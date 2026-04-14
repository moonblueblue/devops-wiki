---
title: "Rollout Analysis와 자동 롤백"
date: 2026-04-14
tags:
  - argo-rollouts
  - analysis
  - prometheus
  - gitops
sidebar_label: "Analysis·자동 롤백"
---

# Rollout Analysis와 자동 롤백

## 1. AnalysisTemplate 개요

배포 중 메트릭을 자동으로 분석해 성공·실패를 판단한다.
실패 시 자동으로 이전 버전으로 롤백한다.

```
배포 시작
  → AnalysisRun 생성
      → Prometheus / Datadog / CloudWatch 쿼리
          ├── 성공 조건 충족: 다음 단계 진행
          └── 실패 조건 충족: 자동 롤백
```

---

## 2. AnalysisTemplate 작성

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
  - name: service-name    # 동적 파라미터

  metrics:
  - name: success-rate
    interval: 1m           # 1분마다 측정
    count: 5               # 총 5회 측정
    successCondition: result[0] >= 0.95   # 성공: 95% 이상
    failureLimit: 2        # 2회 실패 시 롤백
    provider:
      prometheus:
        address: http://prometheus-server.monitoring.svc
        query: |
          sum(rate(http_requests_total{
            service="{{args.service-name}}",
            status!~"5.."
          }[5m]))
          /
          sum(rate(http_requests_total{
            service="{{args.service-name}}"
          }[5m]))
```

---

## 3. 다양한 메트릭 분석

```yaml
metrics:
# 에러율 분석
- name: error-rate
  interval: 1m
  count: 5
  successCondition: result[0] <= 0.01    # 에러 1% 이하
  provider:
    prometheus:
      query: |
        rate(http_requests_total{
          status=~"5.."
        }[5m])

# P95 레이턴시
- name: latency-p95
  interval: 1m
  count: 5
  successCondition: result[0] <= 500     # 500ms 이하
  provider:
    prometheus:
      query: |
        histogram_quantile(0.95,
          rate(http_request_duration_seconds_bucket[5m])
        ) * 1000

# 웹 훅 (외부 분석 시스템 연동)
- name: load-test
  provider:
    web:
      url: https://test-runner.internal/run?service={{args.service-name}}
      jsonPath: "{$.result}"
  successCondition: result == "pass"
```

---

## 4. Canary에 분석 연동

```yaml
strategy:
  canary:
    steps:
    - setWeight: 20
    - pause: {duration: 5m}
    # 분석 실행 (실패 시 자동 롤백)
    - analysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: my-app-canary
    - setWeight: 50
    - pause: {duration: 10m}
    - analysis:
        templates:
        - templateName: success-rate
        - templateName: latency-check   # 복수 분석 병렬 실행
    - setWeight: 100
```

---

## 5. 배경 분석 (Background Analysis)

모든 단계에 걸쳐 지속적으로 분석한다.

```yaml
strategy:
  canary:
    # 배포 전체 기간 동안 지속 분석
    analysis:
      templates:
      - templateName: success-rate
      startingStep: 2    # 2번째 step부터 분석 시작
      args:
      - name: service-name
        value: my-app-canary
    steps:
    - setWeight: 20
    - pause: {duration: 5m}
    - setWeight: 50
    - pause: {duration: 10m}
    - setWeight: 100
```

---

## 6. 롤백 동작

```
AnalysisRun 실패 감지
  → Rollout 상태: Degraded
      → 트래픽 가중치 즉시 0%로 복원
          → stable 버전 유지
              → 알림 전송 (Notifications)
```

```bash
# 실패한 AnalysisRun 확인
kubectl get analysisrun -n production

# 롤백 결과 확인
kubectl argo rollouts get rollout my-app --watch

# 수동 롤백 강제 실행
kubectl argo rollouts abort my-app
kubectl argo rollouts undo my-app
```

---

## 7. Datadog / CloudWatch 연동

```yaml
# Datadog 메트릭
provider:
  datadog:
    apiVersion: v2
    query: |
      avg:trace.http.request.duration{
        service:my-app,env:production
      }.rollup(avg, 60) < 500

# CloudWatch 메트릭
provider:
  cloudWatch:
    interval: 1m
    metricDataQueries:
    - id: m1
      metricStat:
        metric:
          namespace: MyApp
          metricName: ErrorRate
        stat: Average
        period: 60
      returnData: true
  successCondition: result[0] <= 0.01
```

---

## 참고 문서

- [AnalysisTemplate](https://argoproj.github.io/argo-rollouts/features/analysis/)
- [Prometheus Provider](https://argoproj.github.io/argo-rollouts/analysis/prometheus/)
- [트래픽 관리](https://argoproj.github.io/argo-rollouts/features/traffic-management/)
