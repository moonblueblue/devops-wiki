---
title: "GitHub Actions 실전 (빌드·캐시·재사용)"
date: 2026-04-14
tags:
  - github-actions
  - docker
  - cicd
  - cache
sidebar_label: "GitHub Actions 실전"
---

# GitHub Actions 실전

## 1. 컨테이너 이미지 빌드 & 푸시

```yaml
name: Build and Push

on:
  push:
    branches: [main]
    tags: ["v*"]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - uses: actions/checkout@v4

    # Buildx (멀티플랫폼 빌드 지원)
    - uses: docker/setup-buildx-action@v3

    # GHCR 로그인 (GITHUB_TOKEN 사용)
    - uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    # 이미지 태그·라벨 자동 생성
    - id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=sha,prefix={{branch}}-
          type=semver,pattern={{version}}

    # 빌드 & 푸시
    - uses: docker/build-push-action@v6
      with:
        context: .
        push: ${{ github.event_name != 'pull_request' }}
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        # Docker 레이어 캐시 (레지스트리 저장)
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max
```

---

## 2. 캐시 전략

### 의존성 캐시 (actions/cache)

```yaml
# Node.js
- uses: actions/cache@v4
  with:
    path: node_modules
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-
- run: npm ci

# Python
- uses: actions/cache@v4
  with:
    path: ~/.cache/pip
    key: ${{ runner.os }}-pip-${{ hashFiles('**/requirements.txt') }}
- run: pip install -r requirements.txt

# Go
- uses: actions/cache@v4
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
- run: go build ./...
```

### setup-* 액션의 내장 캐시

```yaml
# setup-node built-in cache
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: npm              # 자동으로 node_modules 캐시

# setup-python built-in cache
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: pip

# setup-java built-in cache
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: gradle
```

---

## 3. Artifact 업로드/다운로드

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: npm run build

    - uses: actions/upload-artifact@v4
      with:
        name: build-output
        path: dist/
        retention-days: 7

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - uses: actions/download-artifact@v4
      with:
        name: build-output
        path: dist/

    - run: ls dist/
```

---

## 4. 재사용 가능한 Workflow

공통 파이프라인을 모듈화한다.

```yaml
# .github/workflows/reusable-deploy.yaml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      image-tag:
        required: true
        type: string
    secrets:
      kube-config:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
    - uses: actions/checkout@v4

    - name: kubeconfig 설정
      run: |
        mkdir -p $HOME/.kube
        echo "${{ secrets.kube-config }}" | base64 -d > $HOME/.kube/config

    - name: 배포
      run: |
        kubectl set image deployment/myapp \
          myapp=ghcr.io/myorg/myapp:${{ inputs.image-tag }}
        kubectl rollout status deployment/myapp
```

```yaml
# .github/workflows/deploy.yaml (호출하는 쪽)
jobs:
  build:
    ...
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}

  deploy-staging:
    needs: build
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: staging
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.STAGING_KUBE_CONFIG }}

  deploy-production:
    needs: [build, deploy-staging]
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: production
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.PROD_KUBE_CONFIG }}
```

---

## 5. Environment 보호 규칙

```yaml
jobs:
  deploy-prod:
    environment:
      name: production        # GitHub UI에서 설정
      url: https://app.example.com
    runs-on: ubuntu-latest
    steps:
    - run: ./deploy.sh

# GitHub 저장소 설정에서:
# Settings → Environments → production
# - Required reviewers: 1명 이상
# - Wait timer: 0분
# - Deployment branches: main만
```

---

## 6. 취약점 스캔 (Trivy)

```yaml
- name: 컨테이너 취약점 스캔
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: "1"         # 취약점 발견 시 실패

- uses: github/codeql-action/upload-sarif@v3
  if: always()             # 실패해도 결과 업로드
  with:
    sarif_file: trivy-results.sarif
```

---

## 7. 완성된 파이프라인 예시

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
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: npm
    - run: npm ci
    - run: npm run lint
    - run: npm test -- --coverage
    - uses: codecov/codecov-action@v4

  build:
    needs: test
    if: github.event_name == 'push'
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
        tags: |
          type=sha
          type=ref,event=branch
    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE }}:buildcache,mode=max

  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: staging
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.STAGING_KUBE_CONFIG }}

  deploy-prod:
    needs: build
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: production
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets:
      kube-config: ${{ secrets.PROD_KUBE_CONFIG }}
```

---

## 참고 문서

- [docker/build-push-action](https://github.com/docker/build-push-action)
- [actions/cache](https://github.com/actions/cache)
- [Reusable Workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [Environments](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/managing-environments-for-deployment)
