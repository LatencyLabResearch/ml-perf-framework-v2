/**
 * Exp_A_09 — Peak Load, Endpoint M1 (POST /api/orders), Isolated
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
  const payload = JSON.stringify({
    userId:   1,
    product:  'sample-product',
    quantity: 1,
    price:    9.99,
  });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-09',
    'x-concurrent-users': String(__VU),
  };

  const res = http.post('http://localhost:3000/api/orders', payload, { headers });

  check(res, {
    'status is 201':           (r) => r.status === 201,
    'response time < 1500 ms': (r) => r.timings.duration < 1500,
  });

  sleep(1);
}
