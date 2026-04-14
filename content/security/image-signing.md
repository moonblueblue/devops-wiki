---
title: "컨테이너 이미지 서명"
date: 2026-04-14
tags:
  - cosign
  - image-signing
  - security
  - supply-chain
sidebar_label: "이미지 서명"
---

# 컨테이너 이미지 서명

## 1. 왜 필요한가

```
문제:
  이미지 레지스트리에서 이미지를 pull할 때
  → 이 이미지가 실제로 우리가 빌드한 것인가?
  → 레지스트리가 해킹됐다면?
  → 누군가 이미지를 변조했다면?

해결:
  이미지에 서명을 추가
  → 배포 시 서명 검증
  → 서명 없거나 잘못된 이미지 → 배포 거부
```

---

## 2. Cosign (Sigstore)

CNCF 프로젝트. 컨테이너 이미지 서명·검증의 표준.

### 키 기반 서명

```bash
# 설치
brew install cosign

# 키 쌍 생성
cosign generate-key-pair
# → cosign.key (프라이빗), cosign.pub (퍼블릭)

# 이미지 서명
cosign sign --key cosign.key \
  ghcr.io/myorg/myapp:v1.2.3

# 서명 검증
cosign verify --key cosign.pub \
  ghcr.io/myorg/myapp:v1.2.3
```

### Keyless 서명 (OIDC 기반)

키 관리 없이 GitHub Actions/GCP ID로 서명한다.

```bash
# GitHub Actions에서 Keyless 서명
cosign sign \
  --oidc-issuer=https://token.actions.githubusercontent.com \
  ghcr.io/myorg/myapp:v1.2.3

# 검증 (OIDC 발급자 + ID 확인)
cosign verify \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity="https://github.com/myorg/myrepo/.github/workflows/release.yaml@refs/heads/main" \
  ghcr.io/myorg/myapp:v1.2.3
```

---

## 3. GitHub Actions 통합

```yaml
jobs:
  build-and-sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write    # Keyless 서명용

    steps:
    - uses: actions/checkout@v4

    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: 이미지 빌드·푸시
      uses: docker/build-push-action@v6
      id: build
      with:
        push: true
        tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

    - name: Cosign 설치
      uses: sigstore/cosign-installer@v3

    - name: 이미지 서명 (Keyless)
      run: |
        cosign sign --yes \
          ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

---

## 4. Kubernetes에서 서명 검증 강제

### Kyverno 정책

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-image-signature
    match:
      any:
      - resources:
          kinds: [Pod]
    verifyImages:
    - imageReferences:
      - "ghcr.io/myorg/*"
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/myorg/*/.github/workflows/*.yaml@refs/heads/main"
            issuer: "https://token.actions.githubusercontent.com"
```

### Connaisseur (서명 검증 Admission Controller)

```bash
helm repo add connaisseur https://sse-secure-systems.github.io/connaisseur/charts
helm install connaisseur connaisseur/connaisseur \
  --namespace connaisseur --create-namespace
```

---

## 5. SBOM 첨부

이미지에 SBOM(소프트웨어 구성 요소 명세)을 함께 서명·첨부한다.

```bash
# Syft로 SBOM 생성
syft ghcr.io/myorg/myapp:v1.2.3 -o spdx-json > sbom.json

# SBOM을 이미지에 첨부 (Cosign attestation)
cosign attest --predicate sbom.json \
  --type spdxjson \
  ghcr.io/myorg/myapp:v1.2.3

# SBOM 검증
cosign verify-attestation \
  --type spdxjson \
  ghcr.io/myorg/myapp:v1.2.3 | jq .payload -r | base64 -d | jq
```

---

## 참고 문서

- [Cosign 공식 문서](https://docs.sigstore.dev/cosign/overview/)
- [Sigstore](https://www.sigstore.dev/)
- [Kyverno 이미지 검증](https://kyverno.io/docs/writing-policies/verify-images/)
