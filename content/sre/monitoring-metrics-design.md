---
title: "모니터링 지표 설계"
date: 2026-04-14
tags:
  - sre
  - monitoring
  - metrics
sidebar_label: "지표 설계"
---

# 모니터링 지표 설계

## 1. 지표 선택 원칙

```
좋은 지표의 조건:

  사용자 중심:
    → 사용자가 실제 느끼는 것을 반영
    → 기술 지표보다 비즈니스 지표 우선

  실행 가능:
    → 지표 이상 시 취할 조치가 명확
    → 취할 조치가 없다면 지표 삭제

  신뢰할 수 있음:
    → 안정적으로 측정 가능
    → 명확한 정의와 계산 방법

  적은 수:
    → 핵심 5~10개 집중
    → 지표가 너무 많으면 노이즈
```

---

## 2. 골든 시그널 적용

```
4 Golden Signals:
  Latency  → p50, p95, p99 응답 시간
  Traffic  → 초당 요청 수 (RPS)
  Errors   → 5xx 오류율
  Saturation → CPU, 메모리, 디스크 사용률
```

---

## 3. 서비스 유형별 지표

### API 서비스

```yaml
핵심 지표:
  - http_request_duration_seconds (히스토그램)
  - http_requests_total (카운터)
  - http_requests_errors_total (카운터)
  - active_connections (게이지)

SLO 지표:
  # 가용성
  - sum(rate(requests_success[5m])) / sum(rate(requests_total[5m]))
  
  # 레이턴시 SLO 달성률
  - histogram_quantile(0.95, rate(duration_bucket[5m])) < 0.5
```

### 데이터베이스

```yaml
핵심 지표:
  - pg_up                              # 연결 가능 여부
  - pg_stat_database_tup_returned      # 읽기 처리량
  - pg_stat_database_xact_commit       # 트랜잭션 커밋율
  - pg_replication_lag_seconds         # 복제 지연
  - pg_stat_activity_count             # 활성 연결 수
```

### 쿠버네티스

```yaml
핵심 지표:
  # Pod
  - kube_pod_status_ready
  - kube_deployment_status_replicas_unavailable
  
  # 리소스
  - container_cpu_usage_seconds_total
  - container_memory_working_set_bytes
  
  # 클러스터 건강도
  - kube_node_status_condition{condition="Ready"}
```

---

## 4. 지표 계층 구조

```
비즈니스 레벨:
  결제 성공률, DAU, 매출

서비스 레벨 (SLI):
  API 가용성, 오류율, 레이턴시

인프라 레벨:
  CPU, 메모리, 디스크, 네트워크

→ 위에서 아래로 드릴다운
→ 비즈니스 이상 → 서비스 확인 → 인프라 확인
```

---

## 5. 지표 태그 전략

```yaml
# 일관된 레이블 사용
http_requests_total{
  service="payment",        # 서비스 이름
  version="v1.2.3",         # 배포 버전
  environment="production", # 환경
  method="POST",            # HTTP 메서드
  path="/api/v1/pay",       # 엔드포인트
  status_code="200"         # 응답 코드
}
```

---

## 참고 문서

- [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Prometheus Metric Types](https://prometheus.io/docs/concepts/metric_types/)
