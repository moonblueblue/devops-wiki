---
title: "Infrastructure as Code"
date: 2026-04-12
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

- [x] [IaC란 무엇인가 (선언형 vs 명령형, 프로비저닝 vs 구성 관리)](iac-overview.md)

### Terraform

- [x] [Terraform 기초 (HCL, 워크플로우)](terraform-basics.md)
- [x] [Resource, Data, Variable, Output](terraform-core-components.md)
- [x] [Module 설계와 State 관리](terraform-module-state.md)
- [ ] Workspace와 디렉토리 전략
- [ ] Terraform Cloud / Atlantis

### Ansible

- [x] [Ansible 기초 (Inventory, Playbook, 조건문, 반복문)](ansible-basics.md)
- [x] [Role과 Galaxy (Collection, group_vars, Terraform 비교)](ansible-roles-galaxy.md)
