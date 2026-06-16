/**
 * Exp_A_06 — Steady Load, Endpoint H2 (GET /api/analytics/order-summary), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for the heaviest analytics endpoint under stable traffic.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed:   ['rate<0.01'],
  },
};

export default function () {
  const headers = {
    'Content-Type':       'application/json',
    'x-system-type':      'system-a',
    'x-traffic-pattern':  'steady',
    'x-workload-type':    'isolated',
    'x-endpoint-group':   'heavy',
    'x-test-tool':        'k6',
    'x-experiment-id':    'Exp-A-06',
    'x-concurrent-users': String(__VU),
  };

  const res = http.get('http://localhost:3000/api/analytics/order-summary', { headers });

  check(res, {
    'status is 200':           (r) => r.status === 200,
    'response time < 2000 ms': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
