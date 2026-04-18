---
title: "Infrastructure as Code"
sidebar_label: "IaC"
sidebar_position: 7
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - iac
  - index
---

# Infrastructure as Code

> **티어**: 성장 — **작성 원칙**: 필수만
>
> 환경 의존적 카테고리 (클라우드 중심일수록 크고, 온프레일수록 작다).
> Terraform 중심 + Ansible + K8s-native IaC의 실무 핵심만.

---

## 학습 경로

```
개념        Drift · State · 재현성
Terraform   기초 → 모듈 → Ephemeral → 테스트
Ansible     기본 playbook → 운영 패턴
K8s-native  Crossplane · kro
운영        Tagging · Testing · Cost 통합
```

---

## 목차

### 개념

- [ ] iac-overview — Declarative vs Imperative, 전제 조건
- [ ] drift-detection — 감지 방법, 자동 복구 전략
- [ ] state-management — state 저장소, lock, 원격 백엔드

### Terraform / OpenTofu

- [ ] terraform-basics — HCL, provider, resource, module
- [ ] terraform-state — remote state, workspace, 분할 전략
- [ ] terraform-modules — 재사용 설계, versioning, registry
- [ ] terraform-ephemeral — Ephemeral Resources·Values (1.10+)
- [ ] opentofu-vs-terraform — 분기 이후 차이, 마이그레이션

### Ansible (구성 관리)

- [ ] ansible-basics — inventory, playbook, role
- [ ] ansible-playbook — idempotency, handler, tag
- [ ] ansible-operations — AAP(Tower), scale, secret 관리

### K8s-native IaC

- [ ] crossplane — Composition v2, Provider, Claim
- [ ] kro — Kube Resource Orchestrator, ResourceGroup

### 운영

- [ ] tagging-strategy — 일관된 태그 (FinOps 통합)
- [ ] testing-iac — Terratest, Kitchen-Terraform, OPA conftest

---

## 이 카테고리의 경계

- **Secrets 관리 도구**는 `security/` — 여기는 "Terraform에서 주입" 패턴만
- **GitOps로 Terraform 동기화** (Flux TF controller)는 `cicd/`
- **클라우드 Landing Zone**은 필요 시 여기 또는 별도 카테고리 승격

---

## 참고 표준

- HashiCorp 공식 문서
- OpenTofu Foundation
- Ansible 공식 문서
- Crossplane 공식 문서
