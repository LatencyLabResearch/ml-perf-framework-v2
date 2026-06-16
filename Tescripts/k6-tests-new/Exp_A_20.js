/**
 * Exp_A_20 — Peak Load, All Endpoints, Combined
 * Users  : 100 → 500
 * Duration: 10 minutes
 * Pattern : Peak
 * Traffic Distribution: L1:30%, L2:30%, M1:15%, M2:15%, H1:5%, H2:5%
 *
 * Identical weighted routing logic as Exp_A_19, but with a VU ramp
 * from 100 → 500 over the full 10-minute window.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '10m', target: 500 }, // ramp 100 → 500
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
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'combined',
    'x-test-tool':        'k6',
    'x-experiment-id':    experimentId,
    'x-concurrent-users': String(__VU),
  };
}

export default function () {
  const roll = Math.random();

  if (roll < 0.30) {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/users/1`, { headers });
    check(res, {
      '[L1] status 200':       (r) => r.status === 200,
      '[L1] latency < 1000ms': (r) => r.timings.duration < 1000,
    });

  } else if (roll < 0.60) {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'lightweight' };
    const res = http.get(`${BASE_URL}/api/orders/1`, { headers });
    check(res, {
      '[L2] status 200':       (r) => r.status === 200,
      '[L2] latency < 1000ms': (r) => r.timings.duration < 1000,
    });

  } else if (roll < 0.75) {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ userId: 1, product: 'item', quantity: 1, price: 9.99 });
    const res = http.post(`${BASE_URL}/api/orders`, payload, { headers });
    check(res, {
      '[M1] status 201':       (r) => r.status === 201,
      '[M1] latency < 1500ms': (r) => r.timings.duration < 1500,
    });

  } else if (roll < 0.90) {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'medium' };
    const payload = JSON.stringify({ status: 'processing' });
    const res = http.patch(`${BASE_URL}/api/orders/1/status`, payload, { headers });
    check(res, {
      '[M2] status 200':       (r) => r.status === 200,
      '[M2] latency < 1500ms': (r) => r.timings.duration < 1500,
    });

  } else if (roll < 0.95) {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/reports/user-orders`, { headers });
    check(res, {
      '[H1] status 200':       (r) => r.status === 200,
      '[H1] latency < 3000ms': (r) => r.timings.duration < 3000,
    });

  } else {
    const headers = { ...buildHeaders('Exp-A-20'), 'x-endpoint-group': 'heavy' };
    const res = http.get(`${BASE_URL}/api/analytics/order-summary`, { headers });
    check(res, {
      '[H2] status 200':       (r) => r.status === 200,
      '[H2] latency < 3000ms': (r) => r.timings.duration < 3000,
    });
  }

  sleep(1);
}
