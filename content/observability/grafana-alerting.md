---
title: "Grafana 알림 설정"
date: 2026-04-14
tags:
  - grafana
  - alerting
  - observability
sidebar_label: "Grafana 알림"
---

# Grafana 알림 설정

## 1. Grafana Alerting 개요

Grafana 9.0+부터 **Grafana Alerting** (통합 알림 시스템)을 기본 제공한다.
Prometheus Alertmanager와 달리 Grafana 자체에서 알림을 관리한다.

```
Grafana Alert Rule (PromQL / LogQL 기반)
    ↓ 평가 (evaluation interval)
Alert State 변경
    ↓
Contact Point (Slack, PagerDuty, etc.)
    ↓
Notification Policy (라우팅 규칙)
```

---

## 2. Alert Rule 생성

```
Grafana → Alerting → Alert Rules → New Alert Rule

1. Query & Conditions:
   PromQL:
     sum by (service) (
       rate(http_requests_total{status=~"5.."}[5m])
     )
     /
     sum by (service) (
       rate(http_requests_total[5m])
     ) * 100 > 5

2. Expressions:
   - Classic condition: Last() > 5
   - Reduce: Last value
   - Threshold: IS ABOVE 5

3. Folder & Evaluation Group:
   - Folder: Production Alerts
   - Group: API Alerts
   - Evaluation interval: 1m
   - Pending period: 5m    # 5분 지속 시 firing
```

---

## 3. Contact Point (알림 수신자)

```
Alerting → Contact Points → Add Contact Point

Slack:
  - Webhook URL: $SLACK_WEBHOOK_URL
  - Channel: #alerts
  - Message Template: 커스텀 템플릿

PagerDuty:
  - Integration Key: $PD_KEY

Email:
  - To: ops-team@company.com
```

---

## 4. Notification Policy (라우팅)

```
Alerting → Notification Policies

Default Policy:
  Contact point: slack-general

Routes:
  - Match: severity=critical
    Contact point: pagerduty
    Continue matching: true

  - Match: team=database
    Contact point: slack-db-team

  - Match: severity=warning
    Contact point: slack-general
    Group by: [alertname, service]
    Group wait: 30s
    Repeat interval: 4h
```

---

## 5. 알림 템플릿

```
{{ define "slack-alert" }}
{{ if eq .Status "firing" }}
:red_circle: *[{{ .CommonLabels.severity | upper }}]
{{ .CommonAnnotations.summary }}*
{{ else }}
:large_green_circle: *RESOLVED: {{ .CommonAnnotations.summary }}*
{{ end }}

*서비스:* {{ .CommonLabels.service }}
*현재 값:* {{ index .Alerts 0 .ValueString }}
*대시보드:* {{ .CommonAnnotations.dashboard }}
*Runbook:* {{ .CommonAnnotations.runbook }}
{{ end }}
```

---

## 6. Silence (알림 억제)

```
Alerting → Silences → New Silence

Matchers:
  alertname = PaymentServiceHighErrorRate
  service = payment

Duration: 2h
Comment: 배포 중 (2026-04-14 10:00 ~ 12:00)
```

---

## 7. Grafana Alerting vs Prometheus Alertmanager

| 항목 | Grafana Alerting | Prometheus Alertmanager |
|-----|----------------|------------------------|
| 데이터 소스 | Prometheus, Loki, Tempo 등 | Prometheus만 |
| 설정 위치 | Grafana UI | YAML 파일 |
| GitOps | 어려움 | 용이 (파일 기반) |
| 복잡한 라우팅 | 보통 | 강력 |
| 시각화 통합 | 우수 | 없음 |

**권장:** 둘 다 사용하지 말고 하나로 통일.
Prometheus 기반이면 Alertmanager, Grafana 중심이면 Grafana Alerting.

---

## 참고 문서

- [Grafana Alerting 공식 문서](https://grafana.com/docs/grafana/latest/alerting/)
- [알림 템플릿](https://grafana.com/docs/grafana/latest/alerting/configure-notifications/template-notifications/)
