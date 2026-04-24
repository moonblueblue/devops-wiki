---
title: "Infrastructure as Code"
sidebar_label: "IaC"
sidebar_position: 7
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - iac
  - index
---

# Infrastructure as Code

> **티어**: 성장 — **작성 원칙**: 필수만
>
> 환경 의존적 카테고리 (클라우드 중심일수록 크고, 온프레일수록 작다).
> Terraform 중심 + Ansible + K8s-native IaC의 실무 핵심만.
>
> **온프레미스 전제**: 클라우드 Landing Zone은 원칙적으로 제외 (온프레미스 위키).

---

## 학습 경로

| 단계 | 영역 | 핵심 주제 |
|:-:|---|---|
| 1 | 개념 | IaC 개요 · State 관리 |
| 2 | Terraform | 기초 · State · 모듈 · Providers(온프레) |
| 3 | OpenTofu | Terraform과의 분기 · 마이그레이션 |
| 4 | Ansible | 기본 playbook · 운영 패턴 |
| 5 | K8s-native | Crossplane 중심 |
| 6 | 운영 | IaC 테스트 |

---

## 목차

### 개념

- [x] [IaC 개요](concepts/iac-overview.md) — Declarative vs Imperative, 전제 조건
- [x] [State 관리](concepts/state-management.md) — state 저장소, lock, 원격 백엔드, drift 감지 포함

### Terraform / OpenTofu

- [ ] [Terraform 기본](terraform/terraform-basics.md) — HCL, provider, resource, module
- [ ] [Terraform State](terraform/terraform-state.md) — remote state, workspace, 분할 전략
- [ ] [Terraform 모듈](terraform/terraform-modules.md) — 재사용 설계, versioning, registry
- [ ] [Terraform Providers](terraform/terraform-providers.md) — vSphere·OpenStack·Kubernetes·Helm 등 온프레미스 provider 중심
- [ ] [OpenTofu vs Terraform](terraform/opentofu-vs-terraform.md) — 분기 이후 차이, 마이그레이션

### Ansible (구성 관리)

- [ ] [Ansible 기본](ansible/ansible-basics.md) — inventory, playbook, role, idempotency, handler, tag
- [ ] [Ansible 운영](ansible/ansible-operations.md) — AAP(Tower), scale, secret 관리

### K8s 네이티브 IaC

- [ ] [Crossplane](k8s-native/crossplane.md) — Composition v2, Provider, Claim (kro 비교 포함)

### 운영

- [ ] [IaC 테스트](operations/testing-iac.md) — Terratest, Kitchen-Terraform, OPA conftest

---

## 이 카테고리의 경계

- **Secrets 관리 도구**는 `security/` — 여기는 "Terraform에서 주입" 패턴만
- **GitOps로 Terraform 동기화** (Flux TF controller)는 `cicd/`
- **클라우드 Landing Zone**은 원칙적으로 제외 (온프레미스 위키)

---

## 참고 표준

- HashiCorp 공식 문서
- OpenTofu Foundation
- Ansible 공식 문서
- Crossplane 공식 문서
