/**
 * Exp_B_03 — Steady Load, Endpoint M1 (POST /api/orders), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for a medium-complexity write endpoint (order
 *          creation) under stable traffic.  POST bodies are included
 *          to produce realistic server-side processing.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

// Base URL for System B (proactive ML-driven backend).
// Override at run time with: k6 run -e BASE_URL=http://otherhost:4000 Exp_B_XX.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<800'],  // writes are slower — allow 800 ms
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    user_id: Math.floor(Math.random() * 10) + 1, // 1-10
    product: `product-${Math.floor(Math.random() * 1000)}`,
    quantity: Math.floor(Math.random() * 10) + 1, // 1-10
    amount: Number((Math.random() * 100 + 1).toFixed(2)), // 1.00-100.99
  });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-b',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-B-03',
    'x-concurrent-users': String(__VU),
  };

  const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });

  check(res, {
    'status is 201':          (r) => r.status === 201,
    'response time < 800 ms': (r) => r.timings.duration < 800,
  });

  sleep(1);
}
