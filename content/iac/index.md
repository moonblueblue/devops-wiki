---
title: "Infrastructure as Code"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - roadmap
---

# Infrastructure as Code

인프라를 코드로 관리. 수동 작업에서 벗어나기.

## 목차

### 개념

- [x] [IaC란 무엇인가](iac-overview.md)
- [x] [선언형 vs 명령형](iac-declarative-vs-imperative.md)
- [x] [Configuration Management vs Provisioning](iac-cm-vs-provisioning.md)

### Terraform

- [x] [Terraform 기초 (HCL, 워크플로우)](terraform-basics.md)
- [x] [Resource, Data, Variable, Output](terraform-core-components.md)
- [x] [Module 설계와 재사용](terraform-modules.md)
- [x] [State 관리와 Backend](terraform-state.md)
- [x] [Workspace와 디렉토리 전략](terraform-workspace.md)
- [x] [Terraform Cloud / Atlantis](terraform-cloud-atlantis.md)

### Ansible

- [x] [Ansible 기초 (Inventory, Playbook)](ansible-basics.md)
- [x] [Module과 Handler](ansible-module-handler.md)
- [x] [변수, 반복문, 조건문](ansible-variables.md)
- [x] [Role과 Galaxy](ansible-roles-galaxy.md)
- [x] [Ansible vs Terraform 역할 구분](ansible-vs-terraform.md)

### 기타 도구

- [x] [Pulumi 소개](pulumi.md)
- [x] [Packer로 머신 이미지 관리](packer.md)
- [x] [CloudFormation vs CDK (AWS)](cloudformation-cdk.md)

### 실전 패턴

- [x] [IaC 디렉토리 구조 설계](iac-directory-structure.md)
- [x] [모듈 버전 관리](iac-module-versioning.md)
- [x] [시크릿 관리와 IaC](iac-secret-management.md)
- [x] [IaC 코드 리뷰 체크리스트](iac-code-review.md)
