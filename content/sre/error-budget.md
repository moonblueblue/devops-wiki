---
title: "에러 버짓과 위험 관리"
date: 2026-04-14
tags:
  - sre
  - error-budget
  - risk-management
sidebar_label: "에러 버짓"
---

# 에러 버짓과 위험 관리

## 1. 에러 버짓 개념

```
에러 버짓 = 100% - SLO 목표

예: SLO 99.9% → 에러 버짓 0.1%
  월간: 43.8분 다운타임 허용
  주간: 10.1분
  일간: 1.44분
```

---

## 2. 가용성별 에러 버짓

| SLO | 연간 다운타임 | 월간 다운타임 |
|-----|------------|------------|
| 99% (2 nines) | 3.65일 | 7.31시간 |
| 99.9% (3 nines) | 8.77시간 | 43.8분 |
| 99.95% | 4.38시간 | 21.9분 |
| 99.99% (4 nines) | 52.6분 | 4.38분 |
| 99.999% (5 nines) | 5.26분 | 26.3초 |

---

## 3. 에러 버짓 소비 추적

```yaml
# Prometheus: 에러 버짓 소비율 계산
# 30일 SLO 99.9% 기준

# 에러 버짓 소비율 (recording rule)
- record: job:error_budget_burn_rate:ratio_rate5m
  expr: |
    1 - (
      sum(rate(http_requests_total{code!~"5.."}[5m]))
      /
      sum(rate(http_requests_total[5m]))
    )
    / (1 - 0.999)

# 에러 버짓 소진 알림
- alert: ErrorBudgetBurnRateHigh
  expr: |
    job:error_budget_burn_rate:ratio_rate5m > 14.4
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "에러 버짓 급속 소진 — 1시간 내 2% 소비"
```

---

## 4. 에러 버짓 소진 시 대응

```
버짓 < 50%:
  → 배포 주의, 배포 전 충분한 테스트

버짓 < 10%:
  → 새 기능 배포 중단
  → 신뢰성 개선 작업 우선

버짓 소진 (0%):
  → 기능 개발 동결
  → SRE와 개발팀 공동 신뢰성 스프린트
  → 다음 주기까지 배포 금지
```

---

## 5. 다중 번-레이트 알림

```yaml
# 빠른 소진과 느린 소진을 동시에 탐지
groups:
- name: error-budget-burn
  rules:
  # 1시간 창: 빠른 소진
  - alert: HighBurnRate
    expr: |
      (
        job:error_budget_burn_rate:ratio_rate1h > 14.4
        and
        job:error_budget_burn_rate:ratio_rate5m > 14.4
      )
    labels:
      severity: critical
      window: 1h

  # 6시간 창: 중간 소진
  - alert: MediumBurnRate
    expr: |
      (
        job:error_budget_burn_rate:ratio_rate6h > 6
        and
        job:error_budget_burn_rate:ratio_rate30m > 6
      )
    labels:
      severity: warning
      window: 6h
```

---

## 6. 에러 버짓 정책 문서

```
서비스: payment-api
SLO: 99.95% (30일 롤링)
에러 버짓: 21.9분/월

정책:
  50% 이상 소비:
    → 개발팀 통보, 주간 리뷰 추가

  80% 이상 소비:
    → 배포 중단 권고
    → 신뢰성 개선 항목 Sprint에 포함

  100% 소비:
    → 배포 금지
    → 에러 버짓 리셋될 때까지 동결

예외:
  사전 합의된 유지보수 창 → 버짓 미차감
```

---

## 참고 문서

- [Google SRE Workbook - Error Budget Policy](https://sre.google/workbook/error-budget-policy/)
- [SLO Alerting (Google)](https://sre.google/workbook/alerting-on-slos/)
