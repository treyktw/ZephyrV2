// benchmarks/k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Ramp up
    { duration: '3m', target: 20 },   // Stay at peak
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must finish within 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% can fail
  },
};

const BASE_URL = 'http://localhost';

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`],
    ['GET', `${BASE_URL}/api/features`],
  ]);

  check(responses[0], {
    'health check status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
