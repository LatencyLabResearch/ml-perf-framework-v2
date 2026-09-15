/**
 * Exp_B_14 — Burst Load, Endpoint L2 (GET /api/orders/:id), Isolated
 * Users  : 50 → 500 sudden spike
 * Duration: 5 minutes
 * Pattern : Burst
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

// Base URL for System B (proactive ML-driven backend).
// Override at run time with: k6 run -e BASE_URL=http://otherhost:3000 Exp_B_XX.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 50  },
    { duration: '30s', target: 500 },
    { duration: '4m',  target: 500 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.10'],
  },
};

export default function () {
  const orderId = Math.floor(Math.random()*10)+1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-b',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-B-14',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`${BASE_URL}/api/orders/${orderId}`, { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 2000 ms': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
