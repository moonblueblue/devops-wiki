---
title: "Loki"
date: 2026-04-14
tags:
  - loki
  - logging
  - grafana
  - observability
sidebar_label: "Loki"
---

# Loki

## 1. 개요

Grafana Labs에서 개발한 로그 집계 시스템.
Prometheus처럼 **레이블 기반**으로 로그를 인덱싱한다.
로그 내용 자체는 인덱싱하지 않아 비용이 낮다.

```
Grafana ←→ Loki
             ↑
          Promtail / Fluent Bit / OpenTelemetry
             ↑
     Kubernetes Pod 로그 (/var/log/containers/)
```

---

## 2. ELK와의 차이

| 항목 | Loki | ELK |
|-----|------|-----|
| 인덱싱 | 레이블만 인덱싱 | 로그 전체 인덱싱 |
| 저장 비용 | 낮음 | 높음 |
| 검색 방식 | 레이블 필터 + regex | 전문 검색 |
| 쿼리 언어 | LogQL | KQL/Lucene |
| Grafana 통합 | 기본 내장 | 별도 Kibana |
| 운영 복잡도 | 낮음 | 높음 |

---

## 3. 설치 (Helm)

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# 단순 구성 (SimpleScalable 모드)
helm install loki grafana/loki \
  --namespace monitoring \
  --create-namespace \
  --values loki-values.yaml
```

```yaml
# loki-values.yaml
loki:
  auth_enabled: false
  storage:
    type: filesystem    # 테스트용; 프로덕션은 S3/GCS/Azure

  limits_config:
    retention_period: 30d

# 내장 수집기 활성화 (Promtail 내장)
singleBinary:
  replicas: 1
```

---

## 4. Promtail 설정

Loki 공식 수집기. Kubernetes에서 DaemonSet으로 실행한다.

```yaml
# promtail-config.yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
- url: http://loki:3100/loki/api/v1/push

scrape_configs:
- job_name: kubernetes-pods
  kubernetes_sd_configs:
  - role: pod
  pipeline_stages:
  # JSON 로그 파싱
  - json:
      expressions:
        output: log
        stream: stream
        timestamp: time
        level: level
  - labels:
      stream:
      level:
  - timestamp:
      source: timestamp
      format: RFC3339Nano
  - output:
      source: output
  relabel_configs:
  - source_labels: [__meta_kubernetes_pod_label_app]
    target_label: app
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
  - source_labels: [__meta_kubernetes_pod_name]
    target_label: pod
```

---

## 5. LogQL 쿼리 언어

```logql
# 기본 필터: 네임스페이스 + 레이블
{namespace="production", app="payment"}

# 텍스트 포함
{app="payment"} |= "error"

# 정규식
{app="payment"} |~ "timeout|connection refused"

# JSON 파싱 후 필터
{app="payment"} | json | level="error"

# 특정 필드 기준 필터
{app="payment"} | json | status_code >= 500

# 라인 형식 변환 (출력)
{app="payment"} | json | line_format "{{.level}} {{.message}}"

# 메트릭 집계 (LogQL Metrics)
# 5분간 에러 발생 수
count_over_time(
  {app="payment"} |= "error" [5m]
)

# 에러율 계산
sum(rate({app="payment"} |= "error" [5m]))
  /
sum(rate({app="payment"} [5m]))
```

---

## 6. Grafana에서 Loki 쿼리

```
Grafana → Explore → 데이터 소스: Loki

LogQL 입력:
  {namespace="production"} |= "error" | json

결과:
  → 타임라인 (에러 발생 분포)
  → 로그 라인 목록
  → 레이블 분포
```

---

## 7. 장기 보존 (S3 연동)

```yaml
# loki-values.yaml (프로덕션 설정)
loki:
  storage:
    type: s3
    s3:
      endpoint: s3.amazonaws.com
      bucketnames: my-loki-logs
      region: ap-northeast-2
      access_key_id: <key>
      secret_access_key: <secret>

  compactor:
    retention_enabled: true
    retention_delete_delay: 2h
    retention_delete_worker_count: 150

  limits_config:
    retention_period: 90d
    ingestion_rate_mb: 16
    ingestion_burst_size_mb: 32
```

---

## 참고 문서

- [Loki 공식 문서](https://grafana.com/docs/loki/latest/)
- [LogQL 레퍼런스](https://grafana.com/docs/loki/latest/query/)
- [Loki Best Practices](https://grafana.com/docs/loki/latest/best-practices/)
