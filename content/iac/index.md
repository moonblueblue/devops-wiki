---
title: "Infrastructure as Code"
date: 2026-04-16
tags:
  - iac
  - terraform
  - ansible
  - crossplane
  - roadmap
sidebar_label: "IaC"
---

# 05. Infrastructure as Code

인프라를 코드로 관리. 수동 작업에서 벗어나 버전 관리·리뷰·자동화를
가능하게 한다. Terraform, OpenTofu, Ansible, Crossplane, Pulumi 등
글로벌 스탠다드 도구를 중립적으로 다룬다.

## 목차

### 개념

- [ ] [IaC란 무엇인가](concepts/iac-overview.md)
- [ ] [선언형 vs 명령형](concepts/declarative-vs-imperative.md)
- [ ] [Configuration Management vs Provisioning](concepts/cm-vs-provisioning.md)
- [ ] [멱등성과 선언적 상태](concepts/idempotency.md)
- [ ] [Drift Detection과 복구](concepts/drift-detection.md)

### Terraform / OpenTofu 기초

- [ ] [Terraform vs OpenTofu (라이선스, 호환성, 선택 기준)](terraform-basics/terraform-vs-opentofu.md)
- [ ] [HCL 문법과 워크플로우 (init/plan/apply)](terraform-basics/terraform-basics.md)
- [ ] [Resource, Data, Variable, Output, Locals](terraform-basics/terraform-core-components.md)
- [ ] [표현식과 함수](terraform-basics/terraform-expressions.md)
- [ ] [Provider와 버전 제약](terraform-basics/terraform-providers.md)

### Terraform 심화

- [ ] [Module 설계와 재사용](terraform-advanced/terraform-modules.md)
- [ ] [State 관리와 Backend](terraform-advanced/terraform-state.md)
- [ ] [State Locking과 Remote Backend](terraform-advanced/terraform-state-locking.md)
- [ ] [OpenTofu State/Plan Encryption (v1.7+)](terraform-advanced/opentofu-state-encryption.md)
- [ ] [Workspace와 디렉토리 전략](terraform-advanced/terraform-workspace.md)
- [ ] [Import와 기존 리소스 관리](terraform-advanced/terraform-import.md)
- [ ] [Terragrunt (대규모 Terraform 관리)](terraform-advanced/terragrunt.md)
- [ ] [Terraform Stacks (HCP Terraform)](terraform-advanced/terraform-stacks.md)

### Terraform 운영 플랫폼

- [ ] [HCP Terraform (구 Terraform Cloud)](terraform-platforms/hcp-terraform.md)
- [ ] [Atlantis (오픈소스 PR 자동화)](terraform-platforms/atlantis.md)
- [ ] [Scalr, Env0, Spacelift 대안](terraform-platforms/terraform-platforms.md)

### Terraform 테스트와 정책

- [ ] [Terraform Native Testing (terraform test)](terraform-testing/terraform-testing.md)
- [ ] [Terratest (Go 기반 통합 테스트)](terraform-testing/terratest.md)
- [ ] [tflint, tfsec, checkov, trivy](terraform-testing/terraform-linting.md)
- [ ] [OPA Rego + Conftest for Terraform](terraform-testing/opa-terraform.md)
- [ ] [HashiCorp Sentinel](terraform-testing/sentinel.md)

### Ansible

- [ ] [Ansible 기초 (Inventory, Playbook, Ad-hoc)](ansible/ansible-basics.md)
- [ ] [Module과 Handler](ansible/ansible-module-handler.md)
- [ ] [변수, 반복문, 조건문, 필터](ansible/ansible-variables.md)
- [ ] [Role과 Collection](ansible/ansible-roles-collections.md)
- [ ] [Ansible Galaxy](ansible/ansible-galaxy.md)
- [ ] [Ansible Vault (시크릿)](ansible/ansible-vault.md)
- [ ] [Ansible AWX / Automation Platform](ansible/ansible-awx.md)
- [ ] [Ansible vs Terraform 역할 구분](ansible/ansible-vs-terraform.md)

### Kubernetes-native IaC

- [ ] [Crossplane 개요와 Composition](k8s-native-iac/crossplane.md)
- [ ] [Crossplane Providers와 XRD](k8s-native-iac/crossplane-providers.md)
- [ ] [Crossplane vs Terraform](k8s-native-iac/crossplane-vs-terraform.md)

### 멀티 언어 IaC

- [ ] [Pulumi (TypeScript, Python, Go, C#)](multi-lang-iac/pulumi.md)
- [ ] [Pulumi vs Terraform](multi-lang-iac/pulumi-vs-terraform.md)
- [ ] [CDKTF (CDK for Terraform)](multi-lang-iac/cdktf.md)

### AI-assisted IaC

- [ ] [Ansible Lightspeed (IBM watsonx)](ai-iac/ansible-lightspeed.md)
- [ ] [Pulumi AI와 Copilot 기반 IaC](ai-iac/pulumi-ai.md)
- [ ] [AI-assisted IaC 리뷰 전략과 한계](ai-iac/ai-iac-review.md)

### 머신 이미지

- [ ] [Packer로 머신 이미지 관리](machine-image/packer.md)
- [ ] [EC2 Image Builder, Azure Image Builder 비교](machine-image/cloud-image-builder.md)

### 클라우드 벤더 IaC

- [ ] [AWS CloudFormation과 CDK](cloud-vendor-iac/cloudformation-cdk.md)
- [ ] [Azure Bicep](cloud-vendor-iac/azure-bicep.md)
- [ ] [GCP Deployment Manager와 Config Controller](cloud-vendor-iac/gcp-iac.md)
- [ ] [벤더 IaC vs Terraform 선택 기준](cloud-vendor-iac/vendor-iac-comparison.md)

### 시크릿 관리 (IaC 관점)

- [ ] [Vault와 Terraform 연동](secrets-management/terraform-vault.md)
- [ ] [SOPS + age로 state 외 시크릿 관리](secrets-management/sops-age.md)
- [ ] [외부 시크릿 참조 패턴](secrets-management/external-secret-reference.md)

### 운영 패턴

- [ ] [IaC 디렉토리 구조 설계](operational-patterns/directory-structure.md)
- [ ] [모듈 버전 관리 (semver, Registry, OCI)](operational-patterns/module-versioning.md)
- [ ] [환경 분리 전략 (workspace vs directory vs branch)](operational-patterns/environment-separation.md)
- [ ] [State 백업과 DR](operational-patterns/state-backup-dr.md)
- [ ] [IaC 코드 리뷰 체크리스트](operational-patterns/code-review-checklist.md)

### GitOps와 IaC 통합

- [ ] [Flux Terraform Controller](gitops-iac/flux-tf-controller.md)
- [ ] [ArgoCD + Crossplane 패턴](gitops-iac/argocd-crossplane.md)

---

## 참고 레퍼런스

- [Terraform Documentation](https://developer.hashicorp.com/terraform)
- [OpenTofu Documentation](https://opentofu.org/docs/)
- [Ansible Documentation](https://docs.ansible.com/)
- [Crossplane Documentation](https://docs.crossplane.io/)
- [Pulumi Documentation](https://www.pulumi.com/docs/)
- [Terraform Up & Running (Yevgeniy Brikman)](https://www.terraformupandrunning.com/)
