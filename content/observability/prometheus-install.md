---
title: "Prometheus 아키텍처와 설치"
date: 2026-04-14
tags:
  - prometheus
  - observability
  - kubernetes
sidebar_label: "Prometheus 설치"
---

# Prometheus 아키텍처와 설치

## 1. 아키텍처

```
┌─────────────────────────────────────────┐
│              Prometheus                 │
│                                         │
│  Scrape (pull) ←── Targets (exporter)   │
│      ↓                                  │
│  TSDB (시계열 DB, 로컬 디스크)           │
│      ↓                                  │
│  HTTP API ←── PromQL 쿼리               │
│      ↓                                  │
│  Alertmanager → 알림 발송               │
└─────────────────────────────────────────┘
```

| 컴포넌트 | 역할 |
|---------|------|
| Prometheus Server | 메트릭 수집, 저장, 쿼리 엔진 |
| Exporter | 대상 시스템의 메트릭을 HTTP로 노출 |
| Alertmanager | 알림 수신, 그룹화, 발송 (Slack, PagerDuty 등) |
| Pushgateway | 짧은 Job의 메트릭을 Push 방식으로 수집 |
| Service Discovery | K8s, EC2 등에서 대상 자동 검색 |

---

## 2. Prometheus Stack 설치 (Helm)

```bash
# kube-prometheus-stack: Prometheus + Grafana + Alertmanager 통합
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts
helm repo update

helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=mypassword
```

---

## 3. prometheus.yaml 기본 설정

```yaml
global:
  scrape_interval: 15s       # 15초마다 수집
  evaluation_interval: 15s   # 룰 평가 주기

# Alertmanager 연결
alerting:
  alertmanagers:
  - static_configs:
    - targets: ['alertmanager:9093']

# 알림 규칙 파일
rule_files:
- "alerts/*.yml"

# 수집 대상
scrape_configs:
# Prometheus 자체 메트릭
- job_name: 'prometheus'
  static_configs:
  - targets: ['localhost:9090']

# Node Exporter (서버 메트릭)
- job_name: 'node'
  static_configs:
  - targets:
    - 'node1:9100'
    - 'node2:9100'

# Kubernetes 자동 검색
- job_name: 'kubernetes-pods'
  kubernetes_sd_configs:
  - role: pod
  relabel_configs:
  # 어노테이션 prometheus.io/scrape: "true" 가 있는 파드만 수집
  - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
    action: keep
    regex: true
```

---

## 4. 주요 Exporter

| Exporter | 포트 | 수집 대상 |
|---------|-----|---------|
| node_exporter | 9100 | CPU, 메모리, 디스크, 네트워크 |
| blackbox_exporter | 9115 | HTTP, TCP, DNS 상태 검사 |
| postgres_exporter | 9187 | PostgreSQL 메트릭 |
| redis_exporter | 9121 | Redis 메트릭 |
| jmx_exporter | 9404 | JVM/Java 메트릭 |
| nginx-vts-exporter | 9913 | Nginx 요청 메트릭 |

---

## 5. ServiceMonitor (Kubernetes 자동 검색)

kube-prometheus-stack 사용 시 ServiceMonitor CRD로 수집 대상을 선언한다.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: monitoring
  labels:
    release: kube-prometheus-stack   # Prometheus가 이 레이블로 찾음
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
  namespaceSelector:
    matchNames:
    - production
```

---

## 6. 장기 보존 (Remote Write)

Prometheus 로컬 TSDB는 기본 15일 보관.
장기 보존은 Remote Write로 외부 저장소에 전송한다.

```yaml
remote_write:
- url: https://cortex.internal/api/v1/push
  # 또는 Thanos, VictoriaMetrics, Grafana Mimir

# Helm values
prometheus:
  prometheusSpec:
    retention: 30d          # 30일 로컬 보관
    remoteWrite:
    - url: http://thanos-receive:19291/api/v1/receive
```

---

## 참고 문서

- [Prometheus 공식 문서](https://prometheus.io/docs/)
- [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [Prometheus Operator](https://github.com/prometheus-operator/prometheus-operator)
