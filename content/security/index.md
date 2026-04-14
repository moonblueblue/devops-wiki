---
title: "Security"
date: 2026-04-14
tags:
  - security
  - devsecops
  - roadmap
---

# Security

파이프라인 전체에 보안을 녹여넣기.

## 목차

### 개념

- [x] [DevSecOps란 무엇인가](./devsecops-overview.md)
- [x] [Shift-Left 보안](./shift-left-security.md)
- [x] [제로 트러스트 모델](./zero-trust.md)

### 인증·인가

- [x] [IAM 기본 개념](./iam-basics.md)
- [x] [RBAC과 ABAC](./rbac-abac.md)
- [x] [OAuth2 / OIDC](./oauth2-oidc.md)
- [x] [시크릿 관리 (Vault, Sealed Secrets, External Secrets)](./secret-management.md)

### 컨테이너 보안

- [x] [이미지 취약점 스캔 (Trivy, Grype)](./image-scanning.md)
- [x] [런타임 보안 (Falco)](./falco-runtime-security.md)
- [x] [Pod Security Standards](./pod-security-standards.md)
- [x] [컨테이너 이미지 서명](./image-signing.md)

### 공급망 보안

- [x] [SBOM (Software Bill of Materials)](./sbom.md)
- [x] [SLSA 프레임워크](./slsa.md)
- [x] [아티팩트 서명과 출처 추적](./artifact-signing.md)

### 네트워크 보안

- [x] [네트워크 폴리시](./network-policy-security.md)
- [x] [방화벽과 WAF](./firewall-waf.md)
- [x] [mTLS](./mtls.md)

### 정책 관리

- [x] [OPA / Gatekeeper](./opa-gatekeeper.md)
- [x] [Kyverno](./kyverno.md)
- [x] [Policy as Code](./policy-as-code.md)

### 감사·탐지

- [x] [감사 로그 (Audit Log)](./audit-log.md)
- [x] [침입 탐지와 대응](./intrusion-detection.md)
- [x] [보안 스캐닝 자동화 (CI/CD 통합)](./security-scanning-cicd.md)
