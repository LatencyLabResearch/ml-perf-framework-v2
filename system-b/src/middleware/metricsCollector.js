const pidusage = require('pidusage');
const crypto = require('crypto');
const config = require('../server/config');

const WINDOW_MS = 5_000;

const requestWindow = [];
const latencyWindow = [];
const errorWindow = [];
const cpuWindow = [];

let activeConnections = 0;
let latestCpu = 0;
let latestMemoryMB = 0;
let latestEventLoopLagMs = 0;

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT CLASSIFICATION TABLE
// Exactly 6 entries — one per endpoint. complexity_score is an ordinal
// numeric feature (1=light, 2=moderate, 3=heavy) used directly by the ML model.
// db_query_count is the expected number of DB round-trips per request — a
// second numeric feature that correlates independently with latency.
// ─────────────────────────────────────────────────────────────────────────────
const ENDPOINT_META = {
    'GET /api/users/:id': { tier: 'light', complexity_score: 1, db_query_count: 1 },
    'GET /api/orders/:id': { tier: 'light', complexity_score: 1, db_query_count: 1 },
    'POST /api/orders': { tier: 'moderate', complexity_score: 2, db_query_count: 2 },
    'PATCH /api/orders/:id/status': { tier: 'moderate', complexity_score: 2, db_query_count: 2 },
    'GET /api/reports/user-orders': { tier: 'heavy', complexity_score: 3, db_query_count: 1 },
    'GET /api/analytics/order-summary': { tier: 'heavy', complexity_score: 3, db_query_count: 3 },
};

function classifyEndpoint(method, normalizedPath) {
    const key = `${method} ${normalizedPath}`;
    return ENDPOINT_META[key] || { tier: 'unknown', complexity_score: 0, db_query_count: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function pruneOld(arr) {
    const cutoff = Date.now() - WINDOW_MS;
    while (arr.length && arr[0].ts < cutoff) arr.shift();
}

function percentile(values, p) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.ceil((p / 100) * sorted.length) - 1] || 0;
}

// Replace numeric path segments with template placeholders so that
// /api/users/42 normalises to /api/users/:id and matches the table above.
function normalizePath(url) {
    return url
        .split('?')[0]
        .replace(/\/\d+/g, '/:id')
        .replace(/\/[0-9a-fA-F-]{36}/g, '/:uuid');
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND SAMPLER  (every 1 s)
// ─────────────────────────────────────────────────────────────────────────────
// find the setInterval in metricsCollector.js and replace it
const ALLOCATED_CORES = 0.5;
const SCALE_FACTOR = 1 / ALLOCATED_CORES;

setInterval(async () => {
    try {
        const stats = await pidusage(process.pid);
        latestCpu = +Math.min(stats.cpu * SCALE_FACTOR, 100).toFixed(2);
        latestMemoryMB = +(stats.memory / 1_048_576).toFixed(2);
        cpuWindow.push({ ts: Date.now(), value: latestCpu });
        pruneOld(cpuWindow);

        const start = process.hrtime.bigint();
        setImmediate(() => {
            latestEventLoopLagMs = +(
                Number(process.hrtime.bigint() - start) / 1e6
            ).toFixed(2);
        });
    } catch (err) {
        console.error('[metricsCollector] sampler error:', err.message);
    }
}, 1_000);

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
module.exports = (req, res, next) => {
    const requestStart = process.hrtime.bigint();
    const now = Date.now();

    activeConnections++;
    requestWindow.push({ ts: now });
    pruneOld(requestWindow);

    // Experiment metadata — populated by k6/JMeter via custom request headers.
    // Defaults to 'unknown' so every CSV row has a value (no sparse features).
    req._experiment = {
        system_type: req.headers['x-system-type'] || 'A',
        traffic_pattern: req.headers['x-traffic-pattern'] || 'unknown',
        workload_type: req.headers['x-workload-type'] || 'unknown',
        endpoint_group: req.headers['x-endpoint-group'] || 'unknown',
        test_tool: req.headers['x-test-tool'] || 'unknown',
        experiment_id: req.headers['x-experiment-id'] || 'unknown',
        concurrent_users: Number(req.headers['x-concurrent-users']) || 0,
    };

    // Compute rolling window statistics at request-arrival time.
    // These capture the system state the request encountered, not the state
    // after it finished — which is what the ML model needs to predict latency.
    const latencyValues = latencyWindow.map(l => l.value);
    const avgLatency = latencyValues.length
        ? latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length : 0;
    const avgCpu = cpuWindow.length
        ? cpuWindow.reduce((a, b) => a + b.value, 0) / cpuWindow.length : latestCpu;

    const normalizedPath = `${normalizePath(req.path)}`;
    const endpointKey = `${req.method} ${normalizedPath}`;
    const { tier, complexity_score, db_query_count } = classifyEndpoint(req.method, normalizedPath);

    req._metrics = {
        request_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        instance_id: config.instanceId,

        http_method: req.method,
        endpoint_id: endpointKey,
        endpoint_complexity: tier,
        complexity_score,
        db_query_count,
        payload_size_kb: req.headers['content-length']
            ? +(req.headers['content-length'] / 1024).toFixed(3)
            : 0,

        cpu_utilization_pct: latestCpu,
        memory_usage_mb: latestMemoryMB,
        active_connections: activeConnections,
        event_loop_lag_ms: latestEventLoopLagMs,

        rolling_avg_cpu_5s: +avgCpu.toFixed(2),
        rolling_avg_latency_5s: +avgLatency.toFixed(2),
        p95_latency_5s: +percentile(latencyValues, 95).toFixed(2),
        p99_latency_5s: +percentile(latencyValues, 99).toFixed(2),
        req_per_sec: +(requestWindow.length / (WINDOW_MS / 1_000)).toFixed(2),
        short_term_error_rate: requestWindow.length
            ? +((errorWindow.length / requestWindow.length) * 100).toFixed(2)
            : 0,

        response_time_ms: 0,   // filled on 'finish'
        status_code: 0,
    };

    res.on('finish', () => {
        try {
            const finishTs = Date.now();
            const latencyMs = Number(process.hrtime.bigint() - requestStart) / 1e6;

            latencyWindow.push({ ts: finishTs, value: latencyMs });
            pruneOld(latencyWindow);

            if (res.statusCode >= 500) {
                errorWindow.push({ ts: finishTs });
                pruneOld(errorWindow);
            }

            req._metrics.response_time_ms = +latencyMs.toFixed(2);
            req._metrics.status_code = res.statusCode;
        } finally {
            activeConnections--;
        }
    });

    next();
};