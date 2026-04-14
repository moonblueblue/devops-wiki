---
title: "CI/CD"
date: 2026-04-14
tags:
  - cicd
  - jenkins
  - github-actions
  - roadmap
---

# CI/CD

코드에서 배포까지 자동화. IaC와 함께 자동화의 핵심.

## 목차

### 개념

- [x] [CI/CD란 무엇인가](cicd-overview.md)
- [x] [Continuous Delivery vs Continuous Deployment](cicd-delivery-vs-deployment.md)
- [x] [배포 전략 (Rolling / Blue-Green / Canary)](cicd-deployment-strategies.md)
- [x] [브랜치 전략 (GitFlow / Trunk-Based)](cicd-branching-strategy.md)

### Jenkins

- [x] [Jenkins 설치 및 초기 설정](jenkins-install.md)
- [x] [Job과 Pipeline 개요](jenkins-job-pipeline.md)
- [x] [Jenkinsfile 작성법](jenkins-jenkinsfile.md)
- [x] [Multibranch Pipeline](jenkins-multibranch.md)
- [x] [Agents (분산 빌드)](jenkins-agents.md)
- [x] [주요 플러그인](jenkins-plugins.md)
- [x] [Jenkins 운영 (JCasC, 백업, 모니터링)](jenkins-operations.md)

### GitHub Actions

- [x] [GitHub Actions 구조와 기본 개념](github-actions-basics.md)
- [x] [트리거 (on) 완전 정리](github-actions-triggers.md)
- [x] [보안과 OIDC](github-actions-security.md)
- [x] [빌드·테스트·배포 워크플로우](github-actions-build.md)
- [x] [컨테이너 이미지 빌드·푸시](github-actions-container.md)
- [x] [캐시·Artifact·재사용 Workflow](github-actions-cache.md)

### 테스트 자동화

- [x] [단위 테스트 자동화](cicd-unit-test.md)
- [x] [통합 테스트 자동화](cicd-integration-test.md)
- [x] [성능 테스트 (locust, k6, nGrinder)](cicd-performance-test.md)
- [x] [코드 품질 (SonarQube)](cicd-code-quality.md)

### 실전 패턴

- [x] [실무 CI/CD 파이프라인 설계](cicd-pipeline-design.md)
- [x] [빌드 결과 알림 (Slack, 이메일)](cicd-notifications.md)
- [x] [CI/CD 파이프라인 트러블슈팅](cicd-troubleshooting.md)
