/**
 * Exp_A_02 — Steady Load, Endpoint L2 (GET /api/orders/:id), Isolated
 * Users  : 50 (constant)
 * Duration: 10 minutes
 * Pattern : Steady
 *
 * Purpose: Baseline for the second lightweight read endpoint under
 *          stable traffic; counterpart to Exp_A_01.
 */

import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 50,
  duration: '10m',

  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed:   [{ threshold: 'rate<0.01', abortOnFail: false }], // won't crash the test run
  },
};

// Retries the request up to maxRetries times if it fails
function getWithRetry(url, params, maxRetries = 2) {
  let res;
  for (let i = 0; i <= maxRetries; i++) {
    res = http.get(url, params);
    if (res.status === 200) break;
    sleep(0.3); // small pause before retrying
  }
  return res;
}

export default function () {
  const orderId = Math.floor(Math.random() * 10) + 1;

  const params = {
    headers: {
      'Content-Type':       'application/json',
      'x-system-type':      'system-a',
      'x-traffic-pattern':  'steady',
      'x-workload-type':    'isolated',
      'x-endpoint-group':   'lightweight',
      'x-test-tool':        'k6',
      'x-experiment-id':    'Exp-A-02',
      'x-concurrent-users': String(__VU),
    },
    timeout: '5s', // fail fast instead of hanging indefinitely
  };

  const res = getWithRetry(
    `http://localhost:3000/api/orders/${orderId}`,
    params
  );

  check(res, {
    'status is 200':          (r) => r.status === 200,
    'response time < 500 ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}