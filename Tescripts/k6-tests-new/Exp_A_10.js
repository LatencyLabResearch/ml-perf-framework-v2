/**
 * Exp_A_10 — Peak Load, Endpoint M2 (PATCH /api/orders/:id/status), Isolated
 * Users  : 50 → 300
 * Duration: 10 minutes
 * Pattern : Peak
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '10m', target: 300 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed:   ['rate<0.05'],
  },
};

export default function () {
  const orderId = 1;
  const payload  = JSON.stringify({ status: 'processing' });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-10',
    'x-concurrent-users': String(__VU),
  };

  const res = http.patch(
    `http://localhost:3000/api/orders/${orderId}/status`,
    payload,
    { headers }
  );

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 1500 ms': (r) => r.timings.duration < 1500,
  });

  sleep(1);
}
