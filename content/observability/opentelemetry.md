---
title: "OpenTelemetry 소개"
date: 2026-04-14
tags:
  - opentelemetry
  - otel
  - observability
  - cncf
sidebar_label: "OpenTelemetry"
---

# OpenTelemetry 소개

## 1. 개요

CNCF Graduated 프로젝트.
메트릭, 로그, 트레이스를 **벤더 중립적**으로 수집하는 표준.

```
OpenTelemetry = API + SDK + Collector

API:   계측 인터페이스 (언어별 SDK)
SDK:   실제 구현체 (트레이스 생성, 수집, 내보내기)
Collector: 수집·변환·라우팅 파이프라인
```

---

## 2. OTel Collector 아키텍처

```
앱 (OTel SDK)
    ↓ OTLP (gRPC/HTTP)
OTel Collector
    ├── Receivers  (OTLP, Jaeger, Prometheus, ...)
    ├── Processors (batch, memory_limiter, ...)
    └── Exporters  (Jaeger, Prometheus, Loki, ...)
            ↓
    Jaeger / Tempo / Prometheus / Loki
```

---

## 3. Collector 설정

```yaml
# otel-collector.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318
  prometheus:
    config:
      scrape_configs:
      - job_name: 'myapp'
        static_configs:
        - targets: ['myapp:8080']

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  memory_limiter:
    limit_mib: 400
    spike_limit_mib: 100
    check_interval: 5s
  # 샘플링 (tail-based)
  tail_sampling:
    decision_wait: 10s
    policies:
    - name: errors-policy
      type: status_code
      status_code:
        status_codes: [ERROR]
    - name: slow-traces
      type: latency
      latency:
        threshold_ms: 1000

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, tail_sampling]
      exporters: [otlp/jaeger]
    metrics:
      receivers: [otlp, prometheus]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
```

---

## 4. 언어별 SDK

### Java (자동 계측)

```bash
# Agent 방식: 코드 변경 없이 자동 계측
java \
  -javaagent:opentelemetry-javaagent-2.x.jar \
  -Dotel.service.name=payment-service \
  -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
  -Dotel.resource.attributes=deployment.environment=production \
  -jar app.jar
```

### Python

```python
# pip install opentelemetry-sdk opentelemetry-exporter-otlp

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

# 트레이서 설정
provider = TracerProvider()
provider.add_span_processor(
    BatchSpanProcessor(
        OTLPSpanExporter(endpoint="http://otel-collector:4317")
    )
)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer("my-service")

with tracer.start_as_current_span("my-operation") as span:
    span.set_attribute("key", "value")
    do_work()
```

### Go

```go
// go get go.opentelemetry.io/otel

func initTracer() *sdktrace.TracerProvider {
    exporter, _ := otlptracegrpc.New(
        context.Background(),
        otlptracegrpc.WithEndpoint("otel-collector:4317"),
        otlptracegrpc.WithInsecure(),
    )
    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exporter),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String("my-service"),
        )),
    )
    otel.SetTracerProvider(tp)
    return tp
}
```

---

## 5. Kubernetes 배포 (OTel Operator)

```bash
# OpenTelemetry Operator 설치
kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
```

```yaml
# Collector 배포
apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector
spec:
  mode: DaemonSet    # 또는 Deployment, Sidecar
  config: |
    receivers:
      otlp:
        protocols:
          grpc: {}
    exporters:
      otlp:
        endpoint: jaeger:4317
    service:
      pipelines:
        traces:
          receivers: [otlp]
          exporters: [otlp]

# 자동 계측 주입 (사이드카 방식)
---
apiVersion: opentelemetry.io/v1alpha1
kind: Instrumentation
metadata:
  name: my-instrumentation
spec:
  java:
    image: ghcr.io/open-telemetry/opentelemetry-operator/autoinstrumentation-java:latest
```

---

## 참고 문서

- [OpenTelemetry 공식 문서](https://opentelemetry.io/)
- [OTel Collector](https://opentelemetry.io/docs/collector/)
- [언어별 SDK](https://opentelemetry.io/docs/languages/)
