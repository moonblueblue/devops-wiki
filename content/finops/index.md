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

- [ ] [FinOps 정의와 Foundation](concepts/finops-overview.md)
- [ ] [FinOps Framework (Inform, Optimize, Operate)](concepts/finops-framework.md)
- [ ] [FinOps Framework 2026 업데이트 (Value of Technology)](concepts/finops-framework-2026.md)
- [ ] [FinOps 주요 페르소나 (Engineer, FinOps Practitioner, Finance)](concepts/finops-personas.md)
- [ ] [Principles of FinOps (6가지)](concepts/finops-principles.md)
- [ ] [DevOps와 FinOps의 관계](concepts/devops-vs-finops.md)
- [ ] [FinOps Certified Practitioner 인증](concepts/finops-certification.md)

### 클라우드 비용 구조

- [ ] [주요 비용 드라이버 (Compute, Storage, Network, Data Transfer)](cloud-cost-structure/cost-drivers.md)
- [ ] [인스턴스 타입과 가격 모델](cloud-cost-structure/instance-pricing.md)
- [ ] [지역별 가격 차이 (Region Arbitrage)](cloud-cost-structure/region-pricing.md)
- [ ] [숨겨진 비용 (Egress, Cross-AZ, API Call)](cloud-cost-structure/hidden-costs.md)

### 가격 모델 (Purchase Options)

- [ ] [On-Demand 사용 시점](pricing-models/on-demand.md)
- [ ] [Reserved Instance / Savings Plan (AWS)](pricing-models/reserved-savings.md)
- [ ] [Committed Use Discount (GCP)](pricing-models/cud-gcp.md)
- [ ] [Azure Reserved VM Instances](pricing-models/azure-ri.md)
- [ ] [Spot / Preemptible 전략](pricing-models/spot-preemptible.md)
- [ ] [Enterprise Agreement와 협상](pricing-models/enterprise-agreement.md)

### 비용 가시화 (Inform 단계)

- [ ] [AWS Cost Explorer와 CUR](cost-visibility/aws-cost-explorer.md)
- [ ] [GCP Billing와 BigQuery Export](cost-visibility/gcp-billing.md)
- [ ] [Azure Cost Management](cost-visibility/azure-cost-management.md)
- [ ] [CloudHealth, Flexera, Apptio](cost-visibility/multicloud-finops-tools.md)
- [ ] [FOCUS Specification v1.3 (2025-12 비준)](cost-visibility/focus-specification.md)
- [ ] [FOCUS 확장 범위 (Cloud + SaaS + Data Center)](cost-visibility/focus-expanded-scope.md)

### 태깅 전략

- [ ] [필수 태그 정의 (Environment, Team, Product, CostCenter)](tagging/tagging-strategy.md)
- [ ] [태그 강제 (SCP, Azure Policy, OPA)](tagging/tag-enforcement.md)
- [ ] [태그 거버넌스와 감사](tagging/tag-governance.md)
- [ ] [자동 태깅 전략](tagging/auto-tagging.md)

### Kubernetes 비용 관리

- [ ] [Kubecost](k8s-cost/kubecost.md)
- [ ] [OpenCost (CNCF)](k8s-cost/opencost.md)
- [ ] [Rightsizing (Requests/Limits 조정)](k8s-cost/k8s-rightsizing.md)
- [ ] [Bin-packing과 노드 활용률 최적화](k8s-cost/bin-packing.md)
- [ ] [Karpenter Spot 전략](k8s-cost/karpenter-spot.md)
- [ ] [Cluster Autoscaler 비용 최적화](k8s-cost/ca-cost-optimization.md)
- [ ] [Multi-tenant 비용 할당](k8s-cost/multi-tenant-cost.md)
- [ ] [Namespace 기반 비용 분리](k8s-cost/namespace-cost.md)

### 리소스 최적화 (Optimize 단계)

- [ ] [유휴 리소스 탐지와 제거](resource-optimization/idle-resources.md)
- [ ] [스토리지 계층화 (S3 Intelligent-Tiering, Glacier)](resource-optimization/storage-tiering.md)
- [ ] [데이터 전송 비용 최적화](resource-optimization/data-transfer-optimization.md)
- [ ] [로드밸런서·NAT Gateway 최적화](resource-optimization/lb-nat-optimization.md)
- [ ] [데이터베이스 비용 최적화](resource-optimization/database-cost.md)

### 비용 할당 (Cost Allocation)

- [ ] [Chargeback vs Showback](cost-allocation/chargeback-showback.md)
- [ ] [공유 리소스 분배 (Shared Cost)](cost-allocation/shared-cost-allocation.md)
- [ ] [팀별·프로젝트별 비용 리포팅](cost-allocation/team-cost-reporting.md)
- [ ] [Unit Economics (요청당·사용자당 비용)](cost-allocation/unit-economics.md)

### 이상 탐지 (Anomaly Detection)

- [ ] [Cost Anomaly Detection 도구](anomaly-detection/cost-anomaly-detection.md)
- [ ] [비용 급증 원인 분석](anomaly-detection/cost-spike-analysis.md)

### Budget과 알림

- [ ] [Budget 설정 (AWS Budgets, GCP Budget, Azure Budget)](budget-alerts/budget-setup.md)
- [ ] [Budget 알림과 자동 대응](budget-alerts/budget-alerts.md)
- [ ] [예산 초과 방지 정책](budget-alerts/budget-enforcement.md)

### FinOps for AI (2026 1순위 주제)

- [ ] [AI 비용 관리 개요 (FinOps Foundation 워킹 그룹)](finops-for-ai/finops-for-ai-overview.md)
- [ ] [GPU 비용 구조와 최적화](finops-for-ai/gpu-cost-optimization.md)
- [ ] [LLM 추론 비용 (토큰 기반 과금) 관리](finops-for-ai/llm-inference-cost.md)
- [ ] [LLM 학습 비용 vs 추론 비용 전략](finops-for-ai/training-vs-inference-cost.md)
- [ ] [Multi-model Routing으로 비용 최적화](finops-for-ai/multi-model-routing.md)
- [ ] [AI 워크로드 Unit Economics](finops-for-ai/ai-unit-economics.md)

### SaaS Cost Management

- [ ] [SaaS FinOps 확장 (FOCUS v1.2+)](saas-cost/saas-finops.md)
- [ ] [SaaS 비용 관리 도구 (Zylo, Productiv)](saas-cost/saas-cost-tools.md)
- [ ] [SaaS 라이선스 최적화](saas-cost/saas-license-optimization.md)

### 지속가능성 (Sustainability)

- [ ] [Cloud Carbon Footprint](sustainability/cloud-carbon-footprint.md)
- [ ] [Green Software Foundation 원칙](sustainability/green-software.md)
- [ ] [Carbon-aware Scheduling](sustainability/carbon-aware-scheduling.md)
- [ ] [Sustainability Reporting](sustainability/sustainability-reporting.md)

### FinOps + GitOps

- [ ] [비용 정책 as Code](finops-gitops/cost-policy-as-code.md)
- [ ] [예산 초과 시 배포 차단 정책](finops-gitops/budget-based-deploy-block.md)
- [ ] [FinOps Operator 패턴](finops-gitops/finops-operator.md)

### 조직과 문화 (Operate 단계)

- [ ] [FinOps 팀 구성과 역할](org-culture/finops-team-structure.md)
- [ ] [월간 Cost Review 미팅](org-culture/monthly-cost-review.md)
- [ ] [FinOps 성숙도 모델 (Crawl, Walk, Run)](org-culture/finops-maturity.md)
- [ ] [비용 문화와 개발자 교육](org-culture/cost-culture.md)

### 실전 사례

- [ ] [K8s 비용 50% 절감 사례](case-studies/case-k8s-cost-reduction.md)
- [ ] [Spot 인스턴스 전환 사례](case-studies/case-spot-adoption.md)
- [ ] [FinOps 도입 로드맵](case-studies/finops-adoption-roadmap.md)

---

## 참고 레퍼런스

- [FinOps Foundation](https://www.finops.org/)
- [FOCUS Specification](https://focus.finops.org/)
- [Cloud FinOps (O'Reilly)](https://www.oreilly.com/library/view/cloud-finops-2nd/9781492098355/)
- [OpenCost (CNCF)](https://www.opencost.io/)
- [Kubecost Docs](https://docs.kubecost.com/)
- [Green Software Foundation](https://greensoftware.foundation/)
- [State of FinOps Report](https://stateoffinops.org/)
