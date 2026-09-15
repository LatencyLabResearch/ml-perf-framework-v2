/**
 * Exp_B_08 — Peak Load, Endpoint L2 (GET /api/orders/:id), Isolated
 * Users  : 50 → 300
 * Duration: 10 minutes
 * Pattern : Peak
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

// Base URL for System B (proactive ML-driven backend).
// Override at run time with: k6 run -e BASE_URL=http://otherhost:3000 Exp_B_XX.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '10m', target: 300 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed:   ['rate<0.05'],
  },
};

export default function () {
  const orderId = 1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-b',
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-B-08',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`${BASE_URL}/api/orders/${orderId}`, { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 1000 ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
