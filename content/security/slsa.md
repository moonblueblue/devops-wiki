---
title: "SLSA 프레임워크"
date: 2026-04-14
tags:
  - slsa
  - security
  - supply-chain
  - provenance
sidebar_label: "SLSA 프레임워크"
---

# SLSA 프레임워크

## 1. 개요

**Supply-chain Levels for Software Artifacts.**
소프트웨어 공급망 보안 강화를 위한 프레임워크.
Google이 제안하고 OpenSSF가 관리한다.

---

## 2. 공급망 공격 예시

```
SolarWinds (2020):
  빌드 시스템 해킹 → 악성 코드 삽입 → 서명된 업데이트 배포
  → 18,000개 이상 조직 감염

Log4Shell (2021):
  오픈소스 의존성(log4j) 취약점
  → Java 앱 대부분에 영향

XZ Utils (2024):
  오픈소스 메인테이너 사칭 → 백도어 삽입
  → 리눅스 시스템 sshd 감염 시도
```

---

## 3. SLSA 레벨

| 레벨 | 요구사항 | 보장 수준 |
|-----|---------|---------|
| SLSA 1 | 빌드 프로세스 문서화, 출처 생성 | 기본 |
| SLSA 2 | 버전 관리, 호스팅 빌드 서비스 | 태조 수정 어려움 |
| SLSA 3 | 강화된 빌드 플랫폼, 출처 검증 가능 | 빌드 시스템 보호 |
| SLSA 4 (구) | 2-person 리뷰, 밀폐된 빌드 | (현재 L3에 통합) |

---

## 4. SLSA Provenance (출처 증명)

누가, 언제, 어떤 소스에서, 어떻게 빌드했는지를 기록한다.

```json
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "subject": [{
    "name": "ghcr.io/myorg/myapp:v1.2.3",
    "digest": {"sha256": "abc123..."}
  }],
  "predicateType": "https://slsa.dev/provenance/v0.2",
  "predicate": {
    "builder": {
      "id": "https://github.com/myorg/myrepo/.github/workflows/release.yaml@refs/heads/main"
    },
    "buildType": "https://github.com/slsa-framework/slsa-github-generator",
    "invocation": {
      "configSource": {
        "uri": "git+https://github.com/myorg/myrepo@refs/heads/main",
        "digest": {"sha1": "def456..."}
      }
    }
  }
}
```

---

## 5. SLSA GitHub Generator

```yaml
# GitHub Actions SLSA L3 Provenance 생성
name: Release

on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      digest: ${{ steps.build.outputs.digest }}
    steps:
    - uses: actions/checkout@v4
    - name: 이미지 빌드
      id: build
      run: |
        docker build -t ghcr.io/myorg/myapp:${{ github.ref_name }} .
        docker push ghcr.io/myorg/myapp:${{ github.ref_name }}
        echo "digest=$(docker inspect --format='{{index .RepoDigests 0}}' ghcr.io/myorg/myapp:${{ github.ref_name }})" >> $GITHUB_OUTPUT

  # SLSA Provenance 자동 생성
  provenance:
    needs: build
    permissions:
      actions: read
      id-token: write
      packages: write
    uses: slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@v2.0.0
    with:
      image: ghcr.io/myorg/myapp
      digest: ${{ needs.build.outputs.digest }}
    secrets:
      registry-username: ${{ github.actor }}
      registry-password: ${{ secrets.GITHUB_TOKEN }}
```

---

## 6. Provenance 검증 (slsa-verifier)

```bash
# 설치
brew install slsa-verifier

# Provenance 검증
slsa-verifier verify-image \
  ghcr.io/myorg/myapp:v1.2.3 \
  --source-uri github.com/myorg/myrepo \
  --source-branch main

# 검증 실패 시 배포 차단
```

---

## 7. 실무 적용 단계

```
Phase 1 (SLSA L1):
  □ 빌드를 스크립트화 (수동 빌드 금지)
  □ Provenance 생성 시작

Phase 2 (SLSA L2):
  □ 모든 빌드를 CI에서만 실행
  □ 소스에서 빌드 추적 가능

Phase 3 (SLSA L3):
  □ 빌드 플랫폼 강화
  □ 에페메럴 빌드 환경 사용
  □ Provenance 검증 자동화
```

---

## 참고 문서

- [SLSA 공식 사이트](https://slsa.dev/)
- [SLSA GitHub Generator](https://github.com/slsa-framework/slsa-github-generator)
- [OpenSSF Scorecard](https://scorecard.dev/)
