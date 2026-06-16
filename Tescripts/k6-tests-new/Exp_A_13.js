/**
 * Exp_A_13 — Burst Load, Endpoint L1 (GET /api/users/:id), Isolated
 * Users  : 50 → 500 sudden spike
 * Duration: 5 minutes
 * Pattern : Burst — a very short ramp to simulate an instantaneous spike
 *
 * How the burst is modelled:
 *   Stage 1 (30 s) : hold at 50 VUs — "normal" period before the spike
 *   Stage 2 (30 s) : ramp sharply to 500 VUs — the burst itself
 *   Stage 3 (4 min): hold at 500 VUs — sustained high load after spike
 *
 * The 30-second ramp is the closest k6 stages can get to "sudden":
 * a 0 s duration stage is legal but some runners treat it as 1 s.
 * Use { duration: '1s', target: 500 } for an even sharper spike if needed.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50  }, // baseline
    { duration: '30s', target: 500 }, // burst spike
    { duration: '4m',  target: 500 }, // sustain
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // burst may push latency high
    http_req_failed:   ['rate<0.10'],  // allow up to 10 % errors during burst
  },
};

export default function () {
  const userId = 1;

  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'burst',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'lightweight',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-13',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get(`http://localhost:3000/api/users/${userId}`, { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 2000 ms': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
