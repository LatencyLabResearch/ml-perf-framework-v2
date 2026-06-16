/**
 * Exp_A_23 — Mixed Stress Load, All Endpoints, Combined
 * Users  : Dynamic 100–1200
 * Duration: 15 minutes
 * Pattern : Mixed Stress — the most demanding experiment in the suite
 * Traffic Distribution: Dynamic Mixed Distribution
 *
 * This is a stress test variant of Exp_A_22.  The VU ceiling is pushed
 * to 1200 to discover breaking points, tail-latency cliffs, and error
 * rate thresholds.  Stage pacing is more aggressive: ramps are shorter
 * and peak plateaus are longer to keep the system under sustained stress.
 *
 * Stage design:
 *   Stage 1 (1 min) : ramp 100 → 300    — quick warm-up
 *   Stage 2 (2 min) : hold  300          — light stress
 *   Stage 3 (2 min) : ramp 300 → 800    — heavy ramp
 *   Stage 4 (2 min) : hold  800          — heavy stress hold
 *   Stage 5 (2 min) : ramp 800 → 1200   — stress peak
 *   Stage 6 (3 min) : hold  1200         — max stress — key observation window
 *   Stage 7 (3 min) : ramp 1200 → 100   — cool-down / recovery observation
 *
 * Total: 15 minutes.  VU range: 100–1200.
 *
 * Thresholds are intentionally loose — this experiment is designed to
 * reveal system behaviour under extreme load, not to "pass" a gate.
 * Capture raw data; SLO analysis is done in the report.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '1m',  target: 300  }, // warm-up ramp
    { duration: '2m',  target: 300  }, // light stress
    { duration: '2m',  target: 800  }, // heavy ramp
    { duration: '2m',  target: 800  }, // heavy hold
    { duration: '2m',  target: 1200 }, // stress peak ramp
    { duration: '3m',  target: 1200 }, // max stress hold
    { duration: '3m',  target: 100  }, // recovery
  ],
  thresholds: {
    // Loose thresholds for observation only — don't treat a breach as failure
    http_req_duration: ['p(95)<8000'],
    http_req_failed:   ['rate<0.30'],
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
    // L1: GET /api/users/:id  (30 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/users/1`, { headers });
    check(res, {
      '[L1] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.60) {
    // L2: GET /api/orders/:id  (30 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/orders/1`, { headers });
    check(res, {
      '[L2] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.75) {
    // M1: POST /api/orders  (15 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ userId: 1, product: 'item', quantity: 1, price: 9.99 });
    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });
    check(res, {
      '[M1] status 201': (r) => r.status === 201,
    });

  } else if (roll < 0.90) {
    // M2: PATCH /api/orders/:id/status  (15 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ status: 'processing' });
    const res = http.patch(`${BASE_URL}/api/orders/1/status`, payload, { headers });
    check(res, {
      '[M2] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.95) {
    // H1: GET /api/reports/user-orders  (5 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });
    check(res, {
      '[H1] status 200': (r) => r.status === 200,
    });

  } else {
    // H2: GET /api/analytics/order-summary  (5 %)
    const headers = { ...buildHeaders('Exp-A-23'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/analytics/order-summary`, { headers });
    check(res, {
      '[H2] status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
