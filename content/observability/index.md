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

- [ ] 3 Pillars vs Signals — 3 Pillars → 4 Signals (프로파일 포함)
- [ ] 관측성 vs 모니터링 — 관측성의 정의, Charity Majors
- [ ] Semantic Conventions — OTel 표준 속성, 일관성의 가치
- [ ] Exemplars — 메트릭→트레이스 연결, OpenMetrics

### Prometheus

- [ ] Prometheus 아키텍처 — scrape, WAL, HA 전략
- [ ] PromQL 고급 — rate vs increase, subquery, 함정
- [ ] Recording Rules — 집계 사전 계산, 쿼리 성능
- [ ] Remote Write — Receiver, 네트워크 이슈, 중복 제거
- [ ] Alertmanager — routing, silencing, grouping

### 메트릭 장기 저장

- [ ] Mimir·Thanos·Cortex — 비교, 아키텍처, 운영 특성
- [ ] Exponential Histograms — Native Histograms, cardinality 감소
- [ ] 카디널리티 관리 — 원인·탐지·제어

### 로깅

- [ ] Loki — 인덱싱 철학, 비용, chunk·label 전략
- [ ] Elastic Stack — Elasticsearch·Kibana·Logstash 현실적 운영
- [ ] 로그 샘플링 — 우선순위 기반, rate limiting
- [ ] 로그 구조화 — JSON 구조화, 필드 표준

### 트레이싱

- [ ] Jaeger·Tempo — 비교, 스토리지, 조회 패턴
- [ ] 샘플링 전략 — Head vs Tail, probabilistic, adaptive
- [ ] OTel Collector — pipeline, processor, batch/memory
- [ ] Trace Context — W3C Trace Context, 전파 규격

### 프로파일링

- [ ] OTel Profiles — Public Alpha (2026), 도입 전략
- [ ] Pyroscope — 연속 프로파일링, flame graph 분석
- [ ] 연속 프로파일링 — 프로덕션 오버헤드, Parca

### Grafana 에코시스템

- [ ] Grafana Dashboards — 패널 표준, 변수, 룩앤필
- [ ] Grafana Alloy — Agent 후속, 구성 패턴
- [ ] Grafana OnCall — OnCall, 알림 라우팅

### 클라우드 네이티브 스택

- [ ] OpenTelemetry 개요 — SDK·Collector·Spec
- [ ] Prometheus·OpenTelemetry — 상호 운용, OTLP push
- [ ] OTel Operator — K8s 자동 계측, instrumentation CR

### eBPF 관측

- [ ] Hubble — Cilium 관측, 서비스 의존성 맵
- [ ] Pixie — 자동 계측, Edge 분석
- [ ] Retina — Microsoft 2024 OSS, 네트워크 관측

### SLO as Code (도구)

- [ ] Sloth — PromQL 기반 SLO 생성
- [ ] Pyrra — 선언적 SLO, Prometheus Rule
- [ ] OpenSLO — SLO 명세 표준

### 알림

- [ ] 알림 전략 — Symptom vs Cause, 알림 설계 원칙
- [ ] Multi-window 알림 — 빠른 감지 + 긴 창 조합
- [ ] SLO 알림 — Burn Rate 기반, 에러 버짓 소진률
- [ ] 알림 피로 — 감축 전략, SRE 워크북
- [ ] 이상 탐지 — 통계·ML 기반, 함정

### RUM·Synthetic

- [ ] RUM 기본 — Core Web Vitals, 프라이버시
- [ ] Synthetic 모니터링 — 경로·지역·주기, 예산

### 비용 운영

- [ ] 관측 비용 — 카디널리티·샘플링으로 비용 관리
- [ ] 예산 알림 — 관측 비용 초과 경보 (FinOps 통합)

### AIOps

- [ ] AIOps 개요 — LLM 기반 RCA, 주의할 함정

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
