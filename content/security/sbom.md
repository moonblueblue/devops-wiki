---
title: "SBOM (Software Bill of Materials)"
date: 2026-04-14
tags:
  - sbom
  - security
  - supply-chain
sidebar_label: "SBOM"
---

# SBOM (Software Bill of Materials)

## 1. 개념

소프트웨어에 포함된 모든 구성 요소의 목록.
식품 성분표처럼 소프트웨어에 무엇이 들어있는지를 기계가 읽을 수 있는 형태로 표현한다.

```
myapp:v1.2.3
├── node:18-alpine (베이스 이미지)
│   ├── openssl 3.1.2
│   ├── busybox 1.36.1
│   └── ...
└── npm 패키지
    ├── express 4.18.2
    ├── axios 1.6.0
    └── ...
```

---

## 2. SBOM 형식

| 형식 | 개발 주체 | 특징 |
|-----|---------|------|
| **SPDX** | Linux Foundation | ISO 국제 표준, 가장 범용 |
| **CycloneDX** | OWASP | 보안 취약점 분석에 특화 |

---

## 3. SBOM 생성 도구

### Syft

```bash
# 설치
brew install syft

# 이미지에서 SBOM 생성
syft ghcr.io/myorg/myapp:latest -o spdx-json > sbom.spdx.json
syft ghcr.io/myorg/myapp:latest -o cyclonedx-json > sbom.cdx.json

# 로컬 파일시스템
syft ./my-project -o cyclonedx-json > sbom.cdx.json

# 패키지 목록만 빠르게 확인
syft packages ghcr.io/myorg/myapp:latest
```

### Docker Scout

```bash
# Docker CLI에 내장 (Docker Desktop 4.17+)
docker scout sbom myapp:latest
docker scout quickview myapp:latest
docker scout cves myapp:latest   # CVE 분석
```

---

## 4. SBOM을 이미지에 첨부 (Cosign Attestation)

```bash
# SBOM 생성
syft ghcr.io/myorg/myapp:v1.2.3 \
  -o cyclonedx-json > sbom.cdx.json

# 이미지에 SBOM 첨부 (서명 포함)
cosign attest \
  --predicate sbom.cdx.json \
  --type cyclonedx \
  ghcr.io/myorg/myapp:v1.2.3

# 검증 및 조회
cosign verify-attestation \
  --type cyclonedx \
  ghcr.io/myorg/myapp:v1.2.3 | \
  jq '.payload' -r | base64 -d | jq
```

---

## 5. CI/CD 파이프라인 통합

```yaml
jobs:
  sbom:
    runs-on: ubuntu-latest
    permissions:
      packages: write
      id-token: write

    steps:
    - uses: actions/checkout@v4

    - name: 이미지 빌드
      run: docker build -t myapp:${{ github.sha }} .

    - name: Syft SBOM 생성
      uses: anchore/sbom-action@v0
      with:
        image: myapp:${{ github.sha }}
        format: cyclonedx-json
        output-file: sbom.cdx.json

    - name: Grype 취약점 스캔 (SBOM 기반)
      uses: anchore/scan-action@v3
      with:
        sbom: sbom.cdx.json
        fail-build: true
        severity-cutoff: critical

    - name: SBOM 아티팩트 저장
      uses: actions/upload-artifact@v4
      with:
        name: sbom
        path: sbom.cdx.json
```

---

## 6. SBOM 활용

### 취약점 영향 분석

```bash
# Log4Shell (CVE-2021-44228) 영향 받는 시스템 찾기
grype sbom:./sbom.json | grep log4j

# Grype로 SBOM 기반 전체 스캔
grype sbom:./sbom.cdx.json --fail-on high
```

### 라이선스 감사

```bash
# 라이선스 목록 추출
syft ghcr.io/myorg/myapp:latest -o table | grep -v license

# GPL 라이선스 의존성 확인 (법적 검토 필요)
syft packages myapp:latest | grep -i gpl
```

---

## 7. 규제 요구사항

```
미국 정부 행정명령 (EO 14028, 2021):
  → 연방 정부에 납품하는 소프트웨어 SBOM 제출 의무

EU CRA (Cyber Resilience Act):
  → 디지털 제품 제조사 SBOM 제공 의무

NTIA 가이드라인:
  → SBOM 최소 요소 정의 (공급업체, 버전, 해시, 관계)
```

---

## 참고 문서

- [SPDX 공식 스펙](https://spdx.dev/)
- [CycloneDX](https://cyclonedx.org/)
- [Syft GitHub](https://github.com/anchore/syft)
- [NTIA SBOM 가이드](https://www.ntia.gov/sbom)
