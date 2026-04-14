---
title: "아티팩트 서명과 출처 추적"
date: 2026-04-14
tags:
  - sigstore
  - cosign
  - security
  - supply-chain
sidebar_label: "아티팩트 서명"
---

# 아티팩트 서명과 출처 추적

## 1. Sigstore 에코시스템

```
Sigstore 프로젝트 (OpenSSF/CNCF):
  Cosign    → 컨테이너 이미지 서명
  Fulcio    → OIDC 기반 코드 서명 인증서 발급
  Rekor     → 공개 투명성 로그 (불변 기록)
  gitsign   → Git 커밋 서명
```

모든 서명이 Rekor에 공개 기록되어 감사 가능하다.

---

## 2. 서명 대상

```
컨테이너 이미지:
  cosign sign ghcr.io/myorg/myapp:v1.2.3

Helm Chart:
  helm package my-chart
  cosign sign ./my-chart-1.0.0.tgz

바이너리:
  cosign sign-blob --bundle ./cosign.bundle my-binary

Git 커밋:
  gitsign (커밋 서명으로 코드 출처 추적)
```

---

## 3. Cosign Attestation (첨부 데이터)

이미지에 SBOM, Vulnerability 스캔 결과, Provenance를 첨부한다.

```bash
# 취약점 스캔 결과 첨부
trivy image --format cosign-vuln \
  --output vuln.json \
  ghcr.io/myorg/myapp:v1.2.3

cosign attest \
  --predicate vuln.json \
  --type vuln \
  ghcr.io/myorg/myapp:v1.2.3

# SBOM 첨부
syft ghcr.io/myorg/myapp:v1.2.3 -o cyclonedx-json | \
  cosign attest \
    --predicate /dev/stdin \
    --type cyclonedx \
    ghcr.io/myorg/myapp:v1.2.3

# 커스텀 데이터 첨부
echo '{"approved_by": "security-team", "date": "2026-04-14"}' | \
  cosign attest \
    --predicate /dev/stdin \
    --type custom \
    ghcr.io/myorg/myapp:v1.2.3
```

---

## 4. Rekor (투명성 로그)

모든 서명이 Rekor에 공개 기록된다.

```bash
# 서명 기록 확인
cosign triangulate ghcr.io/myorg/myapp:v1.2.3

# Rekor에서 직접 조회
rekor-cli get \
  --rekor_server https://rekor.sigstore.dev \
  --uuid <uuid>

# 이미지 서명 조회
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp "https://github.com/myorg/.*" \
  ghcr.io/myorg/myapp:v1.2.3
```

---

## 5. Git 커밋 서명 (gitsign)

```bash
# gitsign 설치
brew install sigstore/tap/gitsign

# git 서명 설정
git config --global gpg.x509.program gitsign
git config --global gpg.format x509
git config --global commit.gpgsign true

# 이후 git commit 시 자동으로 OIDC로 서명
git commit -m "feat: add payment feature"
# → 브라우저에서 OIDC 인증 후 서명

# 커밋 서명 검증
gitsign verify HEAD
```

---

## 6. Policy as Code로 서명 강제

```yaml
# Kyverno로 서명된 이미지만 허용
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-signed-images
spec:
  validationFailureAction: Enforce
  rules:
  - name: verify-signature
    match:
      any:
      - resources:
          kinds: [Pod]
          namespaces: [production]
    verifyImages:
    - imageReferences:
      - "ghcr.io/myorg/*"
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/myorg/*"
            issuer: "https://token.actions.githubusercontent.com"
      # SBOM attestation도 요구
      attestations:
      - predicateType: https://cyclonedx.org/bom
```

---

## 7. 공급망 보안 체크리스트

```
이미지:
□ 빌드 시 Cosign으로 서명
□ 서명 없는 이미지 배포 거부 (Kyverno/OPA)
□ 취약점 스캔 결과 Attestation 첨부

소스코드:
□ Git 커밋 서명 (gitsign 또는 GPG)
□ 브랜치 보호 (signed commits 필수 설정)
□ 의존성 고정 (lock file)

빌드:
□ 밀폐된 빌드 환경 (ephemeral runner)
□ SLSA Provenance 생성
□ 빌드 결과물 해시 기록
```

---

## 참고 문서

- [Sigstore 공식 문서](https://docs.sigstore.dev/)
- [Cosign](https://docs.sigstore.dev/cosign/overview/)
- [Rekor](https://docs.sigstore.dev/rekor/overview/)
- [gitsign](https://docs.sigstore.dev/gitsign/overview/)
