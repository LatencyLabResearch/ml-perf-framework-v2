const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../server/config');

fs.mkdirSync(config.logDir, { recursive: true });

const csvFile = path.join(config.logDir, 'request.csv');
const debugFile = path.join(config.logDir, 'request.log');

const csvLogger = winston.createLogger({
  format: winston.format.printf(info => info.message),
  transports: [new winston.transports.File({ filename: csvFile, flags: 'a' })],
});

const debugLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) =>
      `[${timestamp}] ${level.toUpperCase()} ${message}`
    )
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: debugFile, flags: 'a' }),
  ],
});

// Written once by the first instance to start (wx = exclusive open).
// The other two instances get EEXIST and skip silently — no duplicate header.
const HEADER = [
  'request_id',
  'timestamp',
  'instance_id',
  'system_type',
  'traffic_pattern',
  'workload_type',
  'endpoint_group',
  'test_tool',
  'experiment_id',
  'concurrent_users',
  'http_method',
  'endpoint_id',
  'endpoint_complexity',
  'complexity_score',
  'db_query_count',
  'payload_size_kb',
  'cpu_utilization_pct',
  'memory_usage_mb',
  'active_connections',
  'event_loop_lag_ms',
  'rolling_avg_cpu_5s',
  'rolling_avg_latency_5s',
  'p95_latency_5s',
  'p99_latency_5s',
  'req_per_sec',
  'short_term_error_rate',
  'response_time_ms',
  'status_code',
].join(',');

try {
  const fd = fs.openSync(csvFile, 'wx');
  fs.writeSync(fd, HEADER + '\n');
  fs.closeSync(fd);
  console.log(`[${config.instanceId}] CSV header written → ${csvFile}`);
} catch (err) {
  if (err.code !== 'EEXIST') {
    console.error(`[${config.instanceId}] Failed to write CSV header:`, err);
  }
}

module.exports = { csvLogger, debugLogger };