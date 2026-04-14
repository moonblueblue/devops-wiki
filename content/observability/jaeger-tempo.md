---
title: "Jaeger / Tempo"
date: 2026-04-14
tags:
  - jaeger
  - tempo
  - tracing
  - observability
sidebar_label: "Jaeger·Tempo"
---

# Jaeger / Tempo

## 1. 비교

| 항목 | Jaeger | Grafana Tempo |
|-----|--------|--------------|
| 개발사 | CNCF (Uber 기원) | Grafana Labs |
| 저장소 | Cassandra, Elasticsearch | 오브젝트 스토리지 (S3) |
| UI | 자체 UI | Grafana |
| 비용 | 높음 (ES 운영) | 낮음 (S3 활용) |
| Prometheus 연동 | 별도 설정 | 기본 통합 (TraceQL) |
| 적합 케이스 | 풍부한 UI 필요 | Grafana 스택 통합 |

---

## 2. Jaeger 설치

### All-in-one (개발·테스트)

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \   # UI
  -p 4317:4317 \     # OTLP gRPC
  -p 4318:4318 \     # OTLP HTTP
  jaegertracing/all-in-one:latest
```

### Kubernetes (Jaeger Operator)

```bash
kubectl create namespace observability
kubectl apply -f https://github.com/jaegertracing/jaeger-operator/releases/latest/download/jaeger-operator.yaml \
  -n observability
```

```yaml
# Jaeger 인스턴스
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger
  namespace: observability
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: https://elasticsearch:9200
        tls:
          ca: /es/certificates/ca.crt
```

---

## 3. Jaeger UI 활용

```
http://localhost:16686

Search:
  Service → 특정 서비스 선택
  Operation → HTTP POST /orders
  Tags → http.status_code=500 (에러 필터)
  Min Duration → 1s (느린 요청 필터)

결과:
  → 트레이스 목록 (소요 시간 순)
  → 클릭 → 서비스별 span 폭포수(waterfall) 뷰
  → 병목 구간 한눈에 파악
```

---

## 4. Tempo 설치

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install tempo grafana/tempo \
  --namespace monitoring \
  --create-namespace
```

```yaml
# tempo-values.yaml
tempo:
  storage:
    trace:
      backend: s3
      s3:
        bucket: my-tempo-traces
        endpoint: s3.amazonaws.com
        region: ap-northeast-2

  retention: 336h   # 14일

# OTLP 수신 활성화
server:
  http_listen_port: 3100
```

---

## 5. Grafana Tempo 연동

```yaml
# Grafana 데이터 소스 설정
- name: Tempo
  type: tempo
  url: http://tempo:3100
  jsonData:
    tracesToLogsV2:
      datasourceUid: loki   # 트레이스 → 로그 자동 링크
      filterByTraceID: true
      filterBySpanID: true
    serviceMap:
      datasourceUid: prometheus
    nodeGraph:
      enabled: true
```

---

## 6. TraceQL (Tempo 쿼리 언어)

```
# 서비스별 에러 트레이스
{.service.name = "payment-service" && status = error}

# 느린 트레이스 (1초 이상)
{duration > 1s}

# 특정 속성
{.http.status_code = 500 && .span.kind = server}

# 범위 집계
{.service.name = "payment-service"} | rate()
{.service.name = "payment-service"} | avg(duration)
{.service.name = "payment-service"} | quantile(duration, 0.99)
```

---

## 7. 트레이싱 활용 패턴

### 느린 요청 디버깅

```
1. Grafana Explore → Tempo 선택
2. 쿼리: {duration > 2s && .service.name = "api"}
3. 느린 트레이스 클릭
4. Waterfall 뷰에서 병목 span 확인
5. 해당 span의 DB 쿼리/외부 API 확인
```

### 에러 추적

```
1. Prometheus 알림 → 에러율 상승 감지
2. Grafana → Explore → Tempo
3. {status = error && .http.route = "/payment"}
4. 에러 발생 span의 예외 메시지 확인
5. traceId로 Loki에서 상세 로그 조회
```

---

## 참고 문서

- [Jaeger 공식 문서](https://www.jaegertracing.io/docs/)
- [Grafana Tempo 공식 문서](https://grafana.com/docs/tempo/latest/)
- [TraceQL](https://grafana.com/docs/tempo/latest/traceql/)
