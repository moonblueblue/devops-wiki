---
title: "부하 테스트 도구 (k6, Locust)"
date: 2026-04-14
tags:
  - sre
  - load-testing
  - k6
  - locust
sidebar_label: "부하 테스트"
---

# 부하 테스트 도구 (k6, Locust)

## 1. 도구 비교

| 항목 | k6 | Locust |
|------|-----|--------|
| 언어 | JavaScript | Python |
| 분산 실행 | k6 Cloud / Operator | 내장 |
| 프로토콜 | HTTP, gRPC, WS | HTTP (확장 가능) |
| 메트릭 | Prometheus 내장 | 커스텀 |
| CI 통합 | 쉬움 | 보통 |

---

## 2. k6

### 기본 스크립트

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Steady state
    { duration: '2m', target: 200 },  // Spike
    { duration: '5m', target: 200 },  // Spike steady
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95%ile < 500ms
    errors: ['rate<0.01'],             // 오류율 < 1%
  },
};

export default function () {
  const res = http.post(
    'https://api.example.com/payment',
    JSON.stringify({ amount: 1000 }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'transaction id exists': (r) =>
      JSON.parse(r.body).transaction_id !== '',
  });

  errorRate.add(res.status !== 200);
  sleep(1);
}
```

### 실행

```bash
# 로컬 실행
k6 run load-test.js

# Prometheus 메트릭 내보내기
K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write \
k6 run --out=experimental-prometheus-rw load-test.js
```

---

## 3. Locust

```python
# locustfile.py
from locust import HttpUser, task, between

class PaymentUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # 로그인
        self.client.post('/login', json={
            'username': 'test',
            'password': 'test'
        })

    @task(3)
    def get_balance(self):
        self.client.get('/api/balance')

    @task(1)
    def make_payment(self):
        with self.client.post(
            '/api/payment',
            json={'amount': 1000, 'recipient': 'user2'},
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"결제 실패: {response.text}")
```

```bash
# UI 모드
locust -f locustfile.py --host=https://api.example.com

# Headless 모드
locust -f locustfile.py \
  --host=https://api.example.com \
  --users=200 \
  --spawn-rate=10 \
  --run-time=10m \
  --headless \
  --html=report.html
```

---

## 4. k6 Kubernetes Operator

```yaml
# K6 분산 부하 테스트
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: payment-load-test
spec:
  parallelism: 5    # 5개 Pod에서 동시 실행
  script:
    configMap:
      name: load-test-script
      file: load-test.js
  arguments: --vus 100 --duration 5m
```

---

## 5. CI 통합

```yaml
# GitHub Actions 부하 테스트
- name: k6 부하 테스트
  uses: grafana/k6-action@v0.3.1
  with:
    filename: load-tests/payment.js
  env:
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}

- name: 임계값 초과 시 실패
  run: |
    if [ $? -ne 0 ]; then
      echo "부하 테스트 임계값 초과 — 배포 차단"
      exit 1
    fi
```

---

## 참고 문서

- [k6 공식 문서](https://k6.io/docs/)
- [Locust 공식 문서](https://docs.locust.io/)
- [k6 Kubernetes Operator](https://k6.io/blog/running-distributed-tests-on-k8s/)
