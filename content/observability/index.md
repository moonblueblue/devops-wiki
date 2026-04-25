---
title: "Observability"
sidebar_label: "Observability"
sidebar_position: 6
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - observability
  - index
---

# Observability

> **티어**: 메인 — **작성 원칙**: DevOps 엔지니어 실무 빈도 기준
>
> "보이지 않으면 고칠 수 없다." 장애 대응 = 관측 싸움.
> 메트릭·로그·트레이스·프로파일 네 신호와 SLO 기반 운영 전반을 다룬다.

---

## 학습 경로

| 단계 | 영역 | 핵심 주제 |
|:-:|---|---|
| 1 | 개념 | Signals · Semantic Conventions · APM |
| 2 | 메트릭 | Prometheus · PromQL · Storage · Cardinality |
| 3 | 로그 | Loki · Elastic · Pipeline · 운영 정책 |
| 4 | 트레이스 | OTel · Jaeger/Tempo · Sampling |
| 5 | 프로파일 | OTel Profiles · Pyroscope |
| 6 | SLO 도구 | Sloth·Pyrra · OpenSLO |
| 7 | 알림 | Burn Rate · Multi-window · 경보 피로 |
| 8 | 운영 | 비용 · AIOps |

---

## 목차

### 개념

- [x] [관측성 개념](concepts/observability-concepts.md) — 3 Pillars → 4 Signals, Charity Majors의 관측성 정의 통합
- [x] [Semantic Conventions](concepts/semantic-conventions.md) — OTel 표준 속성, 일관성의 가치
- [x] [Exemplars](concepts/exemplars.md) — 메트릭→트레이스 연결, OpenMetrics
- [x] [APM과 관측성](concepts/apm-overview.md) — APM 용어 정리, OTel 시대로의 수렴

### Prometheus

- [x] [Prometheus 아키텍처](prometheus/prometheus-architecture.md) — scrape, WAL, HA 전략
- [x] [PromQL 고급](prometheus/promql-advanced.md) — rate vs increase, subquery, 함정
- [x] [Recording Rules](prometheus/recording-rules.md) — 집계 사전 계산, 쿼리 성능
- [x] [Remote Write](prometheus/remote-write.md) — Receiver, Agent 모드, 중복 제거
- [x] [Alertmanager](prometheus/alertmanager.md) — routing, silencing, grouping

### 메트릭 장기 저장

- [x] [Mimir·Thanos·Cortex·VictoriaMetrics](metric-storage/mimir-thanos-cortex.md) — 비교, 아키텍처, 운영 특성
- [x] [히스토그램 (Exponential·Native)](metric-storage/exponential-histograms.md) — Prometheus Native Histograms, OTel Exponential
- [x] [카디널리티 관리](metric-storage/cardinality-management.md) — 원인·탐지·제어

### 로깅

- [x] [Loki](logging/loki.md) — 인덱싱 철학, 비용, chunk·label 전략
- [x] [Elastic Stack](logging/elastic-stack.md) — Elasticsearch·Kibana·Logstash 현실적 운영
- [x] [로그 파이프라인](logging/log-pipeline.md) — Vector·Fluent Bit·OTel Collector 비교
- [ ] [로그 운영 정책](logging/log-operations.md) — JSON 구조화·필드 표준·우선순위 샘플링·Rate Limiting

### 트레이싱

- [ ] [Jaeger·Tempo](tracing/jaeger-tempo.md) — 비교, 스토리지, 조회 패턴
- [ ] [샘플링 전략](tracing/sampling-strategies.md) — Head vs Tail, probabilistic, adaptive
- [ ] [OTel Collector](tracing/otel-collector.md) — pipeline, processor, batch/memory
- [ ] [Trace Context](tracing/trace-context.md) — W3C Trace Context, 전파 규격

### 프로파일링

- [ ] [연속 프로파일링](profiling/continuous-profiling.md) — Pyroscope·Parca 현재 구현 + OTel Profiles(Public Alpha 2026) 통합

### 클라우드 네이티브 스택

- [ ] [OpenTelemetry 개요](cloud-native/opentelemetry-overview.md) — SDK·Collector·Spec
- [ ] [Prometheus·OpenTelemetry](cloud-native/prometheus-opentelemetry.md) — 상호 운용, OTLP push
- [ ] [OTel Operator](cloud-native/otel-operator.md) — K8s 자동 계측, instrumentation CR

### Grafana 에코시스템

- [ ] [Grafana Dashboards](grafana/grafana-dashboards.md) — 패널 표준, 변수, 룩앤필
- [ ] [Grafana Alloy](grafana/grafana-alloy.md) — Agent 후속, 구성 패턴

### eBPF 관측

- [ ] [eBPF 관측 (Hubble 중심)](ebpf/ebpf-observability.md) — Cilium Hubble, Pixie·Retina 비교

### SLO as Code (도구)

- [ ] [Sloth·Pyrra](slo-as-code/slo-rule-generators.md) — PromQL 기반 SLO 룰 생성 비교
- [ ] [OpenSLO](slo-as-code/openslo.md) — SLO 명세 표준

### 알림

- [ ] [알림 설계·피로 감축](alerting/alerting-design.md) — Symptom vs Cause 설계 + 피로 감축 전략 통합
- [ ] [Multi-window 알림](alerting/multi-window-alerting.md) — 빠른 감지 + 긴 창 조합
- [ ] [SLO 알림](alerting/slo-alerting.md) — Burn Rate 기반, 에러 버짓 소진률
- [ ] [Grafana OnCall](alerting/grafana-oncall.md) — 알림 라우팅, 온콜 스케줄링

### Synthetic 모니터링

- [ ] [Synthetic 모니터링](rum-synthetic/synthetic-monitoring.md) — 경로·지역·주기, 예산

### 비용 운영

- [ ] [관측 비용](cost/observability-cost.md) — 카디널리티·샘플링·예산 알림 통합

### AIOps

- [ ] [AIOps 개요](aiops/aiops-overview.md) — LLM 기반 RCA, 이상 탐지, 주의할 함정

---

## 이 카테고리의 경계

- **SLO 개념·수학** 자체는 `sre/`가 주인공 — 여기는 도구·알림 구현만
- **알림 도구·규칙**은 여기 — **인시던트 대응 프로세스·포스트모템**은 `sre/`
- **Feature Flag**는 `cicd/` — 여기는 "카나리 분석의 메트릭"만
- **보안 감사 로그 전략**은 `security/` — 여기는 "로그 수집·파이프라인"
- **eBPF 커널 측면**은 `linux/` — 여기는 관측성 응용만

---

## 참고 표준

- OpenTelemetry Specification
- Prometheus 공식 문서
- Google SRE Book (Alerting 챕터)
- Charity Majors, *Observability Engineering*
