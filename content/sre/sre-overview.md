---
title: "SRE란 무엇인가"
date: 2026-04-14
tags:
  - sre
  - reliability
  - google
sidebar_label: "SRE란"
---

# SRE란 무엇인가

## 1. 정의

**Site Reliability Engineering.**
Google이 2003년 창안한 소프트웨어 엔지니어링 기반 운영 방식.

```
"SRE is what happens when you ask a software engineer
 to design an operations team."
                                    — Ben Treynor Sloss
```

---

## 2. SRE의 핵심 원칙

```
신뢰성은 기능이다:
  가장 중요한 제품 기능 중 하나는
  신뢰성 있게 동작하는 것이다.

엔지니어링으로 문제 해결:
  수동 작업(Toil)을 자동화로 대체한다.
  반복 작업이 50%를 넘으면 안 된다.

위험을 수용한다:
  100% 신뢰성은 목표가 아니다.
  적절한 에러 버짓으로 혁신을 허용한다.
```

---

## 3. SRE 팀의 역할

| 역할 | 내용 |
|------|------|
| 서비스 안정화 | SLO 정의·측정·달성 |
| Toil 제거 | 수동 반복 작업 자동화 |
| 장애 대응 | 온콜, 포스트모템 |
| 용량 계획 | 부하 예측, 스케일링 |
| 변경 관리 | 안전한 배포 프로세스 |

---

## 4. SRE 주요 개념

```
Toil:
  수동적, 반복적, 자동화 가능한 운영 작업
  → SRE는 Toil을 줄이는 것이 핵심 KPI

Error Budget:
  100% - SLO = 허용 오류 예산
  → 예산 소진 시 새 기능 배포 중단

Postmortem:
  장애 후 원인 분석 문서
  → 비난 없음(Blameless), 재발 방지에 집중

On-call:
  서비스 이상 시 대응하는 당직 엔지니어
  → 합리적인 알림 빈도 유지 필수
```

---

## 5. SRE 성숙도 모델

```
Level 1 - 반응형:
  장애가 발생하면 대응한다.
  모니터링이 기본만 갖춰짐.

Level 2 - 측정형:
  SLI/SLO를 정의하고 측정한다.
  장애 지표를 추적한다.

Level 3 - 예측형:
  에러 버짓을 활용한다.
  카오스 엔지니어링으로 미리 검증한다.

Level 4 - 자동화형:
  Toil이 20% 미만.
  자동 복구, 자동 스케일링이 작동한다.
```

---

## 참고 문서

- [Google SRE Books](https://sre.google/books/)
- [SRE Workbook](https://sre.google/workbook/table-of-contents/)
