---
title: "GitHub Actions Workflow, Job, Step 기본 구조"
date: 2026-04-14
tags:
  - github-actions
  - workflow
  - cicd
sidebar_label: "GHA 기본 구조"
---

# GitHub Actions 기본 구조

## 1. 계층 구조

```
Workflow (.github/workflows/*.yaml)
  └── Job (독립 실행 단위, 병렬 가능)
        └── Step (순차 실행: action 또는 shell)
```

---

## 2. 최소 예시

```yaml
# .github/workflows/ci.yaml
name: CI

on:
  push:
    branches: [main]
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
        cache: npm

    - run: npm ci
    - run: npm test
```

---

## 3. Job 설정

```yaml
jobs:
  test:
    name: 테스트 실행           # Job 표시 이름
    runs-on: ubuntu-latest      # Runner
    timeout-minutes: 30         # 타임아웃
    continue-on-error: false    # 실패 시 Workflow 중단

    defaults:
      run:
        shell: bash
        working-directory: ./app  # 기본 작업 디렉토리

    steps:
    - run: echo "테스트 실행 중"
```

---

## 4. Job 의존성

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - run: npm test

  build:
    needs: test           # test 완료 후 실행
    runs-on: ubuntu-latest
    steps:
    - run: npm run build

  deploy:
    needs: [test, build]  # 두 Job 모두 완료 후 실행
    runs-on: ubuntu-latest
    steps:
    - run: ./deploy.sh
```

---

## 5. 매트릭스 전략

여러 환경에서 병렬로 테스트한다.

```yaml
jobs:
  test:
    strategy:
      matrix:
        node: [18, 20, 22]
        os: [ubuntu-latest, macos-latest]
        exclude:
        - os: macos-latest
          node: 18       # macOS + Node 18 조합 제외
      fail-fast: false   # 하나 실패해도 나머지 계속
    runs-on: ${{ matrix.os }}
    steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
    - run: npm test
```

---

## 6. Runner 유형

```yaml
jobs:
  build:
    # GitHub 호스팅 (무료 2,000분/월)
    runs-on: ubuntu-latest    # ubuntu-24.04
    # runs-on: windows-latest
    # runs-on: macos-latest
    # runs-on: ubuntu-latest-4-cores  # 대용량 Runner

  deploy:
    # 셀프 호스팅
    runs-on: self-hosted

  lint:
    # 컨테이너 안에서 실행
    runs-on: ubuntu-latest
    container:
      image: node:20-alpine
      env:
        NODE_ENV: test
```

---

## 7. 기본 제공 컨텍스트

```yaml
steps:
- run: |
    echo "커밋: ${{ github.sha }}"
    echo "브랜치: ${{ github.ref_name }}"
    echo "사용자: ${{ github.actor }}"
    echo "저장소: ${{ github.repository }}"
    echo "Run 번호: ${{ github.run_number }}"
    echo "OS: ${{ runner.os }}"
```

---

## 참고 문서

- [Workflow 문법](https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions)
- [컨텍스트 레퍼런스](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs)
