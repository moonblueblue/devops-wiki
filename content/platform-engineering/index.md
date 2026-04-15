---
title: "Platform Engineering"
date: 2026-04-16
tags:
  - platform-engineering
  - idp
  - backstage
  - developer-experience
  - roadmap
sidebar_label: "Platform Eng"
---

# 11. Platform Engineering

DevOps를 프로덕트로 만드는 다음 단계.
Internal Developer Platform(IDP), Golden Path, Self-Service를 통해
개발자 생산성을 극대화한다. 2025~2026 글로벌 DevOps 채용의 핵심 역량.

## 목차

### 개념

- [ ] [Platform Engineering이란](platform-engineering-overview.md)
- [ ] [DevOps vs Platform Engineering](devops-vs-platform-engineering.md)
- [ ] [Platform as a Product 사고방식](platform-as-product.md)
- [ ] [Internal Developer Platform (IDP) 정의](idp-definition.md)
- [ ] [Developer Portal vs Developer Platform 구분](portal-vs-platform.md)
- [ ] [Golden Path (황금길) 개념](golden-path.md)
- [ ] [Thinnest Viable Platform (TVP)](thinnest-viable-platform.md)
- [ ] [CNCF Platform Engineering Maturity Model](cncf-platform-maturity.md)

### 조직 이론 (Team Topologies)

- [ ] [Team Topologies 4가지 팀 유형](team-topologies-overview.md)
- [ ] [Stream-aligned Team](stream-aligned-team.md)
- [ ] [Platform Team의 역할과 책임](platform-team.md)
- [ ] [Enabling Team](enabling-team.md)
- [ ] [Complicated Subsystem Team](complicated-subsystem-team.md)
- [ ] [Team Interaction Mode (Collaboration, X-as-a-Service, Facilitating)](team-interaction-modes.md)

### DevEx (Developer Experience)

- [ ] [Developer Experience (DevEx) 개념](devex-overview.md)
- [ ] [SPACE 프레임워크](space-framework-pe.md)
- [ ] [DORA vs SPACE vs DevEx](metrics-frameworks.md)
- [ ] [Cognitive Load 감소 전략](cognitive-load.md)
- [ ] [Flow State와 개발자 생산성](flow-state.md)

### IDP 구성 요소

- [ ] [Self-Service Developer Portal](self-service-portal.md)
- [ ] [환경 프로비저닝 자동화](environment-provisioning.md)
- [ ] [Ephemeral Environments (일회용 환경)](ephemeral-environments.md)
- [ ] [Golden Path Templates (Scaffolding)](golden-path-templates.md)
- [ ] [Service Catalog](service-catalog.md)
- [ ] [kro (Kubernetes Resource Orchestrator)](kro-platform.md)
- [ ] [Platform Orchestrator 패턴 (Humanitec Score)](platform-orchestrator.md)

### AI/ML Platform Engineering

- [ ] [AI 워크로드를 지원하는 플랫폼 설계](ai-platform-design.md)
- [ ] [모델 서빙 플랫폼 (KServe, Seldon Core)](model-serving.md)
- [ ] [Kubeflow와 MLOps 통합](kubeflow.md)
- [ ] [GPU 리소스 관리와 공유](gpu-resource-management.md)
- [ ] [AI 개발자 경험 (Notebook 플랫폼)](ai-developer-experience.md)

### Backstage (Spotify)

- [ ] [Backstage 아키텍처와 설치](backstage-install.md)
- [ ] [Software Catalog](backstage-catalog.md)
- [ ] [Software Templates (Scaffolder)](backstage-scaffolder.md)
- [ ] [TechDocs (docs as code)](backstage-techdocs.md)
- [ ] [Plugins 생태계](backstage-plugins.md)
- [ ] [Backstage Operator Model (K8s)](backstage-operator.md)
- [ ] [Backstage 운영 (멀티테넌트, 인증)](backstage-operations.md)

### 대체 IDP 도구

- [ ] [Port (SaaS IDP)](port-idp.md)
- [ ] [Cortex](cortex-idp.md)
- [ ] [OpsLevel](opslevel.md)
- [ ] [Humanitec](humanitec.md)
- [ ] [Roadie (Backstage SaaS)](roadie.md)
- [ ] [IDP 도구 선택 기준](idp-tool-comparison.md)

### Scorecards와 Tech Radar

- [ ] [Service Health Scorecards](service-scorecards.md)
- [ ] [Production Readiness Review](production-readiness-review.md)
- [ ] [Internal Tech Radar](internal-tech-radar.md)
- [ ] [Tech Strategy와 표준화](tech-strategy.md)

### API Platform

- [ ] [API Gateway (Kong, Tyk, Apigee)](api-gateway.md)
- [ ] [API Management 플랫폼](api-management.md)
- [ ] [API 설계 표준 (OpenAPI, AsyncAPI)](api-design-standards.md)
- [ ] [API 거버넌스](api-governance.md)

### 개발 환경 플랫폼

- [ ] [Cloud Development Environments 개요](cde-overview.md)
- [ ] [Gitpod](gitpod.md)
- [ ] [GitHub Codespaces](github-codespaces.md)
- [ ] [Coder (셀프호스팅)](coder.md)
- [ ] [Devfile과 Remote Containers](devfile-remote-containers.md)

### 플랫폼 관측과 측정

- [ ] [플랫폼 메트릭 (Onboarding time, PR time, Deploy Frequency)](platform-metrics.md)
- [ ] [Platform SLO](platform-slo.md)
- [ ] [사용자 피드백 수집 (NPS, Surveys)](user-feedback.md)
- [ ] [Adoption Metrics](adoption-metrics.md)

### 플랫폼 운영

- [ ] [플랫폼 릴리즈 관리와 Versioning](platform-versioning.md)
- [ ] [하위 호환성 전략](backward-compatibility.md)
- [ ] [플랫폼 마이그레이션 전략](platform-migration.md)
- [ ] [Deprecation 정책](deprecation-policy.md)

### 플랫폼 거버넌스

- [ ] [Policy as Code로 거버넌스](governance-as-code.md)
- [ ] [Golden Path 강제 (Paved Road)](paved-road.md)
- [ ] [역할과 책임 (RACI)](raci-model.md)
- [ ] [비용 거버넌스와 플랫폼](platform-finops.md)

### 실전 사례

- [ ] [Spotify의 Backstage 여정](case-spotify.md)
- [ ] [Netflix의 Paved Road](case-netflix.md)
- [ ] [Airbnb의 Platform Engineering](case-airbnb.md)

---

## 참고 레퍼런스

- [Team Topologies (Matthew Skelton, Manuel Pais)](https://teamtopologies.com/)
- [Platform Engineering Community](https://platformengineering.org/)
- [Backstage Documentation](https://backstage.io/docs/)
- [CNCF Platforms White Paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)
- [InfoQ Platform Engineering Reports](https://www.infoq.com/platform-engineering/)
- [The Internal Developer Platform (Humanitec)](https://internaldeveloperplatform.org/)
