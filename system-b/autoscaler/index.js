import { lookup } from "dns/promises";
import Docker from "dockerode";
import fetch from "node-fetch";

// ── Config ────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000;
// Adjusted for cluster average matching typical research benchmark targets
const CPU_SCALE_UP_THRESHOLD = 70;   
const CPU_SCALE_DOWN_THRESHOLD = 40; 
const SCALE_DOWN_COOLDOWN_MS = 30000;
const SCALE_UP_COOLDOWN_MS = 30000;

const NGINX_POOL_URL = "http://nginx:3000/internal/pool";

// ── Instances ────────────────────────────────────────────
const BASE_INSTANCES = [
  { id: "instance1", host: "instance1", port: 3001 },
  { id: "instance2", host: "instance2", port: 3002 },
];

const STANDBY_INSTANCES = [
  { id: "instance3", host: "instance3", port: 3003 },
  { id: "instance4", host: "instance4", port: 3004 },
  { id: "instance5", host: "instance5", port: 3005 },
];

const BASE_IDS = new Set(BASE_INSTANCES.map(i => i.id));

// ── State ────────────────────────────────────────────────
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

let activePool = [...BASE_INSTANCES];
let standbyPool = [...STANDBY_INSTANCES];
let belowSince = null;
let inCycle = false;
let lastScaleUpTime = 0;

// ── Container cache ──────────────────────────────────────
const containerCache = new Map();

async function getContainer(id) {
  if (containerCache.has(id)) return containerCache.get(id);
  const containers = await docker.listContainers({ all: true });
  const info = containers.find(c => c.Names.some(n => n.includes(id)));
  if (!info) throw new Error(`Container not found: ${id}`);
  const container = docker.getContainer(info.Id);
  containerCache.set(id, container);
  return container;
}

async function refreshContainer(id) {
  containerCache.delete(id);
  return getContainer(id);
}

// ── Helpers ──────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function safeFetch(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveIP(host) {
  try {
    const { address } = await lookup(host);
    return address;
  } catch {
    return host;
  }
}

// ── Instance control ─────────────────────────────────────
async function startInstance(instance) {
  console.log(`[autoscaler] Starting ${instance.id}...`);
  const container = await refreshContainer(instance.id);
  await container.start();
  await waitUntilHealthy(instance);
  console.log(`[autoscaler] ${instance.id} is healthy`);
}

async function stopInstance(instance) {
  console.log(`[autoscaler] Stopping ${instance.id}...`);
  const container = await getContainer(instance.id);
  await container.stop({ t: 10 });
  console.log(`[autoscaler] ${instance.id} stopped`);
}

async function waitUntilHealthy(instance, timeoutMs = 30000) {
  const url = `http://${instance.host}:${instance.port}/health`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await safeFetch(url, {}, 2000);
      if (res.ok) return;
    } catch { }
    await sleep(1000);
  }
  throw new Error(`${instance.id} failed health check`);
}

// ── CPU via /metrics endpoint ────────────────────────────
async function fetchCpu(instance) {
  try {
    const res = await safeFetch(
      `http://${instance.host}:${instance.port}/metrics`,
      {},
      2000
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return typeof data.cpu === "number" ? data.cpu : 0;
  } catch {
    return 0;
  }
}

// ── Nginx sync ───────────────────────────────────────────
async function pushPoolToNginx(pool) {
  const resolvedPool = await Promise.all(
    pool.map(async p => ({ ...p, host: await resolveIP(p.host) }))
  );
  try {
    await safeFetch(NGINX_POOL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool: resolvedPool }),
    });
    console.log(`[autoscaler] pool → ${resolvedPool.map(p => p.id).join(", ")}`);
  } catch (err) {
    console.error("[autoscaler] nginx update failed:", err.message);
  }
}

// ── Main cycle ───────────────────────────────────────────
async function runCycle() {
  if (inCycle) return;
  inCycle = true;

  try {
    // Fetch all CPUs individually
    const cpuResults = await Promise.allSettled(
      activePool.map(async instance => {
        const cpu = await fetchCpu(instance);
        return { id: instance.id, cpu };
      })
    );

    const cpuValues = cpuResults
      .filter(r => r.status === "fulfilled")
      .map(r => r.value);

    // Log individual instance loads
    const cpuLog = cpuValues
      .map(r => `${r.id}=${r.cpu.toFixed(1)}%`)
      .join(" | ");

    console.log(`[autoscaler] CPU → ${cpuLog}`);

    // 🔥 CALCULATE AVERAGE CLUSTER CPU LOAD
    const avg = cpuValues.length > 0
      ? cpuValues.reduce((sum, r) => sum + r.cpu, 0) / cpuValues.length
      : 0;

    console.log(`[autoscaler] average CPU: ${avg.toFixed(1)}%`);

    // ── Scale up ─────────────────────────────────────────
    if (avg >= CPU_SCALE_UP_THRESHOLD && standbyPool.length > 0) {
      const timeSinceLastScaleUp = Date.now() - lastScaleUpTime;

      // Safe thresholds scaled around cluster-wide averages
      const requiredCooldown = avg >= 85
        ? 10000 
        : SCALE_UP_COOLDOWN_MS;

      if (timeSinceLastScaleUp < requiredCooldown) {
        console.log(
          `[autoscaler] scale-up cooldown active ` +
          `(${Math.ceil((requiredCooldown - timeSinceLastScaleUp) / 1000)}s remaining), skipping...`
        );
        return;
      }

      const target = standbyPool.shift();
      try {
        await startInstance(target);
        activePool.push(target);
        await pushPoolToNginx(activePool);
        belowSince = null;
        lastScaleUpTime = Date.now();
        console.log(`[autoscaler] scaled UP → ${target.id}`);
      } catch (err) {
        standbyPool.unshift(target);
        console.error(`[autoscaler] scale-up failed: ${err.message}`);
      }
      return;
    }

    // ── Scale down ────────────────────────────────────────────
    if (avg < CPU_SCALE_DOWN_THRESHOLD && activePool.length > BASE_INSTANCES.length) {
      if (!belowSince) {
        belowSince = Date.now();
        return;
      }
      if (Date.now() - belowSince < SCALE_DOWN_COOLDOWN_MS) return;

      const victim = activePool.find(i => !BASE_IDS.has(i.id));
      if (!victim) { belowSince = null; return; }

      activePool = activePool.filter(i => i.id !== victim.id);
      await pushPoolToNginx(activePool);
      await sleep(5000);

      try {
        await stopInstance(victim);
        standbyPool.push(victim);
        console.log(`[autoscaler] scaled DOWN → removed ${victim.id}`);
      } catch (err) {
        console.error(`[autoscaler] scale-down failed: ${err.message}`);
      }

      belowSince = Date.now();
      return;                  
    }

    belowSince = null;
  } finally {
    inCycle = false;
  }
}

// ── Startup ───────────────────────────────────────────────
console.log("[autoscaler] starting...");

for (const instance of STANDBY_INSTANCES) {
  try {
    const container = await getContainer(instance.id);
    const info = await container.inspect();
    if (info.State.Running) {
      console.log(`[autoscaler] stopping standby ${instance.id}...`);
      await container.stop({ t: 5 });
    } else {
      console.log(`[autoscaler] ${instance.id} already stopped`);
    }
  } catch (err) {
    console.warn(`[autoscaler] could not stop ${instance.id}: ${err.message}`);
  }
}

await pushPoolToNginx(activePool);
console.log("[autoscaler] running...");

while (true) {
  await runCycle();
  await sleep(POLL_INTERVAL_MS);
}