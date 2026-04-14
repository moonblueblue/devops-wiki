---
title: "성능 테스트 (locust, k6, nGrinder)"
date: 2026-04-14
tags:
  - cicd
  - performance-test
  - k6
  - locust
  - ngrinder
sidebar_label: "성능 테스트"
---

# 성능 테스트

## 1. 성능 테스트 유형

| 유형 | 목적 | 특징 |
|-----|------|------|
| **Load Test** | 예상 부하에서 성능 측정 | 정상 트래픽의 2~3배 |
| **Stress Test** | 시스템 한계 탐색 | 점진적 부하 증가 |
| **Spike Test** | 급격한 트래픽 증가 대응 | 순간 폭증 시뮬레이션 |
| **Soak Test** | 장시간 안정성 검증 | 8~24시간 지속 실행 |

---

## 2. k6

Go 기반 스크립트 방식. 가볍고 CI/CD 친화적.

```javascript
// load-test.js
import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // 1분간 50 VU로 증가
    { duration: '3m', target: 50 },   // 3분간 유지
    { duration: '1m', target: 100 },  // 1분간 100 VU로 증가
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },    // 종료
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% 요청 500ms 이내
    http_req_failed: ['rate<0.01'],    // 에러율 1% 미만
    errors: ['rate<0.05'],
  },
};

export default function () {
  const response = http.get('https://api.example.com/users');

  check(response, {
    '상태 200': (r) => r.status === 200,
    '응답 500ms 이내': (r) => r.timings.duration < 500,
  });

  errorRate.add(response.status !== 200);
  sleep(1);
}
```

```yaml
# GitHub Actions
- name: k6 성능 테스트
  uses: grafana/k6-action@v0.3.1
  with:
    filename: tests/load-test.js
  env:
    BASE_URL: https://staging.example.com

- name: 결과 업로드
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: k6-results
    path: summary.json
```

---

## 3. Locust

Python으로 시나리오를 작성하는 부하 테스트 도구.

```python
# locustfile.py
from locust import HttpUser, task, between

class ApiUser(HttpUser):
    wait_time = between(1, 3)  # 요청 사이 대기 (1~3초)
    host = "https://api.example.com"

    def on_start(self):
        # 사용자 로그인
        response = self.client.post("/auth/login", json={
            "username": "testuser",
            "password": "testpass"
        })
        self.token = response.json()["token"]

    @task(3)  # 가중치 3 (더 자주 실행)
    def get_users(self):
        self.client.get(
            "/users",
            headers={"Authorization": f"Bearer {self.token}"}
        )

    @task(1)
    def create_user(self):
        self.client.post(
            "/users",
            json={"name": "Test User", "email": "test@example.com"},
            headers={"Authorization": f"Bearer {self.token}"}
        )
```

```yaml
# GitHub Actions (headless)
- run: pip install locust
- run: |
    locust \
      --headless \
      --users 100 \
      --spawn-rate 10 \
      --run-time 5m \
      --host https://staging.example.com \
      --csv=locust-results \
      --exit-code-on-error 1
```

---

## 4. nGrinder

Naver가 개발한 엔터프라이즈급 성능 테스트 플랫폼.
Groovy 또는 Jython 스크립트를 사용한다.

```groovy
// nGrinder 스크립트 (Groovy)
@RunWith(GrinderRunner)
class TestRunner {

    @BeforeProcess
    static void beforeProcess() {
        HTTPPluginControl.getConnectionDefaults().timeout = 6000
        test1 = new Test(1, "GET /api/users")
        test1.record(runner)
    }

    @Test
    void test1() {
        HTTPResponse response = request1.GET("http://api.example.com/users")
        assertThat(response.statusCode, is(200))
    }
}
```

```
nGrinder 아키텍처:
Controller (웹 UI + 스크립트 관리)
    → Agent 1 (실제 부하 발생)
    → Agent 2
    → Agent 3
```

---

## 5. 성능 테스트 CI/CD 통합 전략

```yaml
name: Performance Tests

on:
  workflow_dispatch:
  schedule:
  - cron: "0 18 * * 1-5"  # 평일 저녁 자동 실행

jobs:
  perf-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: 스테이징 배포 확인
      run: curl -f https://staging.example.com/health

    - name: k6 기본 부하 테스트
      uses: grafana/k6-action@v0.3.1
      with:
        filename: tests/load-test.js

    - name: 결과 분석
      run: |
        # p95 레이턴시 기준 체크
        P95=$(cat summary.json | jq '.metrics.http_req_duration.values["p(95)"]')
        if (( $(echo "$P95 > 500" | bc -l) )); then
          echo "p95 레이턴시 $P95ms > 500ms 기준 초과"
          exit 1
        fi
```

---

## 6. 도구 비교

| 항목 | k6 | Locust | nGrinder |
|-----|-----|--------|---------|
| 언어 | JavaScript | Python | Groovy/Jython |
| CI/CD 연동 | 쉬움 | 보통 | 어려움 |
| UI | 없음 (Grafana) | 웹 UI | 웹 UI |
| 분산 부하 | 지원 | 지원 | 지원 |
| 러닝커브 | 낮음 | 낮음 | 높음 |
| 적합 케이스 | CI/CD 내장 | Python 팀 | 대규모 엔터프라이즈 |

---

## 참고 문서

- [k6 공식 문서](https://grafana.com/docs/k6/)
- [Locust 공식 문서](https://docs.locust.io/)
- [nGrinder](https://naver.github.io/ngrinder/)
