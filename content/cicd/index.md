---
title: "CI/CD"
sidebar_label: "CI/CD"
sidebar_position: 5
date: 2026-04-18
last_verified: 2026-04-24
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

| 단계 | 영역 | 핵심 주제 |
|---|---|---|
| 1 | 개념 | Pipeline as Code · 배포 전략 · GitOps · DORA |
| 2 | CI 플랫폼 | GitHub Actions · GitLab CI · Jenkins |
| 3 | K8s-native | Tekton · Argo Workflows |
| 4 | CD (GitOps) | ArgoCD · Flux · Progressive Delivery |
| 5 | DevSecOps | SAST · SCA · 이미지 스캔 · SLSA |
| 6 | 운영 | Artifact · 의존성 · 테스트 자동화 · 릴리즈 |

---

## 목차

### 개념

- [x] [Pipeline as Code](concepts/pipeline-as-code.md) — 선언적 파이프라인, 버전 관리 가치
- [x] [배포 전략](concepts/deployment-strategies.md) — Blue/Green · Canary · Rolling · Shadow · A/B
- [x] [GitOps 개념](concepts/gitops-concepts.md) — OpenGitOps 원칙, pull vs push
- [x] [DORA 메트릭](concepts/dora-metrics.md) — Lead time, Change failure rate, MTTR, Deployment frequency

### GitHub Actions

- [ ] [GHA 기본](github-actions/gha-basics.md) — workflow, job, step, matrix
- [ ] [GHA 고급](github-actions/gha-advanced.md) — reusable workflow, composite action, caching
- [ ] [ARC 러너](github-actions/arc-runner.md) — Actions Runner Controller, K8s 기반 ephemeral 러너
- [ ] [GHA 보안](github-actions/gha-security.md) — OIDC, permissions, artifact attestation

### GitLab CI

- [x] [GitLab CI](gitlab-ci/gitlab-ci.md) — pipeline 구조, stages, runners, parent-child, dynamic, environments

### Jenkins

- [x] [Jenkins 기본](jenkins/jenkins-basics.md) — controller/agent, JCasC
- [x] [Jenkins Pipeline](jenkins/jenkins-pipeline.md) — Jenkinsfile, declarative vs scripted, shared library, K8s 플러그인

### K8s 네이티브 CI/CD

- [ ] [Tekton](k8s-native/tekton.md) — Task·Pipeline·Trigger, CEL
- [ ] [Argo Workflows](k8s-native/argo-workflows.md) — DAG, artifact, 이벤트 트리거

### ArgoCD (GitOps)

- [x] [ArgoCD 설치](argocd/argocd-install.md) — HA 구성, 프로젝트 분리
- [x] [ArgoCD App](argocd/argocd-apps.md) — Application, ApplicationSet, generator
- [x] [ArgoCD 프로젝트](argocd/argocd-projects.md) — AppProject, SSO/RBAC
- [x] [ArgoCD Sync](argocd/argocd-sync.md) — sync policy, hooks, pruning
- [x] [ArgoCD 운영](argocd/argocd-operations.md) — upgrade, backup, DR
- [x] [ArgoCD 고급](argocd/argocd-advanced.md) — PreDelete Hooks, Shallow Git Clone (3.3), Agent
- [x] [Notifications](argocd/argocd-notifications.md) — 알림 설정, Webhook 연동
- [x] [Image Updater](argocd/argocd-image-updater.md) — 이미지 태그 자동 감지, Git 반영

### Flux (GitOps)

- [ ] [Flux 설치](flux/flux-install.md) — Kustomization, 의존성, health check
- [ ] [Flux Helm](flux/flux-helm.md) — HelmRelease, chart source

### 점진적 배포

- [ ] [Argo Rollouts](progressive-delivery/argo-rollouts.md) — Rollout CR, Analysis, 트래픽 분할
- [ ] [Flagger](progressive-delivery/flagger.md) — AnalysisTemplate, 자동 판단 로직
- [ ] [Feature Flag](progressive-delivery/feature-flag.md) — OpenFeature, LaunchDarkly, Flagsmith, Unleash
- [ ] [트래픽 분할](progressive-delivery/traffic-splitting.md) — Istio·Gateway API·Envoy 연동

### 아티팩트 관리

- [ ] [Harbor](artifact/harbor.md) — 이미지·차트·OCI Artifacts
- [ ] [OCI Artifacts 레지스트리](artifact/oci-artifacts-registry.md) — SBOM·서명 저장 표준

### CI의 DevSecOps

- [ ] [SAST/SCA](devsecops/sast-sca.md) — 코드·의존성 스캔 통합
- [ ] [이미지 스캔](devsecops/image-scanning-cicd.md) — Trivy, Grype, CVE 정책
- [ ] [시크릿 스캔](devsecops/secret-scanning.md) — git-secrets, gitleaks, pre-commit
- [ ] [SLSA](devsecops/slsa-in-ci.md) — Provenance, attestation, Level 상향

### 의존성 관리

- [ ] [의존성 업데이트](dependency/dependency-updates.md) — Renovate·Dependabot, 자동 PR, 그룹핑·스케줄, 보안 업데이트

### 테스트 자동화

- [ ] [테스트 전략](testing/test-strategy.md) — Unit·Integration·E2E·Contract 배분

### 릴리스 관리

- [ ] [SemVer·Changelog](release/semver-and-changelog.md) — SemVer, conventional commits, changelog 자동 생성

### 실전 패턴

- [ ] [모노레포 CI/CD](patterns/monorepo-cicd.md) — Bazel, Nx, affected 감지, 모노/폴리레포 구조
- [ ] [파이프라인 템플릿](patterns/pipeline-templates.md) — 재사용 가능한 템플릿 설계

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
