---
title: "SRE vs DevOps"
date: 2026-04-14
tags:
  - sre
  - devops
  - culture
sidebar_label: "SRE vs DevOps"
---

# SRE vs DevOps

## 1. 철학의 차이

```
DevOps:
  문화적 운동 (Cultural Movement)
  개발팀과 운영팀의 협업과 통합
  "What" — 무엇을 해야 하는가

SRE:
  DevOps 철학의 구체적 구현
  엔지니어링으로 신뢰성을 달성
  "How" — 어떻게 할 것인가
```

---

## 2. 핵심 비교

| 항목 | DevOps | SRE |
|------|--------|-----|
| 기원 | 커뮤니티 운동 | Google 내부 |
| 접근법 | 문화·프로세스 개선 | 엔지니어링 솔루션 |
| 주요 지표 | 배포 빈도, MTTR | SLO, 에러 버짓, Toil |
| 신뢰성 측정 | 암묵적 | SLI/SLO로 명시적 |
| 온콜 | 개발·운영 공유 | SRE가 1차 대응 |
| 자동화 | 권장 | 의무 (Toil < 50%) |

---

## 3. 공통점

```
양쪽 모두:
  □ 사일로(Silo) 제거
  □ 자동화 추구
  □ 지속적 피드백 루프
  □ 장애를 학습 기회로 활용
  □ 변경을 작고 자주 하기
```

---

## 4. 실무에서의 관계

```
DevOps 원칙:
  빠른 배포, 지속적 통합, 협업 문화

SRE 실천:
  SLO로 신뢰성 측정
  에러 버짓으로 배포 속도 조율
  포스트모템으로 학습

결합:
  DevOps 문화 위에 SRE 실천을 쌓는다.
  "SRE implements DevOps"
```

---

## 5. 팀 구조 예시

```
소규모 (스타트업):
  DevOps 엔지니어가 SRE 역할 겸임
  → SLO 정의, 알림 설계, Toil 자동화

중규모:
  플랫폼팀이 SRE 기능 수행
  → 공통 모니터링, 온콜 체계

대규모:
  전담 SRE팀
  → 서비스별 SLO 계약, 에러 버짓 협의
```

---

## 참고 문서

- [Google SRE Book - Chapter 1](https://sre.google/sre-book/introduction/)
- [DevOps vs SRE (Google Cloud)](https://cloud.google.com/blog/products/devops-sre/sre-vs-devops-competing-standards-or-close-friends)
