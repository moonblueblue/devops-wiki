---
title: "SLI, SLO, SLA 정의와 차이"
date: 2026-04-14
tags:
  - sre
  - sli
  - slo
  - sla
sidebar_label: "SLI·SLO·SLA"
---

# SLI, SLO, SLA 정의와 차이

## 1. 세 개념의 관계

```
SLI (Service Level Indicator)
  → 실제로 측정하는 메트릭

SLO (Service Level Objective)
  → SLI에 대한 내부 목표치

SLA (Service Level Agreement)
  → 고객과의 공식 계약 (위반 시 페널티)

관계: SLA > SLO > 실제 성능
```

---

## 2. SLI — 지표

실제로 시스템 상태를 나타내는 측정값.

| 서비스 유형 | 권장 SLI |
|-----------|---------|
| API·웹 서비스 | 가용성, 레이턴시, 오류율 |
| 데이터 파이프라인 | 처리량, 신선도(Freshness) |
| 스토리지 | 내구성(Durability), 읽기/쓰기 성공률 |

```
좋은 SLI 조건:
  □ 사용자가 실제 느끼는 것과 연관됨
  □ 측정 가능하고 신뢰할 수 있음
  □ 단순하고 이해하기 쉬움
```

---

## 3. SLO — 목표

```
형식: SLI ≥ 목표치 (측정 기간)

예시:
  가용성 SLO: 99.9% 요청이 성공 (30일 롤링)
  레이턴시 SLO: 95%ile < 200ms, 99%ile < 1s
  오류율 SLO: HTTP 5xx < 0.1%

원칙:
  - 사용자 경험 기반으로 설정
  - 100%가 아닌 현실적인 목표
  - 내부 목표이므로 SLA보다 엄격하게
```

---

## 4. SLA — 계약

```
SLO vs SLA:
  SLO: 99.9%  (내부 목표)
  SLA: 99.5%  (고객 계약, 위반 시 환불)

SLA에 포함되는 내용:
  □ 가용성 목표
  □ 측정 방법
  □ 위반 시 보상 (크레딧, 환불)
  □ 제외 사항 (예: 예정된 유지보수)
```

---

## 5. 주요 클라우드 SLA 비교

| 서비스 | SLA |
|--------|-----|
| AWS EC2 | 99.99% |
| GKE Autopilot | 99.95% |
| Azure AKS | 99.95% (SLA 옵션) |
| AWS RDS Multi-AZ | 99.95% |

---

## 6. SLI 측정 예시 (Prometheus)

```yaml
# 가용성 SLI
- record: job:sli_availability:ratio_rate5m
  expr: |
    sum(rate(http_requests_total{code!~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))

# 레이턴시 SLI (95%ile < 200ms)
- record: job:sli_latency_p95:gauge
  expr: |
    histogram_quantile(0.95,
      sum(rate(http_request_duration_seconds_bucket[5m]))
      by (le)
    )

# SLO 달성 여부 확인
- alert: SLOViolation
  expr: |
    job:sli_availability:ratio_rate5m < 0.999
  for: 5m
  annotations:
    summary: "가용성 SLO 위반: {{ $value | humanizePercentage }}"
```

---

## 참고 문서

- [Google SRE Book - Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- [SLO 모범 사례 (Google Cloud)](https://cloud.google.com/blog/products/management-tools/practical-guide-to-setting-slos)
