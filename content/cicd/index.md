---
title: "CI/CD"
sidebar_label: "CI/CD"
sidebar_position: 6
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - cicd
  - gitops
  - index
---

# CI/CD

> **티어**: 메인 (핵심) — **작성 원칙**: 빠짐없이
>
> 코드 → 빌드 → 테스트 → 배포의 전체 여정.
> **GitOps(ArgoCD, Flux)를 흡수**하여 CD 방법론의 한 섹션으로 통합한다.

---

## 학습 경로

```
개념        Pipeline as Code · 배포 전략 · GitOps · DORA
CI 플랫폼   GitHub Actions · GitLab CI · Jenkins
K8s-native  Tekton · Argo Workflows · Dagger
CD (GitOps) ArgoCD · Flux · Progressive Delivery
DevSecOps   SAST · SCA · 이미지 스캔 · SLSA
운영        Artifact · 의존성 · 테스트 자동화 · 릴리즈
```

---

## 목차

### 개념

- [ ] Pipeline as Code — 선언적 파이프라인, 버전 관리 가치
- [ ] 배포 전략 — Blue/Green · Canary · Rolling · Shadow · A/B
- [ ] GitOps 개념 — OpenGitOps 원칙, pull vs push
- [ ] 리포 구조 — 모노레포 vs 폴리레포, 앱-인프라 분리
- [ ] DORA 메트릭 — Lead time, Change failure rate, MTTR, Deployment frequency

### GitHub Actions

- [ ] GHA 기본 — workflow, job, step, matrix
- [ ] GHA 고급 — reusable workflow, composite action, caching
- [ ] 셀프호스트 러너 — 보안 격리, ephemeral runner
- [ ] GHA 보안 — OIDC, permissions, artifact attestation

### GitLab CI

- [ ] GitLab CI 기본 — pipeline 구조, stages, runners
- [ ] GitLab CI 고급 — parent-child, dynamic, environments

### Jenkins

- [ ] Jenkins 기본 — controller/agent, JCasC
- [ ] Jenkinsfile — declarative vs scripted, shared library
- [ ] Jenkins K8s — kubernetes plugin, Jenkins Operator

### K8s 네이티브 CI/CD

- [ ] Tekton — Task·Pipeline·Trigger, CEL
- [ ] Argo Workflows — DAG, artifact, 이벤트 트리거
- [ ] Dagger — 코드로 CI, BuildKit 기반

### ArgoCD (GitOps)

- [ ] ArgoCD 설치 — HA 구성, 프로젝트 분리
- [ ] ArgoCD App — Application, ApplicationSet, generator
- [ ] ArgoCD 프로젝트 — AppProject, SSO/RBAC
- [ ] ArgoCD Sync — sync policy, hooks, pruning
- [ ] ArgoCD 운영 — upgrade, backup, DR
- [ ] ArgoCD 고급 — PreDelete Hooks, Shallow Git Clone (3.3), Agent

### Flux (GitOps)

- [ ] Flux 설치 — HelmRelease, Kustomization
- [ ] Flux Kustomize — 의존성, health check
- [ ] Flux Helm — HelmRelease, chart source

### 점진적 배포

- [ ] Argo Rollouts — Rollout CR, Analysis, 트래픽 분할
- [ ] Flagger — AnalysisTemplate, 자동 판단 로직
- [ ] Feature Flag — OpenFeature, LaunchDarkly, Flagsmith, Unleash
- [ ] 트래픽 분할 — Istio·Gateway API·Envoy 연동

### 아티팩트 관리

- [ ] Harbor — 이미지·차트·OCI Artifacts
- [ ] Artifactory — 범용 바이너리 저장소
- [ ] OCI Artifacts 레지스트리 — SBOM·서명 저장 표준

### CI의 DevSecOps

- [ ] SAST/SCA — 코드·의존성 스캔 통합
- [ ] 이미지 스캔 — Trivy, Grype, CVE 정책
- [ ] 시크릿 스캔 — git-secrets, gitleaks, pre-commit
- [ ] SLSA — Provenance, attestation, Level 상향

### 의존성 관리

- [ ] Renovate — 자동 PR, 그룹핑·스케줄
- [ ] Dependabot — GitHub 통합, 보안 업데이트

### 테스트 자동화

- [ ] 테스트 전략 — Unit·Integration·E2E·Contract 배분
- [ ] Contract 테스트 — Pact, provider-consumer

### 릴리스 관리

- [ ] SemVer — SemVer, conventional commits
- [ ] 릴리스 노트 — 자동 생성, changelog 도구

### 실전 패턴

- [ ] 모노레포 CI/CD — Bazel, Nx, affected 감지
- [ ] 파이프라인 템플릿 — 재사용 가능한 템플릿 설계

---

## 이 카테고리의 경계

- **Helm/Kustomize 도구 자체**는 `kubernetes/` — 여기는 "GitOps 맥락 활용"만
- **Secrets 도구(Vault, ESO)**는 `security/` — 여기는 "CI에서 주입" 패턴만
- **SLO 기반 자동 롤백**은 `sre/` — 여기는 "Progressive Delivery 도구"만

---

## 참고 표준

- DORA Report (State of DevOps)
- OpenGitOps WG
- SLSA Framework
- Accelerate (Nicole Forsgren)
- Argo CD / Flux 공식 문서
