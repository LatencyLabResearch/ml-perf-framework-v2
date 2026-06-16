/**
 * Exp_A_02 — Steady Load, Endpoint L2 (GET /api/orders/:id), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for the second lightweight read endpoint under
 *          stable traffic; counterpart to Exp_A_01.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const orderId = 1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-02',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`http://localhost:3000/api/orders/${orderId}`, { headers });

  check(res, {
    'status is 200':          (r) => r.status === 200,
    'response time < 500 ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
