/**
 * Exp_B_05 — Steady Load, Endpoint H1 (GET /api/reports/user-orders), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for a heavy read endpoint (cross-table report) under
 *          stable traffic.  Higher thresholds reflect expected DB join cost.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

// Base URL for System B (proactive ML-driven backend).
// Override at run time with: k6 run -e BASE_URL=http://otherhost:3000 Exp_B_XX.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<2000'], // heavy endpoints — allow 2 s
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-b',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'heavy',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-B-05',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 2000 ms': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
