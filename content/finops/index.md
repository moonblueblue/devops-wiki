---
title: "FinOps"
date: 2026-04-16
tags:
  - finops
  - cost-optimization
  - sustainability
  - roadmap
sidebar_label: "FinOps"
---

# 12. FinOps

Financial Operations. 클라우드 비용을 엔지니어링·재무·비즈니스가
협업해 최적화하는 문화와 방법론.
FinOps Foundation(Linux Foundation 산하)의 프레임워크 기준으로 다룬다.

## 목차

### 개념

- [ ] [FinOps 정의와 Foundation](finops-overview.md)
- [ ] [FinOps Framework (Inform, Optimize, Operate)](finops-framework.md)
- [ ] [FinOps Framework 2026 업데이트 (Value of Technology)](finops-framework-2026.md)
- [ ] [FinOps 주요 페르소나 (Engineer, FinOps Practitioner, Finance)](finops-personas.md)
- [ ] [Principles of FinOps (6가지)](finops-principles.md)
- [ ] [DevOps와 FinOps의 관계](devops-vs-finops.md)
- [ ] [FinOps Certified Practitioner 인증](finops-certification.md)

### 클라우드 비용 구조

- [ ] [주요 비용 드라이버 (Compute, Storage, Network, Data Transfer)](cost-drivers.md)
- [ ] [인스턴스 타입과 가격 모델](instance-pricing.md)
- [ ] [지역별 가격 차이 (Region Arbitrage)](region-pricing.md)
- [ ] [숨겨진 비용 (Egress, Cross-AZ, API Call)](hidden-costs.md)

### 가격 모델 (Purchase Options)

- [ ] [On-Demand 사용 시점](on-demand.md)
- [ ] [Reserved Instance / Savings Plan (AWS)](reserved-savings.md)
- [ ] [Committed Use Discount (GCP)](cud-gcp.md)
- [ ] [Azure Reserved VM Instances](azure-ri.md)
- [ ] [Spot / Preemptible 전략](spot-preemptible.md)
- [ ] [Enterprise Agreement와 협상](enterprise-agreement.md)

### 비용 가시화 (Inform 단계)

- [ ] [AWS Cost Explorer와 CUR](aws-cost-explorer.md)
- [ ] [GCP Billing와 BigQuery Export](gcp-billing.md)
- [ ] [Azure Cost Management](azure-cost-management.md)
- [ ] [CloudHealth, Flexera, Apptio](multicloud-finops-tools.md)
- [ ] [FOCUS Specification v1.3 (2025-12 비준)](focus-specification.md)
- [ ] [FOCUS 확장 범위 (Cloud + SaaS + Data Center)](focus-expanded-scope.md)

### 태깅 전략

- [ ] [필수 태그 정의 (Environment, Team, Product, CostCenter)](tagging-strategy.md)
- [ ] [태그 강제 (SCP, Azure Policy, OPA)](tag-enforcement.md)
- [ ] [태그 거버넌스와 감사](tag-governance.md)
- [ ] [자동 태깅 전략](auto-tagging.md)

### Kubernetes 비용 관리

- [ ] [Kubecost](kubecost.md)
- [ ] [OpenCost (CNCF)](opencost.md)
- [ ] [Rightsizing (Requests/Limits 조정)](k8s-rightsizing.md)
- [ ] [Bin-packing과 노드 활용률 최적화](bin-packing.md)
- [ ] [Karpenter Spot 전략](karpenter-spot.md)
- [ ] [Cluster Autoscaler 비용 최적화](ca-cost-optimization.md)
- [ ] [Multi-tenant 비용 할당](multi-tenant-cost.md)
- [ ] [Namespace 기반 비용 분리](namespace-cost.md)

### 리소스 최적화 (Optimize 단계)

- [ ] [유휴 리소스 탐지와 제거](idle-resources.md)
- [ ] [스토리지 계층화 (S3 Intelligent-Tiering, Glacier)](storage-tiering.md)
- [ ] [데이터 전송 비용 최적화](data-transfer-optimization.md)
- [ ] [로드밸런서·NAT Gateway 최적화](lb-nat-optimization.md)
- [ ] [데이터베이스 비용 최적화](database-cost.md)

### 비용 할당 (Cost Allocation)

- [ ] [Chargeback vs Showback](chargeback-showback.md)
- [ ] [공유 리소스 분배 (Shared Cost)](shared-cost-allocation.md)
- [ ] [팀별·프로젝트별 비용 리포팅](team-cost-reporting.md)
- [ ] [Unit Economics (요청당·사용자당 비용)](unit-economics.md)

### 이상 탐지 (Anomaly Detection)

- [ ] [Cost Anomaly Detection 도구](cost-anomaly-detection.md)
- [ ] [비용 급증 원인 분석](cost-spike-analysis.md)

### Budget과 알림

- [ ] [Budget 설정 (AWS Budgets, GCP Budget, Azure Budget)](budget-setup.md)
- [ ] [Budget 알림과 자동 대응](budget-alerts.md)
- [ ] [예산 초과 방지 정책](budget-enforcement.md)

### FinOps for AI (2026 1순위 주제)

- [ ] [AI 비용 관리 개요 (FinOps Foundation 워킹 그룹)](finops-for-ai-overview.md)
- [ ] [GPU 비용 구조와 최적화](gpu-cost-optimization.md)
- [ ] [LLM 추론 비용 (토큰 기반 과금) 관리](llm-inference-cost.md)
- [ ] [LLM 학습 비용 vs 추론 비용 전략](training-vs-inference-cost.md)
- [ ] [Multi-model Routing으로 비용 최적화](multi-model-routing.md)
- [ ] [AI 워크로드 Unit Economics](ai-unit-economics.md)

### SaaS Cost Management

- [ ] [SaaS FinOps 확장 (FOCUS v1.2+)](saas-finops.md)
- [ ] [SaaS 비용 관리 도구 (Zylo, Productiv)](saas-cost-tools.md)
- [ ] [SaaS 라이선스 최적화](saas-license-optimization.md)

### 지속가능성 (Sustainability)

- [ ] [Cloud Carbon Footprint](cloud-carbon-footprint.md)
- [ ] [Green Software Foundation 원칙](green-software.md)
- [ ] [Carbon-aware Scheduling](carbon-aware-scheduling.md)
- [ ] [Sustainability Reporting](sustainability-reporting.md)

### FinOps + GitOps

- [ ] [비용 정책 as Code](cost-policy-as-code.md)
- [ ] [예산 초과 시 배포 차단 정책](budget-based-deploy-block.md)
- [ ] [FinOps Operator 패턴](finops-operator.md)

### 조직과 문화 (Operate 단계)

- [ ] [FinOps 팀 구성과 역할](finops-team-structure.md)
- [ ] [월간 Cost Review 미팅](monthly-cost-review.md)
- [ ] [FinOps 성숙도 모델 (Crawl, Walk, Run)](finops-maturity.md)
- [ ] [비용 문화와 개발자 교육](cost-culture.md)

### 실전 사례

- [ ] [K8s 비용 50% 절감 사례](case-k8s-cost-reduction.md)
- [ ] [Spot 인스턴스 전환 사례](case-spot-adoption.md)
- [ ] [FinOps 도입 로드맵](finops-adoption-roadmap.md)

---

## 참고 레퍼런스

- [FinOps Foundation](https://www.finops.org/)
- [FOCUS Specification](https://focus.finops.org/)
- [Cloud FinOps (O'Reilly)](https://www.oreilly.com/library/view/cloud-finops-2nd/9781492098355/)
- [OpenCost (CNCF)](https://www.opencost.io/)
- [Kubecost Docs](https://docs.kubecost.com/)
- [Green Software Foundation](https://greensoftware.foundation/)
- [State of FinOps Report](https://stateoffinops.org/)
