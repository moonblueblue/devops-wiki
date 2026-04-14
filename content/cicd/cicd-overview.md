---
title: "CI/CD란 무엇인가"
date: 2026-04-14
tags:
  - cicd
  - continuous-integration
  - continuous-delivery
sidebar_label: "CI/CD란"
---

# CI/CD란 무엇인가

## 1. 정의

**CI (Continuous Integration)**
개발자가 코드를 공유 저장소에 push할 때마다
자동으로 빌드·테스트를 실행하는 방식.

**CD (Continuous Delivery / Deployment)**
CI를 통과한 코드를 배포 가능한 상태로 유지하거나
자동으로 프로덕션까지 배포하는 방식.

---

## 2. 파이프라인 흐름

```
코드 push / PR
    ↓
[CI] 빌드 + 테스트 + 정적 분석 + 취약점 스캔
    ↓
[CD] 컨테이너 이미지 빌드 + 레지스트리 push
    ↓
[CD] 스테이징 자동 배포 + 연기 테스트
    ↓
사람이 승인 (Continuous Delivery)
또는 자동 승격 (Continuous Deployment)
    ↓
[CD] 프로덕션 배포
```

---

## 3. CI가 없을 때의 문제

```
"Works on my machine" 증후군
    → 개발자 로컬에서만 동작
    → 통합 시 충돌 폭발 ("Integration Hell")
    → 릴리즈 전날 밤 비상사태
```

CI를 도입하면:
- 문제를 **즉시** 발견 (push 직후 수 분 내)
- 코드베이스가 항상 **빌드 가능** 상태 유지
- 팀 전체가 **신뢰할 수 있는 기준선** 공유

---

## 4. 주요 CI/CD 도구

| 도구 | 유형 | 특징 |
|-----|------|------|
| **GitHub Actions** | 클라우드 | GitHub 통합, 무료 2,000분/월 |
| **GitLab CI** | 클라우드/셀프 | GitLab 내장, 강력한 파이프라인 |
| **Jenkins** | 셀프 호스팅 | 플러그인 생태계, 온프레미스 |
| **CircleCI** | 클라우드 | 빠른 캐시, 오비트 실행 |
| **Tekton** | 쿠버네티스 네이티브 | CNCF 프로젝트, CRD 기반 |
| **ArgoCD** | 쿠버네티스 | GitOps 방식 CD |

---

## 5. CI/CD 성숙도 모델

```
Level 1: 수동 빌드
Level 2: 자동 빌드 + 기본 테스트
Level 3: 자동 스테이징 배포
Level 4: 자동 프로덕션 배포 (완전 자동화)
Level 5: 카나리·피처플래그·프로그레시브 딜리버리
```

---

## 참고 문서

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Jenkins 공식 문서](https://www.jenkins.io/doc/)
- [Tekton](https://tekton.dev/)
