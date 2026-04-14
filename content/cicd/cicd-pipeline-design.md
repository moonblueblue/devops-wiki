---
title: "실무 CI/CD 파이프라인 설계"
date: 2026-04-14
tags:
  - cicd
  - pipeline
  - design
  - best-practices
sidebar_label: "파이프라인 설계"
---

# 실무 CI/CD 파이프라인 설계

## 1. 파이프라인 설계 원칙

```
빠른 실패 (Fail Fast)
    → 가장 빠른 체크를 먼저 실행
    → 문제 있으면 조기 중단

최소 권한 (Least Privilege)
    → 각 Job에 필요한 권한만 부여
    → OIDC로 장기 자격증명 제거

재현 가능성 (Reproducibility)
    → 같은 코드 = 같은 결과
    → 버전 고정, 캐시 키 포함
```

---

## 2. 표준 파이프라인 구조

```
PR 생성 트리거:
  lint + format check (1분)
      ↓
  단위 테스트 (3분)
      ↓
  보안 스캔 (SAST) (2분)

main 병합 트리거:
  위 3단계
      ↓
  컨테이너 이미지 빌드 & 스캔 (5분)
      ↓
  스테이징 배포 (2분)
      ↓
  통합 테스트 / 스모크 테스트 (5분)
      ↓
  [수동 승인] 또는 자동 승격
      ↓
  프로덕션 배포 (카나리/롤링)
      ↓
  배포 검증 (헬스체크)
```

---

## 3. GitHub Actions 완성 파이프라인

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE: ${{ github.repository }}

jobs:
  # 1단계: 빠른 검사
  lint:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "20", cache: npm }
    - run: npm ci
    - run: npm run lint
    - run: npm run format:check

  # 2단계: 테스트
  test:
    needs: lint
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_PASSWORD: testpass
        options: --health-cmd pg_isready
        ports: ["5432:5432"]
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "20", cache: npm }
    - run: npm ci
    - run: npm test -- --coverage
    - uses: codecov/codecov-action@v4

  # 3단계: 보안 스캔
  security:
    needs: lint
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
    - uses: actions/checkout@v4
    - uses: github/codeql-action/init@v3
      with: { languages: javascript }
    - uses: github/codeql-action/autobuild@v3
    - uses: github/codeql-action/analyze@v3

  # 4단계: 빌드 (main 브랜치만)
  build:
    needs: [test, security]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}
    steps:
    - uses: actions/checkout@v4
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE }}
        tags: type=sha
    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE }}:buildcache,mode=max

  # 5단계: 스테이징 배포
  deploy-staging:
    needs: build
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: staging
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.STAGING_KUBE_CONFIG }}

  # 6단계: 프로덕션 배포 (수동 승인)
  deploy-prod:
    needs: deploy-staging
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: production
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.PROD_KUBE_CONFIG }}
```

---

## 4. 멀티 환경 배포 전략

```
feature/* → PR → 단위 테스트만
develop   → 스테이징 자동 배포
main      → 스테이징 → 수동 승인 → 프로덕션
hotfix/*  → 단위 테스트 → 프로덕션 즉시 (긴급 패치)
```

---

## 5. 파이프라인 최적화 팁

```yaml
# 불필요한 재실행 방지
- if: github.actor != 'dependabot[bot]'

# 특정 경로 변경 시만 실행
on:
  push:
    paths:
    - "src/**"
    - "package*.json"

# 동시 실행 제한 (배포 충돌 방지)
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false  # 배포는 중단하지 않음
```

---

## 참고 문서

- [GitHub Actions Best Practices](https://docs.github.com/en/actions/writing-workflows/quickstart)
- [Reusable Workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
