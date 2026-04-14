---
title: "Incident Review와 Retrospective"
date: 2026-04-14
tags:
  - sre
  - incident
  - review
  - retrospective
sidebar_label: "인시던트 리뷰"
---

# Incident Review와 Retrospective

## 1. 두 가지 리뷰

| 항목 | Incident Review | Retrospective |
|------|----------------|---------------|
| 대상 | 개별 장애 | 기간별 전체 장애 |
| 시기 | 장애 후 24~72시간 | 분기/월별 |
| 목적 | 근본 원인 분석 | 패턴 발견, 개선 방향 |
| 참석자 | 관련 팀 | SRE + 개발팀 리더 |

---

## 2. Incident Review 진행

### 사전 준비 (담당자)

```
□ 포스트모템 초안 작성 (24시간 이내)
□ 타임라인 정리
□ 메트릭·로그 첨부
□ 5 Whys 초안 작성
□ 참석자 공유 (24시간 전)
```

### 세션 진행 (60분)

```
0~10분: 장애 개요 공유
  → 담당자가 타임라인 발표

10~30분: 근본 원인 논의
  → 팀 전체 5 Whys 함께 진행
  → 가설 검증

30~50분: 조치 항목 도출
  → 각 조치에 담당자·기한 지정
  → 즉시/단기/장기 구분

50~60분: 잘한 점·아쉬운 점
  → 비난 없이 시스템 관점 유지
```

---

## 3. Retrospective 진행

### 분기 리뷰 항목

```
1. 장애 통계
   - 총 인시던트 수 (SEV별)
   - 평균 MTTD (탐지 시간)
   - 평균 MTTR (복구 시간)
   - 에러 버짓 소비 현황

2. 패턴 분석
   - 반복되는 원인 유형
   - 자주 장애 발생하는 서비스
   - 알림 오탐률

3. 조치 항목 완료율
   - 지난 분기 액션 아이템 이행률

4. 다음 분기 개선 목표
   - MTTD/MTTR 목표
   - 자동화 항목
   - SLO 조정
```

---

## 4. 핵심 지표 (MTTX)

| 지표 | 의미 | 계산 |
|------|------|------|
| MTTD | Mean Time to Detect | 장애 발생 → 알림 |
| MTTA | Mean Time to Acknowledge | 알림 → 담당자 확인 |
| MTTR | Mean Time to Resolve | 장애 발생 → 복구 |
| MTBF | Mean Time Between Failures | 장애 간격 |

```yaml
# Prometheus: MTTR 추적
# 인시던트 시작/종료 메트릭이 있다고 가정

- record: job:incident_mttr_minutes:avg
  expr: |
    avg(
      (incident_resolved_timestamp
       - incident_started_timestamp) / 60
    )
```

---

## 5. 문화 구축

```
심리적 안전감:
  → 장애를 보고했을 때 불이익이 없어야 함
  → "누가 실수했나"가 아닌 "왜 실수가 가능했나"

학습 문화:
  → 포스트모템을 팀 전체와 공유
  → 좋은 포스트모템은 표창
  → 반복 장애는 조치 이행 실패로 인식

측정:
  → 포스트모템 작성 비율 추적
  → 액션 아이템 완료율 측정
```

---

## 참고 문서

- [Google Postmortem Examples](https://sre.google/sre-book/example-postmortem/)
- [Blameless Culture](https://www.etsy.com/codeascraft/blameless-postmortems/)
