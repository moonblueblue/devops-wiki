---
title: "DevEx 메트릭 — DORA + SPACE + DevEx (DX Core 4)"
sidebar_label: "DevEx"
sidebar_position: 2
date: 2026-04-26
last_verified: 2026-04-26
tags:
  - sre
  - devex
  - dora
  - space
  - productivity
---

# DevEx 메트릭

> **2026년의 자리**: 개발자 생산성 측정의 4대 프레임워크 — **DORA** (2014~,
> Forsgren·Humble), **SPACE** (2021, Storey·Forsgren·Greiler), **DevEx**
> (2023, Noda·Storey·Greiler), **DX Core 4** (2024-12, Noda·Tacho 외).
> Core 4는 앞 셋을 *통합·확장*. SRE 관점에서 *DevEx는 신뢰성·속도·만족도
> 의 합산 지표*. 신뢰성만 보지 않는다.
>
> 1~5인 환경에서는 **DORA 4 keys + DevEx 자가 평가 분기 1회**로 시작.
> 도구는 GitHub Insights·Linear 등 *이미 있는 데이터*로.

- **이 글의 자리**: SRE 카테고리의 마무리. 신뢰성을 넘어 *조직 건강*을
  측정. DORA 메트릭이 [Change Management](../change-management/change-management.md)·
  [Error Budget](../slo/error-budget-policy.md)에서 등장한 배경.
- **선행 지식**: SRE 원칙, On-call 번아웃 개념.

---

## 1. 한 줄 정의

> **DevEx (Developer Experience)**: "*개발자가 *시스템·도구·프로세스*와
> 상호작용하며 *느끼는 경험*과 *측정 가능한 생산성 지표*를 결합한
> 분과.*"

### 왜 SRE 카테고리에 DevEx인가

| 이유 | 의미 |
|---|---|
| **신뢰성과 생산성은 trade-off가 아니다** | DORA: Elite 팀이 *둘 다* 우수 |
| **번아웃 측정이 SRE 책임** | On-call·Toil이 만성 번아웃 원인 |
| **Toil 감축 = DevEx 개선** | 같은 동전 양면 |
| **Postmortem·Blameless 문화** | DevEx의 *Cognitive Load* 측면 |

> SRE는 *시스템 신뢰성*만이 아니라 *팀 신뢰성*도 책임. Google SRE Book
> *Part V "Management"*가 이를 다룸.

---

## 2. 4가지 프레임워크 비교

| 프레임워크 | 출현 | 차원 | 강점 |
|---|:-:|---|---|
| **DORA** (4 keys) | 2014~ | 4 | 정량·결과 지향 |
| **SPACE** | 2021 | 5 | 다차원·홀리스틱 |
| **DevEx** | 2023 | 3 | 개발자 경험 중심 |
| **DX Core 4** | 2024-12 | 4 | 통합·실용 |

### 출처·저자

| 프레임워크 | 핵심 저자 |
|---|---|
| **DORA** | Nicole Forsgren, Jez Humble (DORA Research Program) |
| **SPACE** | Margaret-Anne Storey, Forsgren, Michaela Greiler (GitHub·Microsoft) |
| **DevEx** | Abi Noda, Storey, Forsgren, Thomas Zimmermann (Netlify·GitHub·Microsoft) |
| **DX Core 4** | Noda, Laura Tacho + Forsgren·Storey·Zimmermann 자문 |

> DX Core 4는 앞 셋의 *주요 저자들이 합류*해 만든 *통합 프레임워크*.
> 2024년 12월 발표.

---

## 3. DORA 4 keys — 결과 지향

### 4 메트릭

| Key | 의미 |
|---|---|
| **Deployment Frequency** | 배포 빈도 |
| **Lead Time for Changes** | 커밋 → 프로덕션 시간 |
| **Change Failure Rate** | 배포 실패율 |
| **Failed Deployment Recovery Time** | 실패 회복 시간 (구 MTTR) |

> 2023년부터 4번째 메트릭 명칭 변경: MTTR → **Failed Deployment Recovery
> Time** (또는 *Time to Restore Service*).

### 강점·약점

| 강점 | 약점 |
|---|---|
| 정량적·측정 가능 | *결과*만 측정 — *원인* 미파악 |
| 산업 벤치마크 존재 | 개발자 *느낌* 무시 |
| CI/CD·Git 데이터 자동 추출 | 만족도·번아웃 미측정 |

### 2025 변화 — Archetype 모델

| 측면 | 2024 이전 (4-tier) | 2025+ (Archetype) |
|---|---|---|
| 분류 | Elite·High·Medium·Low | 7개 team archetype |
| 강조 | 단일 등급 | *컨텍스트·팀 특성* |
| 한계 | "우리 Elite 아님" 단순 평가 | 팀 유형별 적합 패턴 |

> 2025년부터 DORA는 *컨텍스트 강조* 방향으로 진화. 4-tier는 *역사적 참조*.

---

## 4. SPACE — 5차원 홀리스틱

| 차원 | 의미 | 예시 메트릭 |
|---|---|---|
| **S**atisfaction | 개발자 만족·웰빙 | 설문 점수, eNPS |
| **P**erformance | 결과 품질 | CFR, 사용자 만족 |
| **A**ctivity | 활동량 | PR·커밋·리뷰 수 |
| **C**ommunication | 협업 | 리뷰 시간, 회의 |
| **E**fficiency | 흐름·플로우 | 인터럽션 빈도, 컨텍스트 스위칭 |

### SPACE의 핵심 메시지

> *"단일 메트릭은 의미 없다. 한 차원을 개선하면 다른 차원이 *희생*될
> 수 있다."*

| 함정 | 결과 |
|---|---|
| Activity만 측정 (PR 수) | 양만 ↑, 품질 ↓ |
| Performance만 측정 | 번아웃·이직 ↑ |
| Satisfaction만 측정 | 결과 책임 회피 |
| **여러 차원 동시 측정** | 균형 |

> SPACE의 권장: *각 차원에서 1~2개 메트릭*, 총 5~10개로 균형 추적.

---

## 5. DevEx — 3차원 (Noda·Storey·Greiler 2023)

InfoQ 발표 후 DX 컨설팅 표준이 됨.

| 차원 | 의미 |
|---|---|
| **Feedback Loops** | 피드백 속도·품질 (빌드·테스트·리뷰 등) |
| **Cognitive Load** | 작업에 필요한 *정신적 노력* |
| **Flow State** | 집중·중단 없는 작업 가능성 |

### Feedback Loops 메트릭

| 메트릭 | 의미 |
|---|---|
| **Build Time** | 빌드 시간 — < 10분 권장 |
| **Test 실행 시간** | < 5분 |
| **PR Review Time** | < 24h |
| **Deploy Time** | 분 단위 |
| **Production Feedback** | 사고 인지 시간 |

### Cognitive Load 메트릭

| 메트릭 | 의미 |
|---|---|
| **온보딩 시간** | 신규 입사자 첫 PR까지 |
| **시스템 이해 부담** | 설문 — "쉽게 이해 가능?" |
| **컨텍스트 스위칭** | 진행 중 작업 수 |
| **Toil 비율** | (직접 측정) |

### Flow State 메트릭

| 메트릭 | 의미 |
|---|---|
| **무중단 시간** | *2시간 이상 집중* 가능 횟수 |
| **회의 시간 비중** | < 30% 권장 |
| **인터럽션 빈도** | 일 평균 알림·페이지 |
| **Deep Work 점수** | 설문 |

---

## 6. DX Core 4 — 통합 프레임워크 (2024-12)

DORA + SPACE + DevEx의 *통합·실용*.

### 4 차원

| 차원 | 의미 | 대표 메트릭 |
|---|---|---|
| **Speed** | 빠르게 가치 전달 | Deployment Frequency, Lead Time, PR Throughput |
| **Effectiveness** | 효과적으로 일함 | Developer Experience Index (DXI), Activity 균형 |
| **Quality** | 품질·신뢰성 | Change Failure Rate, FDRT, SLO |
| **Business Impact** | 비즈니스 가치 | Feature 출시·매출·사용자 만족 |

### Speed 메트릭

| 메트릭 | 측정 |
|---|---|
| **Diff Throughput** | PR 수 / 개발자 / 주 |
| **Lead Time for Changes** | DORA |
| **Deployment Frequency** | DORA |

### Effectiveness 메트릭

| 메트릭 | 측정 |
|---|---|
| **DXI** (DevEx Index) | 14문항 분기 설문 — 0~100 |
| **Engineering Time** | R&D 중 *기능 개발* 비중 |
| **Cognitive Load** | 설문 |

### Quality 메트릭

| 메트릭 | 측정 |
|---|---|
| **Change Failure Rate** | DORA |
| **FDRT** | DORA |
| **Operational Health Index** | SLO 달성·인시던트 빈도 |

### Business Impact 메트릭

| 메트릭 | 측정 |
|---|---|
| **% Time on New Capabilities** | R&D 중 *신기능* 비중 |
| **Initiatives Completed** | 분기 출시 주요 항목 |
| **Adoption / Revenue / NPS** | 비즈니스 결과 |

> Core 4는 *각 차원 1~2개 메트릭*만 — 총 4~8개. 단순함이 강점.
> 300+ 기업 검증, *3~12% 효율 ↑*, *14% 기능 시간 ↑* 보고.

---

## 7. SRE 관점 통합 — 4 프레임워크 → 핵심 8 메트릭

| 메트릭 | 출처 | SRE 의미 |
|---|---|---|
| 1. **Deployment Frequency** | DORA | 변경 속도 |
| 2. **Lead Time for Changes** | DORA | 검토·승인 효율 |
| 3. **Change Failure Rate** | DORA | 변경 위험 분류 효과 |
| 4. **FDRT** | DORA | IR·자동 롤백 효과 |
| 5. **DXI / Satisfaction** | DevEx·SPACE | 번아웃·만족도 |
| 6. **Cognitive Load** | DevEx | Toil·복잡도 |
| 7. **On-call 페이지/시프트** | SRE | On-call 건강 |
| 8. **SLO 달성률** | SRE | 신뢰성 |

> 위 8개 + 분기 1회 측정으로 *SRE·DevEx·DORA 종합* 가시화.

---

## 8. 측정 방법 — 정량 + 정성

### 정량 — 시스템 데이터

| 출처 | 메트릭 |
|---|---|
| **GitHub / GitLab** | PR·커밋·리뷰 시간·Lead Time |
| **CI/CD** | Build·Deploy 시간·CFR |
| **PagerDuty** | 페이지·MTTR·On-call |
| **Prometheus / SLO** | SLO 달성·Burn Rate |
| **JIRA / Linear** | 티켓 throughput |
| **Slack / Calendar** | 회의 시간·인터럽션 |

### DX 공식 DXI 14 드라이버

DX (getdx.com) 공식 DXI는 표준화된 14개 드라이버로 구성. 각 드라이버는
*개발 활동의 핵심 차원*을 측정.

| # | 드라이버 | 차원 |
|:-:|---|---|
| 1 | Deep Work | Flow |
| 2 | Local Iteration Speed | Feedback |
| 3 | Release Process | Feedback |
| 4 | Code Quality | Cognitive Load |
| 5 | Code Maintainability | Cognitive Load |
| 6 | Change Confidence | Feedback |
| 7 | Clear Direction | Cognitive Load |
| 8 | Build & Test Process | Feedback |
| 9 | Onboarding | Cognitive Load |
| 10 | Reliability | Feedback |
| 11 | Documentation | Cognitive Load |
| 12 | Tools & Resources | Cognitive Load |
| 13 | Team Process | Flow |
| 14 | Tech Stack | Cognitive Load |

> 14문항 5점 척도 → DXI 0~100 환산. *분기 비교*가 절대값보다 의미 있음.

### 자체 설문 예시 — 작은 팀

DX 공식 DXI 도입이 무거우면, 위 14 드라이버를 *참고*해 자체 설문 운영
가능.

```markdown
# DevEx 자가 평가 (DXI 참고)

## Feedback Loops
1. 빌드 시간이 만족스럽다
2. PR 리뷰가 빠르다
3. 프로덕션 피드백이 빠르다

## Cognitive Load
4. 시스템 이해가 쉽다
5. 도구가 직관적이다
6. 문서가 충분하다

## Flow State
7. 집중할 시간이 충분하다
8. 회의가 적절하다
9. 인터럽션이 적다

## Outcome
10. 일하는 것이 즐겁다
11. 동료에게 이 회사를 추천한다 (eNPS)
12. 작년보다 생산성이 ↑

## Burnout Risk
13. 지난달 번아웃 느낌
14. On-call 부담
```

> 위는 *DXI를 참고한* 자체 설문 예시. DX 공식 DXI를 쓰려면 getdx.com
> SaaS 도입.

---

## 9. 도구

| 도구 | 형태 |
|---|---|
| **DX (getdx.com)** | DXI 측정 SaaS |
| **Swarmia** | DORA + DevEx 통합 |
| **LinearB** | DORA 메트릭 자동 |
| **Jellyfish** | 엔지니어링 분석 |
| **Pluralsight Flow (구 GitPrime)** | 코드 활동 분석 |
| **Athena Project (구글 OSS)** | DORA 메트릭 OSS |
| **Backstage** | 카탈로그 + 메트릭 통합 |
| **Sleuth** | DORA 추적 |

### 단순 시작 — 기존 도구

| 도구 | 무엇을 |
|---|---|
| **GitHub Insights** | DORA 4 keys 일부 자동 |
| **Google Form / Typeform** | DXI 설문 |
| **Slack 봇** | 분기 자동 설문 |
| **Google Sheets** | 결과 추적 |

> SaaS 도구 도입 전, 기존 데이터로 *최소* 3개월 측정해보고 결정.

---

## 10. 안티패턴 — 측정의 함정

| 안티패턴 | 증상 | 처방 |
|---|---|---|
| **Activity만 측정** | PR 수 ↑, 품질 ↓ | 다차원 |
| **개인 메트릭** | 비교·압박 | *팀 단위*만 |
| **벤치마크 강박** | "Elite 못 달성" 자책 | Archetype 컨텍스트 |
| **메트릭 게이밍** | 의도와 다른 행동 | Goodhart's Law 인지 |
| **너무 많은 메트릭** | 신호 묻힘 | 4~8개로 압축 |
| **정량만** | *느낌* 무시 | 설문 병행 |
| **단발 측정** | 추세 X | 분기 *지속* |
| **공개 비교** | 팀 간 정치 | 내부 학습 도구로 |

### Goodhart's Law

> *"메트릭이 목표가 되면 좋은 메트릭이 아니게 된다."*

| 시나리오 |
|---|
| PR 수를 KPI로 → 작은 PR 양산, 의미 없는 변경 |
| Lead Time을 KPI로 → 검토 생략, 위험 변경 |
| CFR을 KPI로 → 사고 미보고, 정의 회피 |

> 메트릭은 *진단 도구*이지 *평가 도구* X. 인사 평가에 직접 연동 X.

---

## 11. GenAI 영향 측정 — DX AI Framework (2025)

2025년 핵심 주제. AI 코드 어시스턴트(Copilot·Cursor·Cody 등)의 *생산성
영향*을 측정.

### DX AI Measurement Framework — 3차원

| 차원 | 의미 | 메트릭 |
|---|---|---|
| **Utilization** | 사용량 | active user 비율, 사용 빈도, suggested edit 수 |
| **Impact** | 영향 | PR throughput 변화, lead time 변화, 만족도 |
| **Cost** | 비용 | 라이선스, 토큰·API 비용, 학습 시간 |

### 흔한 함정

| 함정 | 의미 |
|---|---|
| **사용량만 = 성공** | 의미 없는 자동완성도 카운트 |
| **자가 보고만** | "30% 더 빠르다" 주관 — 실제 측정 X |
| **개인 비교** | "Bob이 Copilot 잘 씀" — 압박 |
| **품질 미측정** | Copilot 코드 사고율 별도 추적 필요 |

### Copilot 효과 측정 사례

| 회사 | 보고 |
|---|---|
| GitHub | 작업 완료 55% 빠름 (자가 보고) |
| Google | 코드 작성 시간 6% 단축 (controlled) |
| Dropbox | DXI 변화로 측정 |

> Core 4 + AI Framework 결합이 2026년 표준. 도입 *전후* 측정으로 ROI
> 검증.

---

## 12. 측정 윤리 — Privacy·Survey Fatigue·D&I

### 측정 윤리 원칙

| 원칙 | 의미 |
|---|---|
| **동의** | 데이터 수집·설문 참여 명시 동의 |
| **익명화** | 개인 식별 X — 작은 팀이면 더 신중 |
| **소수 그룹 보호** | 5명 미만 셀은 보고 X (식별 가능) |
| **심리적 안전** | 응답이 인사 평가에 *연동되지 않음* 보장 |
| **투명성** | 결과를 팀에 공유 |
| **목적 제한** | 측정 데이터를 *측정 외 목적*에 사용 X |

### Survey Fatigue 방지

| 패턴 | 의미 |
|---|---|
| **분기 1회** | 더 잦으면 응답률 ↓ |
| **14문항 이내** | 5분 이내 완료 |
| **익명 보장** | 솔직한 응답 |
| **결과 공유** | "*응답이 변화를 만든다*" 신뢰 |
| **참여 강제 X** | 강제 응답 → 신뢰 하락 |

### D&I (Diversity & Inclusion) 분해

평균값은 *소수 그룹의 고통을 가린다*. 분기 분석 시 다음 차원으로 *분해*.

| 차원 | 의미 |
|---|---|
| **시니어리티** | 신입·중급·시니어 |
| **원격 vs 사무실** | 하이브리드 효과 |
| **시간대 / 지역** | FTS 환경 |
| **팀** | 팀별 차이 |

> 평균 DXI 70점인데 시니어 75 / 신입 60이면 *온보딩 문제*. 평균만 보면
> 못 봄.
>
> 단, *데이터 익명성과 충돌* 가능 — 작은 그룹은 식별 위험. *집계 가능한
> 최소 인원*(5~10명) 이하면 보고 X.

---

## 13. SRE 관점의 DevEx 개선 액션

### Toil 감축 → DevEx 개선

| Toil | DevEx 차원 |
|---|---|
| 알람 노이즈 | Cognitive Load + Flow State |
| 매뉴얼 배포 | Feedback Loops |
| 인증서 갱신 | Toil + 실수 위험 |
| Runbook 부재 | Cognitive Load + 번아웃 |

### On-call 건강 → Satisfaction

| On-call | Satisfaction |
|---|---|
| 시프트당 페이지 ≤ 2 | ↑ |
| 야간 페이지 < 0.5 | ↑↑ |
| 회복 시간 보장 | ↑↑ |
| 보상 체계 | ↑ |

### 자동화·플랫폼

| 액션 | DevEx |
|---|---|
| Self-service 환경 | Cognitive Load ↓ |
| CI/CD 자동화 | Feedback Loops ↑ |
| Backstage 카탈로그 | Cognitive Load ↓↓ |
| 정책 게이트 자동 | Flow State 보호 |

---

## 14. 1~5인 팀의 DevEx — 분기 측정

### 첫 분기 — 데이터 수집

| 주차 | 활동 |
|:-:|---|
| 1 | GitHub 데이터 추출 — DORA 4 keys |
| 2 | DXI 설문 (Google Form 14문항) |
| 3 | On-call·Toil 데이터 정리 |
| 4 | 종합 정리 — Top 3 개선점 |

### 둘째 분기 — 개선

| 우선 | 활동 |
|---|---|
| 1 | Top Toil 1개 자동화 |
| 2 | 빌드·테스트 시간 단축 |
| 3 | 회의 시간 검토 (회의 없는 날) |

### 셋째 분기 — 재측정

> *분기 비교* — 추세가 우상향이면 성공. 절대값 X.

---

## 15. 한눈에 보기

| 항목 | 한 줄 |
|---|---|
| **4 프레임워크** | DORA(2014) → SPACE(2021) → DevEx(2023) → Core 4(2024-12) |
| **Core 4 차원** | Speed·Effectiveness·Quality·Business Impact |
| **DevEx 3 차원** | Feedback Loops·Cognitive Load·Flow State |
| **SRE 통합 8 메트릭** | DORA 4 + DXI + Cognitive Load + On-call + SLO |
| **측정 주기** | 분기 1회 |
| **함정** | Goodhart·Activity만·개인 메트릭 |
| **Toil = DevEx** | Toil 감축이 DevEx 개선의 핵심 |
| **시작** | GitHub 데이터 + DXI 설문 14문항 |

---

## 참고 자료

- [DORA — State of DevOps Report](https://dora.dev/research/) (확인 2026-04-26)
- [SPACE Framework — ACM Queue (Forsgren·Storey·Greiler 2021)](https://queue.acm.org/detail.cfm?id=3454124) (확인 2026-04-26)
- [DevEx — InfoQ (Noda·Storey·Greiler 2023)](https://www.infoq.com/articles/devex-metrics-framework/) (확인 2026-04-26)
- [DX Core 4 — Introducing (2024-12)](https://getdx.com/news/introducing-the-dx-core-4/) (확인 2026-04-26)
- [DX Core 4 — Measuring Developer Productivity](https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/) (확인 2026-04-26)
- [Swarmia — Comparing DORA·SPACE·DX Core 4](https://www.swarmia.com/blog/comparing-developer-productivity-frameworks/) (확인 2026-04-26)
- [Lothar Schulz — Engineering Metrics Frameworks Comparison (2025)](https://www.lotharschulz.info/2025/05/04/engineering-metrics-frameworks-dora-devex-space-dx-core-4-essp-comparison/) (확인 2026-04-26)
- [Google SRE Book — Part V Management](https://sre.google/sre-book/part-V-management/) (확인 2026-04-26)
- [DX — DXI Guide](https://getdx.com/blog/guide-to-developer-experience-index/) (확인 2026-04-26)
- [DX — AI Measurement Framework](https://getdx.com/blog/how-to-implement-ai-measurement-framework/) (확인 2026-04-26)
- [DORA — 4 Keys History (FDRT redefined 2023)](https://dora.dev/insights/dora-metrics-history/) (확인 2026-04-26)
