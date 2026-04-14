---
title: "GitHub Actions 기초 (Workflow, 트리거, 보안)"
date: 2026-04-14
tags:
  - github-actions
  - cicd
  - oidc
  - workflow
sidebar_label: "GitHub Actions 기초"
---

# GitHub Actions 기초

## 1. 기본 구조

```
Workflow (.github/workflows/*.yaml)
  └── Job (독립 실행 단위, 병렬 가능)
        └── Step (순차 실행: action 또는 run)
```

```yaml
# .github/workflows/ci.yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: "20"

    - run: npm ci
    - run: npm test
```

---

## 2. 트리거 (on)

```yaml
on:
  # 브랜치 push
  push:
    branches: [main, "release/*"]
    tags: ["v*"]
    paths-ignore: ["docs/**"]

  # PR 이벤트
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  # 스케줄 (UTC)
  schedule:
  - cron: "0 9 * * 1"   # 매주 월요일 오전 9시

  # 수동 실행
  workflow_dispatch:
    inputs:
      environment:
        description: "배포 환경"
        required: true
        default: staging
        type: choice
        options: [staging, production]

  # 다른 Workflow에서 호출
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      registry-token:
        required: true
```

---

## 3. Runner

```yaml
jobs:
  build:
    # GitHub 호스팅 (무료 2,000분/월)
    runs-on: ubuntu-latest    # ubuntu-24.04
    # runs-on: windows-latest
    # runs-on: macos-latest

  deploy:
    # 셀프 호스팅 (제한 없음)
    runs-on: self-hosted

  # 컨테이너 안에서 실행
  lint:
    runs-on: ubuntu-latest
    container:
      image: node:20-alpine
```

---

## 4. Job 의존성과 매트릭스

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: npm test

  build:
    needs: test          # test 완료 후 실행
    if: success()
    runs-on: ubuntu-latest
    steps:
    - run: npm run build

  # 매트릭스: 여러 환경에서 병렬 실행
  matrix-test:
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, macos-latest]
      fail-fast: false   # 하나 실패해도 나머지 계속
    runs-on: ${{ matrix.os }}
    steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
```

---

## 5. 환경 변수와 시크릿

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    env:
      NODE_ENV: production    # Job 스코프

    steps:
    - name: 시크릿 사용
      env:
        DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
      run: echo "접속 중..."

    # 동적 환경 변수 설정
    - name: 변수 설정
      run: echo "SHA=${GITHUB_SHA::7}" >> $GITHUB_ENV

    - name: 이전 스텝 변수 사용
      run: echo "이미지 태그: $SHA"
```

### 기본 제공 컨텍스트 변수

```yaml
${{ github.sha }}          # 커밋 SHA
${{ github.ref_name }}     # 브랜치/태그 이름
${{ github.actor }}        # 트리거한 사용자
${{ github.repository }}   # owner/repo
${{ github.run_number }}   # 실행 번호
${{ runner.os }}           # Linux / Windows / macOS
```

---

## 6. OIDC로 클라우드 인증 (권장)

장기 자격증명(Access Key)을 저장하지 않고
임시 토큰으로 클라우드 인증한다.

```
GitHub Actions → OIDC 토큰 발급
    → AWS/GCP/Azure가 토큰 검증
        → 임시 자격증명 발급 (수십 분 유효)
```

### AWS

```yaml
permissions:
  id-token: write    # OIDC 토큰 발급 권한
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: ap-northeast-2

    - run: aws s3 ls
```

### GCP

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: >-
          projects/PROJECT_ID/locations/global/
          workloadIdentityPools/github/providers/github
        service_account: github-actions@PROJECT_ID.iam.gserviceaccount.com

    - uses: google-github-actions/setup-gcloud@v2
    - run: gcloud run services list
```

---

## 7. permissions 블록

```yaml
permissions:
  contents: read      # 저장소 읽기
  packages: write     # GHCR 쓰기
  id-token: write     # OIDC 토큰
  pull-requests: read # PR 정보
  checks: write       # 체크 상태

# Job별 최소 권한 부여
jobs:
  build:
    permissions:
      contents: read
      packages: write
```

> **보안 원칙**: 기본값이 full access이므로 반드시 명시적으로 권한 지정.

---

## 8. SHA 고정 (보안 권장)

```yaml
# 태그 대신 SHA로 고정
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: docker/build-push-action@67a2d409e2e2e91f34e2c9e1e7a5f3ddc0a94b33  # v6
```

---

## 참고 문서

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [OIDC 가이드](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments)
- [Workflow 문법](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
