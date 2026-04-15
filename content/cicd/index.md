---
title: "CI/CD"
date: 2026-04-16
tags:
  - cicd
  - jenkins
  - github-actions
  - gitlab-ci
  - tekton
  - roadmap
sidebar_label: "CI/CD"
---

# 06. CI/CD

코드에서 배포까지 자동화. DORA 메트릭 기반으로 성숙도를 측정하고,
Jenkins·GitHub Actions·GitLab CI·Tekton 등 글로벌 스탠다드 플랫폼을
중립적으로 다룬다.

## 목차

### 개념

- [ ] [CI vs CD (Continuous Delivery vs Continuous Deployment)](ci-cd-definitions.md)
- [ ] [CI/CD 파이프라인 구조와 설계](pipeline-design.md)
- [ ] [배포 전략 (Rolling, Blue-Green, Canary, A/B, Shadow)](deployment-strategies.md)
- [ ] [브랜치 전략 (Trunk-Based, GitFlow, GitHub Flow)](branching-strategy.md)
- [ ] [DORA 메트릭 (Deploy Frequency, Lead Time, MTTR, Change Failure Rate)](dora-metrics.md)
- [ ] [Accelerate의 4가지 핵심 DevOps 역량](accelerate-capabilities.md)

### Jenkins

- [ ] [Jenkins 설치와 초기 설정](jenkins-install.md)
- [ ] [Job과 Pipeline 개요](jenkins-job-pipeline.md)
- [ ] [Jenkinsfile (Declarative vs Scripted)](jenkins-jenkinsfile.md)
- [ ] [Multibranch Pipeline](jenkins-multibranch.md)
- [ ] [Agents (분산 빌드, K8s 에이전트)](jenkins-agents.md)
- [ ] [주요 플러그인과 선택 기준](jenkins-plugins.md)
- [ ] [JCasC (Configuration as Code)](jenkins-jcasc.md)
- [ ] [Jenkins 운영 (백업, 모니터링, 업그레이드)](jenkins-operations.md)

### GitHub Actions

- [ ] [GitHub Actions 구조와 기본 개념](github-actions-basics.md)
- [ ] [트리거 (on) 완전 정리](github-actions-triggers.md)
- [ ] [Secrets와 OIDC Federation](github-actions-security.md)
- [ ] [빌드·테스트·배포 워크플로우](github-actions-workflow.md)
- [ ] [컨테이너 이미지 빌드·푸시](github-actions-container.md)
- [ ] [Reusable Workflow와 Composite Action](github-actions-reusable.md)
- [ ] [Matrix Build 전략](github-actions-matrix.md)
- [ ] [Self-hosted Runner (K8s ARC)](github-actions-self-hosted.md)
- [ ] [캐시와 Artifact](github-actions-cache.md)

### GitLab CI

- [ ] [.gitlab-ci.yml 구조](gitlab-ci-basics.md)
- [ ] [Runner (Shared, Group, Specific)](gitlab-runner.md)
- [ ] [Stages, Jobs, DAG](gitlab-ci-dag.md)
- [ ] [GitLab Auto DevOps](gitlab-auto-devops.md)
- [ ] [멀티프로젝트 파이프라인](gitlab-multi-project.md)

### Kubernetes-native CI/CD

- [ ] [Tekton (CNCF Graduated)](tekton.md)
- [ ] [Argo Workflows (DAG 기반)](argo-workflows.md)
- [ ] [Dagger (코드로 표현하는 CI)](dagger.md)

### 테스트 자동화

- [ ] [단위 테스트 자동화](unit-test.md)
- [ ] [통합 테스트 자동화](integration-test.md)
- [ ] [E2E 테스트 (Playwright, Cypress)](e2e-test.md)
- [ ] [성능 테스트 (k6, Locust, JMeter)](performance-test.md)
- [ ] [Contract Testing (Pact)](contract-testing.md)
- [ ] [코드 품질 (SonarQube, CodeClimate)](code-quality.md)

### 보안 통합 (DevSecOps in CI)

- [ ] [SAST (SonarQube, CodeQL, Semgrep)](sast.md)
- [ ] [SCA (Snyk, Dependency-Check)](sca.md)
- [ ] [Secret Scanning (gitleaks, trufflehog)](secret-scanning.md)
- [ ] [Container Image Scanning (Trivy, Grype)](image-scanning-cicd.md)
- [ ] [IaC Scanning (Checkov, tfsec, kics)](iac-scanning.md)

### 아티팩트 관리

- [ ] [Container Registry in CI](registry-ci.md)
- [ ] [Nexus Repository Manager](nexus.md)
- [ ] [JFrog Artifactory](artifactory.md)
- [ ] [npm, Maven, PyPI 프라이빗 저장소](private-package-registry.md)

### 릴리즈 관리

- [ ] [Semantic Versioning](semver.md)
- [ ] [semantic-release로 자동화](semantic-release.md)
- [ ] [Changelog 자동 생성](changelog-automation.md)
- [ ] [Release Notes 자동화](release-notes.md)

### 실전 패턴

- [ ] [모노레포 CI/CD (Nx, Turborepo, Bazel)](monorepo-cicd.md)
- [ ] [마이크로서비스 CI/CD](microservices-cicd.md)
- [ ] [빌드 캐시 전략](build-cache.md)
- [ ] [파이프라인 최적화 (병렬화, 선택적 실행)](pipeline-optimization.md)
- [ ] [알림 (Slack, PagerDuty, Email)](cicd-notifications.md)
- [ ] [CI/CD 트러블슈팅](cicd-troubleshooting.md)

---

## 참고 레퍼런스

- [DORA Research](https://dora.dev/)
- [Accelerate (Nicole Forsgren et al.)](https://itrevolution.com/product/accelerate/)
- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [GitLab CI Documentation](https://docs.gitlab.com/ee/ci/)
- [Tekton Documentation](https://tekton.dev/docs/)
- [Continuous Delivery (Jez Humble, David Farley)](https://continuousdelivery.com/)
