---
title: "GitHub Actions 빌드 구현 (Java, Node, Python, Go)"
date: 2026-04-14
tags:
  - github-actions
  - build
  - java
  - node
  - python
  - go
  - cicd
sidebar_label: "GHA 빌드 구현"
---

# GitHub Actions 빌드 구현

## 1. Node.js

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
        cache: npm          # node_modules 자동 캐시

    - run: npm ci
    - run: npm run lint
    - run: npm test -- --coverage
    - run: npm run build

    - uses: codecov/codecov-action@v4
      with:
        files: ./coverage/lcov.info
```

---

## 2. Java (Gradle)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-java@v4
      with:
        distribution: temurin    # Eclipse Temurin (OpenJDK)
        java-version: "21"
        cache: gradle            # Gradle 캐시 자동

    - name: 권한 부여
      run: chmod +x ./gradlew

    - run: ./gradlew build
    - run: ./gradlew test

    - uses: actions/upload-artifact@v4
      with:
        name: jar-file
        path: build/libs/*.jar
```

---

## 3. Java (Maven)

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-java@v4
      with:
        distribution: temurin
        java-version: "21"
        cache: maven

    - run: mvn -B package --no-transfer-progress
    - run: mvn test

    - uses: actions/upload-artifact@v4
      with:
        name: jar-file
        path: target/*.jar
```

---

## 4. Python

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.11", "3.12"]

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-python@v5
      with:
        python-version: ${{ matrix.python }}
        cache: pip

    - run: pip install -r requirements.txt
    - run: pip install pytest pytest-cov

    - run: pytest --cov=src --cov-report=xml
    - run: python -m flake8 src/

    - uses: codecov/codecov-action@v4
```

---

## 5. Go

```yaml
jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-go@v5
      with:
        go-version: "1.23"
        cache: true        # go mod 캐시

    - run: go mod download
    - run: go build ./...
    - run: go test -race -coverprofile=coverage.out ./...
    - run: go vet ./...

    - name: staticcheck
      run: |
        go install honnef.co/go/tools/cmd/staticcheck@latest
        staticcheck ./...
```

---

## 6. 환경 변수와 시크릿

```yaml
env:
  # Workflow 전역
  REGISTRY: ghcr.io
  APP_NAME: myapp

jobs:
  build:
    env:
      # Job 범위
      NODE_ENV: production

    steps:
    - name: 시크릿 사용
      env:
        DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
      run: ./scripts/migrate.sh

    # 동적 환경 변수 (다음 스텝에서 사용)
    - name: 버전 설정
      run: echo "VERSION=${GITHUB_REF_NAME}" >> $GITHUB_ENV

    - name: 버전 출력
      run: echo "버전: $VERSION"
```

---

## 7. 빌드 결과 요약

```yaml
- name: 빌드 요약
  run: |
    echo "## 빌드 결과" >> $GITHUB_STEP_SUMMARY
    echo "- 버전: ${GITHUB_REF_NAME}" >> $GITHUB_STEP_SUMMARY
    echo "- 커밋: ${GITHUB_SHA:0:7}" >> $GITHUB_STEP_SUMMARY
    echo "- 빌드 번호: ${GITHUB_RUN_NUMBER}" >> $GITHUB_STEP_SUMMARY
```

---

## 참고 문서

- [actions/setup-node](https://github.com/actions/setup-node)
- [actions/setup-java](https://github.com/actions/setup-java)
- [actions/setup-python](https://github.com/actions/setup-python)
- [actions/setup-go](https://github.com/actions/setup-go)
