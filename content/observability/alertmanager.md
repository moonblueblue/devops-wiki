---
title: "메트릭 수집과 알림 (Alertmanager)"
date: 2026-04-14
tags:
  - prometheus
  - alertmanager
  - observability
sidebar_label: "Alertmanager"
---

# 메트릭 수집과 알림 (Alertmanager)

## 1. 알림 흐름

```
Prometheus → Alert Rule 평가 → firing 상태
    ↓
Alertmanager 수신
    ↓
그룹화 + 중복 제거 + 라우팅
    ↓
Slack / PagerDuty / 이메일 발송
```

---

## 2. Prometheus Alert Rule

```yaml
# prometheus-rules.yaml
groups:
- name: service-alerts
  rules:
  # 서비스 다운 감지
  - alert: ServiceDown
    expr: up{job="my-service"} == 0
    for: 2m      # 2분 지속 시 firing
    labels:
      severity: critical
    annotations:
      summary: "서비스 {{ $labels.instance }} 다운"
      description: "{{ $labels.job }} 2분 이상 응답 없음"
      runbook: "https://wiki.internal/runbooks/service-down"

  # 에러율 높음
  - alert: HighErrorRate
    expr: |
      sum by (service) (
        rate(http_requests_total{status=~"5.."}[5m])
      )
      /
      sum by (service) (
        rate(http_requests_total[5m])
      ) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "{{ $labels.service }} 에러율 5% 초과"
      description: "현재 에러율: {{ $value | humanizePercentage }}"

  # p95 레이턴시 높음
  - alert: HighLatency
    expr: |
      histogram_quantile(0.95,
        rate(http_request_duration_seconds_bucket[5m])
      ) > 1.0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "p95 응답시간 1초 초과"
```

---

## 3. Alertmanager 설정

```yaml
# alertmanager.yaml
global:
  slack_api_url: 'https://hooks.slack.com/services/...'
  pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'

# 알림 라우팅
route:
  group_by: ['alertname', 'service']   # 같은 그룹으로 묶기
  group_wait: 30s                       # 첫 알림 대기
  group_interval: 5m                    # 같은 그룹 재알림 간격
  repeat_interval: 4h                   # 동일 알림 반복 주기

  receiver: 'slack-general'             # 기본 수신자

  routes:
  # critical → PagerDuty (온콜 호출)
  - match:
      severity: critical
    receiver: 'pagerduty'
    continue: true      # 아래 규칙도 계속 확인

  # 데이터베이스 팀
  - match_re:
      service: 'postgres|redis'
    receiver: 'slack-db-team'

# 알림 억제 (silencing)
inhibit_rules:
# ServiceDown 알림이 발생하면 같은 서비스의 다른 알림 억제
- source_match:
    alertname: ServiceDown
  target_match_re:
    alertname: 'High.*'
  equal: ['service']

# 수신자 정의
receivers:
- name: 'slack-general'
  slack_configs:
  - channel: '#alerts'
    text: |
      {{ range .Alerts }}
      *{{ .Labels.alertname }}* [{{ .Labels.severity }}]
      {{ .Annotations.summary }}
      {{ end }}

- name: 'pagerduty'
  pagerduty_configs:
  - service_key: '<service-key>'
    severity: '{{ .CommonLabels.severity }}'

- name: 'slack-db-team'
  slack_configs:
  - channel: '#db-alerts'
```

---

## 4. 알림 침묵 (Silence)

유지보수 중 알림을 일시적으로 억제한다.

```bash
# amtool CLI로 silence 추가
amtool silence add \
  alertname=~".*" \
  --duration=2h \
  --comment="배포 중 (2026-04-14 09:00~11:00)"

# 현재 silence 목록
amtool silence query

# silence 해제
amtool silence expire <silence-id>
```

---

## 5. PrometheusRule CRD (Kubernetes)

kube-prometheus-stack 사용 시 CRD로 알림 룰을 관리한다.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-app-alerts
  namespace: monitoring
  labels:
    release: kube-prometheus-stack
spec:
  groups:
  - name: my-app
    rules:
    - alert: MyAppDown
      expr: up{job="my-app"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "My App 다운"
```

---

## 참고 문서

- [Alertmanager 공식 문서](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Alert Rule 작성](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [amtool](https://github.com/prometheus/alertmanager#amtool)
