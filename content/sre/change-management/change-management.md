---
title: "Change Management — SRE 관점의 변경 위험·승인·동결"
sidebar_label: "Change Mgmt"
sidebar_position: 1
date: 2026-04-26
last_verified: 2026-04-26
tags:
  - sre
  - change-management
  - risk
  - approval
  - dora
---

# Change Management

> **2026년의 자리**: 사고 원인 1위는 *변경*. SRE 관점의 Change Management
> 는 *변경 위험을 분류·검토·동결*하는 체계. ITIL 4(2025년 v2 갱신)의
> CAB 모델과 DORA 연구의 *peer review + 자동화* 모델이 양극. 2025년 EU
> **DORA 규정** 시행으로 금융권은 *문서화된 변경 관리*가 의무. SRE는
> 두 모델을 *위험 분류 기반*으로 결합.
>
> 1~5인 환경에서는 *3단계 위험 분류 + PR 리뷰 + 변경창*으로 충분.
> 무거운 CAB는 *대형 변경 한정*.

- **이 글의 자리**: [Error Budget 정책](../slo/error-budget-policy.md)이
  *언제* 변경 차단인지 정의했다면, 이 글은 *어떻게* 변경을 다룰지.
- **선행 지식**: SLO·EBP, IR 라이프사이클.

---

## 1. 한 줄 정의

> **Change Management**: "*프로덕션 변경의 *위험을 분류*하고, *적절한
> 검토·승인·일정*을 통해 *사고 가능성을 낮추는* 체계.* SRE 관점에서
> 핵심은 *변경 속도와 신뢰성의 균형*."

### 변경 = 사고 원인 1위

| 보고 | 비율 |
|---|---|
| Google SRE | 사고의 ~70%가 변경 직후 |
| AWS 사후 보고 | 다수가 인프라·코드 변경 |
| GitLab 2017 DB 사고 | 운영 절차 변경 |
| 일반 SaaS | 60~80% |

> *변경 속도 ↓로 사고를 줄인다*는 직관은 **틀림**. DORA 연구: *작고 잦은
> 변경*이 *큰 드문 변경*보다 안전. 무거운 CAB는 *오히려 위험 증가*.

---

## 2. 변경의 3가지 타입 (ITIL 4)

| 타입 | 의미 | 승인 |
|---|---|---|
| **Standard** (표준) | 사전 승인된 반복 변경 | 자동 — 절차 자동화 |
| **Normal** (일반) | 매번 평가 필요 | 위험 분류 기반 |
| **Emergency** (긴급) | 즉시 필요 | Emergency CAB |

### Standard Change 예시

| 변경 | 승인 |
|---|---|
| 의존성 버전 업데이트 (Dependabot) | PR 리뷰만 |
| 표준 인스턴스 타입 추가 | Terraform PR |
| 사용자 추가·제거 | IAM 표준 |
| 인증서 자동 갱신 | cert-manager |

> *Standard Change는 무겁게 다루지 않는다*. 자동화로 빠르게 처리.

---

## 3. 위험 분류 — 모든 변경의 출발점

### Risk Matrix (영향 × 발생 가능성)

| | 영향 낮음 | 영향 중 | 영향 높음 |
|---|---|---|---|
| **확실** | Low | Medium | **High** |
| **가능** | Low | **Medium** | High |
| **드묾** | Low | Low | Medium |

### 변경 위험 등급

| 등급 | 정의 | 예시 |
|:-:|---|---|
| **Low** | 격리됨, 자동 롤백, 사용자 영향 0 | 단순 코드 변경, feature flag toggle |
| **Medium** | 일부 영향 가능, 카나리 가능 | 새 기능, schema additive |
| **High** | 전사 영향 가능, 롤백 어려움 | DB 마이그, 인프라 큰 변경 |
| **Critical** | 데이터 손실 가능, 영구 결과 | DB drop, 도메인 변경 |

### 등급별 절차

| 등급 | 검토 | 승인 | 시점 |
|:-:|---|---|---|
| **Low** | PR 리뷰 1명 | 작성자 + reviewer | 자유 |
| **Medium** | PR 리뷰 + SRE | Tech Lead | 변경창 |
| **High** | 위 + Architecture Review | Engineering Lead + SRE Lead | 변경창 + 사전 알림 |
| **Critical** | 위 + 임원·법무 | VP + 법무 | 별도 일정 |

---

## 4. 변경창 (Change Window)

### 변경창 의미

> *언제 변경을 *허용*하는지를 사전 정의한 시간대.* 사고 가능성과 영향
> 시간을 통제.

### 표준 변경창

| 시간대 | 의미 |
|---|---|
| **영업시간** | Low risk만 — 즉시 대응 가능 |
| **점심시간** (12-14) | 변경 금지 — 트래픽 급증 |
| **퇴근 직전** (17-18) | *금지* — 사고 시 대응 인력 X |
| **야간 변경창** (22-04) | 사용자 ↓ — High/Critical |
| **주말** | Critical만, 사전 합의 |
| **이벤트 기간** | *전면 동결* (블랙프라이데이 등) |

### 변경창 정책 예시

```markdown
# Change Window Policy

## Allowed
- Low Risk: 평일 09:00-17:00, 회의 시간 회피
- Medium Risk: 평일 14:00-16:00
- High Risk: 화·수 22:00-02:00 (야간 창)
- Emergency: 24/7 (단, IC 승인)

## Forbidden
- 매일 12:00-14:00 (점심)
- 매일 17:00-19:00 (퇴근)
- 금요일 14:00 이후 (주말 진입)
- 분기 마지막 주
- 블랙프라이데이 ±3일
- 신규 기능 출시 ±48h

## Exception
- Security patch: 즉시 가능
- 데이터 손상 fix: 즉시 가능
- 규제 마감: 별도 승인
```

### 금요일 룰

> *금요일 14:00 이후 변경 X.* 사고 시 주말 대응 부담. 산업 표준.

---

## 5. 변경 동결 (Change Freeze)

### 동결 트리거

| 트리거 | 예시 |
|---|---|
| **Error Budget 소진** | EBP 75% 임계 |
| **이벤트 임박** | 블랙프라이데이, 신규 기능 출시 |
| **분기 마감** | 매출 목표 달성 보호 |
| **규제·감사** | SOC2·ISO27001 감사 기간 |
| **정전·재해 직후** | 안정화 우선 |

### 동결 범위

| 범위 | 의미 |
|---|---|
| **전체 동결** | 보안 외 모든 변경 X |
| **부분 동결** | 핵심 시스템만 |
| **위험 등급별** | High·Critical만 |
| **시간 한정** | 24h·1주·이벤트 기간 |

### 동결 면제 절차

| 사유 | 승인 |
|---|---|
| **보안 패치** | 자동 면제 |
| **데이터 정합성 fix** | 즉시 면제 |
| **규제 마감** | 임원 승인 |
| **고객 영향 진행 중** | IC 승인 |
| **비즈니스 매출** | VP + SRE Lead |

> 면제 사례는 *예외 로그*에 기록. EBP·감사·정책 검토 자료.

---

## 6. CAB — Change Advisory Board

### ITIL 4 CAB

> *대형·고위험 변경을 *집단 검토*하는 위원회.*

| 측면 | 의미 |
|---|---|
| **빈도** | 주 1회 또는 변경 발생 시 |
| **참가자** | SRE·개발 Lead·보안·비즈니스 |
| **검토 대상** | High·Critical 등급 |
| **산출** | 승인·반려·조건부 승인 |

### CAB의 함정 — DORA 연구

> *DORA 연구 결과*: 외부 형식적 검토 절차는 *변경 실패율 감소와 무관*.
> 오히려 큰 batch·드문 출시 → *높은 위험* 유발.

| 무거운 CAB | 가벼운 PR Review + 자동화 |
|---|---|
| 주 1회 일괄 | 매 PR |
| 작은 변경도 검토 | 위험 등급별 |
| 외부 검토자 | Peer Review |
| 큰 batch 강제 | 작은 batch |
| **사고율 ↑·속도 ↓** | **사고율 ↓·속도 ↑** |

### 모던 CAB — 위험 등급별

| 등급 | 검토 |
|:-:|---|
| **Low** | CAB 통과 — *자동 승인* |
| **Medium** | Async — Slack channel 24h |
| **High** | Sync 회의 — 주 1회 |
| **Critical** | Emergency CAB |
| **Standard Change** | 사전 등록만 |

> CAB는 *부담 없는 등급별 절차*로. 모든 변경에 회의는 *반패턴*.

---

## 7. PR Review — DORA 권장 모델

### Peer Review의 4가지 효과

| 효과 | 의미 |
|---|---|
| **위험 식별** | 동료가 다른 시각에서 검토 |
| **지식 공유** | 시스템 이해 분산 |
| **품질 개선** | 코드·설계 품질 ↑ |
| **자동화 보강** | 검토 + lint·test·security scan |

### CODEOWNERS 패턴

```
# .github/CODEOWNERS
# 인프라 변경은 SRE 팀 의무 리뷰
/terraform/         @sre-team
/k8s/               @sre-team
/.github/workflows/ @sre-team

# DB 마이그는 DBA + SRE
/db/migrations/     @dba-team @sre-team

# 보안 정책
/security/          @security-team

# 일반 코드
*                   @backend-team
```

### Required Reviews 정책

| 변경 종류 | Required Reviewer |
|---|---|
| Low Risk | 1명 (peer) |
| Medium Risk | 2명 (peer + SRE) |
| High Risk | 3명 (peer + SRE + Lead) |
| 인프라 | SRE 의무 |
| DB | DBA + SRE 의무 |
| 보안 | Security 의무 |

---

## 8. 자동화 게이트 — 사람 검토 보강

### Pre-merge 게이트

| 게이트 | 의미 |
|---|---|
| **Lint·Format** | 코딩 스타일 |
| **Unit Test** | 단위 검증 |
| **Integration Test** | 통합 검증 |
| **Security Scan** | Trivy·Snyk·SAST |
| **Cost 검증** | Infracost — Terraform 비용 |
| **Policy 검증** | OPA·Kyverno admission |
| **Schema 검증** | API breaking change |
| **Migration 검증** | Liquibase·Flyway dry-run |

### Pre-deploy 게이트

| 게이트 | 의미 |
|---|---|
| **Image scan** | 컨테이너 취약점 |
| **Signature 검증** | Cosign |
| **SBOM 검증** | 의존성 정합성 |
| **Error Budget 점검** | EBP 75%+ 시 차단 |
| **카나리 시작** | Argo Rollouts |
| **Soak time 확인** | 직전 배포 후 24h |

### Post-deploy 게이트

| 게이트 | 의미 |
|---|---|
| **SLO 분석** | 자동 롤백 (Argo Rollouts) |
| **에러 추적** | Sentry·로그 자동 비교 |
| **카나리 분석** | latency·success rate |

---

## 9. DORA 규정 — 금융권 의무

2025-01-17 EU **DORA (Digital Operational Resilience Act)** 시행. 금융권
ICT 변경 관리 *의무*.

### DORA 요구사항 (Article 9 + RTS RMF Article 17)

EU DORA 본 규정에서 **Article 17은 *ICT-related Incident Management
Process***. ICT 변경 관리는 **Article 9 (Protection and Prevention)**
및 **RTS RMF (위임법령) Article 17 ICT change management**에서 다룸.

| 요구 | 의미 |
|---|---|
| **문서화된 변경 관리 정책** | 등급·승인·절차 명시 |
| **위험 평가** | 모든 변경에 위험 분석 |
| **테스트** | 프로덕션 전 검증 |
| **승인 추적** | 누가·언제·왜 |
| **롤백 계획** | 모든 변경에 롤백 절차 |
| **사후 검토** | 영향 분석 |
| **3rd party 변경** | 외부 의존성 변경 추적 |

### 한국 금융권

| 규정 | 의미 |
|---|---|
| **전자금융감독규정** | 정보처리시스템 변경 통제 (안전성 확보) |
| **금융보안원 전자금융기반시설 보호기준** | 변경 관리 통제 항목 |
| **금융분야 클라우드 가이드** | 클라우드 변경 관리 |
| **금융감독원 IT 검사·감독** | 변경 이력·통제 점검 |
| **개인정보보호법** | 처리 변경 통보 의무 |

> 금융·의료·공공 영역은 *DORA 또는 동등 규제*가 적용. 일반 SaaS와 다른
> 무게.

---

## 10. 변경 메트릭 — DORA 4 keys

| Key | Change Management 영향 |
|---|---|
| **Deployment Frequency** | *작고 잦은* 변경 → 우상향 |
| **Lead Time for Changes** | 검토·승인 효율성 |
| **Change Failure Rate (CFR)** | 변경 실패율 — 위험 분류·테스트 효과 |
| **Failed Deployment Recovery Time** | 사고 회복 — 롤백 자동화 |

### CFR 목표 (참고)

| Elite | High | Medium | Low |
|---|---|---|---|
| 0~5% | 5~10% | 10~15% | 15~30% |

> 위 4-tier는 **2024 DORA Report 기준** (마지막 4-tier 모델). **2025년부터
> DORA는 7개 *team archetype* 모델로 전환** — 단일 등급보다 *팀 특성·
> 컨텍스트* 강조. 4-tier는 *역사적 참조*로 사용. 각 변경에 사후 사고
> 추적이 메트릭의 핵심은 변하지 않음.

---

## 11. RFC (Request for Change) 양식

ITIL·DORA 양쪽이 RFC 표준 필드를 정의.

| 필드 | 의미 |
|---|---|
| **목적·배경** | 왜 이 변경이 필요한가 |
| **위험 등급** | Low·Medium·High·Critical (Substitution Test로 검증) |
| **영향 범위** | Blast Radius (사용자·기능·시간) |
| **테스트 결과** | Staging·dry-run·shadow 결과 |
| **롤백 계획** | 단계별 롤백 절차 + 시간 SLA |
| **검증 방법** | 변경 후 *어떻게 정상 확인*하는가 |
| **통보 대상** | CS·법무·임원·고객 |
| **변경창** | 시작·종료 시각 |
| **승인자** | 위험 등급에 맞는 승인 체인 |
| **의존성** | 다른 변경·시스템 |
| **Standard 후보 여부** | 향후 자동화 가능성 |

> *Substitution Test*: "*같은 변경을 다른 동등한 동료가 했어도 같은 결과*
> 일까?" Yes면 *시스템 약점*, No면 *개인 검토* 필요. 위험 등급 검증의
> 표준 휴리스틱.

---

## 12. Backout / Rollback Plan — 모든 변경의 의무

### 표준 양식

```yaml
backout_plan:
  trigger:
    - SLO Burn Rate > 14.4× 5분 지속
    - 5xx > 5%
    - 데이터 정합성 의심
  steps:
    - 1. 카나리 abort (Argo Rollouts) — 1분 이내
    - 2. 트래픽 전환 (LB) — 추가 1분
    - 3. DB 변경 롤백 (사전 SQL 준비) — 5분
  rollback_sla: 10분
  tested: true
  test_date: 2026-04-20
  test_result: PASS — 8분에 회복
  point_of_no_return: DB column drop 단계 — 이후 전체 백업 복원만
```

| 속성 | 의미 |
|---|---|
| **테스트됨** | Staging에서 *실제* 롤백 시도 + 시간 측정 |
| **자동화** | 사람 개입 최소화 |
| **시간 SLA** | 변경 위험 등급별 — Medium 30분, High 10분 |
| **Point of No Return** | 이후 단계는 롤백 불가 — 명시 |
| **검증 절차** | 롤백 후 *정상 확인* 체크리스트 |

> **테스트 안 한 롤백 = 없는 롤백.** 분기 1회 staging에서 실제 시도.

---

## 13. Database 변경 특수성

DB는 사고 원인 1위. 일반 코드와 다른 패턴.

### Expand-Contract 패턴

| 단계 | 의미 | 자동 롤백 |
|:-:|---|---|
| 1 Expand | 새 컬럼 추가 (NULL 허용) | OK |
| 2 Dual write | 옛+새 둘 다 write | OK |
| 3 Backfill | 기존 row에 새 값 채움 | OK |
| 4 Read 전환 | 새 컬럼 read | OK |
| 5 Contract write | 옛 컬럼 write 중지 | 제한 |
| 6 Contract drop | 옛 컬럼 drop | **불가능** |

> 6단계 *사이*에 배포 + soak time. 한 PR로 묶으면 자동 롤백 의미 X.
> 자세히는 [SLO 기반 롤백](../progressive-delivery/slo-based-rollback.md).

### Online Schema Change 도구

| 도구 | DB |
|---|---|
| **gh-ost** | MySQL — GitHub 정전 |
| **pt-online-schema-change** | MySQL — Percona |
| **pgroll** | PostgreSQL — zero-downtime |
| **Liquibase / Flyway** | 다중 DB — 마이그 관리 |
| **Bytebase** | 다중 DB — GitOps |

### DB 변경 추가 게이트

| 게이트 | 의미 |
|---|---|
| **Backup 직전 검증** | 복원 가능성 확인 |
| **Read replica lag** | 0에 가까울 때만 |
| **Long lock 검증** | 잠금 시간 측정·임계 초과 시 차단 |
| **Index 추가** | `CREATE INDEX CONCURRENTLY` (Postgres) |
| **Schema diff 자동** | Liquibase preview |

---

## 14. Dry-run / Staging 검증

| 패턴 | 의미 |
|---|---|
| **Dry-run** | 실제 적용 X, 영향 시뮬레이션 (terraform plan, kubectl --dry-run) |
| **Shadow Execution** | 프로덕션 트래픽 복제, 응답 무시 |
| **Preview Environment** | PR마다 임시 환경 자동 생성 |
| **Staging 검증** | 프로덕션 유사 환경 |
| **Canary in Staging** | 카나리 절차 자체 검증 |
| **Tabletop** | 회의실에서 시나리오 토론 |

> 모든 High Risk 변경은 *최소 한 가지* dry-run 필수.

---

## 15. Blast Radius와 Slow Rollout 매핑

| 등급 | Blast Radius | 카나리 단계 |
|---|---|---|
| **L0** (Zero) | 사용자 영향 0 | Shadow 또는 Dark launch |
| **L1** (Local) | 단일 요청 | 1% 카나리 |
| **L2** (Cell) | 1 cell·1% 사용자 | 1·5% 카나리 — Cell-based 격리 |
| **L3** (Region) | 1 region | Region 단위 점진 |
| **L4** (Global) | 전 세계 | 동결·별도 일정 |

### 단계 매핑 원칙

| 위험 등급 | Blast Radius 목표 | Rollout 패턴 |
|:-:|---|---|
| **Low** | L1 | 단일 카나리 5% → 100% |
| **Medium** | L2 | 1·5·25·50·100% |
| **High** | L2 (cell)·L3 (region) | 1·5·10·25·50·75·100% |
| **Critical** | L3·L4 | 별도 일정·임원 승인 |

자세히는 [SLO 기반 롤백](../progressive-delivery/slo-based-rollback.md)·
[Failure Modes](../reliability-design/failure-modes.md).

---

## 16. Change Collisions — 동시 변경 충돌

| 시나리오 | 처방 |
|---|---|
| **같은 시스템에 두 변경 진행** | Change Lock — 시스템별 동시 1건 |
| **의존성 그래프** | Service A 변경 시 의존하는 B는 동결 |
| **Multi-team coordination** | 변경 캘린더 + Slack 자동 알림 |
| **DB 마이그 + 코드 배포** | 같은 PR에 묶지 X — 단계 분리 |

### Change Lock 예시

```yaml
# 변경 시스템에서 자동 검증
service: payment-api
active_change: CHG-2026-04-15-001
status: in_progress
locked_until: 2026-04-15 18:00 KST

# 다른 PR이 같은 서비스를 변경하려 하면
# CI 게이트가 차단 (or 큐에 등록)
```

---

## 17. Standard Change 승격 절차

매번 검토하는 변경을 *Standard*로 승격하면 자동 승인 가능. 절차:

| 단계 | 내용 |
|:-:|---|
| 1 | **3회 이상 성공** 기록 (변경 추적 시스템) |
| 2 | **위험 등급 Low** 일관성 |
| 3 | **자동화 가능** 검증 |
| 4 | **롤백 자동** 검증 |
| 5 | **CAB 승인** — Standard로 등록 |
| 6 | **분기 재평가** — 실패 발생 시 강등 |

> Standard Change 카탈로그 운영 — 각 항목마다 *어떤 자동화*가 적용되는지
> 명시.

---

## 18. 변경 추적 — 감사·트레이서빌리티

### 변경 데이터 표준

```yaml
change_id: CHG-2026-04-15-001
title: "payment-api v2.3.0 배포"
type: Normal
risk: Medium
requester: alice@example.com
approver: bob@example.com (Tech Lead)
sre_reviewer: charlie@example.com
schedule: 2026-04-15 14:00 KST
window: business_hours
related_pr: github.com/example/payment/pull/123
related_jira: PAY-456

risk_assessment:
  user_impact: low (canary 5%)
  rollback: automatic
  blast_radius: L2 (cell)

approval:
  - 2026-04-14 16:00: bob (PR review)
  - 2026-04-15 13:55: charlie (SRE final check)

execution:
  start: 2026-04-15 14:01
  end: 2026-04-15 14:38
  status: success
  observations: SLO 정상 유지

post_review:
  date: 2026-04-22
  outcome: 변경 성공, 추가 액션 없음
```

### 도구

| 도구 | 용도 |
|---|---|
| **GitHub PR + linked JIRA** | 가장 단순 |
| **ServiceNow Change** | ITIL CAB |
| **Atlassian Change Management** | JIRA 통합 |
| **incident.io / FireHydrant** | 변경 + 사고 통합 |
| **Backstage** | 카탈로그 + 변경 |

---

## 19. 안티패턴

| 안티패턴 | 증상 | 처방 |
|---|---|---|
| **모든 변경에 CAB** | 속도 ↓, 큰 batch ↑ | 위험 등급별 |
| **변경창 무시** | 점심·금요일 사고 | 정책 강제 + 자동화 |
| **롤백 계획 부재** | 사고 시 우왕좌왕 | 모든 변경에 의무 |
| **Standard Change 자동화 안 함** | 매번 검토 부담 | 절차 자동화 |
| **위험 분류 부정확** | High → Low 잘못 표기 | Substitution Test |
| **변경 추적 없음** | 감사 불가 | PR + JIRA 링크 |
| **Emergency 남용** | 정상 절차 회피 | Emergency 사후 검토 |
| **Code freeze로 보안 차단** | 취약점 노출 | 보안 자동 면제 |

---

## 20. 1~5인 팀의 Change Management — 미니 가이드

### 한 페이지 정책

```markdown
# Change Management Policy v1

## 위험 분류 (3단계)
- Low: 코드 단순 변경, feature flag toggle, 의존성 minor
  - 승인: PR review 1명
  - 변경창: 평일 09-17 (점심 제외)
- Medium: 새 기능, schema additive, 인프라 자원 변경
  - 승인: PR review + SRE
  - 변경창: 화·수 14-16
- High: DB 마이그, 인프라 큰 변경, 도메인
  - 승인: PR + SRE + Tech Lead
  - 변경창: 화·수 야간 22-02

## 변경창 금지 시간
- 매일 12-14, 17-19
- 금요일 14:00 이후
- 분기 마지막 주
- 블랙프라이데이 ±3일

## Code Freeze
- EBP 75% 소진: High·Medium 동결
- EBP 100%: 전체 동결
- 이벤트 ±48h: 전체 동결

## Emergency
- 보안 패치: 자동 면제
- 데이터 정합성 fix: 즉시
- 그 외: IC + Tech Lead 공동 승인

## 추적
- 모든 변경 = PR + JIRA 티켓
- 사후 7일 내 영향 검토 (High만)
```

---

## 21. 한눈에 보기

| 항목 | 한 줄 |
|---|---|
| **변경 = 사고 원인 1위** | 70%+ 사고가 변경 직후 |
| **위험 분류** | Low·Medium·High·Critical 4단계 |
| **변경창** | 평일 영업시간, 야간 창, 금요일 룰 |
| **CAB 함정** | 무거운 외부 검토 = 사고율 ↑ (DORA 연구) |
| **DORA 권장** | Peer Review + 자동화 |
| **자동화 게이트** | Pre-merge·Pre-deploy·Post-deploy |
| **Code Freeze** | EBP·이벤트·감사 기반 |
| **Emergency** | 보안·데이터 정합성만 자동 면제 |
| **CFR Elite** | < 5% |
| **EU DORA (2025-01)** | 금융권 의무 |
| **시작** | 한 페이지 정책 + PR + 변경창 |

---

## 참고 자료

- [DORA — Streamlining Change Approval](https://dora.dev/capabilities/streamlining-change-approval/) (확인 2026-04-25)
- [Google SRE Workbook — Configuration Specifics (변경 관리)](https://sre.google/workbook/configuration-specifics/) (확인 2026-04-25)
- [ITIL 4 — Change Enablement](https://www.axelos.com/itil-4) (확인 2026-04-25)
- [DORA EU Regulation — Article 17 ICT Change Management](https://www.springlex.eu/en/packages/dora/rts-rmf-regulation/article-17/) (확인 2026-04-25)
- [DORA State of DevOps 2025](https://cloud.google.com/devops/state-of-devops) (확인 2026-04-25)
- [Liquibase — DORA Compliance for DB Change Management](https://www.liquibase.com/resources/guides/dora-compliance-for-financial-services-database-change-management-best-practices) (확인 2026-04-25)
