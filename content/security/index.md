---
title: "Security"
sidebar_label: "Security"
sidebar_position: 8
date: 2026-04-18
last_verified: 2026-04-18
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

```
원칙       Zero Trust · Defense in Depth
신원        IAM · OIDC · Workload Identity
시크릿      Vault · ESO · Sealed Secrets · SOPS
네트워크    mTLS 전략 · Network Policy 전략
컨테이너    이미지 서명 · SBOM · Runtime 보안
공급망      SLSA · Sigstore · VEX
정책        OPA/Gatekeeper
암호        Post-Quantum (ML-KEM·ML-DSA)
```

---

## 목차

### 원칙·개념

- [ ] zero-trust — 원칙, 실무 적용, BeyondCorp
- [ ] defense-in-depth — 다층 방어, 실무 체크리스트

### 인증·인가 (AuthN/AuthZ)

- [ ] iam-basics — 주체·리소스·정책, 최소 권한
- [ ] oidc-saml — SSO 프로토콜 비교, 실무 구현
- [ ] workload-identity — IRSA, GKE WI, Azure AD WI, SPIFFE/SPIRE

### Secrets Management (주인공 통합)

- [ ] vault-basics — Vault 아키텍처, Dynamic Secrets, Transit
- [ ] external-secrets-operator — ESO, SecretStore, 주요 provider
- [ ] sealed-secrets — Bitnami Sealed Secrets, 키 관리
- [ ] sops — SOPS + age/GPG, KSOPS, Helm 통합

### Network Security (전략)

- [ ] mtls-strategy — Service Mesh·직접 구현 트레이드오프
- [ ] network-policy-strategy — Default Deny, 계층별 정책
- [ ] service-mesh-security — Istio/Linkerd 보안 모델 비교

### Container Security

- [ ] image-signing — Cosign, Notary v2, sigstore
- [ ] sbom — CycloneDX, SPDX, 생성·저장
- [ ] runtime-security — Falco, Tracee, Tetragon 비교

### Supply Chain (공급망)

- [ ] slsa — Level 1~4, provenance, builder trust
- [ ] sigstore — Rekor, Fulcio, Cosign keyless
- [ ] vex — Vulnerability Exchange, 노이즈 감축

### Policy as Code

- [ ] opa-gatekeeper — ConstraintTemplate, Rego, 실무 정책

### PKI & Cryptography

- [ ] post-quantum-crypto — ML-KEM·ML-DSA, 2026 전환 전략

---

## 이 카테고리의 경계

- **기본 보안 지식**은 각 카테고리로:
  - SELinux·AppArmor·auditd → `linux/`
  - TLS·mTLS 프로토콜 → `network/`
  - RBAC·PSA·Secret encryption → `kubernetes/`
  - CI 스캔 도구 → `cicd/devsecops-ci/`
- 여기는 **전략·공급망·교차 주제만**

---

## 참고 표준

- CIS Benchmarks (Kubernetes, Docker, Linux)
- NSA/CISA Kubernetes Hardening Guide
- NIST CSF, NIST SP 800-207 (Zero Trust)
- OWASP Top 10, ASVS
- SLSA Framework
- OpenSSF Best Practices
