---
title: "PromQL 기본"
date: 2026-04-14
tags:
  - prometheus
  - promql
  - observability
sidebar_label: "PromQL"
---

# PromQL 기본

## 1. 데이터 타입

| 타입 | 설명 | 예 |
|-----|------|-----|
| Instant Vector | 현재 시점의 값 집합 | `http_requests_total` |
| Range Vector | 시간 범위의 값 집합 | `http_requests_total[5m]` |
| Scalar | 단일 숫자 | `1024` |
| String | 문자열 | `"hello"` |

---

## 2. 레이블 필터링

```promql
# 정확히 일치
http_requests_total{status="200"}

# 일치하지 않음
http_requests_total{status!="200"}

# 정규식 일치
http_requests_total{status=~"2.."}     # 2xx 응답
http_requests_total{status!~"2.."}    # 2xx 제외

# 복수 조건 (AND)
http_requests_total{job="api", status="500"}
```

---

## 3. 함수

### rate() — 초당 변화율

Counter 메트릭의 초당 증가율을 계산한다.
요청/초, 에러/초 계산에 사용한다.

```promql
# 5분간 평균 초당 요청 수
rate(http_requests_total[5m])

# 5분간 평균 에러율
rate(http_requests_total{status=~"5.."}[5m])
  /
rate(http_requests_total[5m])
```

### irate() — 순간 변화율

마지막 두 샘플로 순간 변화율을 계산한다.
스파이크 감지에 유용하다.

```promql
irate(http_requests_total[5m])
```

### increase() — 증가량

시간 범위 동안의 총 증가량.

```promql
# 1시간 동안 총 요청 수
increase(http_requests_total[1h])
```

---

## 4. 집계 함수

```promql
# 모든 인스턴스의 합계
sum(rate(http_requests_total[5m]))

# 레이블로 그룹화
sum by (status) (rate(http_requests_total[5m]))

# 레이블 제외 후 집계
sum without (instance, pod) (rate(http_requests_total[5m]))

# 평균
avg(http_request_duration_seconds)

# 최댓값
max(http_request_duration_seconds)

# 인스턴스 수
count(up{job="node"})
```

---

## 5. Histogram 분위수

```promql
# p95 응답 시간 (밀리초)
histogram_quantile(
  0.95,
  rate(http_request_duration_seconds_bucket[5m])
) * 1000

# 서비스별 p99
histogram_quantile(
  0.99,
  sum by (service, le) (
    rate(http_request_duration_seconds_bucket[5m])
  )
)
```

---

## 6. 실용 쿼리 모음

```promql
# 에러율 (%)
100 * (
  rate(http_requests_total{status=~"5.."}[5m])
  /
  rate(http_requests_total[5m])
)

# 서비스 가용성
avg_over_time(up{job="my-service"}[24h]) * 100

# CPU 사용률 (%)
100 - (
  avg by (instance) (
    rate(node_cpu_seconds_total{mode="idle"}[5m])
  ) * 100
)

# 메모리 사용률 (%)
100 * (
  1 -
  node_memory_MemAvailable_bytes /
  node_memory_MemTotal_bytes
)

# 디스크 사용률 (%)
100 - (
  node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs"}
  /
  node_filesystem_size_bytes{fstype!~"tmpfs|fuse.lxcfs"}
  * 100
)

# Kubernetes Pod 재시작 수 (최근 1시간)
increase(kube_pod_container_status_restarts_total[1h]) > 0
```

---

## 7. Recording Rules (성능 최적화)

자주 쓰는 복잡한 쿼리를 미리 계산해 저장한다.

```yaml
# prometheus-rules.yaml
groups:
- name: recording-rules
  rules:
  - record: job:http_requests:rate5m
    expr: sum by (job, status) (
      rate(http_requests_total[5m])
    )

  - record: job:http_error_rate:rate5m
    expr: |
      sum by (job) (rate(http_requests_total{status=~"5.."}[5m]))
      /
      sum by (job) (rate(http_requests_total[5m]))
```

---

## 참고 문서

- [PromQL 공식 문서](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
