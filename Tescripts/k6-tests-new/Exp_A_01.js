/**
 * Exp_A_01 — Steady Load, Endpoint L1 (GET /api/users/:id), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady — constant virtual-user count throughout the run
 *
 * Purpose: Establish a clean latency baseline for a lightweight read
 *          endpoint under stable, predictable traffic.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,           // 50 concurrent virtual users
  duration: '10m',   // run for 10 minutes

  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95th-percentile latency < 500 ms
    http_req_failed:   ['rate<0.01'],  // error rate < 1 %
  },
};

export default function () {
  // A fixed user ID is used so every iteration hits the same endpoint shape.
  // Change to a random ID if your backend requires unique IDs.
  const userId = 1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-01',
    'x-concurrent-users': String(__VU),   // current virtual-user number
  };

  const res = http.get(`http://localhost:3000/api/users/${userId}`, { headers });

  check(res, {
    'status is 200':          (r) => r.status === 200,
    'response time < 500 ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // 1-second think-time between iterations per VU
}
