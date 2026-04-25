---
title: "Security"
sidebar_label: "Security"
sidebar_position: 8
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - security
  - index
---

# Security

> **티어**: 성장 — **작성 원칙**: 필수만
>
> 각 레이어에서 기초 보안은 해당 카테고리가 다루고, **교차·전략·공급망만** 여기 둔다.

---

## 학습 경로

| 단계 | 영역 | 핵심 주제 |
|:-:|---|---|
| 1 | 원칙 | Zero Trust |
| 2 | 신원 | OIDC·SAML · Workload Identity |
| 3 | 시크릿 | Vault · ESO · 경량 도구 |
| 4 | 네트워크 | mTLS 전략 · Network Policy 전략 |
| 5 | 컨테이너 | 이미지 서명 · SBOM · 런타임 보안 |
| 6 | 공급망 | SLSA · Sigstore |
| 7 | 정책 | OPA/Gatekeeper · Kyverno |

---

## 목차

### 원칙·개념

- [x] [Zero Trust](principles/zero-trust.md) — 원칙, BeyondCorp, 다층 방어를 포함한 실무 적용

### 인증·인가 (AuthN/AuthZ)

- [x] [OIDC·SAML](authn-authz/oidc-saml.md) — SSO 프로토콜 비교, 실무 구현
- [x] [Workload Identity](authn-authz/workload-identity.md) — IRSA, GKE WI, Azure AD WI, SPIFFE/SPIRE

### 시크릿 관리 (주인공 통합)

- [x] [Vault 기본](secrets/vault-basics.md) — Vault 아키텍처, Dynamic Secrets, Transit
- [x] [External Secrets Operator](secrets/external-secrets-operator.md) — ESO, SecretStore, 주요 provider
- [x] [경량 시크릿 도구](secrets/lightweight-secrets.md) — Sealed Secrets·SOPS, 키 관리, Helm 통합

### 네트워크 보안 (전략)

- [ ] [mTLS 전략](network-security/mtls-strategy.md) — Service Mesh·직접 구현 트레이드오프
- [ ] [Network Policy 전략](network-security/network-policy-strategy.md) — Default Deny, 계층별 정책

### 컨테이너 보안

- [ ] [이미지 서명](container-security/image-signing.md) — Cosign, Notary v2, sigstore
- [ ] [SBOM](container-security/sbom.md) — CycloneDX, SPDX, 생성·저장, VEX 통합
- [ ] [런타임 보안](container-security/runtime-security.md) — Falco, Tracee, Tetragon 비교

### 공급망 보안

- [ ] [SLSA](supply-chain/slsa.md) — Level 1~4, provenance, builder trust
- [ ] [Sigstore](supply-chain/sigstore.md) — Rekor, Fulcio, Cosign keyless

### Policy as Code

- [ ] [OPA·Gatekeeper](policy/opa-gatekeeper.md) — ConstraintTemplate, Rego, 실무 정책
- [ ] [Kyverno](policy/kyverno.md) — Kubernetes 네이티브 정책 엔진, YAML 기반 정책

---

## 이 카테고리의 경계

- **기본 보안 지식**은 각 카테고리로:
  - SELinux·AppArmor·auditd → `linux/`
  - TLS·mTLS 프로토콜 → `network/`
  - RBAC·PSA·Secret encryption → `kubernetes/`
  - CI 스캔 도구 → `cicd/devsecops-ci/`
- **Service Mesh 구현 및 Post-Quantum TLS는 `network/`가 주인공**
- 여기는 **전략·공급망·교차 주제만**

---

## 참고 표준

- CIS Benchmarks (Kubernetes, Docker, Linux)
- NSA/CISA Kubernetes Hardening Guide
- NIST CSF, NIST SP 800-207 (Zero Trust)
- OWASP Top 10, ASVS
- SLSA Framework
- OpenSSF Best Practices
