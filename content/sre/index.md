---
title: "SRE"
sidebar_label: "SRE"
sidebar_position: 9
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - sre
  - index
---

# SRE

> **티어**: 성장 — **작성 원칙**: 필수만
>
> 신뢰성 공학의 방법론·철학. 글 수는 적지만 **밀도가 가장 높은** 카테고리.
> 도구보다 **판단·원칙·프로세스**를 담는다.
>
> 1~5인 DevOps 겸임 관점으로 작성 — 전담 SRE 조직이 없는 환경에서
> 실제로 손에 쥐고 쓸 수 있는 최소한의 방법론에 집중.

---

## 학습 경로

| 단계 | 영역 | 핵심 주제 |
|:-:|---|---|
| 1 | 원칙 | Google SRE Principles, Toil |
| 2 | SLO | SLI 선정 → SLO → Burn Rate → Error Budget |
| 3 | 장애 대응 | Incident Response, On-call |
| 4 | 포스트모템 | Blameless 포스트모템, RCA 방법론 |
| 5 | Runbook | Runbook 템플릿 |
| 6 | 점진적 배포 | SLO 기반 자동 롤백 |
| 7 | 카오스 | 가설 기반 실험, 도구 비교 |
| 8 | 신뢰성 설계 | Failure Modes, Blast Radius |
| 9 | 용량·변경 | Capacity Planning, Change Management |
| 10 | 조직·문화 | DevEx Metrics |

---

## 목차

### 원칙·개념

- [x] [SRE 원칙](principles/sre-principles.md) — Google SRE 원칙, Dickerson Pyramid
- [x] [SLI·SLO·SLA](principles/sli-slo-sla.md) — 정의와 관계, 현실 함정

### SLI·SLO·에러 버짓

- [x] [SLI 선정](slo/sli-selection.md) — CUJ (Critical User Journey), 4 Golden Signals
- [x] [SLO Burn Rate](slo/slo-burn-rate.md) — Burn Rate 수학, 다중 창 판단
- [x] [Error Budget 정책](slo/error-budget-policy.md) — 소진 시 조치 (배포 동결, 롤백 강제)

### 장애 대응

- [x] [Incident Response](incident/incident-response.md) — IRT, Commander, War Room 운영, 커뮤니케이션
- [x] [On-call 로테이션](incident/on-call-rotation.md) — 로테이션, 휴식, 핸드오프

### 포스트모템·RCA

- [x] [포스트모템](postmortem/postmortem.md) — Blameless 원칙, Google 템플릿, 실무 포맷 통합
- [x] [RCA 방법론](postmortem/rca-methods.md) — 5 Whys, Fishbone, Causal Graph

### Runbook·Playbook

- [x] [Runbook 템플릿](runbook/runbook-template.md) — 호출·진단·복구 구조, 자동화 연계

### 점진적 배포 (SRE 관점)

- [x] [SLO 기반 롤백](progressive-delivery/slo-based-rollback.md) — 에러 버짓 기반 자동 롤백 정책

### 카오스 엔지니어링

- [ ] [카오스 엔지니어링](chaos/chaos-engineering.md) — Netflix 원칙, 가설 기반 실험, Chaos Mesh·LitmusChaos·Gremlin 비교

### 신뢰성 설계

- [ ] [Failure Modes](reliability-design/failure-modes.md) — 단일 장애점, Blast Radius, Cell-based, 의존성 영향 분석

### Toil

- [ ] [Toil 감축](toil/toil-reduction.md) — 측정·제거 전략, 자동화 우선순위

### Capacity Planning

- [ ] [Capacity Planning](capacity/capacity-planning.md) — 수요 예측, 헤드룸, 리소스 계획

### Change Management

- [ ] [Change Management (SRE 관점)](change-management/change-management.md) — 변경 위험 분류, 승인·검토, 변경 동결

### 조직·문화

- [ ] [DevEx 메트릭](culture/devex-metrics.md) — DORA + SPACE + DevEx (Core 4)

---

## 이 카테고리의 경계

- **SLO as Code 도구**(Sloth·Pyrra·OpenSLO)는 `observability/`
- **Progressive Delivery 도구**(Argo Rollouts·Flagger)는 `cicd/`
- **보안 사고 대응 프로세스**는 `security/`
- 여기는 **방법론·판단·프로세스·문화**에 집중

---

## 참고 표준

- Google SRE Book 3부작 (sre.google 무료)
- The DevOps Handbook (Gene Kim 외)
- Accelerate (Nicole Forsgren)
- Chaos Engineering Principles (principlesofchaos.org)
