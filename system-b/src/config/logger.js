const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../server/config');

fs.mkdirSync(config.logDir, { recursive: true });

// One file PER INSTANCE -> no two processes ever write to the same file.
// e.g. request-instance-1.csv, request-instance-2.csv, request-instance-3.csv
const csvFile = path.join(config.logDir, `request-${config.instanceId}.csv`);
const debugFile = path.join(config.logDir, `request-${config.instanceId}.log`);

const HEADER = [
  'request_id',
  'timestamp',
  'instance_id',
  'instance_count',
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

// Write the header BEFORE creating the winston transport, and only when the
// file is missing or empty. This instance is the only writer, so there is no race.
try {
  if (!fs.existsSync(csvFile) || fs.statSync(csvFile).size === 0) {
    fs.writeFileSync(csvFile, HEADER + '\n');
    console.log(`[${config.instanceId}] CSV header written -> ${csvFile}`);
  }
} catch (err) {
  console.error(`[${config.instanceId}] Failed to write CSV header:`, err);
}

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

module.exports = { csvLogger, debugLogger };