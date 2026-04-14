---
title: "코드 품질 (SonarQube)"
date: 2026-04-14
tags:
  - cicd
  - sonarqube
  - code-quality
  - static-analysis
sidebar_label: "코드 품질"
---

# 코드 품질 (SonarQube)

## 1. SonarQube 개요

정적 코드 분석 플랫폼.
버그, 취약점, 코드 냄새(Code Smell)를 자동으로 감지한다.

```
코드 push
    ↓
SonarQube 분석
    ├── 버그 (Bugs)
    ├── 취약점 (Vulnerabilities)
    ├── 코드 냄새 (Code Smells)
    ├── 중복 코드 (Duplications)
    └── 테스트 커버리지
    ↓
Quality Gate 통과/실패
    → 실패 시 PR merge 차단
```

---

## 2. SonarQube 설치 (Docker)

```yaml
# docker-compose.yaml
services:
  sonarqube:
    image: sonarqube:10-community
    ports:
    - "9000:9000"
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://db:5432/sonar
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    volumes:
    - sonarqube_data:/opt/sonarqube/data
    - sonarqube_logs:/opt/sonarqube/logs
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: sonar
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
    volumes:
    - postgresql:/var/lib/postgresql/data

volumes:
  sonarqube_data:
  sonarqube_logs:
  postgresql:
```

---

## 3. GitHub Actions 연동

```yaml
# .github/workflows/sonar.yaml
name: SonarQube Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  sonar:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0    # Git 전체 히스토리 (blame 분석)

    - uses: actions/setup-java@v4
      with:
        distribution: temurin
        java-version: "21"

    - name: 테스트 + 커버리지
      run: ./gradlew test jacocoTestReport

    - uses: SonarSource/sonarqube-scan-action@v5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}

    # Quality Gate 결과 대기
    - uses: SonarSource/sonarqube-quality-gate-action@v1
      timeout-minutes: 5
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
```

```properties
# sonar-project.properties
sonar.projectKey=my-project
sonar.projectName=My Project
sonar.sources=src/main
sonar.tests=src/test
sonar.java.coveragePlugin=jacoco
sonar.coverage.jacoco.xmlReportPaths=build/reports/jacoco/test/jacocoTestReport.xml
sonar.qualitygate.wait=true
```

---

## 4. Quality Gate 설정

```
SonarQube UI → Quality Gates → Create
기본 조건:
  □ Coverage ≥ 80%
  □ Duplicated Lines ≤ 3%
  □ Maintainability Rating ≤ A
  □ Reliability Rating ≤ A
  □ Security Rating ≤ A
  □ 신규 취약점 0개
```

---

## 5. SonarCloud (SaaS 버전)

오픈소스는 무료로 사용 가능한 클라우드 서비스.
서버 운영이 필요 없다.

```yaml
- uses: SonarSource/sonarcloud-github-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
  with:
    args: >
      -Dsonar.organization=myorg
      -Dsonar.projectKey=myorg_myproject
```

---

## 6. 린터와 정적 분석 도구 비교

| 도구 | 언어 | 역할 |
|-----|------|------|
| **SonarQube** | 다국어 | 종합 코드 품질 분석 |
| **ESLint** | JS/TS | 코드 스타일 + 에러 |
| **flake8/pylint** | Python | PEP8 + 에러 |
| **golangci-lint** | Go | 다수 lint 통합 |
| **SpotBugs** | Java | 버그 패턴 감지 |
| **PMD** | Java/Apex | 코드 품질 |
| **Checkstyle** | Java | 코딩 컨벤션 |

---

## 7. 린터 CI 통합 예시

```yaml
# Node.js ESLint + Prettier
- run: npm run lint
- run: npm run format:check

# Python
- run: flake8 src/ --max-line-length=120
- run: black --check src/

# Go
- uses: golangci/golangci-lint-action@v6
  with:
    version: v1.60

# PR 코멘트 자동 추가
- uses: reviewdog/action-eslint@v1
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    reporter: github-pr-review
```

---

## 참고 문서

- [SonarQube 공식 문서](https://docs.sonarsource.com/sonarqube/)
- [SonarCloud](https://sonarcloud.io/)
- [GitHub Actions Integration](https://docs.sonarsource.com/sonarqube/latest/devops-platform-integration/github-integration/)
