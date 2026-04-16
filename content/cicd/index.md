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

- [ ] [CI vs CD (Continuous Delivery vs Continuous Deployment)](concepts/ci-cd-definitions.md)
- [ ] [CI/CD 파이프라인 구조와 설계](concepts/pipeline-design.md)
- [ ] [배포 전략 (Rolling, Blue-Green, Canary, A/B, Shadow)](concepts/deployment-strategies.md)
- [ ] [브랜치 전략 (Trunk-Based, GitFlow, GitHub Flow)](concepts/branching-strategy.md)
- [ ] [DORA 메트릭 (Deploy Frequency, Lead Time, MTTR, Change Failure Rate)](concepts/dora-metrics.md)
- [ ] [Accelerate의 4가지 핵심 DevOps 역량](concepts/accelerate-capabilities.md)

### Jenkins

- [ ] [Jenkins 설치와 초기 설정](jenkins/jenkins-install.md)
- [ ] [Job과 Pipeline 개요](jenkins/jenkins-job-pipeline.md)
- [ ] [Jenkinsfile (Declarative vs Scripted)](jenkins/jenkins-jenkinsfile.md)
- [ ] [Multibranch Pipeline](jenkins/jenkins-multibranch.md)
- [ ] [Agents (분산 빌드, K8s 에이전트)](jenkins/jenkins-agents.md)
- [ ] [주요 플러그인과 선택 기준](jenkins/jenkins-plugins.md)
- [ ] [JCasC (Configuration as Code)](jenkins/jenkins-jcasc.md)
- [ ] [Jenkins 운영 (백업, 모니터링, 업그레이드)](jenkins/jenkins-operations.md)

### GitHub Actions

- [ ] [GitHub Actions 구조와 기본 개념](github-actions/github-actions-basics.md)
- [ ] [트리거 (on) 완전 정리](github-actions/github-actions-triggers.md)
- [ ] [Secrets와 OIDC Federation](github-actions/github-actions-security.md)
- [ ] [빌드·테스트·배포 워크플로우](github-actions/github-actions-workflow.md)
- [ ] [컨테이너 이미지 빌드·푸시](github-actions/github-actions-container.md)
- [ ] [Reusable Workflow와 Composite Action](github-actions/github-actions-reusable.md)
- [ ] [Matrix Build 전략](github-actions/github-actions-matrix.md)
- [ ] [Self-hosted Runner (K8s ARC)](github-actions/github-actions-self-hosted.md)
- [ ] [캐시와 Artifact](github-actions/github-actions-cache.md)

### GitLab CI

- [ ] [.gitlab-ci.yml 구조](gitlab-ci/gitlab-ci-basics.md)
- [ ] [Runner (Shared, Group, Specific)](gitlab-ci/gitlab-runner.md)
- [ ] [Stages, Jobs, DAG](gitlab-ci/gitlab-ci-dag.md)
- [ ] [GitLab Auto DevOps](gitlab-ci/gitlab-auto-devops.md)
- [ ] [멀티프로젝트 파이프라인](gitlab-ci/gitlab-multi-project.md)

### 기타 CI/CD 플랫폼

- [ ] [CircleCI](other-platforms/circleci.md)
- [ ] [Drone CI, Woodpecker CI](other-platforms/drone-woodpecker.md)

### Kubernetes-native CI/CD

- [ ] [Tekton (CNCF Incubating)](k8s-native-cicd/tekton.md)
- [ ] [Argo Workflows (DAG 기반)](k8s-native-cicd/argo-workflows.md)
- [ ] [Dagger (코드로 표현하는 CI)](k8s-native-cicd/dagger.md)

### 테스트 자동화

- [ ] [단위 테스트 자동화](test-automation/unit-test.md)
- [ ] [통합 테스트 자동화](test-automation/integration-test.md)
- [ ] [Testcontainers (통합 테스트 표준)](test-automation/testcontainers.md)
- [ ] [E2E 테스트 (Playwright, Cypress)](test-automation/e2e-test.md)
- [ ] [성능 테스트 (k6, Locust, JMeter)](test-automation/performance-test.md)
- [ ] [Contract Testing (Pact)](test-automation/contract-testing.md)
- [ ] [코드 품질 (SonarQube, CodeClimate)](test-automation/code-quality.md)

### 보안 통합 (DevSecOps in CI)

- [ ] [SAST (SonarQube, CodeQL, Semgrep)](devsecops-ci/sast.md)
- [ ] [SCA (Snyk, Dependency-Check)](devsecops-ci/sca.md)
- [ ] [Secret Scanning (gitleaks, trufflehog)](devsecops-ci/secret-scanning.md)
- [ ] [Container Image Scanning (Trivy, Grype)](devsecops-ci/image-scanning-cicd.md)
- [ ] [IaC Scanning (Checkov, tfsec, kics)](devsecops-ci/iac-scanning.md)
- [ ] [SLSA Provenance를 CI에서 생성 (GHA Attestation, Tekton Chains)](devsecops-ci/slsa-in-ci.md)
- [ ] [빌드 아티팩트 서명 (cosign, Sigstore)](devsecops-ci/build-signing.md)

### 아티팩트 관리

- [ ] [Container Registry in CI](artifact-management/registry-ci.md)
- [ ] [Nexus Repository Manager](artifact-management/nexus.md)
- [ ] [JFrog Artifactory](artifact-management/artifactory.md)
- [ ] [npm, Maven, PyPI 프라이빗 저장소](artifact-management/private-package-registry.md)

### 릴리즈 관리

- [ ] [Semantic Versioning](release-management/semver.md)
- [ ] [semantic-release로 자동화](release-management/semantic-release.md)
- [ ] [Changelog 자동 생성](release-management/changelog-automation.md)
- [ ] [Release Notes 자동화](release-management/release-notes.md)

### 실전 패턴

- [ ] [모노레포 CI/CD (Nx, Turborepo, Bazel)](practical-patterns/monorepo-cicd.md)
- [ ] [마이크로서비스 CI/CD](practical-patterns/microservices-cicd.md)
- [ ] [빌드 캐시 전략](practical-patterns/build-cache.md)
- [ ] [파이프라인 최적화 (병렬화, 선택적 실행)](practical-patterns/pipeline-optimization.md)
- [ ] [알림 (Slack, PagerDuty, Email)](practical-patterns/cicd-notifications.md)
- [ ] [CI/CD 트러블슈팅](practical-patterns/cicd-troubleshooting.md)

---

## 참고 레퍼런스

- [DORA Research](https://dora.dev/)
- [Accelerate (Nicole Forsgren et al.)](https://itrevolution.com/product/accelerate/)
- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [GitLab CI Documentation](https://docs.gitlab.com/ee/ci/)
- [Tekton Documentation](https://tekton.dev/docs/)
- [Continuous Delivery (Jez Humble, David Farley)](https://continuousdelivery.com/)
