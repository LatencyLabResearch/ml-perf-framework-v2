import { lookup } from "dns/promises";
import Docker from "dockerode";
import fetch from "node-fetch";

// ── Config ────────────────────────────────────────────────
const POLL_INTERVAL_MS = 5000;
const CPU_SCALE_UP_THRESHOLD = 80;
const CPU_SCALE_DOWN_THRESHOLD = 60;
const SCALE_DOWN_COOLDOWN_MS = 30000;
const NGINX_POOL_URL = "http://nginx:3000/internal/pool";

// ── Instances ────────────────────────────────────────────
const BASE_INSTANCES = [
  { id: "instance1", host: "instance1", port: 3001 },
  { id: "instance2", host: "instance2", port: 3002 },
  { id: "instance3", host: "instance3", port: 3003 },
];

const STANDBY_INSTANCES = [
  { id: "instance4", host: "instance4", port: 3004 },
  { id: "instance5", host: "instance5", port: 3005 },
];

// ── State ────────────────────────────────────────────────
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

let activePool = [...BASE_INSTANCES];
let standbyPool = [...STANDBY_INSTANCES];
let scaledUp = [];
let belowSince = null;
let inCycle = false;

// ── Cache ────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function safeFetch(url, options = {}, timeoutMs = 2000) {
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
  } catch (err) {
    console.warn(`[autoscaler] DNS resolve failed for ${host}: ${err.message}`);
    return host;
  }
}

// ── Instance control ─────────────────────────────────────
async function startInstance(instance) {
  console.log(`[autoscaler] Starting ${instance.id}...`);
  const container = await getContainer(instance.id);
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
    } catch {}
    await sleep(1000);
  }
  throw new Error(`${instance.id} failed health check`);
}

// ── Metrics ──────────────────────────────────────────────
async function fetchCpu(instance) {
  try {
    const res = await safeFetch(
      `http://${instance.host}:${instance.port}/metrics`,
      {},
      2000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.cpu === "number" ? data.cpu : null;
  } catch {
    return null;
  }
}

async function avgCpu(pool) {
  const results = await Promise.all(pool.map(fetchCpu));
  const valid = results.filter(v => typeof v === "number" && !isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ── Nginx sync ───────────────────────────────────────────
async function pushPoolToNginx(pool) {
  const resolvedPool = await Promise.all(
    pool.map(async (p) => ({
      ...p,
      host: await resolveIP(p.host),
    }))
  );
  try {
    await safeFetch(
      NGINX_POOL_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pool: resolvedPool }),
      },
      3000
    );
    console.log(
      `[autoscaler] pool → [${resolvedPool.map(p => `${p.id}@${p.host}`).join(", ")}]`
    );
  } catch (err) {
    console.error("[autoscaler] nginx update failed:", err.message);
  }
}

// ── Cycle ────────────────────────────────────────────────
async function runCycle() {
  if (inCycle) return;
  inCycle = true;
  try {
    const cpu = await avgCpu(activePool);
    if (cpu === null) {
      console.log("[autoscaler] no CPU data");
      return;
    }
    console.log(`[autoscaler] avg CPU: ${cpu.toFixed(1)}%`);

    // Scale up
    if (cpu >= CPU_SCALE_UP_THRESHOLD && standbyPool.length > 0) {
      const next = standbyPool.shift();
      try {
        await startInstance(next);
        activePool.push(next);
        scaledUp.push(next);
        belowSince = null;
        await pushPoolToNginx(activePool);
      } catch (err) {
        standbyPool.unshift(next);
        console.error(`[autoscaler] scale-up failed: ${err.message}`);
      }
      return;
    }

    // Scale down
    if (cpu < CPU_SCALE_DOWN_THRESHOLD && scaledUp.length > 0) {
      if (!belowSince) {
        belowSince = Date.now();
        return;
      }
      if (Date.now() - belowSince < SCALE_DOWN_COOLDOWN_MS) return;

      const victim = scaledUp.pop();
      activePool = activePool.filter(p => p.id !== victim.id);
      await pushPoolToNginx(activePool);
      try {
        await stopInstance(victim);
        standbyPool.push(victim);
      } catch (err) {
        console.error(`[autoscaler] scale-down failed: ${err.message}`);
      }
      belowSince = null;
      return;
    }

    belowSince = null;
  } finally {
    inCycle = false;
  }
}

// ── Entry point ──────────────────────────────────────────
console.log("[autoscaler] starting...");

// Stop standby instances so they're created but not running
for (const instance of STANDBY_INSTANCES) {
  try {
    const container = await getContainer(instance.id);
    const info = await container.inspect();
    if (info.State.Running) {
      console.log(`[autoscaler] stopping standby ${instance.id}...`);
      await container.stop({ t: 5 });
    } else {
      console.log(`[autoscaler] ${instance.id} already stopped (standby ready)`);
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