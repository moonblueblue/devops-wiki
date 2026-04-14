---
title: "Grafana 대시보드 구성"
date: 2026-04-14
tags:
  - grafana
  - observability
  - dashboard
sidebar_label: "Grafana 대시보드"
---

# Grafana 대시보드 구성

## 1. 설치

```bash
# Helm (kube-prometheus-stack에 포함)
helm install kube-prometheus-stack \
  prometheus-community/kube-prometheus-stack \
  --set grafana.enabled=true \
  --set grafana.adminPassword=mypassword \
  --namespace monitoring

# 단독 설치
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana \
  --namespace monitoring \
  --set adminPassword=mypassword
```

---

## 2. 데이터 소스 연결

```yaml
# Helm values로 데이터 소스 자동 설정
grafana:
  datasources:
    datasources.yaml:
      apiVersion: 1
      datasources:
      - name: Prometheus
        type: prometheus
        url: http://kube-prometheus-stack-prometheus:9090
        isDefault: true
      - name: Loki
        type: loki
        url: http://loki:3100
      - name: Tempo
        type: tempo
        url: http://tempo:3100
```

---

## 3. 주요 패널 유형

| 패널 | 용도 |
|-----|------|
| Time Series | 시계열 데이터 (요청/초, CPU) |
| Stat | 단일 숫자 강조 (에러율 %) |
| Gauge | 범위 내 현재 값 (CPU 사용률) |
| Bar Chart | 범주별 비교 |
| Table | 상세 데이터 목록 |
| Heatmap | 시간대별 분포 (레이턴시 히트맵) |
| Logs | Loki 로그 표시 |

---

## 4. 대시보드 as Code (Provisioning)

대시보드를 JSON 파일로 관리하면 GitOps로 버전 관리할 수 있다.

```yaml
# Helm values
grafana:
  dashboardProviders:
    dashboardproviders.yaml:
      apiVersion: 1
      providers:
      - name: default
        folder: ''
        type: file
        options:
          path: /var/lib/grafana/dashboards

  dashboards:
    default:
      node-exporter:
        gnetId: 1860       # Grafana 공식 저장소 대시보드 ID
        revision: 37
        datasource: Prometheus
      k8s-cluster:
        gnetId: 7249
        datasource: Prometheus
```

---

## 5. 자주 쓰는 공식 대시보드

| 이름 | ID | 내용 |
|-----|-----|------|
| Node Exporter Full | 1860 | 서버 CPU/메모리/디스크 |
| Kubernetes Cluster | 7249 | 클러스터 전체 현황 |
| Kubernetes Pods | 6336 | Pod 리소스 상세 |
| ArgoCD | 14584 | ArgoCD 앱 상태 |
| Nginx Ingress | 9614 | 요청/에러/레이턴시 |
| JVM Micrometer | 4701 | Java 애플리케이션 |

---

## 6. 변수 (Variables)

동적으로 대시보드를 필터링한다.

```
대시보드 Settings → Variables → New Variable

Name: namespace
Type: Query
Query: label_values(kube_pod_info, namespace)
Multi-value: true
Include All option: true

패널에서 사용:
  sum by (pod) (
    rate(container_cpu_usage_seconds_total{
      namespace="$namespace"
    }[5m])
  )
```

---

## 7. 대시보드 구성 원칙

```
좋은 대시보드:
  □ 위에는 서비스 헬스 요약 (RED 지표)
  □ 중간에 상세 메트릭 (시계열)
  □ 아래에 로그 링크 또는 트레이스 링크
  □ 변수로 환경/네임스페이스 필터링

피해야 할 것:
  □ 50개 이상의 패널 (복잡도 과다)
  □ 아무도 안 보는 패널 방치
  □ 텍스트 설명 없는 메트릭 숫자
  □ 공유하지 않고 개인 대시보드만 사용
```

---

## 참고 문서

- [Grafana 공식 문서](https://grafana.com/docs/grafana/latest/)
- [Grafana Dashboard Gallery](https://grafana.com/grafana/dashboards/)
- [Grafana Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
