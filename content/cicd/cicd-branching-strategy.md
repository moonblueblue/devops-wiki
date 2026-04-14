---
title: "브랜치 전략과 CI/CD"
date: 2026-04-14
tags:
  - cicd
  - git
  - branching
  - gitflow
  - trunk-based
sidebar_label: "브랜치 전략"
---

# 브랜치 전략과 CI/CD

## 1. 브랜치 전략이 CI/CD에 미치는 영향

브랜치 전략은 "언제, 어떤 브랜치를 배포하는가"를 결정한다.
CI/CD 파이프라인 설계와 직결된다.

---

## 2. GitFlow

```
main ────────────────────────────────────────
  ↑ release                        ↑ hotfix
develop ────────────────────────────────────
   ↑ feature/A  ↑ feature/B
```

| 브랜치 | 역할 |
|-------|------|
| `main` | 프로덕션 코드 (태그로 릴리즈) |
| `develop` | 다음 릴리즈 통합 브랜치 |
| `feature/*` | 기능 개발 |
| `release/*` | 릴리즈 준비 (버그 수정만) |
| `hotfix/*` | 프로덕션 긴급 패치 |

```yaml
# GitFlow CI/CD 예시
on:
  push:
    branches: [main, develop, "release/*"]
  pull_request:
    branches: [develop, main]

jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    # main에 push될 때만 프로덕션 배포
```

**장점**: 버전 관리 명확, 여러 버전 동시 유지 가능
**단점**: 브랜치 많아서 복잡, 통합 지연 가능성

**적합**: 주기적 릴리즈, 다중 버전 지원 (앱 스토어 앱 등)

---

## 3. GitHub Flow

```
main ────────────────────────────────────────
   ↑ PR      ↑ PR      ↑ PR
feature/A  feature/B  fix/bug-123
```

- `main`은 항상 배포 가능
- 기능 브랜치에서 작업 → PR → 리뷰 → merge → 자동 배포

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    # PR 시 테스트 실행

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    # merge 즉시 프로덕션 배포
```

**적합**: 소규모 팀, 지속적 배포를 원할 때

---

## 4. Trunk-Based Development (TBD)

```
main ────────────────────────────────────────
   ↑1일  ↑1일  ↑1일  ↑1일
 feat/A feat/B feat/C feat/D
```

- 단일 브랜치(`main/trunk`) 항상 배포 가능 상태
- 기능 브랜치는 **1~2일 이내** 병합
- 미완성 기능은 **Feature Flag**로 숨김
- 2025년 기준 고성능 팀의 사실상 표준

```yaml
# Feature Flag 예시
if feature_flags.enabled("new-checkout", user.id):
    return new_checkout()
else:
    return legacy_checkout()
```

```yaml
# TBD CI/CD - 모든 push가 잠재적 프로덕션 배포
on:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    steps:
    - run: make test
    - run: make build
    - run: make deploy-canary   # 10% 카나리
    - run: make promote         # 문제없으면 100%
```

**장점**: 통합 지연 없음, 빠른 피드백, 빈번한 배포
**단점**: 높은 테스트 규율 요구, Feature Flag 인프라 필요

**적합**: 고성능 팀, SaaS, 지속적 배포

---

## 5. 전략 선택 기준

| 상황 | 권장 전략 |
|-----|---------|
| 모바일 앱, 주기적 릴리즈 | GitFlow |
| 소규모 팀, 단순 배포 | GitHub Flow |
| SaaS, 하루 여러 번 배포 | Trunk-Based |
| 다중 버전 동시 지원 | GitFlow |
| CI/CD 성숙 팀 | Trunk-Based |

---

## 6. 브랜치별 CI/CD 파이프라인 매핑

```
PR/MR 생성       → 빌드 + 단위 테스트 + lint
develop 병합     → 빌드 + 전체 테스트 + 스테이징 배포
release/* 생성   → QA 환경 배포 + 릴리즈 후보 태그
main 병합        → 프로덕션 배포 (자동 or 수동 승인)
hotfix/* 병합    → 즉시 프로덕션 패치 배포
```

---

## 참고 문서

- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
- [GitFlow (Atlassian)](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)
- [Feature Flags](https://martinfowler.com/articles/feature-toggles.html)
