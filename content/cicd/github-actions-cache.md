---
title: "GitHub Actions 캐시와 Artifact 관리"
date: 2026-04-14
tags:
  - github-actions
  - cache
  - artifact
  - cicd
sidebar_label: "GHA 캐시·Artifact"
---

# GitHub Actions 캐시와 Artifact 관리

## 1. actions/cache

의존성을 캐시해 빌드 시간을 단축한다.

```yaml
# Node.js (수동 캐시)
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
    restore-keys: |
      ${{ runner.os }}-pip-

- run: pip install -r requirements.txt

# Go
- uses: actions/cache@v4
  with:
    path: ~/go/pkg/mod
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}

- run: go build ./...
```

---

## 2. setup-* 내장 캐시 (권장)

더 간단하고 최적화된 캐시를 자동 관리한다.

```yaml
# Node.js (내장 캐시)
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: npm         # 자동으로 node_modules 캐시

# Python (내장 캐시)
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: pip

# Java Gradle (내장 캐시)
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: gradle

# Java Maven (내장 캐시)
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: maven
```

---

## 3. 캐시 키 전략

```yaml
# 정확한 키 → fallback 키 순서로 복원
- uses: actions/cache@v4
  with:
    path: ~/.m2
    # 완전 일치: 이 정확한 캐시가 있으면 사용
    key: ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
    # 부분 일치: 가장 최근 캐시로 복원 (미스 시)
    restore-keys: |
      ${{ runner.os }}-maven-${{ hashFiles('**/pom.xml') }}
      ${{ runner.os }}-maven-
```

**캐시 키 설계 원칙**:
- 의존성 파일의 해시를 포함한다
- OS를 포함한다 (바이너리 캐시인 경우)
- 브랜치별 분리가 필요하면 `github.ref`도 포함

---

## 4. Artifact 업로드/다운로드

빌드 산출물을 Job 간에 전달하거나 다운로드할 수 있다.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - run: npm run build

    - uses: actions/upload-artifact@v4
      with:
        name: build-output    # Artifact 이름
        path: dist/           # 업로드 경로
        retention-days: 7     # 보관 기간 (기본 90일, 최대 90일)
        if-no-files-found: error

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - uses: actions/download-artifact@v4
      with:
        name: build-output
        path: dist/            # 다운로드 경로

    - run: ls -la dist/
    - run: rsync -av dist/ server:/var/www/
```

---

## 5. 테스트 결과 Artifact

```yaml
- name: 테스트 실행
  run: npm test -- --reporter=junit --outputFile=test-results.xml
  continue-on-error: true

- uses: actions/upload-artifact@v4
  if: always()    # 실패해도 업로드
  with:
    name: test-results
    path: test-results.xml

# JUnit 결과를 PR 코멘트로
- uses: dorny/test-reporter@v1
  if: always()
  with:
    name: Jest Tests
    path: test-results.xml
    reporter: jest-junit
```

---

## 6. 캐시 용량 관리

```
GitHub Actions 캐시 한도: 저장소당 10GB
초과 시 오래된 캐시부터 자동 삭제
```

```bash
# GitHub CLI로 캐시 목록 확인
gh cache list

# 특정 캐시 삭제
gh cache delete <cache-id>

# 브랜치 캐시 전체 삭제
gh cache list --ref refs/heads/feature/old-branch \
  | awk '{print $1}' \
  | xargs -I{} gh cache delete {}
```

---

## 7. 재사용 Workflow + Artifact 조합

```yaml
# build.yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.version }}
    steps:
    - id: meta
      uses: docker/metadata-action@v5
      with:
        images: ghcr.io/myorg/myapp
        tags: type=sha

    - uses: docker/build-push-action@v6
      with:
        push: true
        tags: ${{ steps.meta.outputs.tags }}

  deploy-staging:
    needs: build
    uses: ./.github/workflows/reusable-deploy.yaml
    with:
      environment: staging
      image-tag: ${{ needs.build.outputs.image-tag }}
    secrets: inherit
```

---

## 참고 문서

- [actions/cache](https://github.com/actions/cache)
- [actions/upload-artifact](https://github.com/actions/upload-artifact)
- [캐시 Best Practices](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/caching-dependencies-to-speed-up-workflows)
