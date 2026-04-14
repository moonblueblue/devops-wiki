---
title: "알림 설계 원칙"
date: 2026-04-14
tags:
  - alerting
  - observability
  - sre
sidebar_label: "알림 설계 원칙"
---

# 알림 설계 원칙

## 1. 좋은 알림의 기준

Google SRE Book의 알림 설계 원칙:

```
알림은 반드시 사람이 행동해야 할 때만 울린다.
자동으로 처리되거나, 당장 조치가 불필요하면 알림이 아니다.
```

| 기준 | 내용 |
|-----|------|
| **Actionable** | 알림을 받으면 즉시 무엇을 해야 할지 명확 |
| **Urgent** | 지금 당장 대응이 필요한 수준 |
| **Novel** | 이미 알고 있는 문제가 아닌 새로운 상황 |
| **Low Noise** | 불필요한 알림이 없어 신뢰도 높음 |

---

## 2. Symptom-based vs Cause-based 알림

### Cause-based (원인 기반, 나쁜 예)

```
Bad:
  → CPU 90% 이상
  → 메모리 80% 이상
  → 디스크 70% 이상
```

문제: CPU가 높아도 서비스는 정상일 수 있다.
실제 사용자 경험과 무관한 알림이 많아진다.

### Symptom-based (증상 기반, 좋은 예)

```
Good:
  → 에러율 1% 초과 (사용자 경험 직접 영향)
  → p95 응답시간 1초 초과 (사용자 체감 느림)
  → 서비스 헬스체크 실패 (서비스 다운)
```

원인(CPU, 메모리)은 대시보드로 확인하면 된다.
알림은 사용자에게 영향을 미치는 증상 위주로 설계한다.

---

## 3. 알림 수준 분류

```
Critical (P1):
  → 서비스 다운 / 데이터 손실 위험
  → 온콜 즉시 호출 (24/7)
  → PagerDuty / 전화

Warning (P2):
  → 성능 저하 / 조만간 문제 예상
  → 업무 시간 내 확인
  → Slack 알림

Info (P3):
  → 참고 사항 / 트렌드 변화
  → 알림 없음 (대시보드만)
```

---

## 4. for 절 활용 (순간적 스파이크 제외)

```yaml
# 순간적 스파이크는 알림 제외
alert: HighErrorRate
expr: rate(http_errors_total[5m]) > 0.05
for: 5m    # 5분 지속 시에만 알림

# 짧은 서비스 재시작도 무시
alert: ServiceDown
expr: up == 0
for: 2m    # 2분 지속 시에만 알림
```

---

## 5. 알림 라벨과 어노테이션

```yaml
alert: PaymentServiceHighErrorRate
expr: error_rate{service="payment"} > 0.05
for: 5m
labels:
  severity: critical        # 심각도
  team: payment             # 담당 팀
  service: payment          # 서비스명
annotations:
  summary: "결제 서비스 에러율 5% 초과"
  description: |
    현재 에러율: {{ $value | humanizePercentage }}
    서비스: {{ $labels.service }}
  runbook: "https://wiki.internal/runbooks/payment-errors"
  dashboard: "https://grafana.internal/d/payment/payment-service"
```

`runbook` 링크가 중요하다.
알림을 받은 사람이 즉시 어떤 조치를 해야 하는지 알 수 있다.

---

## 6. Dead Man's Switch

파이프라인 전체가 중단될 때도 감지한다.

```yaml
# Prometheus가 정상 작동 중임을 계속 알림
alert: DeadMansSwitch
expr: vector(1)
labels:
  severity: none
annotations:
  summary: "모니터링 파이프라인 정상 작동 확인용"
# Alertmanager에서 이 알림이 오면 silence 해제
# 이 알림이 오지 않으면 "모니터링 중단" 감지
```

---

## 7. 알림 품질 지표

```
월별 알림 리뷰 체크:
□ 총 알림 수 추세 (증가 중이면 문제)
□ 알림별 대응 시간 (actionable한가)
□ False Positive 비율 (5% 이하 목표)
□ 1개월 이상 발화 안 된 알림 → 삭제 검토
□ 같은 알림이 계속 반복 → 자동화 검토
```

---

## 참고 문서

- [Google SRE: Alerting on What Matters](https://sre.google/sre-book/monitoring-distributed-systems/)
- [My Philosophy on Alerting](https://docs.google.com/document/d/199PqyG3UsyXlwieHaqbGiWVa8eMWi8zzAn0YfcApr8Q/)
