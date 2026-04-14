---
title: "메트릭, 로그, 트레이스 (Observability 3 Pillars)"
date: 2026-04-14
tags:
  - observability
  - metrics
  - logs
  - tracing
sidebar_label: "3 Pillars"
---

# 메트릭, 로그, 트레이스 (3 Pillars)

## 1. 전체 그림

```
시스템 이상 감지
  ↓
메트릭 (Metrics): "무엇이 비정상인가?"
  → CPU 90%, 에러율 5% 상승
  ↓
로그 (Logs): "어떤 에러가 발생했는가?"
  → "NullPointerException at UserService:42"
  ↓
트레이스 (Traces): "어디서 얼마나 걸렸는가?"
  → API → UserService(200ms) → DB(1500ms) ← 병목
```

---

## 2. 메트릭 (Metrics)

**시계열 숫자 데이터.**
집계된 수치로 시스템 상태를 표현한다.

```
prometheus_http_requests_total{status="200"} 1234 @timestamp

주요 메트릭 유형:
  Counter   → 단조 증가 (요청 수, 에러 수)
  Gauge     → 증가/감소 (CPU, 메모리, 연결 수)
  Histogram → 버킷별 분포 (응답 시간 분포)
  Summary   → 분위수 (p50, p95, p99)
```

**장점**: 저장 비용 낮음, 집계·시각화 용이
**단점**: 맥락 없음, 왜 발생했는지 모름

---

## 3. 로그 (Logs)

**이벤트의 불변 기록.**
언제, 무슨 일이 일어났는지를 텍스트로 표현한다.

```json
{
  "timestamp": "2026-04-14T09:30:00Z",
  "level": "ERROR",
  "service": "payment-service",
  "traceId": "abc123",
  "message": "Payment failed: insufficient funds",
  "userId": "user-789",
  "amount": 5000
}
```

**로그 레벨:**

| 레벨 | 용도 |
|-----|------|
| ERROR | 즉시 조치 필요한 문제 |
| WARN | 주의 필요, 당장은 괜찮음 |
| INFO | 정상 흐름 기록 |
| DEBUG | 개발용 상세 정보 |

**장점**: 풍부한 맥락, 원인 분석에 직접적
**단점**: 저장 비용 높음, 비정형이라 검색 어려움

---

## 4. 트레이스 (Traces)

**요청의 전체 여정 추적.**
분산 시스템에서 하나의 요청이 어떤 서비스를 거쳤는지 시각화한다.

```
TraceId: abc123
  Span: API Gateway       [0ms   ~ 10ms]
  Span: UserService       [10ms  ~ 80ms]
    Span: DB Query        [20ms  ~ 75ms]  ← 병목
  Span: OrderService      [80ms  ~ 150ms]
    Span: Cache Hit       [82ms  ~ 84ms]
  Total: 150ms
```

**주요 개념:**

| 용어 | 설명 |
|-----|------|
| Trace | 하나의 요청 전체 흐름 (고유 TraceId) |
| Span | 트레이스 내 단일 작업 단위 |
| Parent/Child Span | 서비스 간 호출 관계 |
| Baggage | 컨텍스트 전파 데이터 |

**장점**: 분산 시스템 병목 즉시 파악
**단점**: 샘플링 필요 (전수 저장 비용 과다)

---

## 5. 세 가지의 연계

```
알림 발생 (메트릭: 에러율 5% 초과)
    ↓
로그 검색 (TimeRange + service=payment)
    → ERROR: payment-service timeout
    ↓
트레이스 조회 (traceId로 전체 흐름 확인)
    → DB 쿼리 2000ms 지연 발견
```

세 가지를 연결하는 핵심: **TraceId / CorrelationId**.
모든 데이터(메트릭 label, 로그 필드, 트레이스 span)에
동일한 TraceId를 포함시켜야 한다.

---

## 6. 도구 생태계

| Pillar | 오픈소스 | 관리형 SaaS |
|--------|---------|------------|
| 메트릭 | Prometheus + Grafana | Datadog, New Relic |
| 로그 | ELK Stack, Loki | Datadog, Splunk |
| 트레이스 | Jaeger, Tempo | Datadog APM, Honeycomb |
| 통합 수집 | OpenTelemetry | - |

---

## 참고 문서

- [OpenTelemetry](https://opentelemetry.io/)
- [Prometheus](https://prometheus.io/docs/)
- [Elastic Stack](https://www.elastic.co/what-is/elk-stack)
