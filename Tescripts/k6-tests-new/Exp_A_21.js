/**
 * Exp_A_21 — Burst Load, All Endpoints, Combined
 * Users  : 100 → 1000 sudden spike
 * Duration: 5 minutes
 * Pattern : Burst
 * Traffic Distribution: L1:30%, L2:30%, M1:15%, M2:15%, H1:5%, H2:5%
 *
 * Stage design mirrors the isolated burst experiments (A_13–A_18):
 *   Stage 1 (30 s) : hold 100 VUs    — pre-spike baseline
 *   Stage 2 (30 s) : ramp to 1000    — burst spike
 *   Stage 3 (4 min): hold at 1000    — post-spike observation
 *
 * At 1000 VUs, the system is under extreme stress.  Thresholds are
 * deliberately relaxed to capture behaviour, not to "pass" the test.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100  },
    { duration: '30s', target: 1000 },
    { duration: '4m',  target: 1000 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<6000'],
    http_req_failed:   ['rate<0.20'],  // high burst — observe, don't gate
  },
};

const BASE_URL = 'http://localhost:3000';

function buildHeaders(experimentId) {
  return {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'combined',
    'x-test-tool':        'k6',
    'x-experiment-id':    experimentId,
    'x-concurrent-users': String(__VU),
  };
}

export default function () {
  const roll = Math.random();

  if (roll < 0.30) {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/users/1`, { headers });
    check(res, {
      '[L1] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.60) {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/orders/1`, { headers });
    check(res, {
      '[L2] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.75) {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ userId: 1, product: 'item', quantity: 1, price: 9.99 });
    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });
    check(res, {
      '[M1] status 201': (r) => r.status === 201,
    });

  } else if (roll < 0.90) {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ status: 'processing' });
    const res = http.patch(`${BASE_URL}/api/orders/1/status`, payload, { headers });
    check(res, {
      '[M2] status 200': (r) => r.status === 200,
    });

  } else if (roll < 0.95) {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });
    check(res, {
      '[H1] status 200': (r) => r.status === 200,
    });

  } else {
    const headers = { ...buildHeaders('Exp-A-21'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/analytics/order-summary`, { headers });
    check(res, {
      '[H2] status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}
