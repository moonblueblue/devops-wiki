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

- [ ] [Platform Engineering이란](concepts/platform-engineering-overview.md)
- [ ] [DevOps vs Platform Engineering](concepts/devops-vs-platform-engineering.md)
- [ ] [Platform as a Product 사고방식](concepts/platform-as-product.md)
- [ ] [Internal Developer Platform (IDP) 정의](concepts/idp-definition.md)
- [ ] [Developer Portal vs Developer Platform 구분](concepts/portal-vs-platform.md)
- [ ] [Golden Path (황금길) 개념](concepts/golden-path.md)
- [ ] [Thinnest Viable Platform (TVP)](concepts/thinnest-viable-platform.md)
- [ ] [CNCF Platform Engineering Maturity Model](concepts/cncf-platform-maturity.md)

### 조직 이론 (Team Topologies)

- [ ] [Team Topologies 4가지 팀 유형](team-topologies/team-topologies-overview.md)
- [ ] [Stream-aligned Team](team-topologies/stream-aligned-team.md)
- [ ] [Platform Team의 역할과 책임](team-topologies/platform-team.md)
- [ ] [Enabling Team](team-topologies/enabling-team.md)
- [ ] [Complicated Subsystem Team](team-topologies/complicated-subsystem-team.md)
- [ ] [Team Interaction Mode (Collaboration, X-as-a-Service, Facilitating)](team-topologies/team-interaction-modes.md)

### DevEx (Developer Experience)

- [ ] [Developer Experience (DevEx) 개념](devex/devex-overview.md)
- [ ] [SPACE 프레임워크](devex/space-framework-pe.md)
- [ ] [DORA vs SPACE vs DevEx](devex/metrics-frameworks.md)
- [ ] [Cognitive Load 감소 전략](devex/cognitive-load.md)
- [ ] [Flow State와 개발자 생산성](devex/flow-state.md)

### IDP 구성 요소

- [ ] [Self-Service Developer Portal](idp-components/self-service-portal.md)
- [ ] [환경 프로비저닝 자동화](idp-components/environment-provisioning.md)
- [ ] [Ephemeral Environments (일회용 환경)](idp-components/ephemeral-environments.md)
- [ ] [Golden Path Templates (Scaffolding)](idp-components/golden-path-templates.md)
- [ ] [Service Catalog](idp-components/service-catalog.md)
- [ ] [kro (Kubernetes Resource Orchestrator)](idp-components/kro-platform.md)
- [ ] [Platform Orchestrator 패턴 (Humanitec Score)](idp-components/platform-orchestrator.md)

### AI/ML Platform Engineering

- [ ] [AI 워크로드를 지원하는 플랫폼 설계](ai-ml-platform/ai-platform-design.md)
- [ ] [모델 서빙 플랫폼 (KServe, Seldon Core)](ai-ml-platform/model-serving.md)
- [ ] [Kubeflow와 MLOps 통합](ai-ml-platform/kubeflow.md)
- [ ] [GPU 리소스 관리와 공유](ai-ml-platform/gpu-resource-management.md)
- [ ] [AI 개발자 경험 (Notebook 플랫폼)](ai-ml-platform/ai-developer-experience.md)

### Backstage (Spotify)

- [ ] [Backstage 아키텍처와 설치](backstage/backstage-install.md)
- [ ] [Software Catalog](backstage/backstage-catalog.md)
- [ ] [Software Templates (Scaffolder)](backstage/backstage-scaffolder.md)
- [ ] [TechDocs (docs as code)](backstage/backstage-techdocs.md)
- [ ] [Plugins 생태계](backstage/backstage-plugins.md)
- [ ] [Backstage Operator Model (K8s)](backstage/backstage-operator.md)
- [ ] [Backstage 운영 (멀티테넌트, 인증)](backstage/backstage-operations.md)

### 대체 IDP 도구

- [ ] [Port (SaaS IDP)](alt-idp-tools/port-idp.md)
- [ ] [Cortex](alt-idp-tools/cortex-idp.md)
- [ ] [OpsLevel](alt-idp-tools/opslevel.md)
- [ ] [Humanitec](alt-idp-tools/humanitec.md)
- [ ] [Roadie (Backstage SaaS)](alt-idp-tools/roadie.md)
- [ ] [IDP 도구 선택 기준](alt-idp-tools/idp-tool-comparison.md)

### Scorecards와 Tech Radar

- [ ] [Service Health Scorecards](scorecards-techradar/service-scorecards.md)
- [ ] [Production Readiness Review](scorecards-techradar/production-readiness-review.md)
- [ ] [Internal Tech Radar](scorecards-techradar/internal-tech-radar.md)
- [ ] [Tech Strategy와 표준화](scorecards-techradar/tech-strategy.md)

### API Platform

- [ ] [API Gateway (Kong, Tyk, Apigee)](api-platform/api-gateway.md)
- [ ] [API Management 플랫폼](api-platform/api-management.md)
- [ ] [API 설계 표준 (OpenAPI, AsyncAPI)](api-platform/api-design-standards.md)
- [ ] [API 거버넌스](api-platform/api-governance.md)

### 개발 환경 플랫폼

- [ ] [Cloud Development Environments 개요](dev-environments/cde-overview.md)
- [ ] [Gitpod](dev-environments/gitpod.md)
- [ ] [GitHub Codespaces](dev-environments/github-codespaces.md)
- [ ] [Coder (셀프호스팅)](dev-environments/coder.md)
- [ ] [Devfile과 Remote Containers](dev-environments/devfile-remote-containers.md)

### 플랫폼 관측과 측정

- [ ] [플랫폼 메트릭 (Onboarding time, PR time, Deploy Frequency)](platform-observability/platform-metrics.md)
- [ ] [Platform SLO](platform-observability/platform-slo.md)
- [ ] [사용자 피드백 수집 (NPS, Surveys)](platform-observability/user-feedback.md)
- [ ] [Adoption Metrics](platform-observability/adoption-metrics.md)

### 플랫폼 운영

- [ ] [플랫폼 릴리즈 관리와 Versioning](platform-operations/platform-versioning.md)
- [ ] [하위 호환성 전략](platform-operations/backward-compatibility.md)
- [ ] [플랫폼 마이그레이션 전략](platform-operations/platform-migration.md)
- [ ] [Deprecation 정책](platform-operations/deprecation-policy.md)

### 플랫폼 거버넌스

- [ ] [Policy as Code로 거버넌스](platform-governance/governance-as-code.md)
- [ ] [Golden Path 강제 (Paved Road)](platform-governance/paved-road.md)
- [ ] [역할과 책임 (RACI)](platform-governance/raci-model.md)
- [ ] [비용 거버넌스와 플랫폼](platform-governance/platform-finops.md)

### 실전 사례

- [ ] [Spotify의 Backstage 여정](case-studies/case-spotify.md)
- [ ] [Netflix의 Paved Road](case-studies/case-netflix.md)
- [ ] [Airbnb의 Platform Engineering](case-studies/case-airbnb.md)

---

## 참고 레퍼런스

- [Team Topologies (Matthew Skelton, Manuel Pais)](https://teamtopologies.com/)
- [Platform Engineering Community](https://platformengineering.org/)
- [Backstage Documentation](https://backstage.io/docs/)
- [CNCF Platforms White Paper](https://tag-app-delivery.cncf.io/whitepapers/platforms/)
- [InfoQ Platform Engineering Reports](https://www.infoq.com/platform-engineering/)
- [The Internal Developer Platform (Humanitec)](https://internaldeveloperplatform.org/)
