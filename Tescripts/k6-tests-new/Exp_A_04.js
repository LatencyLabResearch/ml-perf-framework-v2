/**
 * Exp_A_04 — Steady Load, Endpoint M2 (PATCH /api/orders/:id/status), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for a medium-complexity update endpoint (status
 *          mutation) under stable traffic.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const orderId = 1;
  const payload  = JSON.stringify({ status: 'processing' });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-04',
    'x-concurrent-users': String(__VU),
  };

  const res = http.patch(
    `http://localhost:3000/api/orders/${orderId}/status`,
    payload,
    { headers }
  );

  check(res, {
    'status is 200':          (r) => r.status === 200,
    'response time < 800 ms': (r) => r.timings.duration < 800,
  });

  sleep(1);
}
