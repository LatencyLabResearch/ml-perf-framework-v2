/**
 * Exp_A_19 — Steady Load, All Endpoints, Combined
 * Users  : 100 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 * Traffic Distribution:
 *   L1 (GET /api/users/:id)               → 30 %
 *   L2 (GET /api/orders/:id)              → 30 %
 *   M1 (POST /api/orders)                 → 15 %
 *   M2 (PATCH /api/orders/:id/status)     → 15 %
 *   H1 (GET /api/reports/user-orders)     →  5 %
 *   H2 (GET /api/analytics/order-summary) →  5 %
 *
 * How the weighted distribution works:
 *   Math.random() returns a value in [0, 1).
 *   We split that range into buckets proportional to the weights above.
 *   Each VU independently rolls the dice on every iteration, so the
 *   distribution converges to the spec as iteration count grows.
 *
 *   Bucket mapping:
 *     [0.00, 0.30) → L1
 *     [0.30, 0.60) → L2
 *     [0.60, 0.75) → M1
 *     [0.75, 0.90) → M2
 *     [0.90, 0.95) → H1
 *     [0.95, 1.00) → H2
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 100,
  duration: '10m',

  thresholds: {
    // Mixed workload — use a composite threshold
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000';

// Shared request defaults — only the experiment-specific fields change per call
function buildHeaders(experimentId) {
  return {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'combined',
    'x-test-tool':        'k6',
    'x-experiment-id':    experimentId,
    'x-concurrent-users': String(__VU),
  };
}

export default function () {
  const roll = Math.random(); // uniform [0, 1)

  if (roll < 0.30) {
    // --- L1: GET /api/users/:id  (30 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/users/1`, { headers });
    check(res, {
      '[L1] status 200':        (r) => r.status === 200,
      '[L1] latency < 500 ms':  (r) => r.timings.duration < 500,
    });

  } else if (roll < 0.60) {
    // --- L2: GET /api/orders/:id  (30 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/orders/1`, { headers });
    check(res, {
      '[L2] status 200':        (r) => r.status === 200,
      '[L2] latency < 500 ms':  (r) => r.timings.duration < 500,
    });

  } else if (roll < 0.75) {
    // --- M1: POST /api/orders  (15 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ userId: 1, product: 'item', quantity: 1, price: 9.99 });
    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });
    check(res, {
      '[M1] status 201':        (r) => r.status === 201,
      '[M1] latency < 800 ms':  (r) => r.timings.duration < 800,
    });

  } else if (roll < 0.90) {
    // --- M2: PATCH /api/orders/:id/status  (15 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ status: 'processing' });
    const res = http.patch(`${BASE_URL}/api/orders/1/status`, payload, { headers });
    check(res, {
      '[M2] status 200':        (r) => r.status === 200,
      '[M2] latency < 800 ms':  (r) => r.timings.duration < 800,
    });

  } else if (roll < 0.95) {
    // --- H1: GET /api/reports/user-orders  (5 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });
    check(res, {
      '[H1] status 200':         (r) => r.status === 200,
      '[H1] latency < 2000 ms':  (r) => r.timings.duration < 2000,
    });

  } else {
    // --- H2: GET /api/analytics/order-summary  (5 %) ---
    const headers = { ...buildHeaders('Exp-A-19'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/analytics/order-summary`, { headers });
    check(res, {
      '[H2] status 200':         (r) => r.status === 200,
      '[H2] latency < 2000 ms':  (r) => r.timings.duration < 2000,
    });
  }

  sleep(1);
}
