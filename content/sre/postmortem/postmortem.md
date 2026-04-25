---
title: "포스트모템 — Blameless 원칙·Google 템플릿"
sidebar_label: "포스트모템"
sidebar_position: 1
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - sre
  - postmortem
  - blameless
  - learning
  - incident
---

# 포스트모템

> **2026년의 자리**: 포스트모템은 *사고에서 배우는 도구*. Google SRE Book
> *"Postmortem Culture: Learning from Failure"* + Workbook *"Postmortem
> Culture"*가 표준. **Blameless** (비난 없음)가 본질이며, 이 한 가지만
> 잘못되어도 모든 게 무너진다 — 사람들이 솔직하게 보고하지 않으면 학습 X.
>
> 1~5인 환경에서는 한 페이지짜리 포스트모템으로도 충분. 핵심은 *작성
> 자체*가 아니라 *Action Items 추적·학습 공유*.

- **이 글의 자리**: [IR](../incident/incident-response.md) → 사고 종료 →
  포스트모템 → [RCA 방법론](rca-methods.md). Dickerson 피라미드 3층.
- **선행 지식**: IR 라이프사이클, SEV 분류.

---

## 1. 한 줄 정의

> **포스트모템**: "*사고 후 학습 문서.* 무엇이 일어났고, 왜 일어났으며,
> 어떻게 재발 방지할지를 *비난 없이* 기록한다."

### 포스트모템의 5가지 목적

| # | 목적 | 의미 |
|:-:|---|---|
| 1 | **학습** | 같은 실수 반복 X — 시스템·프로세스 약점 발견 |
| 2 | **재발 방지** | Action Items로 *변경* — 글로 끝내지 않음 |
| 3 | **공유** | 다른 팀이 *같은 실수* 안 함 |
| 4 | **신뢰 구축** | Blameless 문화 — 솔직한 보고 가능 환경 |
| 5 | **정책·SLO 검토** | 사고가 EBP·SLO 적정성 검증 |

---

## 2. Blameless — 가장 중요한 원칙

### Blameless의 본질

> "사람의 실수는 *시스템 약점의 증상*이지 원인이 아니다."
> — Google SRE Book *Postmortem Culture* (Dr. John Allspaw, Etsy)

| Blameful (잘못된) | Blameless (올바른) |
|---|---|
| "Bob이 잘못된 명령어를 쳤다" | "위험한 명령어가 사람에게 직접 노출되어 있었다" |
| "DB 관리자 부재" | "DB 마이그 권한이 단일 사람에 집중" |
| "테스트 안 했음" | "변경 위험 분류와 테스트 요구가 불일치" |
| 사람 처벌 | 시스템 변경 |
| 위축된 보고 | 솔직한 학습 |

### Just Culture — Blameless의 이론적 근거

Sidney Dekker의 *Just Culture* 모델 (3단계 분류). Blameless 운영의
실무 가이드.

| 분류 | 의미 | 처리 |
|---|---|---|
| **Human Error** (실수) | 의도 없는 인지 오류 | 시스템 변경, 비난 X |
| **At-risk Behavior** (위험 행동) | 위험 인지 부족 | 코칭·교육, 시스템 변경 |
| **Reckless Behavior** (무모) | 위험 *알면서* 의도적 위반 | HR 트랙 — 별도 처리 |

> Reckless만 Blameless 트랙에서 벗어남. **Substitution Test**: *같은
> 상황에 다른 동등한 동료가 있었다면 같은 결과였을까?* — 답이 Yes면
> 시스템 문제, No면 개인 검토.

### Second Stories — Allspaw·Dekker

| First Story (피상) | Second Story (심층) |
|---|---|
| "Bob이 잘못된 명령" | Bob이 *그 시점에 그 행동이 합리적이었던 이유* |
| "테스트 안 함" | 테스트 환경이 *그 시점에 신뢰할 수 없었던 맥락* |
| "Alert 무시" | Alert가 *과거 false positive로 신뢰를 잃었던 경험* |

> *Local Rationality*: 사람은 *그 시점의 정보·압박·상황*에서 합리적이라
> 믿는 행동을 한다. RCA의 출발점.

### Blameless ≠ Accountability 부재

| 오해 | 진실 |
|---|---|
| "Blameless = 책임 없음" | 책임은 *시스템 변경*에 있음 |
| "Blameless = 누구도 평가 X" | 의도적 악의·반복 부주의는 별도 트랙 |
| "Blameless = 모두 칭찬" | 시스템 약점은 *명확하게* 지목 |

> Etsy 정전 사고의 교훈: Blameless 문화가 없으면 사람들이 *알면서도
> 보고하지 않는다*. 학습이 아니라 *은폐*.

### "Blame 없이 책임 지목" 표현

| 사람 지목 (X) | 시스템 지목 (O) |
|---|---|
| "Alice가 잘못된 IP 입력" | "IP 입력 폼에 검증·확인 단계 부재" |
| "Bob의 SQL이 DB 잠금 유발" | "장기 잠금 SQL을 사전 차단하는 검토·linter 부재" |
| "운영팀이 모니터링 못 봤음" | "알람 임계가 비즈니스 영향과 정렬 X" |

---

## 3. 포스트모템 작성 트리거

| 트리거 | 의무 | 비고 |
|---|---|---|
| **SEV1·2 사고** | *반드시* | 예외 없음 |
| **고객 대면 SLO 위반** | *반드시* | 영향 시간 무관 |
| **데이터 손실·정확성 사고** | *반드시* | 1건이라도 |
| **보안 사고** | *반드시* | 별도 보안 PIR 트랙 |
| **SEV3 (다중 발생)** | 권장 | 같은 사고 3회 이상 반복 시 |
| **near-miss (사고 직전)** | 권장 | 카오스·드릴에서 발견된 위험 |
| **성공적 복구** | 선택 | "왜 잘 됐는가" — 패턴 학습 |

> "왜 잘 됐는가"도 포스트모템 가능. *실패*뿐 아니라 *성공 패턴* 도큐먼트.

---

## 4. Google 표준 템플릿 — 핵심 9개 + 확장

Google 공식 템플릿의 *핵심 9개 섹션* + 메타데이터·확장 섹션 구조.

| 분류 | 섹션 |
|---|---|
| **메타** | Status / Authors / Owner / Reviewers / Date |
| **핵심 9개** | Summary, Impact, Root Causes, Trigger, Resolution, Detection, Timeline, Action Items, Lessons Learned |
| **Google 시그니처** | What Went Well, What Went Wrong, Where We Got Lucky |
| **확장** | Glossary (외부 공유 시) |

```markdown
# Postmortem: [Service] [Brief Description] [Date]

## Status: [Draft | In Review | Final]
## Authors: [Names]
## Owner: [IC]
## Reviewers: [Names]
## Date: YYYY-MM-DD

---

## 1. Summary
한 단락 — 무엇이, 언제, 누구에게 영향, 어떻게 복구.

## 2. Impact
- 사용자: 영향 인원·비율
- 매출: 추정 손실
- SLO: 소진율
- 데이터: 손실·정합성 문제

## 3. Root Causes
- 직접 원인 (Trigger): 무엇이 즉시 사고를 일으켰나
- 기여 요인 (Contributing factors): 그것을 가능하게 한 조건
- 근본 원인 (Root cause): 시스템·프로세스 약점

## 4. Trigger
사고를 *촉발한* 이벤트 — 배포, 트래픽 급증, 외부 의존성 변경 등.

## 5. Resolution
완화 → 복구 단계별 무엇을 했는가.

## 6. Detection
어떻게 사고를 인지했는가 — 알람·고객 보고·자체 발견.
- MTTD (탐지 시간)
- 알람 작동 여부
- 알람이 부족했다면 *왜*

## 7. Timeline
| 시각 | 이벤트 |
|---|---|
| T-2h | 배포 시작 |
| T+0  | 알람 발사 |
| T+5  | ACK |
| T+12 | IC 호출 |
| T+30 | 첫 완화 시도 |
| T+45 | 완화 성공 |
| T+90 | 완전 복구 |

## 8. What Went Well
잘 작동한 것 — *반복할 가치 있는 패턴*.

## 9. What Went Wrong
잘 작동하지 않은 것 — *시스템 약점*.

## 10. Where We Got Lucky
*운으로 더 큰 사고를 피한 부분* — Google의 시그니처 섹션.
"X가 아니었다면 더 큰 일." 향후 위험 도출.

## 11. Action Items
| ID | 액션 | 우선 | 소유자 | 마감 | 추적 |
|---|---|:-:|---|---|---|
| AI-1 | 알람 임계 조정 | P0 | alice | 2026-05-01 | JIRA-1234 |
| AI-2 | DB 마이그 가이드 작성 | P1 | bob | 2026-05-15 | JIRA-1235 |
| AI-3 | 카나리 자동 롤백 도입 | P0 | sre-team | 2026-06-01 | JIRA-1236 |

## 12. Lessons Learned
- 패턴 1
- 패턴 2

## 13. Glossary (선택)
- 사고 보고서 외부 공유 시 — 용어 풀이
```

---

## 5. "Where We Got Lucky" — 핵심 섹션

Google 내부 템플릿의 *시그니처*. 다른 곳에는 거의 없는 섹션.

### 의미

> "*운*으로 더 큰 사고를 피한 부분을 *명시*한다. 그것이 *다음 사고의
> 위험*이다."

### 예시

```
- 트래픽이 평소의 1/3 수준이라 영향이 적었음. 정상 트래픽이었으면
  10배 사용자 영향.
- 새벽 03:00 사고로 한국 사용자 영향 미미. 낮 시간이었으면 SEV1.
- 배포 직후 5분 만에 인지. 카나리 1시간 진행이었으면 30% 환경 오염.
- DB 백업이 직전 30분 전 실행됨. 1시간 전이었다면 데이터 손실 유의미.
- On-call이 우연히 해당 시스템 전문가. 다른 사람이었다면 RCA 1시간+.
```

> *운*은 다음 분기 액션 항목으로 변환. "*트래픽이 정상이었어도* 안전한
> 시스템을 만들자."

---

## 6. Action Items — 글이 아닌 변경

### Action Items의 4가지 속성

| 속성 | 의미 |
|---|---|
| **Specific** | "안정성 개선" X — "X 알람 임계 1% → 5%" |
| **Owned** | 담당자 명시 — *팀*만 적으면 책임 분산 |
| **Tracked** | JIRA·Linear 등 추적 시스템 ID |
| **Time-boxed** | 마감 — 무기한 X |

### 우선순위 분류

| 우선 | 의미 | 마감 |
|:-:|---|---|
| **P0** | 같은 사고 직접 재발 방지 | 1주 |
| **P1** | 비슷한 사고 방지 | 1개월 |
| **P2** | 일반적 신뢰성 개선 | 분기 |
| **P3** | 백로그 — 우선순위 낮음 | 미정 |

### Action Items 추적 의무

> 포스트모템 *없는* 사고보다 *Action Item 추적 안 하는* 포스트모템이
> 더 나쁘다 — *학습 흉내*.

| 단계 | 책임 |
|---|---|
| **작성 시 등록** | IC + Scribe |
| **주간 검토** | 팀 리드 |
| **분기 회고** | SRE Lead |
| **90일 미완 알람** | 자동 escalation |
| **완료 검증** | 작성자 외 1명 |

> 90일 내 80%+ 완료가 *현업 권장치*. Google SRE Workbook이 명시 수치를
> 제시하진 않으나, 실무 팀들이 KPI로 자주 사용.

---

## 7. 포스트모템 회의 (Postmortem Review)

### 일정

| 단계 | 시점 | 형태 |
|---|---|---|
| **1. HotWash** | 사고 직후 30분 | 즉시 — 기억 신선할 때 |
| **2. 초안 작성** | T+72h | IC + Scribe |
| **3. 리뷰** | T+1주 | 팀 + stakeholder |
| **4. 발행** | T+2주 | 공개·아카이브 |
| **5. 분기 검토** | 분기 끝 | 트렌드·Action Item 검증 |

### 리뷰 회의 어젠다 (60분)

| 시간 | 항목 |
|---|---|
| 5분 | 사고 요약 |
| 10분 | 타임라인 검증 |
| 15분 | Root Cause 토론 |
| 10분 | Action Items 우선순위 합의 |
| 10분 | "Where We Got Lucky" 토론 |
| 10분 | Lessons Learned + 다른 팀 공유 결정 |

### Blameless 진행 규칙

| 규칙 | 의미 |
|---|---|
| **이름 대신 역할** | "On-call IC가" — "Bob이" X |
| **Why 5번 X** | RCA는 별도 — 회의는 *시스템 약점* |
| **방어 발언 금지** | "그건 내 잘못이..." 차단, *시스템* 으로 돌림 |
| **외부 인사 참관** | 다른 팀원이 옵저버 — 학습 확산 |
| **녹화 선택** | 솔직성과 trade-off — 보통 X |

---

## 8. 사례 — 한 페이지 미니 포스트모템

```markdown
# Postmortem: payment-api 5xx 급증 (2026-04-15)

## Summary
2026-04-15 14:23 KST, payment-api 새 버전 v2.3.0 배포 직후 5xx
오류율이 35%까지 급증. 14:33 자동 카나리 롤백으로 복구. 영향 사용자
약 12,000명, 결제 실패 약 2,400건.

## Impact
- 사용자: 12,000명 영향 (10분간)
- 매출: 약 ₩350,000 손실 (실패 결제 평균 단가 기준)
- SLO: 가용성 SLO 30일 버짓 14% 소진

## Trigger
v2.3.0의 DB 커넥션 풀 설정 오타 — `max_connections: 50` → `5`

## Root Cause
- 직접: 설정 오타
- 기여: PR 리뷰가 yaml 변경을 *기능* 변경에 묻어 검토 부족
- 근본: 인프라 설정 변경에 별도 검토 게이트 부재

## Detection
SLO Burn Rate 14.4× 알람 (5분 창) — T+2분에 발사. 작동 OK.

## Timeline
| 시각 | 이벤트 |
|---|---|
| 14:21 | v2.3.0 카나리 시작 (5%) |
| 14:23 | 5xx 35% — 알람 발사 |
| 14:25 | On-call ACK |
| 14:30 | IC 호출, 카나리 자동 롤백 시작 |
| 14:33 | 롤백 완료, 5xx 정상화 |

## What Went Well
- SLO Burn Rate 알람이 2분 만에 인지
- 카나리 단계가 5%였기에 영향 제한
- 자동 롤백이 5분 내 완료

## What Went Wrong
- PR 리뷰에서 인프라 설정 변경 누락
- 카나리 단계가 5%지만 *2분 동안* 12,000명 영향

## Where We Got Lucky
- 한국 시간 기준 점심 직후 — 점심 시간대였다면 영향 2배
- 카나리가 자동 롤백이 가능한 환경이었음
- DB가 다른 서비스와 분리된 풀이라 cascade 없음

## Action Items
| ID | 액션 | 우선 | 소유자 | 마감 |
|---|---|:-:|---|---|
| AI-1 | 인프라 설정 변경 별도 PR 강제 (CODEOWNERS) | P0 | sre | 2026-04-22 |
| AI-2 | 카나리 단계 5% → 1% 시작 | P1 | sre | 2026-05-01 |
| AI-3 | DB 커넥션 풀 임계 검증 자동화 | P1 | sre | 2026-05-15 |

## Lessons Learned
- 인프라 설정은 *기능 PR과 분리* 필요
- 작은 카나리(1%)도 자동 롤백이 빠르면 충분
- "운"으로 적었던 점심 시간 회피를 시스템화 — 모든 시간대 안전한 카나리
```

---

## 9. Postmortem vs PIR — 보안 사고 트랙 분리

운영 사고 *포스트모템* 외에, 보안 사고는 별도 트랙 — **Post-Incident
Review (PIR)**.

| 측면 | Postmortem (운영) | PIR (보안) |
|---|---|---|
| 표준 | Google SRE Book | NIST SP 800-61, ISO 27035 |
| 청중 | 엔지니어링·전사 | 보안팀·법무·임원·감독기관 |
| 민감 정보 | 비교적 공개 가능 | 침해 지표·취약점·고객 정보 |
| 법적 디스커버리 | 일반 | 변호사 작업물 보호 (attorney-client privilege) |
| 외부 보고 의무 | 선택 | 의무 — GDPR 72h, KISA 24h, SEC 등 |
| 작성자 | IC + Scribe | CSO·CISO + 외부 포렌식 |

> 보안 사고는 *공동 트랙* 운영. 운영 측 Postmortem + 보안 측 PIR을
> *별도* 발행. 같은 타임라인에서 정보 공유는 NDA·법무 검토 후. 자세히
> 는 `security/` 카테고리.

---

## 10. 공개 포스트모템 — Public Postmortem

대형 사고 후 *외부 공개*는 신뢰 회복의 강력한 도구.

### 산업 표준 사례

| 회사 | 유명 사례 |
|---|---|
| **Cloudflare** | 정기 공개 — 모든 SEV1·2 |
| **GitLab** | 2017 DB 삭제 사고 — *실시간* 공개 |
| **AWS** | Service Health Dashboard + 사후 보고서 |
| **GitHub** | 분기 가용성 보고서 |
| **Google Cloud** | Service Health + Incident Reports |

### 공개 시 작성 가이드

| 항목 | 권장 |
|---|---|
| **Redaction** | 내부 시스템명·고객 정보 제거 |
| **법무 검토** | SLA 위약·소송 우려 검토 |
| **고객 영향 정량화** | 추정 사용자·매출 명시 |
| **Action Items 공개** | *재발 방지 약속* — 신뢰 회복 |
| **타임라인 정직** | 알람 미작동·실수도 공개 |
| **사람 이름 X** | 외부 공개는 *역할*만 — Blameless |

> Cloudflare의 공개 포스트모템은 *기술 마케팅* 효과까지. "*투명성이
> 신뢰*". GitLab 2017은 산업 모범으로 인용.

---

## 11. 트렌드 분석 — 포스트모템 데이터 마이닝

분기·연간 단위로 모든 포스트모템 검토.

| 분석 | 질문 |
|---|---|
| **Trigger 분포** | 배포 X%, 외부 의존성 Y%, 트래픽 급증 Z% |
| **Root Cause 패턴** | 같은 시스템·같은 약점 반복? |
| **Detection** | MTTD 분포 — 알람 커버리지 점검 |
| **Action Item 완료율** | 분기 90일 내 완료 % |
| **재발률** | 같은 사고 N회 → 시스템 변경 우선 |
| **MTTR 분포** | SEV별 MTTR 추이 |

> Google "Postmortems at Google" working group이 산업 표준화한 분석.

---

## 12. 포스트모템 도구

| 도구 | 강점 |
|---|---|
| **Google Docs / Confluence** | 표준 — 협업·코멘트 |
| **incident.io** | 자동 작성 (타임라인·알람·메시지 import) |
| **FireHydrant** | 통합 IR + 포스트모템 |
| **PagerDuty** | 사고 데이터 연동 |
| **Notion** | 가벼운 시작 |
| **postmortem-templates (GitHub)** | OSS 템플릿 모음 |

> 자동화 도구가 *타임라인·알람·메시지*를 자동 import. 수동 입력 시간을
> 절반으로.

---

## 13. 안티패턴 — 포스트모템 실패

| 안티패턴 | 증상 | 처방 |
|---|---|---|
| **Blame 문화** | 솔직한 보고 X, 학습 0 | Blameless 명문화, 매니저 시범 |
| **Action Item 미추적** | 같은 사고 반복 | 자동 트래커, 90일 검증 |
| **포스트모템 작성 안 함** | 학습 0 | SEV1·2 자동 트리거 |
| **회의 없이 문서만** | 컨텍스트 손실 | 1주 내 리뷰 회의 강제 |
| **다른 팀과 미공유** | 같은 실수 다른 팀 반복 | 분기 트렌드 공유 |
| **5 Whys로 그침** | 표면적 RCA | 별도 RCA 방법론 |
| **너무 길어 읽지 않음** | 학습 X | 1페이지 요약 + 상세 분리 |
| **부정확한 타임라인** | 신뢰 손상 | 자동 import + Scribe |

---

## 14. Blameless 문화 만들기

### 매니저·리더의 4가지 행동

| 행동 | 의미 |
|---|---|
| **본인 실수 먼저 공개** | "내가 X 실수했다" — 모범 |
| **Blame 발언 즉시 차단** | 회의에서 *그 자리에서* 교정 |
| **시스템 약점 칭찬** | "이걸 발견해서 다행" |
| **Action 완료 가시화** | 시스템 변경 → 학습 증거 |

### 신규 입사자에게

- 첫 주: 최근 6개월 포스트모템 5개 정독
- 첫 사고 시: Shadow IC + 포스트모템 공동 저자

> Blameless 문화는 *말*이 아니라 *행동*으로 정착. 1년이 걸린다.

---

## 15. 1~5인 팀의 포스트모템 — 미니 워크플로

| 단계 | 시간 | 산출물 |
|---|---|---|
| **HotWash** (사고 직후) | 30분 | 즉시 메모 |
| **초안 작성** | 1시간 | 한 페이지 미니 |
| **팀 리뷰** (3일 내) | 30분 | Action Items 합의 |
| **공유** | — | Wiki·Slack 공지 |
| **분기 회고** | 1시간 | 트렌드·완료율 |

> SEV1·2가 분기에 1~3건이면 워크로드 무리 X. 이 정도 학습은 *반드시*
> 한다.

---

## 16. 한눈에 보기

| 항목 | 한 줄 |
|---|---|
| **포스트모템의 본질** | 사고에서 배우는 문서 |
| **Blameless** | 사람의 실수는 시스템 약점의 증상 |
| **트리거** | SEV1·2, 데이터 손실, SLO 위반 시 *반드시* |
| **Google 시그니처** | "Where We Got Lucky" 섹션 |
| **Action Items** | Specific·Owned·Tracked·Time-boxed |
| **추적** | 90일 내 80%+ 완료 표준 |
| **회의** | T+1주 내 60분 리뷰, Blameless 규칙 |
| **트렌드** | 분기·연간 데이터 마이닝 |
| **금지** | Blame, 작성만·추적 X, 비공유 |

---

## 참고 자료

- [Google SRE Book — Postmortem Culture](https://sre.google/sre-book/postmortem-culture/) (확인 2026-04-25)
- [Google SRE Book — Example Postmortem](https://sre.google/sre-book/example-postmortem/) (확인 2026-04-25)
- [Google SRE Workbook — Postmortem Culture](https://sre.google/workbook/postmortem-culture/) (확인 2026-04-25)
- [Google SRE Workbook — Postmortem Analysis](https://sre.google/workbook/postmortem-analysis/) (확인 2026-04-25)
- [Google Cloud — Fearless Shared Postmortems](https://cloud.google.com/blog/products/gcp/fearless-shared-postmortems-cre-life-lessons) (확인 2026-04-25)
- [GitHub — postmortem-templates](https://github.com/dastergon/postmortem-templates) (확인 2026-04-25)
- [Etsy — Blameless Postmortems (Allspaw)](https://www.etsy.com/codeascraft/blameless-postmortems) (확인 2026-04-25)
