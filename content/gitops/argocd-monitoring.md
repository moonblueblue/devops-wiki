---
title: "ArgoCD 모니터링 (Prometheus, Grafana)"
date: 2026-04-14
tags:
  - argocd
  - monitoring
  - prometheus
  - grafana
sidebar_label: "ArgoCD 모니터링"
---

# ArgoCD 모니터링

## 1. ArgoCD 메트릭 구조

ArgoCD는 기본적으로 Prometheus 메트릭을 노출한다.

| 컴포넌트 | 포트 | 주요 메트릭 |
|---------|-----|----------|
| argocd-server | 8083 | API 요청, 인증 |
| argocd-repo-server | 8084 | Git 동기화 성능 |
| argocd-application-controller | 8082 | App 상태, 동기화 결과 |

---

## 2. Prometheus ServiceMonitor 설정

```yaml
# ArgoCD Helm chart values.yaml
controller:
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true
      namespace: monitoring

server:
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

repoServer:
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true
```

---

## 3. 핵심 메트릭

### Application 상태

```promql
# Synced 상태인 앱 수
argocd_app_info{sync_status="Synced"}

# OutOfSync 앱 목록
argocd_app_info{sync_status="OutOfSync"}

# Degraded 상태 앱
argocd_app_info{health_status="Degraded"}

# 앱별 마지막 동기화 시간
argocd_app_reconcile_count
```

### 동기화 성능

```promql
# 동기화 소요 시간 p95
histogram_quantile(0.95,
  rate(argocd_app_reconcile_duration_seconds_bucket[5m])
)

# Git 폴링 에러율
rate(argocd_git_request_total{request_type="fetch",
  response_code!="200"}[5m])
```

---

## 4. Grafana 대시보드

공식 ArgoCD 대시보드 ID: **14584** (Grafana 공식 저장소)

```bash
# Grafana에 대시보드 임포트
# Dashboards → Import → ID 14584 입력
```

주요 패널:
- App Sync Status 분포 (Synced / OutOfSync / Unknown)
- App Health Status 분포
- 동기화 소요 시간 히스토그램
- Git 폴링 에러율
- 컨트롤러 큐 길이

---

## 5. 알림 설정 (ArgoCD Notifications)

```yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  # Slack 서비스 설정
  service.slack: |
    token: $slack-token

  # 배포 완료 알림
  template.app-deployed: |
    slack:
      attachments: |
        [{
          "color": "good",
          "title": "{{ .app.metadata.name }} 배포 완료",
          "fields": [
            {"title": "Revision", "value": "{{.app.status.sync.revision}}", "short": true},
            {"title": "Status", "value": "{{.app.status.sync.status}}", "short": true}
          ]
        }]

  # 배포 실패 알림
  template.app-sync-failed: |
    slack:
      attachments: |
        [{
          "color": "danger",
          "title": "{{ .app.metadata.name }} 동기화 실패",
          "text": "{{.app.status.conditions | toJson}}"
        }]

  # 트리거 정의
  trigger.on-deployed: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-deployed]
  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [app-sync-failed]
```

### Application에 알림 구독

```yaml
metadata:
  annotations:
    notifications.argoproj.io/subscribe.on-deployed.slack: my-team-channel
    notifications.argoproj.io/subscribe.on-sync-failed.slack: my-team-alerts
```

---

## 6. 주요 알람 규칙 (PrometheusRule)

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: argocd-alerts
  namespace: monitoring
spec:
  groups:
  - name: argocd
    rules:
    - alert: ArgoCDAppOutOfSync
      expr: >
        argocd_app_info{sync_status="OutOfSync"} == 1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "App {{ $labels.name }} OutOfSync 10분 초과"

    - alert: ArgoCDAppDegraded
      expr: >
        argocd_app_info{health_status="Degraded"} == 1
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "App {{ $labels.name }} Degraded 상태"
```

---

## 참고 문서

- [ArgoCD Notifications](https://argocd-notifications.readthedocs.io/)
- [ArgoCD Metrics](https://argo-cd.readthedocs.io/en/stable/operator-manual/metrics/)
- [Grafana 대시보드 14584](https://grafana.com/grafana/dashboards/14584)
