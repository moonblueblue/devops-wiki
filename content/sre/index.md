---
title: "SRE"
sidebar_label: "SRE"
sidebar_position: 9
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - sre
  - index
---

# SRE

> **티어**: 성장 — **작성 원칙**: 필수만
>
> 신뢰성 공학의 방법론·철학. 글 수는 적지만 **밀도가 가장 높은** 카테고리.
> 도구보다 **판단·원칙·프로세스**를 담는다.

---

## 학습 경로

```
원칙        Google SRE Principles · Toil
SLO         SLI 선정 → SLO → Burn Rate → Error Budget
장애 대응   IR · Postmortem · Runbook
신뢰성 설계  Failure Modes · Dependency Mapping
카오스      Principles · Tools
조직·문화   Team Topologies · DevEx Metrics
```

---

## 목차

### 원칙·개념

- [ ] sre-principles — Google SRE 원칙, Dickerson Pyramid
- [ ] sli-slo-sla — 정의와 관계, 현실 함정

### SLI / SLO / Error Budget

- [ ] sli-selection — CUJ (Critical User Journey), 4 Golden Signals
- [ ] slo-burn-rate — Burn Rate 수학, 다중 창 판단
- [ ] error-budget-policy — 소진 시 조치 (배포 동결, 롤백 강제)

### Incident Management

- [ ] incident-response — IRT, Commander, 커뮤니케이션
- [ ] on-call-rotation — 로테이션, 휴식, 핸드오프
- [ ] war-room — 런칭, 로그·타임라인

### Postmortem & RCA

- [ ] blameless-postmortem — Google 템플릿, 실무 포맷
- [ ] rca-methods — 5 Whys, Fishbone, Causal Graph

### Runbook & Playbook

- [ ] runbook-template — 호출·진단·복구 구조
- [ ] automation — 런북 → 자동화, Ansible·PagerDuty

### Progressive Delivery (SRE 관점)

- [ ] slo-based-rollback — 에러 버짓 기반 자동 롤백 정책

### Chaos Engineering

- [ ] chaos-principles — Netflix 원칙, 가설 기반
- [ ] chaos-tools — Chaos Mesh, LitmusChaos, Gremlin 비교

### Reliability Design

- [ ] failure-modes — 단일 장애점, Blast Radius, Cell-based
- [ ] dependency-mapping — Upstream/Downstream, 영향 분석

### Toil

- [ ] toil-reduction — 측정·제거 전략, 자동화 우선순위

### 조직·문화 (PE 흡수)

- [ ] team-topologies — Stream·Platform·Enabling·Subsystem
- [ ] devex-metrics — DORA + SPACE + DevEx (Core 4)

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
- Team Topologies (Matthew Skelton)
- Chaos Engineering Principles (principlesofchaos.org)
