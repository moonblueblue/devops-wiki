---
title: "Exemplars — 메트릭에서 트레이스로 점프하는 다리"
sidebar_label: "Exemplars"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-25
tags:
  - observability
  - exemplars
  - openmetrics
  - prometheus
  - native-histograms
  - opentelemetry
---

# Exemplars

> **Exemplar**은 메트릭 샘플 옆에 붙는 **"이 수치를 만든 대표 요청 한
> 건의 trace_id"** 같은 메타데이터다. 메트릭 대시보드에서 스파이크를
> 발견했을 때, Exemplar이 있으면 **그 시점·그 분위수의 실제 트레이스
> 한 건**으로 한 번 클릭에 점프한다. 메트릭과 트레이스 사이의 다리.

- **주제 경계**: 이 글은 **표준·동작·운영**을 다룬다. Tempo·Jaeger
  같은 트레이스 백엔드는 [Jaeger·Tempo](../tracing/jaeger-tempo.md).
- **선행**: [관측성 개념](observability-concepts.md) §3.1, [Semantic
  Conventions](semantic-conventions.md)에서 다룬 Trace Context 개념을
  전제한다.

---

## 1. 왜 Exemplar이 필요한가

### 1.1 해결하는 문제

| 시나리오 | Exemplar 없을 때 | 있을 때 |
|---|---|---|
| p99 지연 스파이크 발견 | 트레이스에서 시간 범위 추측 검색 | 클릭 한 번에 대표 trace |
| 카나리 에러율 급등 | 실패 trace_id를 로그에서 grep | 메트릭 옆 trace로 점프 |
| 특정 지역만 느림 | 라벨 분해 후 trace 다시 검색 | 그 라벨의 exemplar 조회 |

> 메트릭은 **집계**, 트레이스는 **단건**. 둘은 서로 다른 질문에
> 답하지만 **같은 요청을 다르게 본 것**이다. Exemplar이 그 동일성을
> 데이터로 보존한다.

### 1.2 OpenMetrics가 정의했다

**OpenMetrics**(CNCF Incubating, RFC급 표준)가 Exemplar을 처음 정식으로
규정했다. Prometheus 텍스트 포맷의 상위 호환이며, **OpenMetrics 형식
스크랩일 때만** Prometheus가 exemplar를 받아낸다.

```
# HELP http_request_duration_seconds Histogram of request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 1234 # {trace_id="4bf9..."} 0.087 1714030401.123
http_request_duration_seconds_bucket{le="0.5"} 1502 # {trace_id="9c2a..."} 0.412 1714030402.456
```

> `# {label="value"} 값 타임스탬프` 부분이 Exemplar. 메트릭 샘플과
> **같은 줄**의 코멘트로 부착되며, **OpenMetrics에서만 유효한 문법**.

---

## 2. 데이터 모델

### 2.1 부착 가능한 메트릭 유형

| 메트릭 타입 | Exemplar 부착 | 비고 |
|---|---|---|
| **Histogram bucket** | 가장 일반적 | 분위수 기반 점프의 핵심 |
| **Counter (`_total`)** | 가능 | OpenMetrics는 `_total` MetricPoint에만 허용 |
| **Native Histogram** | 가능, **여러 개 부착** | 리스트 형태, 타임스탬프 필수 |
| **Summary** | **정의상 미지원** | OpenMetrics 1.0이 부착 금지 |
| **Gauge** | 정의상 불가 | 순간값에 "대표 요청"이 없음 |

> 실무에서 90%는 **Histogram bucket exemplar**. p99 같은 분위수 분석을
> 자동 생성된 exemplar로 점프할 수 있게 한다.

### 2.2 라벨 제약

OpenMetrics 스펙:

- 모든 라벨 이름·값 합산 **128 UTF-8 문자 이하**
- `trace_id`, `span_id` 표준 키 권장(SemConv는 강제하지 않음)
- 메트릭 자체의 라벨과 **별개의 차원**(카디널리티 폭발 영향 없음)

### 2.3 Native Histogram의 차이

기존 Histogram의 `le=` 버킷마다 1개 exemplar이었다면, **Native
Histogram**은 여러 exemplar을 리스트로 부착하고 **타임스탬프 필수**다.

| 항목 | Classic Histogram | Native Histogram |
|---|---|---|
| Exemplar 수 | 버킷당 0~1 | 샘플당 0~N |
| 타임스탬프 | 선택 | 필수 |
| 노출 포맷 | OpenMetrics 텍스트 + Protobuf | **Protobuf만** (텍스트 노출 없음) |

> Native Histogram은 데이터 모델 자체가 텍스트 표현을 갖지 않아
> **Prometheus Protobuf scrape 또는 OTLP·PRW v2**로만 전송된다.
> 자세한 내용은
> [히스토그램 (Exponential·Native)](../metric-storage/exponential-histograms.md).

---

## 3. Prometheus 운영

### 3.1 활성화

Prometheus는 **2.26+**에서 exemplar 저장을 지원하나, 기본은 비활성이며
**feature flag**로 켠다(2026.04 기준 여전히 feature flag 단계).

```bash
# 1. feature flag로 exemplar storage 활성화 (필수)
# 2. (선택) 메모리 내 원형 버퍼 크기 조정
prometheus \
  --enable-feature=exemplar-storage \
  --storage.tsdb.max-exemplars=100000
```

YAML로도 크기 조정 가능(플래그는 별도로 켜야 한다):

```yaml
# prometheus.yml
storage:
  exemplars:
    max_exemplars: 100000   # 메모리 내 원형 버퍼 크기
```

| 항목 | 동작 |
|---|---|
| 저장소 | **메모리 내 fixed-size circular buffer** |
| 영속성 | **없음** — 재시작 시 초기화 |
| 쿼리 | `/api/v1/query_exemplars` |
| Remote Write | OTLP, **PRW v2(EXPERIMENTAL, 2026.04)** 에서 전파 가능 |

### 3.2 스크랩 포맷 강제

Prometheus는 **OpenMetrics 또는 Protobuf** 형식을 받을 때만 exemplar를
저장한다. exemplar storage가 활성화된 상태에서는 자동 협상이 OpenMetrics
를 우선하나, 일부 exporter가 `Accept` 헤더 협상을 무시하므로 **Prometheus
2.49+의 `scrape_protocols`**로 명시 강제한다.

```yaml
scrape_configs:
  - job_name: app
    scrape_protocols:
      - OpenMetricsText1.0.0
      - PrometheusProto
      - PrometheusText0.0.4
    static_configs:
      - targets: ["app:8080"]
```

Exporter 측은 응답 헤더(`Content-Type: application/openmetrics-text`
또는 `application/vnd.google.protobuf`)로 검증.

### 3.3 쿼리

```promql
# 일반 쿼리
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```

Grafana는 위 쿼리에 **자동으로 exemplar 트레이스 점**을 그래프에
오버레이한다(다음 §5).

---

## 4. SDK 측 — Exemplar을 만드는 곳

### 4.1 OpenTelemetry SDK

OTel SDK Metric은 **활성 Span이 있을 때 자동으로 exemplar 부착**.
별도 코드 변경 없이 trace_id·span_id가 들어간다.

```python
# Python
from opentelemetry import metrics, trace

meter = metrics.get_meter(__name__)
hist = meter.create_histogram(
    "http.server.request.duration",
    unit="s",
)

with tracer.start_as_current_span("handle_request"):
    # 이 측정에 자동으로 exemplar(trace_id, span_id) 부착됨
    hist.record(0.412, {"http.route": "/v1/orders"})
```

### 4.2 Prometheus client_python·client_go

직접 부착 가능하나 OTel처럼 자동이 아니다.

```python
from prometheus_client import Counter

c = Counter("requests_total", "Total")
c.inc(exemplar={"trace_id": current_trace_id()})
```

### 4.3 Exemplar Filter — 어떤 측정에 부착할지

| Filter | 설명 |
|---|---|
| `AlwaysOn` | 모든 측정에 exemplar 부착 |
| `AlwaysOff` | 비활성 |
| `TraceBased` | **샘플된 trace에서만** 부착(스펙 권장 기본) |

> SDK별 기본값 주의: Python·Java·Go 등 대부분은 `TraceBased`. **.NET
> SDK는 기본 `AlwaysOff`**로, 명시적으로 켜야 한다.
> exemplar는 트레이스 백엔드에 해당 trace가 있어야 의미가 있으므로,
> **TraceBased + 트레이스 샘플링**이 표준 조합. Trace가 샘플 아웃되면
> exemplar 클릭이 빈 화면으로 간다.

### 4.4 Exemplar Reservoir — 어떤 샘플을 유지할지

Filter가 통과시킨 측정 중에서 **어떤 exemplar를 보존할지**는 Reservoir가
결정한다. 측정은 많고 exemplar 슬롯은 한정적이라서 필요한 추상.

| Aggregation | 권장 Reservoir |
|---|---|
| Explicit-bucket Histogram | `AlignedHistogramBucketExemplarReservoir` (버킷당 1) |
| Base2 Exponential Histogram | `SimpleFixedSizeExemplarReservoir` (`size = min(buckets, 20)`) |
| 그 외(Counter 등) | `SimpleFixedSizeExemplarReservoir` |

> Reservoir를 모르면 "왜 exemplar가 일부만 보존되는가"를 디버깅할 수
> 없다. 핫 버킷에 측정이 몰리면 같은 슬롯이 덮어쓰이는 게 정상 동작.

### 4.5 OTLP를 통한 전파

OTel SDK가 만든 exemplar는 **OTLP `Exemplar` proto 메시지**로
SDK → Collector → 백엔드까지 흘러간다. Collector의 `attributes`·
`filter`·`metricstransform` processor는 exemplar를 **기본적으로 보존**
하지만, attribute 변형 시 trace_id가 사라지지 않게 정책 명시 권장.

| 경로 | exemplar 보존 |
|---|---|
| OTel SDK → OTLP → Collector | 보존 |
| Collector → OTLP → Backend(Tempo·Datadog·Honeycomb 등) | 보존 |
| Collector → Prometheus Remote Write v1 | **미지원**(스펙상 exemplar 필드 없음) |
| Collector → Prometheus Remote Write v2(EXPERIMENTAL) | 보존 |
| Collector → `prometheusremotewrite` exporter | exporter 옵션 `send_exemplars: true` 필요 |

---

## 5. Grafana — 시각화와 점프

### 5.1 데이터소스 설정

Grafana Prometheus 데이터소스의 **Exemplars** 섹션에서 trace 백엔드
연결.

| 필드 | 예 |
|---|---|
| Internal link → Data source | Tempo |
| Label name | `trace_id` |
| URL | `${__value.raw}` (자동 채움) |

설정 후 메트릭 패널에 **다이아몬드 마커**가 그래프 위에 찍히고,
클릭하면 Tempo Trace View로 이동.

### 5.2 트레이스 ↔ 로그 (Loki) 양방향

Exemplar는 메트릭 → 트레이스만 다리를 놓는다. 트레이스 ↔ 로그는
별도 설정.

| 방향 | 설정 위치 |
|---|---|
| Metric → Trace | Prometheus DS의 Exemplars |
| Trace → Logs | Tempo DS의 *Trace to logs* |
| Logs → Trace | Loki DS의 *Derived fields*(`trace_id` 추출) |

> 세 다리를 모두 잇는 게 표준 패턴. Time shift는 Grafana 기본이 0이며,
> 클럭 드리프트가 큰 환경에서만 ±2~5s 권장.

---

## 6. 흔한 함정

| 함정 | 증상 | 처방 |
|---|---|---|
| Trace가 샘플 아웃됐는데 exemplar는 부착 | "Trace not found" | TraceBased 샘플링 사용 |
| Native Histogram + exemplar를 OpenMetrics scrape | exemplar 누락 | OTLP/PRW 사용 |
| Prometheus 재시작 → exemplar 증발 | 과거 시점 점프 불가 | Mimir/Cortex 등 영속 백엔드 |
| `max_exemplars` 너무 작음 | 최신 것만 남고 옛것 덮어쓰기 | 트래픽 기반으로 조정 |
| 라벨 합산 128자 초과 | exemplar 거부 | trace_id+span_id로만 |
| Gauge에 exemplar 부착 시도 | 의미 없음 | Counter/Histogram만 |
| Exemplar 라벨에 PII | 컴플라이언스 위반 | trace_id·span_id만 |
| `Accept` 헤더 협상 실패 | 옛 Prometheus 포맷으로 동작 | Exporter 헤더 확인 |

---

## 7. 비용·확장 고려

### 7.1 메모리

| 메트릭 수 | 권장 `max_exemplars` |
|---|---|
| ≤ 10만 시계열 | 50,000 |
| ≤ 100만 | 200,000 |
| ≥ 1,000만 | 1,000,000+ (Mimir로 이관 권장) |

> Exemplar 한 건 ≈ 100~200B(라벨 포함) 메모리. 1M개 = 약 200MB.

### 7.2 영속화

Prometheus는 **메모리 내 원형 버퍼**만 지원. 영구 저장이 필요하면:

- **Mimir**(Grafana) — Remote Write 수신 후 long-term 저장에 exemplar
  포함
- **Thanos** — 메모리 내만, 영속화는 미지원
- **Cortex** — Mimir로 fork된 후에도 CNCF Incubating으로 별개 존속.
  신규 채택은 Mimir 권장
- **VictoriaMetrics** — Remote Write 수신 시 exemplar 라벨을 받지만
  **정식 storage exemplar 지원은 미흡**(2026.04 기준)

자세한 비교는
[Mimir·Thanos·Cortex·VictoriaMetrics](../metric-storage/mimir-thanos-cortex.md).

---

## 8. 표준 준수 체크리스트

| 항목 | 준수 여부 확인 |
|---|---|
| OpenMetrics 또는 OTLP로 exposition | exporter 응답 헤더 |
| `trace_id`, `span_id` 라벨 사용 | OTel SDK 기본 |
| Exemplar 라벨 합 128자 이하 | hexadecimal trace_id 32자 + span_id 16자 |
| TraceBased 샘플링 | Trace와 일치 |
| Grafana 데이터소스 Exemplars 설정 | Internal link |
| Tempo/Jaeger 백엔드 연결 | trace 보관 기간 = exemplar 보관 기간 |

---

## 9. 다음 단계

- [APM과 관측성](apm-overview.md) — Exemplar이 옛 APM "transaction
  drill-down" UX를 표준화
- [PromQL 고급](../prometheus/promql-advanced.md)
- [히스토그램 (Exponential·Native)](../metric-storage/exponential-histograms.md)
- [Jaeger·Tempo](../tracing/jaeger-tempo.md)
- [샘플링 전략](../tracing/sampling-strategies.md)

---

## 참고 자료

- [OpenMetrics 스펙 — Exemplars](https://github.com/prometheus/OpenMetrics/blob/main/specification/OpenMetrics.md#exemplars)
- [Prometheus — Feature flags / Exemplars](https://prometheus.io/docs/prometheus/latest/feature_flags/) (2026-04 확인)
- [Native Histograms — Prometheus 스펙](https://prometheus.io/docs/specs/native_histograms/)
- [Grafana Tempo 데이터소스 — Configure exemplars](https://grafana.com/docs/grafana/latest/datasources/tempo/configure-tempo-data-source/) (2026-04 확인)
- [Trace discovery in Grafana — Tempo · Loki · Exemplars](https://grafana.com/blog/2020/11/09/trace-discovery-in-grafana-tempo-using-prometheus-exemplars-loki-2.0-queries-and-more/)
- [OpenTelemetry — Metrics Exemplars (.NET)](https://github.com/open-telemetry/opentelemetry-dotnet/blob/main/docs/metrics/exemplars/README.md)
- [client_python — Exemplars](https://prometheus.github.io/client_python/instrumenting/exemplars/)
- [How to Configure Prometheus Exemplars (2026)](https://oneuptime.com/blog/post/2026-02-09-prometheus-exemplars-link-metrics-traces/view)
