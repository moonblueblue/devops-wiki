---
title: "Security"
date: 2026-04-16
tags:
  - security
  - devsecops
  - zero-trust
  - supply-chain
  - roadmap
sidebar_label: "Security"
---

# 09. Security

DevSecOps. 파이프라인 전체에 보안을 녹여 넣는다.
IAM·시크릿·공급망·컨테이너·네트워크·컴플라이언스까지,
글로벌 스탠다드 보안 표준(CIS, NSA, NIST, OWASP, SLSA) 기준으로 다룬다.

## 목차

### 개념

- [ ] [DevSecOps란 무엇인가](concepts/devsecops-overview.md)
- [ ] [Shift-Left 보안](concepts/shift-left-security.md)
- [ ] [Zero Trust 아키텍처](concepts/zero-trust.md)
- [ ] [Defense in Depth](concepts/defense-in-depth.md)
- [ ] [최소 권한 원칙 (Least Privilege)](concepts/least-privilege.md)

### 인증·인가

- [ ] [IAM 기본 개념](authn-authz/iam-basics.md)
- [ ] [인증 vs 인가 (AuthN vs AuthZ)](authn-authz/authn-vs-authz.md)
- [ ] [RBAC, ABAC, ReBAC](authn-authz/rbac-abac-rebac.md)
- [ ] [OAuth 2.0와 OIDC](authn-authz/oauth2-oidc.md)
- [ ] [SAML과 엔터프라이즈 SSO](authn-authz/saml.md)
- [ ] [Workload Identity (SPIFFE, SPIRE)](authn-authz/spiffe-spire.md)
- [ ] [MFA, FIDO2, Passkey](authn-authz/mfa-passkey.md)

### PKI와 암호학

- [ ] [대칭·비대칭 키 암호학 기초](pki-cryptography/cryptography-basics.md)
- [ ] [해시와 디지털 서명](pki-cryptography/hashing-signing.md)
- [ ] [PKI 구조와 인증서 라이프사이클](pki-cryptography/pki-lifecycle.md)
- [ ] [cert-manager로 자동화](pki-cryptography/cert-manager-automation.md)
- [ ] [HSM과 KMS](pki-cryptography/hsm-kms.md)

### 시크릿 관리

- [ ] [HashiCorp Vault 기초](secrets-management/vault-basics.md)
- [ ] [Vault Dynamic Secrets](secrets-management/vault-dynamic-secrets.md)
- [ ] [Vault Transit (암호화 서비스)](secrets-management/vault-transit.md)
- [ ] [AWS Secrets Manager, GCP Secret Manager, Azure Key Vault](secrets-management/cloud-secrets.md)
- [ ] [Kubernetes Secret의 한계](secrets-management/k8s-secret-limits.md)
- [ ] [Sealed Secrets](secrets-management/sealed-secrets-security.md)
- [ ] [External Secrets Operator](secrets-management/eso-security.md)
- [ ] [Secret Rotation 전략](secrets-management/secret-rotation.md)
- [ ] [Secret Scanning (gitleaks, trufflehog, detect-secrets)](secrets-management/secret-scanning-tools.md)

### 컨테이너 보안

- [ ] [컨테이너 보안 위협 모델](container-security/container-threat-model.md)
- [ ] [이미지 취약점 스캔 (Trivy, Grype, Snyk, Clair)](container-security/image-scanning.md)
- [ ] [런타임 보안 (Falco)](container-security/falco.md)
- [ ] [Tracee (eBPF 런타임 보안)](container-security/tracee.md)
- [ ] [Tetragon (Cilium eBPF 런타임 enforcement)](container-security/tetragon.md)
- [ ] [eBPF 런타임 보안 비교 (Falco/Tracee/Tetragon)](container-security/ebpf-runtime-comparison.md)
- [ ] [Pod Security Admission (PSA)](container-security/pod-security-admission-security.md)
- [ ] [Container Escape 시나리오](container-security/container-escape.md)
- [ ] [Rootless 컨테이너 보안](container-security/rootless-security.md)

### 공급망 보안 (Supply Chain Security)

- [ ] [SBOM (SPDX, CycloneDX)](supply-chain/sbom.md)
- [ ] [VEX (Vulnerability Exploitability eXchange, OpenVEX)](supply-chain/vex.md)
- [ ] [SLSA 프레임워크 (Level 1~4)](supply-chain/slsa.md)
- [ ] [Sigstore (cosign, Rekor, Fulcio)](supply-chain/sigstore.md)
- [ ] [Notary v2](supply-chain/notary-v2.md)
- [ ] [Reproducible Builds](supply-chain/reproducible-builds-security.md)
- [ ] [OpenSSF Scorecard](supply-chain/openssf-scorecard.md)
- [ ] [실제 공급망 공격 사례 분석 (SolarWinds, 3CX, xz-utils)](supply-chain/supply-chain-attacks.md)

### 네트워크 보안

- [ ] [방화벽 전략 (계층별 방어)](network-security/firewall-strategy.md)
- [ ] [WAF (Web Application Firewall)](network-security/waf.md)
- [ ] [DDoS 방어 (Cloudflare, AWS Shield)](network-security/ddos-protection.md)
- [ ] [mTLS 실전 (서비스 간)](network-security/mtls-practical.md)
- [ ] [Service Mesh 보안 (Istio, Linkerd)](network-security/service-mesh-security.md)
- [ ] [Zero Trust Network 구현 (BeyondCorp, Teleport)](network-security/beyondcorp.md)
- [ ] [VPN vs Zero Trust](network-security/vpn-vs-ztn.md)

### 정책 관리 (Policy as Code)

- [ ] [OPA (Open Policy Agent) 기초](policy-as-code/opa-basics.md)
- [ ] [Rego 언어](policy-as-code/rego.md)
- [ ] [Gatekeeper (K8s)](policy-as-code/gatekeeper.md)
- [ ] [Kyverno (K8s)](policy-as-code/kyverno.md)
- [ ] [OPA vs Kyverno 선택 기준](policy-as-code/opa-vs-kyverno.md)
- [ ] [Admission Webhook 기반 정책](policy-as-code/admission-webhook-security.md)

### 보안 표준·컴플라이언스

- [ ] [CIS Benchmarks (K8s, Docker, Linux)](compliance/cis-benchmarks.md)
- [ ] [NSA Kubernetes Hardening Guide](compliance/nsa-k8s-hardening.md)
- [ ] [NIST Cybersecurity Framework](compliance/nist-csf.md)
- [ ] [ISO 27001, SOC 2, PCI DSS](compliance/compliance-standards.md)
- [ ] [GDPR와 개인정보보호법](compliance/privacy-laws.md)
- [ ] [Compliance as Code (InSpec, Chef Compliance)](compliance/compliance-as-code.md)
- [ ] [Kubescape (CNCF, CIS/NSA 자동 스캔)](compliance/kubescape.md)
- [ ] [kube-bench](compliance/kube-bench.md)

### 애플리케이션 보안

- [ ] [SAST (정적 분석)](app-security/sast-security.md)
- [ ] [DAST (동적 분석)](app-security/dast.md)
- [ ] [IAST (Interactive)](app-security/iast.md)
- [ ] [SCA (Software Composition Analysis)](app-security/sca-security.md)
- [ ] [OWASP Top 10](app-security/owasp-top10.md)
- [ ] [API Security (OWASP API Top 10)](app-security/api-security.md)

### 위협 분석

- [ ] [Threat Modeling (STRIDE, DREAD)](threat-analysis/threat-modeling.md)
- [ ] [Attack Tree와 MITRE ATT&CK](threat-analysis/attack-tree-mitre.md)

### 감사와 탐지

- [ ] [Kubernetes Audit Logging](audit-detection/k8s-audit-logging.md)
- [ ] [SIEM 기초 (Splunk, Elastic, Sentinel)](audit-detection/siem.md)
- [ ] [침입 탐지 (IDS/IPS)](audit-detection/ids-ips.md)
- [ ] [이상 행위 탐지 (UEBA)](audit-detection/ueba.md)

### 보안 운영

- [ ] [CVE 대응 프로세스와 패치 관리](security-operations/cve-response.md)
- [ ] [보안 사고 대응 (Security IR)](security-operations/security-ir.md)
- [ ] [포렌식 기초](security-operations/forensics-basics.md)
- [ ] [Red Team vs Blue Team vs Purple Team](security-operations/red-blue-purple-team.md)

---

## 참고 레퍼런스

- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [NSA Kubernetes Hardening Guide](https://media.defense.gov/2022/Aug/29/2003066362/-1/-1/0/CTR_KUBERNETES_HARDENING_GUIDANCE_1.2_20220829.PDF)
- [OWASP](https://owasp.org/)
- [OpenSSF](https://openssf.org/)
- [SLSA Framework](https://slsa.dev/)
- [Sigstore](https://www.sigstore.dev/)
- [MITRE ATT&CK](https://attack.mitre.org/)
