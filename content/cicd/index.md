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

- [ ] pipeline-as-code — 선언적 파이프라인, 버전 관리 가치
- [ ] deployment-strategies — Blue/Green · Canary · Rolling · Shadow · A/B
- [ ] gitops-concepts — OpenGitOps 원칙, pull vs push
- [ ] repo-structure — 모노레포 vs 폴리레포, 앱-인프라 분리
- [ ] dora-metrics — Lead time, Change failure rate, MTTR, Deployment frequency

### GitHub Actions

- [ ] gha-basics — workflow, job, step, matrix
- [ ] gha-advanced — reusable workflow, composite action, caching
- [ ] self-hosted-runner — 보안 격리, ephemeral runner
- [ ] gha-security — OIDC, permissions, artifact attestation

### GitLab CI

- [ ] gitlab-ci-basics — pipeline 구조, stages, runners
- [ ] gitlab-ci-advanced — parent-child, dynamic, environments

### Jenkins

- [ ] jenkins-basics — controller/agent, JCasC
- [ ] jenkinsfile — declarative vs scripted, shared library
- [ ] jenkins-k8s — kubernetes plugin, Jenkins Operator

### K8s-native CI/CD

- [ ] tekton — Task·Pipeline·Trigger, CEL
- [ ] argo-workflows — DAG, artifact, 이벤트 트리거
- [ ] dagger — 코드로 CI, BuildKit 기반

### ArgoCD (GitOps)

- [ ] argocd-install — HA 구성, 프로젝트 분리
- [ ] argocd-apps — Application, ApplicationSet, generator
- [ ] argocd-projects — AppProject, SSO/RBAC
- [ ] argocd-sync — sync policy, hooks, pruning
- [ ] argocd-operations — upgrade, backup, DR
- [ ] argocd-advanced — PreDelete Hooks, Shallow Git Clone (3.3), Agent

### Flux (GitOps)

- [ ] flux-install — HelmRelease, Kustomization
- [ ] flux-kustomization — 의존성, health check
- [ ] flux-helm — HelmRelease, chart source

### Progressive Delivery

- [ ] argo-rollouts — Rollout CR, Analysis, 트래픽 분할
- [ ] flagger — AnalysisTemplate, 자동 판단 로직
- [ ] feature-flag — OpenFeature, LaunchDarkly, Flagsmith, Unleash
- [ ] traffic-splitting — Istio·Gateway API·Envoy 연동

### Artifact Management

- [ ] harbor — 이미지·차트·OCI Artifacts
- [ ] artifactory — 범용 바이너리 저장소
- [ ] oci-artifacts-registry — SBOM·서명 저장 표준

### DevSecOps in CI

- [ ] sast-sca — 코드·의존성 스캔 통합
- [ ] image-scanning-cicd — Trivy, Grype, CVE 정책
- [ ] secret-scanning — git-secrets, gitleaks, pre-commit
- [ ] slsa-in-ci — Provenance, attestation, Level 상향

### Dependency Management

- [ ] renovate — 자동 PR, 그룹핑·스케줄
- [ ] dependabot — GitHub 통합, 보안 업데이트

### Test Automation

- [ ] test-strategy — Unit·Integration·E2E·Contract 배분
- [ ] contract-testing — Pact, provider-consumer

### Release Management

- [ ] semantic-versioning — SemVer, conventional commits
- [ ] release-notes — 자동 생성, changelog 도구

### Practical Patterns

- [ ] monorepo-cicd — Bazel, Nx, affected 감지
- [ ] pipeline-templates — 재사용 가능한 템플릿 설계

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
