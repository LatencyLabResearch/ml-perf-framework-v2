/**
 * Exp_A_16 — Burst Load, Endpoint M2 (PATCH /api/orders/:id/status), Isolated
 * Users  : 50 → 500 sudden spike
 * Duration: 5 minutes
 * Pattern : Burst
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50  },
    { duration: '30s', target: 500 },
    { duration: '4m',  target: 500 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.10'],
  },
};

export default function () {
  const orderId = 1;
  const payload  = JSON.stringify({ status: 'processing' });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-16',
    'x-concurrent-users': String(__VU),
  };

  const res = http.patch(
    `http://localhost:3000/api/orders/${orderId}/status`,
    payload,
    { headers }
  );

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 3000 ms': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
