/**
 * Exp_A_17 — Burst Load, Endpoint H1 (GET /api/reports/user-orders), Isolated
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
    http_req_duration: ['p(95)<5000'],
    http_req_failed:   ['rate<0.10'],
  },
};

export default function () {
  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'heavy',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-17',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get('http://localhost:3000/api/reports/user-orders', { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 5000 ms': (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
