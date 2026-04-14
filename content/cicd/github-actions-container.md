---
title: "GitHub Actions 컨테이너 이미지 빌드와 레지스트리 연동"
date: 2026-04-14
tags:
  - github-actions
  - docker
  - container
  - registry
  - cicd
sidebar_label: "GHA 컨테이너 빌드"
---

# GitHub Actions 컨테이너 이미지 빌드

## 1. GHCR(GitHub Container Registry) 빌드 & 푸시

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

    # 멀티플랫폼 빌드 (arm64, amd64)
    - uses: docker/setup-buildx-action@v3

    # GHCR 로그인
    - uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    # 이미지 태그 자동 생성
    - id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=sha,prefix={{branch}}-
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}

    # 빌드 & 푸시
    - uses: docker/build-push-action@v6
      with:
        context: .
        push: ${{ github.event_name != 'pull_request' }}
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        platforms: linux/amd64,linux/arm64
        cache-from: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache
        cache-to: type=registry,ref=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:buildcache,mode=max
```

---

## 2. Docker Hub 연동

```yaml
- uses: docker/login-action@v3
  with:
    registry: docker.io
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: |
      myorg/myapp:latest
      myorg/myapp:${{ github.sha }}
```

---

## 3. AWS ECR 연동

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: ap-northeast-2

    - id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - uses: docker/build-push-action@v6
      with:
        context: .
        push: true
        tags: |
          ${{ steps.login-ecr.outputs.registry }}/myapp:${{ github.sha }}
          ${{ steps.login-ecr.outputs.registry }}/myapp:latest
```

---

## 4. 멀티스테이지 빌드 최적화

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```yaml
- uses: docker/build-push-action@v6
  with:
    context: .
    target: runner    # 특정 스테이지까지만 빌드
    push: true
    tags: myapp:latest
```

---

## 5. 취약점 스캔 (Trivy)

```yaml
- name: 이미지 빌드
  uses: docker/build-push-action@v6
  with:
    context: .
    load: true        # 로컬에만 로드 (push 안함)
    tags: myapp:test

- name: 취약점 스캔
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:test
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: "1"

- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: trivy-results.sarif

# 스캔 통과 후 실제 push
- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}
```

---

## 6. 빌드 아규먼트

```yaml
- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: myapp:latest
    build-args: |
      APP_VERSION=${{ github.ref_name }}
      BUILD_DATE=${{ github.run_id }}
      GIT_SHA=${{ github.sha }}
```

---

## 참고 문서

- [docker/build-push-action](https://github.com/docker/build-push-action)
- [docker/metadata-action](https://github.com/docker/metadata-action)
- [AWS ECR Login Action](https://github.com/aws-actions/amazon-ecr-login)
