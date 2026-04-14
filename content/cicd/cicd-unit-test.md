---
title: "CI/CD에서 단위 테스트 자동화"
date: 2026-04-14
tags:
  - cicd
  - unit-test
  - testing
  - jest
  - pytest
sidebar_label: "단위 테스트"
---

# CI/CD에서 단위 테스트 자동화

## 1. 단위 테스트의 역할

CI 파이프라인에서 가장 먼저 실행되는 테스트.
빠른 피드백(수 초~수 분)으로 개발자 실수를 즉시 차단한다.

```
코드 push
    ↓
단위 테스트 (수초~수분)   ← 여기서 빠르게 실패해야 함
    ↓ 통과
통합 테스트 (수분)
    ↓ 통과
배포
```

---

## 2. JavaScript/TypeScript (Jest)

```yaml
# .github/workflows/ci.yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: npm

- run: npm ci
- run: npm test -- --coverage --ci --reporters=default --reporters=jest-junit

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: jest-results
    path: junit.xml

- uses: dorny/test-reporter@v1
  if: always()
  with:
    name: Jest Tests
    path: junit.xml
    reporter: jest-junit
```

```json
// jest.config.js
{
  "collectCoverage": true,
  "coverageThreshold": {
    "global": {
      "branches": 70,
      "functions": 80,
      "lines": 80
    }
  }
}
```

---

## 3. Python (pytest)

```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.12"
    cache: pip

- run: pip install pytest pytest-cov pytest-xml

- run: |
    pytest \
      --cov=src \
      --cov-report=xml \
      --cov-fail-under=80 \
      --junit-xml=pytest-results.xml \
      -v

- uses: codecov/codecov-action@v4
  with:
    files: coverage.xml
```

---

## 4. Java (JUnit + Gradle)

```yaml
- uses: actions/setup-java@v4
  with:
    distribution: temurin
    java-version: "21"
    cache: gradle

- run: ./gradlew test

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: gradle-test-results
    path: build/reports/tests/

- uses: dorny/test-reporter@v1
  if: always()
  with:
    name: Gradle Tests
    path: "build/test-results/**/*.xml"
    reporter: java-junit
```

---

## 5. Go (testing)

```yaml
- uses: actions/setup-go@v5
  with:
    go-version: "1.23"

- run: |
    go test -race \
      -coverprofile=coverage.out \
      -covermode=atomic \
      ./...

- run: go tool cover -func coverage.out

# 커버리지 최소값 체크
- run: |
    COVERAGE=$(go tool cover -func coverage.out | grep total | awk '{print $3}' | tr -d '%')
    if (( $(echo "$COVERAGE < 70" | bc -l) )); then
      echo "커버리지 $COVERAGE% < 70% 기준 미달"
      exit 1
    fi
```

---

## 6. 커버리지 리포트

```yaml
# Codecov 연동 (무료 오픈소스)
- uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    files: coverage.xml
    fail_ci_if_error: true
    flags: unit-tests
```

---

## 7. 테스트 병렬화

```yaml
# 매트릭스로 테스트 분산
strategy:
  matrix:
    shard: [1, 2, 3, 4]

steps:
- run: |
    npx jest \
      --shard=${{ matrix.shard }}/4 \
      --ci --coverage
```

---

## 참고 문서

- [Jest](https://jestjs.io/)
- [pytest](https://docs.pytest.org/)
- [Codecov](https://about.codecov.io/)
