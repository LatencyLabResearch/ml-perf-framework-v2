/**
 * Exp_A_15 — Burst Load, Endpoint M1 (POST /api/orders), Isolated
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
  const payload = JSON.stringify({
    userId:   1,
    product:  'sample-product',
    quantity: 1,
    price:    9.99,
  });

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'medium',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-15',
    'x-concurrent-users': String(__VU),
  };

  const res = http.post('http://localhost:3000/api/orders', payload, { headers });

  check(res, {
    'status is 201':           (r) => r.status === 201,
    'response time < 3000 ms': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
