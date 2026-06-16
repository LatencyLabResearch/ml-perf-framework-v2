/**
 * Exp_A_22 — Mixed Load, All Endpoints, Combined
 * Users  : Dynamic 50–700
 * Duration: 15 minutes
 * Pattern : Mixed — multiple traffic shapes within a single run
 * Traffic Distribution: Dynamic Mixed Distribution
 *
 * Stage design simulates a realistic 15-minute window that includes
 * steady, peak, and valley phases — the kind of non-stationary traffic
 * your ML model must learn to handle:
 *
 *   Stage 1 (2 min) : ramp 50 → 200    — morning build-up
 *   Stage 2 (3 min) : hold  200         — steady mid-morning
 *   Stage 3 (2 min) : ramp 200 → 700   — lunch-hour peak
 *   Stage 4 (2 min) : hold  700         — sustained peak
 *   Stage 5 (2 min) : ramp 700 → 150   — post-peak drop
 *   Stage 6 (2 min) : hold  150         — calm period
 *   Stage 7 (2 min) : ramp 150 → 400   — late-afternoon spike
 *
 * Total: 15 minutes.  VU range: 50–700.
 *
 * Traffic distribution shifts dynamically across stages: the ratio of
 * heavy-to-light requests naturally increases under load as more users
 * trigger analytics queries.  The random-roll bucket approach below
 * provides this without hardcoding per-stage distributions.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '2m',  target: 200 }, // ramp up
    { duration: '3m',  target: 200 }, // steady
    { duration: '2m',  target: 700 }, // peak ramp
    { duration: '2m',  target: 700 }, // peak hold
    { duration: '2m',  target: 150 }, // cooldown
    { duration: '2m',  target: 150 }, // valley
    { duration: '2m',  target: 400 }, // secondary spike
  ],
  thresholds: {
    http_req_duration: ['p(95)<4000'],
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3000';

function buildHeaders(experimentId) {
  return {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'mixed',
    'x-workload-type':    'combined',
    'x-test-tool':        'k6',
    'x-experiment-id':    experimentId,
    'x-concurrent-users': String(__VU),
  };
}

export default function () {
  const roll = Math.random();

  if (roll < 0.30) {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/users/1`, { headers });
    check(res, {
      '[L1] status 200':       (r) => r.status === 200,
      '[L1] latency < 2000ms': (r) => r.timings.duration < 2000,
    });

  } else if (roll < 0.60) {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/orders/1`, { headers });
    check(res, {
      '[L2] status 200':       (r) => r.status === 200,
      '[L2] latency < 2000ms': (r) => r.timings.duration < 2000,
    });

  } else if (roll < 0.75) {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ userId: 1, product: 'item', quantity: 1, price: 9.99 });
    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });
    check(res, {
      '[M1] status 201':       (r) => r.status === 201,
      '[M1] latency < 2000ms': (r) => r.timings.duration < 2000,
    });

  } else if (roll < 0.90) {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ status: 'processing' });
    const res = http.patch(`${BASE_URL}/api/orders/1/status`, payload, { headers });
    check(res, {
      '[M2] status 200':       (r) => r.status === 200,
      '[M2] latency < 2000ms': (r) => r.timings.duration < 2000,
    });

  } else if (roll < 0.95) {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });
    check(res, {
      '[H1] status 200':       (r) => r.status === 200,
      '[H1] latency < 4000ms': (r) => r.timings.duration < 4000,
    });

  } else {
    const headers = { ...buildHeaders('Exp-A-22'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/analytics/order-summary`, { headers });
    check(res, {
      '[H2] status 200':       (r) => r.status === 200,
      '[H2] latency < 4000ms': (r) => r.timings.duration < 4000,
    });
  }

  sleep(1);
}
