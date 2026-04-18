---
title: "Observability"
sidebar_label: "Observability"
sidebar_position: 5
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - observability
  - index
---

# Observability

> **티어**: 메인 (핵심) — **작성 원칙**: 빠짐없이
>
> "보이지 않으면 고칠 수 없다." 장애 대응 = 관측 싸움.
> 메트릭·로그·트레이스·프로파일 네 신호와 SLO 기반 운영 전반을 다룬다.

---

## 학습 경로

```
개념       Signals · Semantic Conventions
메트릭     Prometheus · PromQL · Storage · Cardinality
로그       Loki · Elastic · Sampling · Structured
트레이스    OTel · Jaeger/Tempo · Sampling
프로파일    OTel Profiles · Pyroscope
SLO 도구    Sloth · Pyrra · OpenSLO
알림       Burn Rate · Multi-window · 경보 피로
```

---

## 목차

### 개념

- [ ] three-pillars-vs-signals — 3 Pillars → 4 Signals (프로파일 포함)
- [ ] observability-vs-monitoring — 관측성의 정의, Charity Majors
- [ ] semantic-conventions — OTel 표준 속성, 일관성의 가치
- [ ] exemplars — 메트릭→트레이스 연결, OpenMetrics

### Prometheus

- [ ] prometheus-architecture — scrape, WAL, HA 전략
- [ ] promql-advanced — rate vs increase, subquery, 함정
- [ ] recording-rules — 집계 사전 계산, 쿼리 성능
- [ ] remote-write — Receiver, 네트워크 이슈, 중복 제거
- [ ] alertmanager — routing, silencing, grouping

### Metric Storage (장기)

- [ ] mimir-thanos-cortex — 비교, 아키텍처, 운영 특성
- [ ] exponential-histograms — Native Histograms, cardinality 감소
- [ ] cardinality-management — 원인·탐지·제어

### Logging

- [ ] loki — 인덱싱 철학, 비용, chunk·label 전략
- [ ] elastic-stack — Elasticsearch·Kibana·Logstash 현실적 운영
- [ ] log-sampling — 우선순위 기반, rate limiting
- [ ] log-structured — JSON 구조화, 필드 표준

### Tracing

- [ ] jaeger-tempo — 비교, 스토리지, 조회 패턴
- [ ] sampling-strategies — Head vs Tail, probabilistic, adaptive
- [ ] otel-collector — pipeline, processor, batch/memory
- [ ] trace-context — W3C Trace Context, 전파 규격

### Profiling

- [ ] otel-profiles — Public Alpha (2026), 도입 전략
- [ ] pyroscope — 연속 프로파일링, flame graph 분석
- [ ] continuous-profiling — 프로덕션 오버헤드, Parca

### Grafana Ecosystem

- [ ] grafana-dashboards — 패널 표준, 변수, 룩앤필
- [ ] grafana-alloy — Agent 후속, 구성 패턴
- [ ] grafana-oncall — OnCall, 알림 라우팅

### Cloud-Native Stack

- [ ] opentelemetry-overview — SDK·Collector·Spec
- [ ] prometheus-opentelemetry — 상호 운용, OTLP push
- [ ] otel-operator — K8s 자동 계측, instrumentation CR

### eBPF Observability

- [ ] hubble — Cilium 관측, 서비스 의존성 맵
- [ ] pixie — 자동 계측, Edge 분석
- [ ] retina — Microsoft 2024 OSS, 네트워크 관측

### SLO as Code (도구)

- [ ] sloth — PromQL 기반 SLO 생성
- [ ] pyrra — 선언적 SLO, Prometheus Rule
- [ ] openslo — SLO 명세 표준

### Alerting

- [ ] alerting-strategy — Symptom vs Cause, 알림 설계 원칙
- [ ] multi-window-alerting — 빠른 감지 + 긴 창 조합
- [ ] slo-alerting — Burn Rate 기반, 에러 버짓 소진률
- [ ] alert-fatigue — 감축 전략, SRE 워크북
- [ ] anomaly-detection — 통계·ML 기반, 함정

### RUM & Synthetic

- [ ] rum-basics — Core Web Vitals, 프라이버시
- [ ] synthetic-monitoring — 경로·지역·주기, 예산

### Cost Operations

- [ ] observability-cost — 카디널리티·샘플링으로 비용 관리
- [ ] budget-alerts — 관측 비용 초과 경보 (FinOps 통합)

### AIOps

- [ ] aiops-overview — LLM 기반 RCA, 주의할 함정

---

## 이 카테고리의 경계

- **SLO 개념·수학** 자체는 `sre/`가 주인공 — 여기는 도구·알림 구현만
- **Feature Flag**는 `cicd/` — 여기는 "카나리 분석의 메트릭"만
- **보안 감사 로그 전략**은 `security/` — 여기는 "로그 수집·파이프라인"

---

## 참고 표준

- OpenTelemetry Specification
- Prometheus 공식 문서
- Google SRE Book (Alerting 챕터)
- Charity Majors, *Observability Engineering*
