---
title: "알림 시스템 구축"
date: 2026-04-14
tags:
  - sre
  - alerting
  - on-call
sidebar_label: "알림 시스템"
---

# 알림 시스템 구축

## 1. 알림 설계 원칙

```
좋은 알림의 조건:

  즉각 조치 필요:
    → 받은 즉시 무언가 해야 할 알림만 발송
    → "흥미롭네" 수준의 알림은 불필요

  증상 기반:
    → CPU 90% (원인)보다
       응답 속도 저하 (증상) 기반 알림

  사용자 영향 기반:
    → 사용자가 느끼는 문제를 알림

  적은 수:
    → 온콜 당 하루 < 5개 알림 목표
```

---

## 2. 알림 계층

```
페이지 (Page) — 즉각 대응 필요:
  → PagerDuty/OpsGenie 호출
  → 온콜 담당자 즉시 깨움
  → SEV-1, SEV-2에만 사용

티켓 (Ticket) — 업무 시간 대응:
  → JIRA 티켓 자동 생성
  → 슬랙 알림
  → SEV-3, SEV-4

로그 (Log) — 추후 확인:
  → 데이터만 기록
  → 알림 없음
```

---

## 3. PagerDuty 연동

```yaml
# Alertmanager + PagerDuty
route:
  group_by: [alertname, cluster, service]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: default
  routes:
  - match:
      severity: critical
    receiver: pagerduty-critical
    continue: false
  - match:
      severity: warning
    receiver: slack-warning

receivers:
- name: pagerduty-critical
  pagerduty_configs:
  - routing_key: <PAGERDUTY_KEY>
    severity: critical
    description: |
      {{ range .Alerts }}
        {{ .Annotations.summary }}
      {{ end }}
    details:
      firing: '{{ .Alerts.Firing | len }}'
      runbook: '{{ (index .Alerts 0).Annotations.runbook_url }}'

- name: slack-warning
  slack_configs:
  - api_url: <WEBHOOK_URL>
    channel: '#alerts'
    title: '{{ .GroupLabels.alertname }}'
    text: |
      {{ range .Alerts }}
      *{{ .Annotations.summary }}*
      {{ .Annotations.description }}
      {{ end }}
```

---

## 4. 알림 룬북 (Runbook) 연결

```yaml
# 알림에 runbook URL 필수 첨부
- alert: HighErrorRate
  expr: |
    sum(rate(http_requests_total{code=~"5.."}[5m]))
    / sum(rate(http_requests_total[5m])) > 0.01
  annotations:
    summary: "에러율 1% 초과"
    description: "서비스 {{ $labels.service }} 에러율: {{ $value | humanizePercentage }}"
    runbook_url: "https://wiki.example.com/runbooks/high-error-rate"
```

---

## 5. 온콜 일정 관리

```
온콜 원칙:
  □ 24시간 × 7일 커버리지
  □ 1주 단위 순환
  □ 1차 + 2차 대응자 지정
  □ 온콜 부담 공평하게 배분

온콜 건강 지표:
  □ 야간 알림 < 2개/주
  □ 대응 시간 < 10분
  □ 번아웃 지표 추적 (알림 수, 대응 시간)
```

---

## 6. 알림 피로 해소

```
오탐 줄이기:
  □ 알림 for 절 추가 (5m 이상 지속)
  □ 플래핑 억제 (inhibit_rules)
  □ 주기적 알림 검토 (월 1회)

알림 감소 절차:
  1. 지난 달 알림 목록 추출
  2. 오탐 또는 액션 없는 알림 식별
  3. 삭제 또는 임계값 조정
  4. 알림 Action Rate 측정
```

---

## 참고 문서

- [Alertmanager 설정](https://prometheus.io/docs/alerting/latest/configuration/)
- [PagerDuty Best Practices](https://postmortems.pagerduty.com/oncall/alerting_principles/)
