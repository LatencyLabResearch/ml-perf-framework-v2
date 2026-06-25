const { csvLogger, debugLogger } = require('../config/logger');

function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return (str.includes(',') || str.includes('"') || str.includes('\n'))
        ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildRow(m, e) {
    return [
        m.request_id,
        m.timestamp,
        m.instance_id,
        e.system_type,
        e.traffic_pattern,
        e.workload_type,
        e.endpoint_group,
        e.test_tool,
        e.experiment_id,
        e.concurrent_users,
        m.http_method,
        m.endpoint_id,
        m.endpoint_complexity,
        m.complexity_score,
        m.db_query_count,
        m.payload_size_kb,
        m.cpu_utilization_pct,
        m.memory_usage_mb,
        m.active_connections,
        m.event_loop_lag_ms,
        m.rolling_avg_cpu_5s,
        m.rolling_avg_latency_5s,
        m.p95_latency_5s,
        m.p99_latency_5s,
        m.req_per_sec,
        m.short_term_error_rate,
        m.response_time_ms,
        m.status_code,
    ];
}

module.exports = (req, res, next) => {
    if (req.path === '/health') {
        return next();
    }

    res.on('finish', () => {
        try {
            const m = req._metrics || {};
            const e = req._experiment || {};

            csvLogger.info(buildRow(m, e).map(escapeCSV).join(','));

            debugLogger.info(
                `[${e.experiment_id}] ${m.endpoint_id} | ` +
                `tier=${m.endpoint_complexity}(score=${m.complexity_score} q=${m.db_query_count}) ` +
                `status=${m.status_code} latency=${m.response_time_ms}ms ` +
                `cpu=${m.cpu_utilization_pct}% mem=${m.memory_usage_mb}MB ` +
                `conn=${m.active_connections} rps=${m.req_per_sec}`
            );
        } catch (err) {
            console.error('[requestLogger]', err.message);
        }
    });
    next();
};
