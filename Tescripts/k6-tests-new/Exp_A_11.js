/**
 * Exp_A_11 — Peak Load, Endpoint H1 (GET /api/reports/user-orders), Isolated
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
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.05'],
  },
};

export default function () {
  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'heavy',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-11',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get('http://localhost:3000/api/reports/user-orders', { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 3000 ms': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
