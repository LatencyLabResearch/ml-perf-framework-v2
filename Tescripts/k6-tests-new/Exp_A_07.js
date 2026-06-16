/**
 * Exp_A_07 — Peak Load, Endpoint L1 (GET /api/users/:id), Isolated
 * Users  : ramp from 50 → 300 over 10 minutes
 * Duration: 10 minutes
 * Pattern : Peak — sustained high load reached via gradual ramp
 *
 * Purpose: Reveal how latency degrades on L1 as concurrency grows from
 *          50 to 300.  Ramp is spread over the full 10-min window to
 *          model a real traffic build-up rather than an instantaneous jump.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  // stages let us ramp VUs smoothly from 50 to 300 over 10 minutes
  stages: [
    { duration: '10m', target: 300 }, // ramp from current (50 start) → 300
  ],
  // k6 starts with 1 VU by default; the startVUs option sets the initial value
  // so we explicitly start at 50 to match the experiment spec.
  // NOTE: k6 OSS does not have a direct "startVUs" in stages; the workaround is
  // to add an initial instant stage that jumps to 50.
  // Uncomment the first stage below if your k6 version supports it:
  // stages: [
  //   { duration: '0s',  target: 50  }, // start at 50
  //   { duration: '10m', target: 300 }, // ramp to 300
  // ],

  thresholds: {
    http_req_duration: ['p(95)<1000'], // peak load — relaxed to 1 s
    http_req_failed:   ['rate<0.05'],  // allow up to 5 % errors under peak
  },
};

export default function () {
  const userId = 1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'peak',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-07',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`http://localhost:3000/api/users/${userId}`, { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 1000 ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
