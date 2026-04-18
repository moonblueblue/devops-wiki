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

- [ ] SRE 원칙 — Google SRE 원칙, Dickerson Pyramid
- [ ] SLI·SLO·SLA — 정의와 관계, 현실 함정

### SLI·SLO·에러 버짓

- [ ] SLI 선정 — CUJ (Critical User Journey), 4 Golden Signals
- [ ] SLO Burn Rate — Burn Rate 수학, 다중 창 판단
- [ ] Error Budget 정책 — 소진 시 조치 (배포 동결, 롤백 강제)

### 장애 대응

- [ ] Incident Response — IRT, Commander, 커뮤니케이션
- [ ] On-call 로테이션 — 로테이션, 휴식, 핸드오프
- [ ] War Room — 런칭, 로그·타임라인

### 포스트모템·RCA

- [ ] Blameless Postmortem — Google 템플릿, 실무 포맷
- [ ] RCA 방법론 — 5 Whys, Fishbone, Causal Graph

### Runbook·Playbook

- [ ] Runbook 템플릿 — 호출·진단·복구 구조
- [ ] 자동화 — 런북 → 자동화, Ansible·PagerDuty

### 점진적 배포 (SRE 관점)

- [ ] SLO 기반 롤백 — 에러 버짓 기반 자동 롤백 정책

### 카오스 엔지니어링

- [ ] 카오스 원칙 — Netflix 원칙, 가설 기반
- [ ] 카오스 도구 — Chaos Mesh, LitmusChaos, Gremlin 비교

### 신뢰성 설계

- [ ] Failure Modes — 단일 장애점, Blast Radius, Cell-based
- [ ] 의존성 매핑 — Upstream/Downstream, 영향 분석

### Toil

- [ ] Toil 감축 — 측정·제거 전략, 자동화 우선순위

### 조직·문화 (PE 흡수)

- [ ] Team Topologies — Stream·Platform·Enabling·Subsystem
- [ ] DevEx 메트릭 — DORA + SPACE + DevEx (Core 4)

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
