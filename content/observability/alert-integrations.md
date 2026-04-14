---
title: "Slack / PagerDuty 연동"
date: 2026-04-14
tags:
  - alerting
  - slack
  - pagerduty
  - observability
sidebar_label: "Slack·PagerDuty"
---

# Slack / PagerDuty 연동

## 1. Alertmanager + Slack

### Incoming Webhook 설정

```
Slack → 설정 → 앱 → Incoming Webhooks → 새 Webhook
  → 채널 선택 → Webhook URL 복사
```

```yaml
# alertmanager.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'

receivers:
- name: slack-alerts
  slack_configs:
  - channel: '#alerts'
    title: >-
      {{ if eq .Status "firing" }}:red_circle:{{ else }}:large_green_circle:{{ end }}
      [{{ .CommonLabels.severity | toUpper }}] {{ .CommonAnnotations.summary }}
    text: >-
      *서비스:* {{ .CommonLabels.service }}
      *링크:* {{ .CommonAnnotations.runbook }}
    send_resolved: true   # 복구 알림도 전송
```

---

## 2. Alertmanager + PagerDuty

```yaml
receivers:
- name: pagerduty-critical
  pagerduty_configs:
  - routing_key: '<PD_INTEGRATION_KEY>'
    # Events API v2
    severity: '{{ .CommonLabels.severity }}'
    description: '{{ .CommonAnnotations.summary }}'
    details:
      service: '{{ .CommonLabels.service }}'
      runbook: '{{ .CommonAnnotations.runbook }}'
    # 자동 resolved 처리
    send_resolved: true
```

PagerDuty Integration Key는 서비스 생성 시 발급된다.
`Events API v2 Integration` 방식을 권장한다.

---

## 3. Grafana → Slack (Grafana Alerting)

```
Alerting → Contact Points → New Contact Point

Name: slack-production
Type: Slack
Webhook URL: https://hooks.slack.com/services/...
Channel: #production-alerts

Message body:
{{ template "slack.default.text" . }}
```

---

## 4. Grafana → PagerDuty

```
Contact Point Type: PagerDuty
Integration Key: <PD_INTEGRATION_KEY>
Severity: {{ .CommonLabels.severity }}
Summary: {{ .CommonAnnotations.summary }}
```

---

## 5. 온콜 스케줄 (PagerDuty)

```
PagerDuty → Services → My Service
  → Escalation Policies
    Level 1: 담당자 (5분 내 응답)
    Level 2: 팀 리더 (15분 내 응답)
    Level 3: 전체 팀 (30분 내 응답)

  → Schedules
    주간: 담당자 A (월~수)
    주간: 담당자 B (목~금)
    주말: 담당자 C
```

---

## 6. 알림 채널 설계

```
채널 구분:
  #alerts-info    → 자동 처리, FYI 알림
  #alerts-warning → P2 경고, 업무 시간 내 확인
  #alerts-critical → P1 긴급, 즉시 조치 필요
  #incidents       → 장애 대응 실시간 소통

연동:
  P1 Critical → PagerDuty + #alerts-critical
  P2 Warning  → #alerts-warning
  복구 알림   → #alerts-warning (resolved 표시)
```

---

## 7. 알림 메시지 템플릿 모범 사례

```yaml
# 좋은 알림 메시지 구성 요소
title: "[CRITICAL] 결제 서비스 에러율 10% 초과"
body: |
  **현재 상황**: 에러율 10.3% (임계값: 5%)
  **영향**: 결제 실패 약 1분당 50건
  **서비스**: payment-service (production)
  
  **즉시 조치**:
  1. 대시보드 확인: https://grafana/d/payment
  2. 최근 배포 확인: https://argocd/apps/payment
  3. Runbook: https://wiki/runbooks/payment-errors
  
  **연락처**: #team-payment
```

---

## 참고 문서

- [Alertmanager Slack 연동](https://prometheus.io/docs/alerting/latest/configuration/#slack_config)
- [Alertmanager PagerDuty](https://prometheus.io/docs/alerting/latest/configuration/#pagerduty_config)
- [PagerDuty Events API](https://developer.pagerduty.com/docs/send-alert-event/)
