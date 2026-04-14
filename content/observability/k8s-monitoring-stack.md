---
title: "쿠버네티스 환경 모니터링 스택"
date: 2026-04-14
tags:
  - kubernetes
  - monitoring
  - prometheus
  - grafana
  - observability
sidebar_label: "K8s 모니터링 스택"
---

# 쿠버네티스 환경 모니터링 스택

## 1. 전체 스택 구성

```
┌────────────────────────────────────────────────┐
│  메트릭: Prometheus + Grafana                   │
│  로그:   Loki + Promtail (또는 Fluent Bit)      │
│  트레이스: Tempo + OpenTelemetry                │
└────────────────────────────────────────────────┘
```

### kube-prometheus-stack (권장 시작점)

```bash
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Prometheus + Alertmanager + Grafana + Node Exporter + kube-state-metrics
helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --values monitoring-values.yaml
```

---

## 2. kube-state-metrics

Kubernetes 리소스 상태를 메트릭으로 노출한다.

```promql
# Pod 상태 분포
count by (phase) (kube_pod_status_phase)

# 재시작 횟수 높은 Pod
topk(10,
  increase(kube_pod_container_status_restarts_total[1h])
) > 0

# Pending Pod (스케줄링 안 된 Pod)
kube_pod_status_phase{phase="Pending"} == 1

# OOMKilled Pod
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}

# Deployment 복제 불일치
kube_deployment_spec_replicas != kube_deployment_status_available_replicas

# PVC 용량 부족 (80% 이상)
kubelet_volume_stats_used_bytes
  /
kubelet_volume_stats_capacity_bytes * 100 > 80
```

---

## 3. 핵심 알림 규칙

```yaml
# kubernetes-alerts.yaml
groups:
- name: kubernetes
  rules:
  # Pod CrashLoopBackOff
  - alert: PodCrashLoopBackOff
    expr: |
      rate(kube_pod_container_status_restarts_total[15m]) * 60 * 5 > 5
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Pod {{ $labels.pod }} CrashLoopBackOff"

  # 노드 디스크 부족
  - alert: NodeDiskRunningFull
    expr: |
      (node_filesystem_avail_bytes{fstype!~"tmpfs|fuse.lxcfs"}
        / node_filesystem_size_bytes) * 100 < 15
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "노드 {{ $labels.instance }} 디스크 15% 미만"

  # 노드 메모리 부족
  - alert: NodeMemoryRunningFull
    expr: |
      node_memory_MemAvailable_bytes
        / node_memory_MemTotal_bytes * 100 < 10
    for: 5m
    labels:
      severity: warning

  # etcd 리더 없음
  - alert: EtcdNoLeader
    expr: etcd_server_has_leader == 0
    for: 1m
    labels:
      severity: critical

  # Prometheus 타겟 다운
  - alert: PrometheusTargetDown
    expr: up == 0
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "{{ $labels.job }} 타겟 다운"
```

---

## 4. Grafana 대시보드 구성

```yaml
# kube-prometheus-stack values.yaml
grafana:
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: kubernetes
        folder: Kubernetes
        type: file
        options:
          path: /var/lib/grafana/dashboards/kubernetes

  dashboards:
    kubernetes:
      # 클러스터 전체 현황
      k8s-cluster:
        gnetId: 7249
        datasource: Prometheus
      # Pod 상세
      k8s-pods:
        gnetId: 6336
        datasource: Prometheus
      # 노드 전체 현황
      node-exporter:
        gnetId: 1860
        datasource: Prometheus
      # Nginx Ingress
      ingress-nginx:
        gnetId: 9614
        datasource: Prometheus
```

---

## 5. 로그 스택 통합 (Loki + Promtail)

```bash
# Loki + Promtail 설치
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set promtail.enabled=true \
  --set grafana.enabled=false   # 이미 kube-prometheus-stack에 있음
```

```yaml
# Grafana에 Loki 데이터 소스 추가
grafana:
  additionalDataSources:
  - name: Loki
    type: loki
    url: http://loki:3100
    jsonData:
      derivedFields:
      - datasourceUid: tempo
        matcherRegex: "traceID=(\\w+)"
        name: TraceID
        url: '$${__value.raw}'
```

---

## 6. 트레이스 스택 통합 (Tempo + OTel)

```bash
helm install tempo grafana/tempo \
  --namespace monitoring

helm install opentelemetry-collector \
  open-telemetry/opentelemetry-collector \
  --namespace monitoring \
  --values otel-values.yaml
```

---

## 7. 전체 스택 설치 요약

```bash
# 1. Prometheus + Grafana + Alertmanager
helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# 2. Loki + Promtail
helm install loki grafana/loki-stack \
  -n monitoring

# 3. Tempo
helm install tempo grafana/tempo \
  -n monitoring

# 4. OpenTelemetry Collector
helm install otel-collector \
  open-telemetry/opentelemetry-collector \
  -n monitoring
```

모든 구성 요소가 설치되면
Grafana 하나에서 메트릭·로그·트레이스를 통합 조회할 수 있다.

---

## 참고 문서

- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Loki Stack](https://github.com/grafana/helm-charts/tree/main/charts/loki-stack)
- [Grafana Tempo](https://grafana.com/docs/tempo/latest/)
- [kube-state-metrics](https://github.com/kubernetes/kube-state-metrics)
