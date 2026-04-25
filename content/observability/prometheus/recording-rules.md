---
title: "Recording Rules — 사전 집계로 쿼리 가속"
sidebar_label: "Recording"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-25
tags:
  - observability
  - prometheus
  - recording-rules
  - aggregation
  - promql
---

# Recording Rules

> **Recording Rule**은 자주 쓰는 비싼 PromQL 쿼리를 **사전 계산해
> 새 시계열로 저장**하는 메커니즘. 대시보드 응답 속도, 알림 룰의
> 안정성, Federation·Remote Write 비용을 한 번에 잡는다.
> 글로벌 스탠다드의 표준 운영 도구.

- **주제 경계**: 이 글은 **표기 규약·운영 패턴**을 다룬다. 알림 룰은
  [Alertmanager](alertmanager.md), Recording Rule을 SLO 룰 자동
  생성으로 쓰는 도구는
  [Sloth·Pyrra](../slo-as-code/slo-rule-generators.md).
- **선행**: [PromQL 고급](promql-advanced.md), [Prometheus 아키텍처](prometheus-architecture.md) §7.

---

## 1. 왜 Recording Rule인가

| 문제 | Recording Rule이 해결하는 방법 |
|---|---|
| 대시보드 로딩 5~30초 | 미리 계산된 시계열로 즉시 응답 |
| 알림 PromQL이 복잡해 디버깅 어려움 | 룰 단위로 분해, 알림 식 단순화 |
| 같은 쿼리를 여러 알림이 중복 평가 | 한 번 계산, 다수가 참조 |
| Federation으로 모든 데이터 복제 | 사전 집계된 결과만 federate |
| 비싼 `quantile_over_time` 자주 호출 | Recording으로 분당 1회만 계산 |
| 카디널리티 폭발 | 라벨 줄여 새 시계열 생성 |

> **운영 룰**: 하루에 5번 이상 같은 쿼리를 평가하면 Recording Rule을
> 의심하라.

---

## 2. 정의 — 어떻게 쓰는가

```yaml
# rules/api.yaml
groups:
  - name: api.rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: |
          sum without (instance, pod) (
            rate(http_requests_total[5m])
          )
        labels:
          team: platform
```

| 키 | 의미 |
|---|---|
| `record` | 새 메트릭 이름 |
| `expr` | PromQL |
| `labels` | 결과 시계열에 추가할 라벨 |
| `interval` | 그룹 단위 평가 주기(생략 시 전역 `evaluation_interval`) |

룰 파일은 `prometheus.yml`의 `rule_files`에 등록.

```yaml
rule_files:
  - "rules/*.yaml"
```

---

## 3. 명명 규약 — `level:metric:operations`

Prometheus 공식 권고는 콜론 구분 3분할.

```
level                  메트릭이 집계된 레벨(라벨 셋)
metric                 원본 메트릭 이름(rate면 _total 제거)
operations             최신 연산이 가장 왼쪽
```

### 3.1 예시

| 룰 이름 | 의미 |
|---|---|
| `instance:node_cpu:rate5m` | 인스턴스 단위 CPU rate |
| `job:http_requests:rate5m` | job 단위 합계 rate |
| `cluster_namespace:container_cpu:sum_rate5m` | 클러스터·네임스페이스 합 |
| `route:http_request_duration:histogram_quantile_p99_5m` | 경로별 p99 |

### 3.2 규칙 요약

| 규칙 | 예 |
|---|---|
| 라벨이 곧 level | `instance:`, `job:`, `cluster_namespace:` |
| `_total` 떼기 | `rate` 후 `:rate5m` 사용 |
| `_sum`은 다른 연산이 있으면 생략 | `sum(rate(...))` → `:rate5m` |
| 비율은 `_per_` + `:ratio` | `errors_per_total:ratio5m` |
| 시간 윈도우는 마지막 토큰 | `:rate5m`, `:p99_5m` |

> 일관된 prefix만 잘 잡으면 알림·대시보드의 **자동완성·검색**이
> 차원이 달라진다.

---

## 4. 그룹과 평가 흐름

### 4.1 그룹 단위 직렬 평가

같은 `groups` 내 룰은 **순차 평가**. 한 룰의 결과를 다음 룰이 사용
가능. 다른 그룹은 병렬.

```yaml
groups:
  - name: 1_base.rules
    interval: 30s
    rules:
      - record: job:http_requests:rate5m
        expr: sum by (job) (rate(http_requests_total[5m]))

  - name: 2_derived.rules
    interval: 30s
    rules:
      - record: cluster:http_requests:rate5m
        expr: sum(job:http_requests:rate5m)
```

> 의존이 있으면 **같은 그룹**에 둔다. 다른 그룹에 두면 평가 시점이
> 달라 한 step 뒤처질 수 있다.

### 4.2 평가 주기 선택

| 상황 | 권장 |
|---|---|
| 알림 입력용 | 15s~30s |
| 대시보드 캐시용 | 30s~1m |
| 장기 추세(`:rate1h`, `:rate1d`) | 1m~5m |
| Federation 입력 | 30s~1m |

> 규칙: **평가 주기 ≤ scrape_interval × 2**. 너무 길면 데이터 갭,
> 너무 짧으면 CPU 낭비.

### 4.3 평가 시간이 interval을 초과하면

룰 그룹의 모든 룰 누적 평가 시간이 `interval`을 넘기면 **건너뛰기 +
경고 메트릭**(`prometheus_rule_group_iterations_missed_total`).

```promql
# 룰 평가 실패 알림 (counter라 rate/increase로)
increase(prometheus_rule_evaluation_failures_total[5m]) > 0

# 평가 지연 시간
prometheus_rule_group_last_duration_seconds > 30

# 그룹이 interval 초과로 건너뛴 횟수
increase(prometheus_rule_group_iterations_missed_total[10m]) > 0
```

---

## 5. 안전장치와 신기능

### 5.1 `limit` — 시계열·알림 수 상한 (2.47+)

룰이 만들어내는 시계열·알림 수에 **그룹 단위 상한**을 부여. 카디널리티
폭발을 운영 단계에서 차단.

```yaml
groups:
  - name: api.rules
    interval: 30s
    limit: 10000              # 시계열 또는 알림 인스턴스 수
    rules:
      - record: job_route:http_requests:rate5m
        expr: sum by (job, route) (rate(http_requests_total[5m]))
```

> 초과 시 룰 평가는 실패로 기록되고 시계열은 만들어지지 않는다.
> 새 룰 도입 시 보수적인 limit으로 시작 → 모니터링 후 상향.

### 5.2 `query_offset` — 늦게 도착하는 데이터 보정 (2.53+)

Remote Write·Mimir·Agent 구조에서 룰이 평가 시점에 **아직 도착하지
않은 데이터**로 빈 결과를 내는 문제를 막는다.

```yaml
# prometheus.yml 글로벌
global:
  rule_query_offset: 30s

# 또는 그룹 단위
groups:
  - name: api.rules
    query_offset: 30s
```

> 즉, 평가 시 **현재 시각 - 30s** 기준으로 쿼리. 늦게 도착하는
> 데이터를 기다린다. 분산 환경에서 사실상 필수.

### 5.3 룰 파일 reload

| 방법 | 동작 |
|---|---|
| `SIGHUP` | 동일 |
| `POST /-/reload` | `--web.enable-lifecycle` 필요 |
| Prometheus Operator | `PrometheusRule` CR 변경 → configmap-reloader sidecar가 SIGHUP |

> 운영: 룰 파일은 ConfigMap 또는 Git 배포, 적용은 lifecycle 엔드포인트.
> 파싱 실패 시 **이전 설정 유지** + 메트릭에 실패 기록.

### 5.4 Recording vs Alerting 룰의 차이

| 항목 | Recording | Alerting |
|---|---|---|
| 키워드 | `record` | `alert` |
| 결과 | 새 시계열 저장 | 활성 알림 인스턴스 보관 |
| `for` | ✗ | ✓ pending → firing 지속 시간 |
| `keep_firing_for` | ✗ | ✓ flap 방지 |
| `annotations` | ✗ | ✓ 알림 본문 |
| `labels` | ✓ | ✓ |
| 평가 결과 영속화 | TSDB 시계열 | TSDB의 `ALERTS{...}` 시계열 + AM push |

> **Recording은 데이터, Alerting은 사건**. 알림은 항상 Recording을
> 입력으로 두는 게 표준 구조.

### 5.5 HA Prometheus + Recording Rule 함정

Replica Pair 양쪽이 같은 룰을 평가하면 **같은 시계열을 두 번 생성**한다.

| 해결 방법 | 설명 |
|---|---|
| `external_labels: {replica: A/B}` | RW 시 receiver가 dedupe |
| Mimir Ruler / Thanos Ruler로 분리 | Prometheus는 룰 평가 안 함 |
| HA 한쪽만 룰 활성화 | 단순하나 SPOF |

> Recording Rule이 만든 시계열은 **로컬 TSDB에는 external_labels 없이**
> 저장되고, Remote Write로 보낼 때만 external_labels가 붙는다.
> Mimir·Thanos receiver 측에서 dedupe 정책을 일치시켜야 한다.

---

## 6. 운영 패턴 — 표준 사용 셋트

### 6.1 RED 메트릭 사전 집계

```yaml
- record: job_route:http_requests:rate5m
  expr: sum by (job, route) (rate(http_requests_total[5m]))

- record: job_route:http_request_errors:rate5m
  expr: |
    sum by (job, route) (
      rate(http_requests_total{code=~"5.."}[5m])
    )

- record: job_route:http_request_errors:ratio_rate5m
  expr: |
    job_route:http_request_errors:rate5m
    / job_route:http_requests:rate5m
```

### 6.2 분위수 사전 집계

```yaml
- record: route:http_request_duration:p99_5m
  expr: |
    histogram_quantile(0.99,
      sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))
    )
```

> p99 같은 분위수는 호출 비용이 높아 **반드시** Recording.

### 6.3 SLO Burn Rate 사전 집계 — 다중 윈도우

```yaml
- record: job:slo_errors:ratio_rate5m
  expr: |
    sum(rate(http_requests_total{code=~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m]))

- record: job:slo_errors:ratio_rate1h
  expr: |
    sum(rate(http_requests_total{code=~"5.."}[1h]))
    /
    sum(rate(http_requests_total[1h]))

- record: job:slo_burn_rate_5m
  expr: job:slo_errors:ratio_rate5m / (1 - 0.999)

- record: job:slo_burn_rate_1h
  expr: job:slo_errors:ratio_rate1h / (1 - 0.999)
```

> Multi-window multi-burn-rate 알림에는 보통 `5m`·`1h`·`6h`·`3d` 네
> 윈도우를 사전 집계. 자세한 패턴은
> [SLO 알림](../alerting/slo-alerting.md),
> [Multi-window 알림](../alerting/multi-window-alerting.md),
> [SLO as Code](../slo-as-code/slo-rule-generators.md).

### 6.4 Federation·Remote Write 입력

상위 Prometheus 또는 Mimir로 보낼 시계열은 **Recording으로 사전
집계된 것만**. 원본 raw 시계열을 federate하면 비용 폭발.

| 원본 | Federation에 적합 |
|---|---|
| `http_requests_total{instance=...}` | ✗ (인스턴스 단위 너무 많음) |
| `job:http_requests:rate5m` | ★★★ |
| `cluster:http_requests:rate5m` | ★★★ |

---

## 7. 안티패턴

| 안티패턴 | 결과 | 처방 |
|---|---|---|
| `by`로 라벨 화이트리스트 안 씀 | 새 라벨 추가 시 차원 증가 | `without` 또는 명시적 `by` |
| 같은 expr를 여러 룰에 복붙 | 유지보수 지옥 | 베이스 룰을 만들어 참조 |
| Recording 결과가 원본보다 시계열 많음 | 잘못된 집계 | 의도한 level 라벨만 |
| 그룹 분리로 의존 룰 race | 한 step 뒤처짐 | 같은 그룹 |
| Recording에 알림 식 그대로 | record vs alert 혼동 | record는 시계열만, alert는 별도 |
| 평가 interval > query range | 데이터 갭 | interval ≤ rate window/2 |
| Recording을 한도 없이 늘림 | 자체 카디널리티 폭발 | 라벨 검토, 이미 사전 집계된 것 또 집계 X |
| 알림 식이 raw 시계열 직접 사용 | 알림마다 비싼 쿼리 | Recording 경유 |

---

## 8. 검증과 테스트

### 8.1 정적 검증

```bash
# 문법 체크
promtool check rules rules/*.yaml

# pint - 더 엄격한 정적 분석
pint lint rules/*.yaml
```

`pint`(Cloudflare 오픈소스)는 룰 명명·라벨·counter suffix·중복 등을
잡는다. CI에 표준으로 박는다.

### 8.2 단위 테스트

```yaml
# tests/api.rules.test.yaml
rule_files:
  - rules/api.yaml

evaluation_interval: 30s

tests:
  - interval: 30s
    input_series:
      - series: 'http_requests_total{job="api",code="200"}'
        values: '0+10x10'
      - series: 'http_requests_total{job="api",code="500"}'
        values: '0+1x10'
    promql_expr_test:
      - expr: job:http_requests:rate5m{job="api"}
        eval_time: 5m
        exp_samples:
          - labels: 'job:http_requests:rate5m{job="api"}'
            value: 0.36
```

```bash
promtool test rules tests/*.test.yaml
```

> CI에서 룰 PR마다 자동 실행. **알림 회귀 사고의 80%를 잡는다**.

---

## 9. 카디널리티 안전 가이드

Recording Rule은 의도하지 않으면 **시계열을 더 늘릴 수 있다**.

| 패턴 | 카디널리티 |
|---|---|
| `sum by (job)` | 줄어듦(target) |
| `sum without (instance)` | 줄어듦 |
| 라벨 추가만 하는 record | **늘어남** — 위험 |
| 기존 메트릭과 겹치는 라벨셋 | 충돌·혼란 |

운영 디버깅 쿼리:

```promql
# 메트릭 이름별 시계열 수
topk(20, count by (__name__) ({__name__=~".+"}))

# 룰 그룹의 결과 시계열 수
prometheus_tsdb_head_series
```

> 룰 도입 전후 `prometheus_tsdb_head_series` 모니터링 + §5.1의
> `limit`을 그룹마다 부여. 자세한 가이드는
> [카디널리티 관리](../metric-storage/cardinality-management.md).

---

## 10. Mimir·Thanos 환경에서의 Recording Rule

| 백엔드 | Recording Rule 평가 위치 |
|---|---|
| 단일 Prometheus | 자체 evaluator |
| Thanos | Thanos Ruler(stateful) 또는 Stateless Ruler |
| Mimir | **Mimir Ruler**가 평가, 결과는 Mimir에 저장 |
| Cortex | Cortex Ruler |

### 10.1 Mimir Ruler — 두 평가 모드

| 모드 | 동작 | 사용 시점 |
|---|---|---|
| **Internal** | Ruler가 ingester를 직접 쿼리, query-frontend 우회 | 단순 룰, 적은 부하 |
| **Remote** | query-frontend 경유 → query sharding 활용 | 큰 룰셋, 분위수 등 무거운 쿼리 |

### 10.2 Rule sharding과 멀티테넌시

| 기능 | 의미 |
|---|---|
| **Hash ring sharding** | 룰 그룹을 ruler 인스턴스에 분산. 룰셋 크기에 따라 스케일 |
| **Shuffle sharding** (`ruler.tenant-shard-size`) | 한 테넌트의 룰을 일부 ruler 인스턴스만이 평가 |
| **`source_tenants`** (federated rule groups) | 여러 테넌트 데이터를 한 룰에서 집계. 보안·격리 정책과 충돌 주의 |

### 10.3 Thanos Stateless Ruler

`--remote-write.config` 사용 시 **로컬 TSDB 없이** WAL + Remote Write로
동작. 룰 결과를 본인이 안 가지고 있고 모두 백엔드(Mimir·Cortex)에 보냄.
HA·디스크 운영이 단순해진다.

### 10.4 Kubernetes — PrometheusRule CRD

`prometheus-operator`의 `PrometheusRule` CRD가 K8s 환경 표준.
ConfigMap 자동 생성 + Prometheus reload sidecar.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-rules
  labels:
    prometheus: main
spec:
  groups:
    - name: api.rules
      interval: 30s
      limit: 10000
      rules:
        - record: job_route:http_requests:rate5m
          expr: sum by (job, route) (rate(http_requests_total[5m]))
```

자세한 내용은 [Mimir·Thanos·Cortex](../metric-storage/mimir-thanos-cortex.md).

---

## 11. 다음 단계

- [Alertmanager](alertmanager.md) — Recording → Alerting 흐름
- [SLO 알림](../alerting/slo-alerting.md) — Burn Rate 룰
- [SLO as Code](../slo-as-code/slo-rule-generators.md) — Sloth/Pyrra
- [Multi-window 알림](../alerting/multi-window-alerting.md)
- [카디널리티 관리](../metric-storage/cardinality-management.md)

---

## 참고 자료

- [Recording rules — Prometheus 공식 권고](https://prometheus.io/docs/practices/rules/) (2026-04 확인)
- [Defining recording rules — 설정 문서](https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/)
- [Metric and label naming](https://prometheus.io/docs/practices/naming/)
- [Recording Rules — PromLabs Trainings](https://training.promlabs.com/training/recording-rules/recording-rules-overview/rule-naming-conventions/)
- [Undoing the benefits of labels — Robust Perception](https://www.robustperception.io/undoing-the-benefits-of-labels/)
- [pint — Cloudflare 룰 정적 분석](https://github.com/cloudflare/pint)
- [promtool test rules — 단위 테스트](https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/)
