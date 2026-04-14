---
title: "CI vs CD vs CD (Continuous Delivery vs Deployment)"
date: 2026-04-14
tags:
  - cicd
  - continuous-delivery
  - continuous-deployment
sidebar_label: "Delivery vs Deployment"
---

# CI vs CD vs CD

## 1. 세 가지 개념 비교

| 단계 | 영어 | 의미 | 자동화 수준 |
|-----|------|------|-----------|
| **CI** | Continuous Integration | 코드 통합 자동화 | 빌드·테스트 자동 |
| **CD** | Continuous Delivery | 배포 준비 자동화 | 스테이징까지 자동, **사람이 승인** |
| **CD** | Continuous Deployment | 완전 자동 배포 | 프로덕션까지 **무인 자동** |

---

## 2. Continuous Delivery

```
코드 push
    ↓
[자동] 빌드 → 테스트 → 스테이징 배포 → 연기 테스트
    ↓
[사람] "이 버전 프로덕션에 배포해도 되나요?" → 승인 버튼
    ↓
[자동] 프로덕션 배포
```

**핵심**: 항상 "배포 가능한 상태"를 유지한다.
배포는 선택이지 의무가 아니다.

적합한 경우:
- 규제 산업 (금융, 의료)
- 배포 전 사람이 검토해야 하는 경우
- 릴리즈 노트·공지가 필요한 B2B SaaS

---

## 3. Continuous Deployment

```
코드 push
    ↓
[자동] 빌드 → 테스트 → 스테이징 → 자동 승격 → 프로덕션
    ↓
사람의 개입 없음
```

**핵심**: 테스트를 통과한 코드는 자동으로 프로덕션에 간다.

적합한 경우:
- B2C 웹 서비스 (Netflix, Amazon)
- 높은 배포 빈도 (하루 수십 번)
- Feature Flag로 미완성 기능 숨김 가능한 경우

---

## 4. 전제 조건

### Continuous Delivery를 위한 조건

```
□ 충분한 테스트 커버리지 (unit + integration)
□ 스테이징 환경 = 프로덕션과 동일
□ 빠른 피드백 루프 (15분 이내 결과)
□ 원클릭 배포 가능
```

### Continuous Deployment를 위한 추가 조건

```
□ 높은 자동화된 테스트 신뢰도
□ 카나리/롤링 배포로 리스크 분산
□ 빠른 롤백 메커니즘 (1분 이내)
□ 관측 가능성 (배포 후 이상 즉시 감지)
□ Feature Flag 인프라
```

---

## 5. 실제 파이프라인 예시

### Continuous Delivery (GitHub Actions)

```yaml
jobs:
  deploy-staging:
    needs: build
    environment: staging     # 자동 배포

  deploy-prod:
    needs: deploy-staging
    environment: production  # 수동 승인 필요
    # GitHub UI: Settings → Environments
    # → Required reviewers 설정
```

### Continuous Deployment

```yaml
jobs:
  deploy-prod:
    needs: [test, staging-smoke-test]
    if: github.ref == 'refs/heads/main'
    # 자동 승격 - 수동 승인 없음
    steps:
    - uses: ./.github/workflows/deploy.yaml
      with:
        canary-weight: 10   # 처음 10%만
```

---

## 참고 문서

- [Continuous Delivery (martinfowler.com)](https://martinfowler.com/bliki/ContinuousDelivery.html)
- [Continuous Deployment vs Delivery](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment)
