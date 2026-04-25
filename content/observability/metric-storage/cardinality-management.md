---
title: "카디널리티 관리 — 원인·탐지·통제"
sidebar_label: "카디널리티"
sidebar_position: 3
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - observability
  - metric-storage
  - cardinality
  - prometheus
  - relabeling
  - stream-aggregation
  - adaptive-metrics
---

# 카디널리티 관리

> **모든 메트릭 백엔드의 비용·메모리·쿼리 성능은 active series 수의 1차
> 함수**다. Prometheus·Mimir·Thanos·VictoriaMetrics 어느 쪽이든
> 카디널리티 폭발 한 번이면 OOM·청구서 폭증·쿼리 마비가 동시에 온다.
> 잡는 도구는 비슷하지만, **언제·어디서 잡느냐**가 운영 품질을 가른다.

- **주제 경계**: 이 글은 **원인 진단·탐지·통제**. 백엔드별 한도 설정은
  [Mimir·Thanos·Cortex·VM](mimir-thanos-cortex.md), 히스토그램 `le` 폭탄은
  [히스토그램](exponential-histograms.md), 비용 모델 전반은
  관측 비용(작성 예정) 참조.
- **선행**: [Prometheus 아키텍처](../prometheus/prometheus-architecture.md),
  [Recording Rules](../prometheus/recording-rules.md).

---

## 1. 카디널리티 — 정의와 비용

**Cardinality (메트릭 카디널리티) = 한 메트릭이 만드는 시계열의 수.**
한 메트릭이 가진 라벨 조합 수와 동일.

```
http_requests_total{method="GET",  endpoint="/api/v1/users", status="200"}
http_requests_total{method="POST", endpoint="/api/v1/users", status="201"}
http_requests_total{method="GET",  endpoint="/api/v1/users", status="500"}
...
```

→ method 5 × endpoint 50 × status 7 = **1,750 시계열** (한 메트릭 기준).

### 1.1 카디널리티가 비용을 결정하는 이유

| 자원 | 영향 |
|---|---|
| Ingester/메모리 | head block 인덱스가 active series 수에 비례 |
| TSDB 디스크 | block 크기·sparse 인덱스 비례 |
| 쿼리 시간 | matcher가 후보 시리즈를 fan-out — 시리즈 수에 거의 선형 |
| 객체 스토리지 비용 | block 수·index 크기 → API 요청 수 폭증 |
| 백엔드 청구서 | active series 또는 sample 단위 요금 |

> **active series 수 = 비용 함수의 첫 변수**. 이걸 통제하지 못하면
> 어떤 백엔드도 답이 없다.

### 1.2 Label Cardinality vs Metric Cardinality

| 용어 | 정의 | 곱셈 위치 |
|---|---|---|
| **Label cardinality** | 한 라벨의 distinct 값 수 (예: `endpoint` = 50) | 곱셈 인자 |
| **Metric cardinality** | 한 메트릭의 시계열 수 = 라벨 cardinality 곱 | 곱셈 결과 |

> 진단·통제는 **인자(label cardinality)** 단위로 한다. "어느 라벨이 곱셈을
> 키우는가"를 찾는 것이 카디널리티 사냥의 핵심.

### 1.3 Cardinality vs Churn — 둘 다 잡아야 한다

| 개념 | 정의 | 부담 |
|---|---|---|
| **Cardinality** | 동시에 살아있는 active series 수 | 메모리·인덱스·쿼리 fan-out |
| **Churn** | 시간당 새로 만들어지고/사라지는 series 수 | head block compaction 부담, WAL 폭증 |

- 카디널리티가 낮아도 churn이 높으면 ingester가 무너진다 (예: 매 분
  pod_id가 바뀌는 ephemeral 워크로드).
- churn은 **`prometheus_tsdb_head_series_created_total`** 의 rate로 추적.

---

## 2. 폭발의 흔한 원인

### 2.1 사용자 식별자·세션 ID·UUID

| 라벨 (Bad) | 추정 차수 | 위험 |
|---|---|---|
| `user_id` | 수만~수억 | 즉시 폭발 |
| `session_id` | 수십만 | 폭발 + churn |
| `request_id`·`trace_id` | 무한대 | 1회용, churn 폭발 |
| `customer_email` | 사용자 수 | PII 위험 동반 |
| `pod_uid` | 재배포마다 churn | 시간 따라 누적 |

> 이런 라벨은 **메트릭이 아니라 트레이스·로그에 둘 것**. 트레이스는
> 카디널리티 비용 모델이 다르다 (샘플링 가능).

### 2.2 무경계 외부 입력

- HTTP `path` 그대로 (예: `/api/v1/users/12345/orders/67890` 전부 별개)
- 사용자 입력 query parameter
- 에러 메시지 문자열
- `User-Agent` raw 값

→ **반드시 normalization**: 경로 템플릿(`/api/v1/users/:id/orders/:order_id`),
status code 클래스(`2xx`), bucketing.

### 2.3 Kubernetes 자동 라벨

cAdvisor·kubelet·node-exporter·kube-state-metrics가 만드는 자동 라벨
일부는 **운영 가치 대비 카디널리티가 매우 높다**:

| 라벨·메트릭 | 보통 폭주 | 권장 |
|---|---|---|
| `container_id` | 재배포마다 churn | drop |
| `image_id` | 이미지 해시 | drop |
| `pod_template_hash` | replicaset마다 churn | drop |
| `id` (cgroup full path) | 매우 높음 | drop |
| `name`(컨테이너 이름) | 적정 | 보존 |
| `namespace`, `pod`, `container` | 적정 | 보존 |

추가로 **자주 폭탄이 되는 메트릭**:

| 메트릭 | 곱셈 차원 | 대응 |
|---|---|---|
| `apiserver_request_duration_seconds_bucket` (kube-apiserver) | `verb × resource × code × le` | 사용 범위로 drop, 중요한 verb만 보존 |
| `kube_pod_container_resource_requests`/`_limits` (kube-state-metrics) | resource × pod × container | 컨테이너 리소스 추적이 아니면 drop |
| `node_systemd_unit_state` (node-exporter) | unit × state 곱 | 모니터링 대상 unit만 명시 keep |

→ 잘 알려진 `kubernetes_sd` 환경에서 metric_relabel로 위 라벨·메트릭을
drop하면 **시리즈 수 50~90% 감축** 사례가 흔하다.

### 2.4 히스토그램 `le` × 라벨 조합

[히스토그램](exponential-histograms.md#3-classic-histogram--무엇이-문제인가)
참조. native histogram으로 전환하면 `le` 차원이 사라진다.

### 2.5 over-instrumentation

같은 정보를 여러 라벨·메트릭으로 노출 (예: `*_total` + `*_count` + 별도
라벨 차원). 라이브러리 default가 과다할 수 있음. **scrape 후 무엇이
실제 사용되는지 분석**이 필수.

---

## 3. 탐지 — 데이터로 보기

### 3.1 Prometheus TSDB Status

내장 진단의 1차 도구. **반드시 정기 점검**.

```
http://<prometheus>/api/v1/status/tsdb?limit=20
```

`limit` (default 10, max 10000). 또는 UI: **Status → TSDB Status**.

| 필드 | 의미 |
|---|---|
| `seriesCountByMetricName` | 메트릭별 시리즈 수 (top N) |
| `labelValueCountByLabelName` | 라벨별 distinct 값 수 |
| `seriesCountByLabelValuePair` | 라벨=값 조합별 시리즈 수 |
| `memoryInBytesByLabelName` | 라벨별 사용 메모리 (v3.6+ experimental) |

### 3.2 PromQL — 실시간 카디널리티 쿼리

```promql
# 메트릭별 시리즈 수 top 10
topk(10, count by (__name__)({__name__=~".+"}))

# 가장 시리즈를 많이 만드는 job
topk(10, count by (job)({__name__=~".+"}))

# 특정 메트릭에서 라벨 X의 distinct 값 수 (label cardinality)
count(count by (endpoint) (http_requests_total))
```

> **주의**: PromQL만으로 "모든 라벨의 distinct 값 수 top N"을 일괄
> 구할 수는 없다. 라벨 이름은 `__name__`처럼 메타가 아니어서 변수로
> 못 쓴다. 그 용도는 **TSDB Status API**·**`mimirtool analyze`**·
> **VMUI Cardinality Explorer**가 정답.

### 3.3 Churn 추적

```promql
# 시간당 새로 만들어진 시리즈 수
rate(prometheus_tsdb_head_series_created_total[1h])

# 활성 head series
prometheus_tsdb_head_series

# scrape별 추가 시리즈 — churn 발생 위치
topk(20, increase(scrape_series_added[1h]))
```

> **alert 권장**: `rate(prometheus_tsdb_head_series_created_total[1h]) > 1000`
> 같은 절대치보다, 7일 baseline 대비 % 증가가 더 안정적.

### 3.4 `tsdb analyze` — 오프라인 분석

```bash
promtool tsdb analyze /var/lib/prometheus/data/<block-id>
```

- 메트릭별 시리즈 수, 라벨 분포, 가장 큰 라벨 값들 등 상세 보고서.
- **block 단위**라서 역사적 분석에 적합.

### 3.5 백엔드별 도구

| 백엔드 | 도구 |
|---|---|
| Mimir | `cardinality-analysis` API, `mimirtool analyze` |
| VictoriaMetrics | **Cardinality Explorer** (VMUI), Grafana plugin (2026-03 신규) |
| Thanos | `tsdb analyze` (블록별), Querier `/api/v1/status/tsdb` |
| Grafana Cloud | Adaptive Metrics 대시보드 |

---

## 4. 통제 — 4단 방어

```mermaid
flowchart LR
    A[클라이언트] --> B[scrape]
    B --> C[Remote Write]
    C --> D[백엔드]
```

| 단계 | 도구 | 적합 시점 |
|---|---|---|
| ① 클라이언트 | 라벨 명세 설계, `_id` 류 제거 | 새 코드·라이브러리 도입 시 |
| ② Scrape (relabel) | `metric_relabel_configs`·`relabel_configs` | 기존 exporter 통제 |
| ③ Remote Write 시 | vmagent/Alloy stream aggregation, OTel processor | 백엔드 도착 전 일괄 절감 |
| ④ 백엔드 한도 | per-tenant `max_series` 등 limit | "막을 수 없을 때 막는다" |

### 4.1 ① 클라이언트 — 가장 싸고 효과적

- 라벨 명세를 코드 리뷰 단계에서 통제. `id`·`uuid`·`email` 등은 PR
  거부 사유.
- bounded enum (status 클래스, region, tier) 사용.
- 메트릭 추가 시 **예상 cardinality 계산 의무화**: 라벨값 곱.

### 4.2 ② Scrape Relabeling — 가장 자주 쓰는 무기

`relabel_configs` vs `metric_relabel_configs` 구분이 핵심.

| 항목 | `relabel_configs` | `metric_relabel_configs` |
|---|---|---|
| 적용 시점 | scrape **전** | scrape **후** |
| 입력 | SD가 만든 메타 라벨(`__meta_*`) | 실제 수집된 시리즈 |
| 용도 | 타겟 자체 drop, 라벨 재할당 | 시리즈·메트릭·라벨 drop |
| 카디널리티 통제 | 타겟 단위 | 시계열 단위 |

#### 라벨 drop 예시 (Kubernetes)

```yaml
metric_relabel_configs:
  - regex: 'container_id|pod_uid|image_id|id'
    action: labeldrop
  - source_labels: [__name__]
    regex: 'go_(memstats|gc|threads).*'
    action: drop
```

- `labeldrop`: 라벨 키 자체 제거. 제거 후 동일해진 시리즈끼리는 sample
  단위로 충돌할 수 있음.
- `drop`: 매칭되는 시계열 자체 제거.

> **labeldrop 함정**: 라벨 제거 후 동일해진 시리즈가 같은 timestamp에
> 다른 값을 보내면 `Error on ingesting samples with different value but
> same timestamp`로 **충돌 sample이 drop**되며 scrape가 부분 실패한다.
> 적용 전 staging dry-run + `prometheus_target_scrapes_sample_duplicate_timestamp_total`
> 모니터링 필수.

#### high-cardinality value normalization

```yaml
metric_relabel_configs:
  # /api/users/12345 → /api/users/:id
  - source_labels: [path]
    regex: '/api/users/\d+'
    target_label: path
    replacement: '/api/users/:id'
```

### 4.3 ③ Stream Aggregation — 런타임 절감

원본을 그대로 두고 **집계된 series만 백엔드에 보낸다**. 카디널리티
절감의 가장 강력한 도구.

| 도구 | 위치 | 비고 |
|---|---|---|
| **vmagent `-streamAggr`** | Prometheus와 백엔드 사이 | OSS, 가장 성숙 |
| **Grafana Alloy** (`prometheus.relabel`/`prometheus.exporter`) | Agent | OTel pipeline과 통합 |
| **OTel Collector** (`filter`·`transform`·`attributes`·`metricstransform`) | OTLP pipeline | OTel 일급 |
| **Mimir Adaptive Metrics** | 백엔드 측 (Cloud only) | SaaS, 자동 추천 |

> **OTel processor 정리**: `filterprocessor`는 datapoint **drop만 가능**
> (attribute 제거 불가). attribute 제거·정규화는 **`transformprocessor`
> (OTTL)** 또는 **`attributesprocessor`** 가 정답. `metricstransform`은
> 이름 변경·집계, `groupbyattrsprocessor`는 그룹핑 — 카디널리티 통제용은
> 아님. 처음 도입 시 가장 자주 헷갈리는 지점.

#### vmagent 예시

```yaml
- match: 'http_requests_total'
  interval: 1m
  outputs: [total]
  by: [job, status_class]
```

→ 원본의 모든 라벨 조합 × 인스턴스 수가 **(job × status_class) 시계열로
1분 간격 사전 합산**되어 송신. 시리즈 수 90%+ 절감 흔함.

### 4.4 ④ 백엔드 한도 — 마지막 안전망

#### Mimir

YAML `limits.*` 키 / CLI `-ingester.*` 또는 `-querier.*` flag 양쪽으로
설정 가능. 값 `0`은 모두 "무제한".

| 한도 | 기본값 | 의미 |
|---|---|---|
| `max_global_series_per_user` | 150,000 | tenant당 active series 상한 |
| `max_global_series_per_metric` | 0 (무제한) | metric 1개당 상한 |
| `max_fetched_series_per_query` | 0 (무제한) | 쿼리 1회 fetch series 상한 |
| `max_fetched_samples_per_query` | 0 (무제한) | 쿼리 1회 sample 상한 |
| `max_label_names_per_series` | 30 | 시리즈당 라벨 수 상한 (distributor validation) |

> 멀티테넌시 환경에서 **tenant별 override**가 필수. `runtime.yaml`로
> 무재시작 변경 가능. `max_label_names_per_series`는
> `X-Mimir-SkipLabelCountValidation` 헤더로 우회 가능.

#### VictoriaMetrics

| 옵션 | 의미 |
|---|---|
| `-maxLabelsPerTimeseries` | 시리즈당 라벨 수 상한 (default **40**, 초과 라벨은 drop) |
| `-maxLabelValueLen` | 라벨값 길이 상한 |
| `-search.maxUniqueTimeseries` | 쿼리 fetch series 상한 |
| `-storage.maxHourlySeries` | 시간당 신규 series (churn 통제) |
| `-storage.maxDailySeries` | 일별 신규 series |

> **VM 함정**: `maxLabelsPerTimeseries` 초과 시 에러가 아니라 **초과
> 라벨이 조용히 drop**된다. 모니터링이 없으면 카디널리티 통제는 됐어도
> 데이터 의미가 달라진다.

#### 한도가 hit되면

- Prometheus·vmagent: scrape error, scrape 일부 누락.
- Mimir: `429 Too Many Requests` (limit exceeded), 일부 sample drop.
- → **alert 필수**. 한도 hit는 데이터 손실이며 자동 회복이 아님.

```promql
# Mimir — discarded samples
sum by (reason)(rate(cortex_discarded_samples_total[5m])) > 0

# Prometheus — duplicate timestamp (labeldrop·HA 충돌)
rate(prometheus_target_scrapes_sample_duplicate_timestamp_total[5m]) > 0

# Prometheus — out of order
rate(prometheus_target_scrapes_sample_out_of_order_total[5m]) > 0
```

---

## 5. Adaptive 패턴 — 자동 절감

### 5.1 Grafana Cloud Adaptive Metrics

- 대시보드·alert·recording rule이 **실제로 사용하는 라벨**을 분석.
- 사용되지 않는 라벨을 **롤업/aggregation**으로 자동 절감.
- 평균 35% 절감 (1500+ 조직 평균, 2025-02 기준), 일부 조직 50~70% 보고.
- 2025-10에 Adaptive Telemetry suite로 확장 — metrics·logs·traces·profiles
  공통 적용.
- 도입 위험: 사용 패턴 분석 결과를 검토 없이 적용하면 향후 ad-hoc
  쿼리가 깨질 수 있음. **추천을 검토·승인 워크플로우**로 운영.

### 5.2 OSS 대안 — VM Stream Aggregation + 사용량 분석

Adaptive Metrics와 동등한 자동화는 OSS에 없다. 다만:
1. **Grafana 대시보드 사용 라벨 분석**: dashboards JSON을 파싱하여 실제
   참조되는 라벨 set 추출.
2. **Recording rule·alert 라벨 분석**: rules YAML 파싱.
3. 위 두 set 외 라벨에 stream aggregation을 자동 적용.

→ 직접 구축한 조직들이 운영 중 (Adevinta·Wise 등 사례 공개).

---

## 6. 설계 가이드 — 재발 방지

### 6.1 라벨 설계 체크리스트

새 메트릭·라벨 추가 시:
- [ ] 라벨이 bounded enum인가? (값 종류가 100 미만)
- [ ] PR 시 cardinality 추정값을 명시했는가? (예상 values × 다른 라벨)
- [ ] 사용자 식별자·UUID·request_id 아닌가?
- [ ] 같은 정보가 trace·log에 더 적합하지 않은가?
- [ ] 사용처(대시보드·alert)가 명확한가? "혹시 모르니"는 거부.

### 6.2 SLO

| SLO | 모니터링 |
|---|---|
| Active series 수 | TSDB head series, **P95 사용률** vs 한도 |
| Churn rate | `prometheus_tsdb_head_series_created_total` rate |
| 가장 큰 메트릭 | 정기 ranking, 임계 위반 alert |
| 백엔드 한도 hit | `cortex_discarded_samples_total` 등 |

### 6.3 정기 점검 (분기 1회 권장)

- TSDB Status → 가장 큰 메트릭 top 20.
- 라벨별 distinct value 수 추이.
- 7일 평균 churn rate vs 90일 평균.
- 사용 안 되는 메트릭 식별 (Adaptive Metrics 또는 자체 스크립트).

### 6.4 Recording Rule·Federation의 카디널리티 영향

- **Recording rule은 카디널리티를 줄이는 도구**지만, 잘못 작성하면 **원본
  보다 더 많은 시리즈를 만든다**. 흔한 실수: `by ()` 누락, `label_replace`로
  신규 라벨 도입, 복수 source label cross product 발생.
- **Federation**은 receiver 측 카디널리티를 폭증시키는 함정. `honor_labels`
  설정·라벨 보존 정책에 따라 동일한 시리즈가 다른 라벨로 두 번 들어올 수
  있다. Remote Write가 federation보다 카디널리티 통제에 유리.

---

## 7. 안티패턴

| 안티패턴 | 결과 | 대안 |
|---|---|---|
| "혹시 필요할까봐" 라벨 | 카디널리티 폭증 | 사용 시점에 추가 |
| 모든 path 그대로 라벨링 | URI 무한대 카디널리티 | 경로 템플릿 normalization |
| 스택트레이스·에러 메시지 라벨 | 무한 unique 값 | error code enum |
| 백엔드 한도만 의존 | 데이터 drop, 불안정 | ②·③ 사전 통제 |
| Cardinality alert 없음 | 심야에 OOM | TSDB head series·churn alert |
| trace·metric 라벨 동일 시도 | metric 폭발 | trace는 sampling, metric은 bounded |

---

## 8. 의사결정 가이드

긴급: 운영 중 ingester가 OOM/한도 hit:
- → 우선 ② **metric_relabel_configs**로 가장 큰 메트릭 drop 또는 라벨
  drop. 1시간 내 적용 가능한 가장 빠른 수단. Prometheus는 `SIGHUP` 또는
  `/-/reload` 엔드포인트로 무중단 적용.

중기: 동일 패턴 반복 방지:
- → ③ **stream aggregation** (vmagent·Alloy·OTel)을 계측 파이프라인에
  표준 도입. 새 서비스가 들어와도 자동 절감.

장기: 신규 코드 카디널리티 통제:
- → ① **라벨 설계 가이드**를 PR 리뷰 항목으로 명문화.

비용 최적화 단독 목적, Cloud 사용:
- → **Adaptive Metrics** (Grafana Cloud) 또는 자체 분석 + stream agg.

---

## 9. 함께 보기

- [Mimir·Thanos·Cortex·VM](mimir-thanos-cortex.md) — 백엔드별 한도·도구
- [히스토그램](exponential-histograms.md) — `le` 폭탄 관련
- [Recording Rules](../prometheus/recording-rules.md) — 사후 집계 절감
- [Remote Write](../prometheus/remote-write.md) — vmagent/Alloy 위치
- [Prometheus 아키텍처](../prometheus/prometheus-architecture.md) — TSDB head series

---

## 참고 자료

- [Prometheus TSDB Status API](https://prometheus.io/docs/prometheus/latest/querying/api/#tsdb-stats) — 확인 2026-04-25
- [Prometheus Configuration (relabel_configs)](https://prometheus.io/docs/prometheus/latest/configuration/configuration/) — 확인 2026-04-25
- [Robust Perception — tsdb analyze for churn/cardinality](https://www.robustperception.io/using-tsdb-analyze-to-investigate-churn-and-cardinality/) — 확인 2026-04-25
- [Grafana — Manage high cardinality in Prometheus and Kubernetes](https://grafana.com/blog/2022/10/20/how-to-manage-high-cardinality-metrics-in-prometheus-and-kubernetes/) — 확인 2026-04-25
- [VictoriaMetrics Stream Aggregation](https://docs.victoriametrics.com/victoriametrics/stream-aggregation/) — 확인 2026-04-25
- [VictoriaMetrics Relabeling Cookbook](https://docs.victoriametrics.com/victoriametrics/relabeling/) — 확인 2026-04-25
- [VictoriaMetrics 2026-03 Ecosystem (Cardinality Explorer)](https://victoriametrics.com/blog/victoriametrics-march-2026-ecosystem-updates/) — 확인 2026-04-25
- [Mimir Configuration Parameters](https://grafana.com/docs/mimir/latest/configure/configuration-parameters/) — 확인 2026-04-25
- [Mimir Runtime Configuration](https://grafana.com/docs/mimir/latest/configure/about-runtime-configuration/) — 확인 2026-04-25
- [Grafana Cloud Adaptive Metrics](https://grafana.com/docs/grafana-cloud/cost-management-and-billing/reduce-costs/metrics-costs/control-metrics-usage-via-adaptive-metrics/) — 확인 2026-04-25
- [Adevinta — Adaptive Metrics 도입 사례](https://adevinta.com/techblog/how-to-reduce-your-grafana-cloud-costs-with-adaptive-metrics/) — 확인 2026-04-25
- [Grafana Adaptive Telemetry 2025-10](https://grafana.com/blog/2025/10/08/adaptive-telemetry-suite-in-grafana-cloud/) — 확인 2026-04-25
- [OTel Filter Processor README](https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/filterprocessor/README.md) — 확인 2026-04-25
- [VictoriaMetrics maxLabelsPerTimeseries default 변경 (Issue #7661)](https://github.com/VictoriaMetrics/VictoriaMetrics/issues/7661) — 확인 2026-04-25
