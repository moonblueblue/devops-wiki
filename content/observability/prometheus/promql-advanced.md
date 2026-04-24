---
title: "PromQL 고급 — rate · 분위수 · subquery · 함정"
sidebar_label: "PromQL 고급"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-25
tags:
  - observability
  - prometheus
  - promql
  - histogram
  - rate
  - subquery
---

# PromQL 고급

> PromQL은 Prometheus의 질의 언어. 익히면 짧지만 함정이 많다. 이 글은
> **함수의 의미와 운영에서의 함정**을 정리한다. 입문은 공식 튜토리얼을
> 권장하고, 여기서는 **알아둬야 깊은 분석이 가능한 패턴**만 다룬다.

- **주제 경계**: PromQL **사용**을 다룬다. Prometheus 전체 동작은
  [Prometheus 아키텍처](prometheus-architecture.md), 룰 자동화는
  [Recording Rules](recording-rules.md).
- **선행**: 시계열·라벨 모델([Prometheus 아키텍처](prometheus-architecture.md) §3),
  [Exemplars](../concepts/exemplars.md).

---

## 1. 데이터 타입 한 페이지 정리

| 타입 | 모양 | 예 |
|---|---|---|
| **Instant Vector** | 시점 t의 시계열 셋 | `up` |
| **Range Vector** | t-Δ ~ t의 시계열 셋 | `up[5m]` |
| **Scalar** | 단일 숫자 | `0.95` |
| **String** | 문자열(거의 안 씀) | `"foo"` |

함수는 **입력/출력 타입이 정해져 있다**. `rate()`는 Range → Instant.
타입을 모르면 에러 메시지가 뭔지 안 보인다.

---

## 2. rate vs increase vs irate — Counter 처리

### 2.1 의미

| 함수 | 단위 | 사용 상황 |
|---|---|---|
| `rate(x[5m])` | 초당 변화량 | 알림·대시보드의 표준 |
| `increase(x[5m])` | 절대 증가량 | 단위 보존이 필요할 때 |
| `irate(x[5m])` | **마지막 두 sample**의 초당 변화량 | 짧은 스파이크 감지 |

> 셋 모두 **Counter 리셋을 자동 처리**한다. 새 sample이 이전보다 작으면
> 0으로 리셋된 것으로 간주하고 보정한다.

### 2.2 외삽(Extrapolation) — rate가 정수가 아닌 이유

Prometheus는 윈도우 경계를 정확히 채우지 못하는 경우 **선형 외삽**으로
보정한다.

| 상황 | 동작 |
|---|---|
| 첫 sample이 윈도우 시작에서 멀다 | 시간을 외삽해 시작 추정 |
| 마지막 sample이 끝에서 멀다 | 끝까지 외삽 |
| 외삽이 평균 간격의 1.1배 초과 | "시작/끝 구간으로 간주" → 외삽 한계 |

> 결과: `increase()`가 **정수가 아닌 값**(예: 4.83)을 돌려줄 수 있다.
> 실수처럼 보여도 정상 동작이다. `last9`·`SigNoz` 등 설명도 동일.

### 2.3 함정 — sum과 rate의 순서

```promql
# 잘못된 예 - 카운터 리셋 감지 깨짐 (subquery로 합산 후 rate)
rate(sum(http_requests_total)[5m:])

# 올바른 예
sum(rate(http_requests_total[5m]))
```

> **rate는 항상 먼저, sum은 나중에**. sum 후 rate를 하면 한 인스턴스의
> 리셋이 합산값의 "감소"로 보여 잘못된 보정이 된다.

### 2.4 윈도우 크기 가이드

| 목적 | 권장 |
|---|---|
| 알림(빠른 감지) | `[2m]`~`[5m]` |
| 대시보드 | `[5m]`~`[10m]` |
| 장시간 추세 | `[1h]` |
| 짧은 스파이크 | `irate` + `[1m]`(주의 §2.5) |

규칙: **rate 윈도우 ≥ scrape_interval × 4**. 그 이하면 sample 부족으로
외삽 오차가 커지고, NaN이 나오기 쉽다.

### 2.5 irate 사용 주의

`irate`는 마지막 두 샘플만 본다 → 알림 룰에 쓰면 **flap 위험**.
대시보드의 "지금 이 순간" 표시에만 적합.

---

## 3. 히스토그램과 분위수

### 3.1 Classic Histogram의 함정

```promql
histogram_quantile(0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket[5m]))
)
```

| 주의 | 이유 |
|---|---|
| **`le` 라벨 보존 필수** | `sum by (le)` 또는 `sum without`로 다른 라벨만 제거 |
| `rate` 안에 `_bucket` | `_count`나 `_sum`이 아님 |
| 버킷 경계 의존 | 99분위가 마지막 두 버킷 사이면 정밀도 ↓ |
| `+Inf` 버킷 누락 | 결과 부정확 |

### 3.2 Native Histogram

```promql
# Native Histogram에서는 le 신경 쓸 필요 없음
histogram_quantile(0.99, rate(http_request_duration_seconds[5m]))
```

| 함수 | 동작 |
|---|---|
| `histogram_quantile()` | classic·native 모두 지원, 자동 분기 |
| `histogram_avg()` | native 전용, 평균 |
| `histogram_count()`·`histogram_sum()` | native, count·sum |
| `histogram_fraction(0,0.1, x)` | 0~0.1초 내 비율 |

> Native Histogram이 도입되면 **`le` 라벨이 사라지고 카디널리티가
> 1/10**로 줄어든다. 마이그레이션은 점진적으로([Native Histograms](../metric-storage/exponential-histograms.md)).

### 3.3 분위수의 의미

> 99분위 = 100건 중 1건이 이 값을 초과. **평균 ≠ p99**. SLO·UX는
> 항상 분위수로. 평균은 회귀 분석용에만.

---

## 4. 집계와 그룹

### 4.1 by · without

```promql
sum by (route) (rate(http_requests_total[5m]))
sum without (instance, pod) (rate(http_requests_total[5m]))
```

| 사용 | 의미 |
|---|---|
| `by (...)` | 명시한 라벨만 남기고 합산 |
| `without (...)` | 명시한 라벨을 제거하고 합산 |

> **`by`로 화이트리스트** 권장. 새 라벨이 추가될 때 `without`은
> 의도치 않게 라벨이 살아남는다.

### 4.2 topk·bottomk·quantile

| 함수 | 용도 |
|---|---|
| `topk(5, ...)` | 상위 5개 시계열 |
| `bottomk(5, ...)` | 하위 5개 |
| `quantile(0.99, ...)` | **시계열들의** 분위수(샘플의 분위수 아님) |

> `quantile`은 histogram_quantile과 다른 함수다. **시계열 인스턴스
> 분포의 분위수**(예: 100개 노드의 CPU 99분위) 용도.

### 4.3 set 연산자 — `and`·`or`·`unless`

| 연산자 | 의미 |
|---|---|
| `A and B` | A의 시계열 중 B와 라벨 매칭되는 것만 |
| `A or B` | 둘 중 하나에만 있어도 |
| `A unless B` | A에서 B와 매칭되는 것 제외 |

> set 연산자는 **기본 many-to-many**로 동작하며 `group_left/right`를
> 받지 않는다. "B가 있을 때만 A 평가"·"B가 없을 때만 A 발화" 같은
> 조건부 알림의 기본 도구.

### 4.4 group_left·group_right — 1대다 매칭

서로 다른 메트릭 사이에서 라벨로 매칭.

```promql
# kube_pod_info의 node 라벨을 cpu 메트릭에 join
sum by (node) (
  rate(container_cpu_usage_seconds_total[5m])
  * on (pod, namespace) group_left(node)
    kube_pod_info
)
```

| 토큰 | 의미 |
|---|---|
| `on (라벨)` | 매칭에 사용할 공통 라벨 |
| `ignoring (라벨)` | 매칭에서 제외할 라벨 |
| `group_left(라벨)` | 우측이 다(多), 좌측이 일(一). 우측의 라벨 가져오기 |
| `group_right(라벨)` | 반대 |

> 가장 헷갈리는 영역. **에러 메시지 "many-to-many matching not
> allowed"** 가 뜨면 `group_left/right` 누락 또는 매칭 라벨 부족.

---

## 5. Subquery — 시계열 안의 시계열

### 5.1 구문

```promql
max_over_time( rate(http_requests_total[5m])[1h:5m] )
```

`[1h:5m]` = 지난 1시간 동안 5분 간격으로 평가한 instant vector를
range vector로.

| 사용 | 예 |
|---|---|
| 분위수의 분위수 | `quantile_over_time(0.99, rate(x[5m])[1h:])` |
| 변동성 | `stddev_over_time(rate(x[5m])[6h:])` |
| 최대 비율 | `max_over_time(rate(x[5m])[1h:5m])` |

### 5.2 비용 주의

Subquery는 **내부 쿼리를 step 횟수만큼 평가**한다. `[24h:1m]`이면
1440번 평가. 큰 시계열에 쓰면 쿼리 시간이 비례.

> 실용 가이드: subquery는 **사후 분석용**. 알림이나 자주 쓰는
> 대시보드에는 [Recording Rules](recording-rules.md)로 미리 계산.

---

## 6. Offset · @modifier

### 6.1 offset

```promql
http_requests_total - http_requests_total offset 1w
```

`offset Δ`는 **현재 시점에서 Δ 과거의 값**을 보게 한다. 주간/월간 비교에
유용.

### 6.2 @ modifier

```promql
http_requests_total @ 1714030400
http_requests_total @ end()
```

특정 절대 시각 또는 `start()` / `end()`(쿼리 윈도우의 시작/끝)에서
평가. 그래프 위에 "기준 시점 값"을 고정해 표시할 때.

---

## 7. 예측·추세·라벨 변환

### 7.1 `predict_linear` — 추세 외삽

```promql
# 4시간 후 예상 디스크 잔량
predict_linear(node_filesystem_avail_bytes[1h], 4*3600) < 0
```

> 지난 1시간의 선형 추세로 4시간 후 값을 예측. **디스크 고갈 알림**의
> 표준 패턴(SRE Book에서도 인용).

### 7.2 `deriv` — Gauge의 기울기

```promql
# 큐 깊이가 분당 증가하는 속도
deriv(queue_depth[10m])
```

> Gauge에는 `rate()`를 절대 쓰지 않는다(rate는 counter 전용). Gauge의
> 변화율은 `deriv()`(선형회귀 기반) 또는 `delta()`(시작·끝 단순 차).

### 7.3 `holt_winters` → `double_exponential_smoothing` (3.0)

3.0에서 함수가 리네이밍되고 **experimental 플래그 뒤로 이동**했다.

```promql
# 3.0+
double_exponential_smoothing(node_load1[1h], 0.5, 0.1)
```

> `--enable-feature=promql-experimental-functions` 필요. 시계열 평활화
> 용도지만 운영 알림에는 권장하지 않는다(파라미터 튜닝 어려움).

### 7.4 `label_replace` · `label_join`

```promql
# instance="10.0.0.1:9100"에서 IP만 추출
label_replace(up, "ip", "$1", "instance", "([^:]+):.*")

# 여러 라벨을 합쳐 새 라벨 생성
label_join(up, "endpoint", "/", "instance", "job")
```

> Recording Rule에서 join 키를 만들거나 라벨 정규화에 사용.

### 7.5 stale marker — 사라진 시계열의 표시

Prometheus는 시계열이 사라질 때 **특수 NaN(stale marker)**를 5분 안에
기록한다. `rate()`·`increase()`는 이를 실제 값으로 처리하지 않고 끝점
으로만 사용한다.

| 상황 | 영향 |
|---|---|
| 타깃이 SD에서 사라짐 | 마지막 sample 5분 후 stale marker |
| `up{job=...}` 시계열 자체 부재 | `absent_over_time`이 발화 |
| 일시적 scrape 실패 | stale 아님(값만 누락) |

> 운영 함정: 알림이 startup 직후 false positive를 내는 이유 중 하나가
> stale marker 처리. **`for: 5m` 이상**과 함께 쓰면 대부분 회피된다.

---

## 8. Range Vector 셀렉터의 변경 (3.0+)

3.0부터 range vector 셀렉터가 **left-open · right-closed**로
변경됐다.

| 항목 | 2.x | 3.0+ |
|---|---|---|
| 셀렉터 경계 | `[t-Δ, t]` (양쪽 포함) | `(t-Δ, t]` (좌개·우폐) |
| step 경계 정렬 sample | 두 윈도우에서 모두 평가 | 우측(다음) 윈도우에서만 평가 |

> 마이그레이션 영향: 케이스에 따라 `rate()`·`increase()` 결과가
> **변하지 않을 수도 있고, 약간 차이가 날 수도** 있다. 정확해진 결과
> 이며 알림 임계치는 재검증 권장.

---

## 9. 자주 쓰는 운영 패턴

### 9.1 Golden Signals

```promql
# Latency p99
histogram_quantile(0.99,
  sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))
)

# Error Rate
sum by (route) (rate(http_requests_total{code=~"5.."}[5m]))
  /
sum by (route) (rate(http_requests_total[5m]))

# Traffic
sum by (route) (rate(http_requests_total[5m]))

# Saturation - CPU
1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))
```

### 9.2 Up/Health

```promql
# 값이 0인 시계열 (스크랩 실패) — alert rule의 for: 5m와 함께
up{job="api"} == 0

# 시계열 자체가 사라짐 (SD에서 제거) — for 절 필수, 부팅 직후 false positive 주의
absent_over_time(up{job="api"}[10m])
```

> 두 패턴은 다른 사고를 잡는다. `up == 0`은 **타깃은 있는데 응답
> 실패**, `absent_over_time`은 **타깃이 SD에서 사라짐**.

### 9.3 Burn Rate (SLO)

```promql
# 99.9% SLO일 때 1h 윈도우 burn rate
# burn_rate = error_rate / (1 - SLO)
sum(rate(http_requests_total{code=~"5.."}[1h]))
  /
sum(rate(http_requests_total[1h]))
  / (1 - 0.999)
```

> 수식 의미: **에러율 ÷ 허용 에러 예산**. burn rate ≥ 14.4면 한 시간에
> 한 달치 에러 예산을 다 소진하는 속도.

자세한 내용은 [SLO 알림](../alerting/slo-alerting.md).

### 9.4 OTLP 메트릭 join (3.0+ `info()`, EXPERIMENTAL)

```promql
# target_info의 service.version을 메트릭에 join
info(rate(http_requests_total[5m]))
```

`info()` 함수는 **`target_info` 메트릭의 라벨**을 instant vector에
자동 join. OTLP에서 들어온 service·deployment 메타를 분석에 합치는
표준 패턴.

> **2026.04 시점 experimental**. `--enable-feature=promql-experimental-functions`
> 플래그가 필요하며, 시그니처가 바뀔 수 있다. 프로덕션 알림은 stable이
> 될 때까지 보류.

---

### 9.5 UTF-8 메트릭 이름 quoting (3.0+)

OTLP에서 들어온 점 표기 메트릭은 PromQL에서 **메트릭 이름도 큰따옴표
안**에 둔다.

```promql
# 옛 표기
http_server_request_duration_seconds_count

# UTF-8 표기 (메트릭 이름과 라벨 모두 quoted)
{"http.server.request.duration", "http.route"="/api/orders"}
```

`metric_name_validation_scheme: utf8`이 활성화되어야 한다.

---

## 10. 흔한 실수와 처방

| 실수 | 결과 | 처방 |
|---|---|---|
| `rate(x[1m])` (scrape ≥ 30s) | sample 부족, NaN/외삽 오차 | `scrape × 4` 이상, 권장 `[5m]` |
| `sum(rate(x))` 안 한 채 `histogram_quantile` | le 누락으로 NaN | `sum by (le) (rate(_bucket))` |
| `sum(http_requests_total)` (rate 없이) | 누적값 자체를 합산 | rate 먼저 |
| Counter에 `delta()` 사용 | 의미 없음 | `increase()` |
| Gauge에 `rate()` 사용 | 의미 다름(미분) | `deriv()` 또는 `delta()` |
| `quantile_over_time(0.99, x[1h])` 자주 사용 | 비용 폭발 | Recording Rule |
| `topk(5, ...)`을 알림에 직접 | 라벨 변동에 따라 다른 시계열 | absent + 명시 라벨 |
| `irate`를 알림에 사용 | flap | rate |
| `code=~"5.."` 정규식 누락 | 4xx까지 에러로 셈 | 명시 |
| OTLP·legacy 메트릭 join | UTF-8 라벨 quoting 누락 | `{"http.route"="..."}` |

---

## 11. 디버깅 팁

| 도구 | 용도 |
|---|---|
| `/api/v1/query?query=...&stats=all` | 평가 통계, sample/series 수 |
| Web UI Graph 탭 + Explain | 단계별 결과 |
| `prometheus_engine_query_duration_seconds` | 느린 쿼리 |
| Mimir/Thanos query stats | 분산 환경 |
| `promtool check rules` · `pint` | 룰 정적 분석 |
| `promtool test rules` | 룰 단위 테스트 |

> 느린 쿼리는 거의 항상 **고카디널리티 + 큰 range vector**의 조합.
> Recording Rule로 사전 집계 + 라벨 줄이기.

---

## 12. 다음 단계

- [Recording Rules](recording-rules.md) — 사전 집계로 쿼리 가속
- [Alertmanager](alertmanager.md)
- [SLO 알림](../alerting/slo-alerting.md)
- [Multi-window 알림](../alerting/multi-window-alerting.md)
- [히스토그램 (Exponential·Native)](../metric-storage/exponential-histograms.md)
- [카디널리티 관리](../metric-storage/cardinality-management.md)

---

## 참고 자료

- [Prometheus Querying — Functions](https://prometheus.io/docs/prometheus/latest/querying/functions/) (2026-04 확인)
- [Prometheus 3 migration guide](https://prometheus.io/docs/prometheus/latest/migration/) (range vector 변경)
- [How Exactly Does PromQL Calculate Rates? — PromLabs](https://promlabs.com/blog/2021/01/29/how-exactly-does-promql-calculate-rates/)
- [Rate then sum, never sum then rate — Robust Perception](https://www.robustperception.io/rate-then-sum-never-sum-then-rate/)
- [rate()/increase() extrapolation — Issue #3746](https://github.com/prometheus/prometheus/issues/3746)
- [Prometheus rate vs increase — SigNoz](https://signoz.io/guides/understanding-prometheus-rate-vs-increase-functions-correctly/)
- [Native Histograms 스펙](https://prometheus.io/docs/specs/native_histograms/)
- [Counter Rates & Increases — PagerTree](https://pagertree.com/learn/prometheus/promql/counter-rates-and-increases)
