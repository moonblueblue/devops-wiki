---
title: "분산 트레이싱 개념"
date: 2026-04-14
tags:
  - tracing
  - distributed-systems
  - observability
sidebar_label: "분산 트레이싱"
---

# 분산 트레이싱 개념

## 1. 왜 필요한가

마이크로서비스 환경에서 단일 요청이 여러 서비스를 거친다.
어느 서비스에서 얼마나 걸렸는지 추적하지 않으면
성능 문제의 원인을 알 수 없다.

```
사용자 → API Gateway → 인증 서비스 → 주문 서비스 → DB
                              ↘ 상품 서비스 → Cache

전체 응답이 3초 → 어디서 느린가?
→ 분산 트레이싱 없이는 알 수 없음
```

---

## 2. 핵심 개념

### Trace

하나의 요청이 처리되는 **전체 흐름**.
고유한 TraceId로 식별한다.

```
TraceId: abc-123-def
  ├── API Gateway:     0ms ~ 10ms
  ├── Auth Service:    10ms ~ 50ms
  ├── Order Service:   50ms ~ 200ms
  │   ├── DB Query:    60ms ~ 190ms   ← 병목
  └── Total: 200ms
```

### Span

Trace 내의 **단일 작업 단위**.
시작·종료 시간, 서비스 이름, 상태를 포함한다.

```
Span {
  traceId: "abc-123-def"
  spanId: "span-001"
  parentSpanId: null    # root span
  service: "api-gateway"
  operation: "POST /orders"
  startTime: 2026-04-14T09:00:00.000Z
  duration: 200ms
  status: OK
  tags: {http.status: 200, http.method: POST}
}
```

### Context Propagation

서비스 간 TraceId를 전달하는 메커니즘.

```
HTTP Header로 전파:
  traceparent: 00-abc123def456-span001-01
  tracestate: vendor=value

gRPC Metadata로 전파
Message Queue 헤더로 전파
```

---

## 3. 샘플링 전략

전체 요청의 트레이스를 저장하면 비용이 폭증한다.

| 전략 | 설명 | 적합 케이스 |
|-----|------|-----------|
| **Head-based** | 요청 시작 시 샘플링 결정 (1%) | 기본 설정 |
| **Tail-based** | 완료 후 에러/느린 것만 보존 | 오류 디버깅 |
| **Always On** | 모든 요청 트레이스 | 개발/테스트 |
| **Rate Limiting** | 초당 N개 제한 | 부하 제어 |

```yaml
# 실무 권장: Tail-based Sampling
# 에러 요청: 100% 보존
# 느린 요청 (p95 초과): 100% 보존
# 나머지: 1% 랜덤 샘플링
```

---

## 4. W3C TraceContext 표준

```
HTTP Header:
  traceparent: {version}-{traceId}-{parentId}-{flags}
  traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01

  version: 00 (고정)
  traceId: 128비트 (32 hex)
  parentId: 64비트 (16 hex)
  flags: 01=sampled, 00=not sampled
```

OpenTelemetry, Jaeger, Zipkin이 이 표준을 따른다.

---

## 5. 애플리케이션 계측 (Instrumentation)

### 자동 계측

```java
// Java - OpenTelemetry Java Agent
// JVM 옵션으로 자동 계측 (코드 변경 없음)
java -javaagent:opentelemetry-javaagent.jar \
     -Dotel.service.name=payment-service \
     -Dotel.exporter.otlp.endpoint=http://otel-collector:4317 \
     -jar app.jar
```

### 수동 계측

```python
# Python - OpenTelemetry SDK
from opentelemetry import trace

tracer = trace.get_tracer("payment-service")

def process_payment(order_id):
    with tracer.start_as_current_span("process_payment") as span:
        span.set_attribute("order.id", order_id)
        span.set_attribute("payment.method", "credit_card")

        result = charge_card(order_id)

        if not result.success:
            span.set_status(Status(StatusCode.ERROR))
            span.record_exception(result.error)
        return result
```

---

## 6. 트레이싱 에코시스템

```
계측 레이어: OpenTelemetry SDK / Agent
    ↓
수집·변환: OpenTelemetry Collector
    ↓
저장: Jaeger / Tempo / Zipkin
    ↓
시각화: Jaeger UI / Grafana (Tempo)
```

---

## 참고 문서

- [OpenTelemetry](https://opentelemetry.io/)
- [W3C TraceContext](https://www.w3.org/TR/trace-context/)
- [Google Dapper Paper](https://research.google/pubs/pub36356/)
