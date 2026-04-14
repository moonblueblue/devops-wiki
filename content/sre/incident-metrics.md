---
title: "장애 지표 설계와 관리 요령"
date: 2026-04-14
tags:
  - sre
  - incident
  - metrics
sidebar_label: "장애 지표 관리"
---

# 장애 지표 설계와 관리 요령

## 1. 핵심 장애 지표

```
운영 건강도를 나타내는 핵심 지표:

MTTD (Mean Time to Detect):
  → 알림 시스템 품질 반영
  → 목표: < 5분

MTTA (Mean Time to Acknowledge):
  → 온콜 프로세스 품질 반영
  → 목표: < 10분

MTTR (Mean Time to Resolve):
  → 대응 역량 반영
  → 목표: SEV-1 < 2시간

MTBF (Mean Time Between Failures):
  → 시스템 안정성 반영
  → 클수록 좋음
```

---

## 2. 장애 지표 수집

```yaml
# Prometheus alertmanager receiver로 지표 수집
# 인시던트 시작 시 메트릭 기록

# incident_created_total 카운터 증가
- alert: IncidentCreated
  expr: ALERTS{alertstate="firing",severity="critical"}
  for: 1m
  labels:
    incident: "true"
  annotations:
    severity: "{{ $labels.severity }}"

# 커스텀 지표 (외부 인시던트 시스템 연동)
incident_duration_seconds{
  service="payment",
  severity="sev1"
} 4200
```

---

## 3. 장애 빈도 분석

```python
# PagerDuty API로 장애 지표 수집
import requests
from datetime import datetime, timedelta

headers = {
    'Authorization': f'Token token={API_KEY}',
    'Accept': 'application/vnd.pagerduty+json;version=2'
}

# 지난 30일 인시던트 조회
response = requests.get(
    'https://api.pagerduty.com/incidents',
    headers=headers,
    params={
        'since': (datetime.now() - timedelta(days=30)).isoformat(),
        'until': datetime.now().isoformat(),
        'statuses[]': ['resolved'],
        'limit': 100
    }
)

incidents = response.json()['incidents']

# SEV별 MTTR 계산
for severity in ['sev1', 'sev2', 'sev3']:
    sev_incidents = [
        i for i in incidents
        if i['urgency'] == severity
    ]
    mttr = sum([
        (datetime.fromisoformat(i['resolved_at']) -
         datetime.fromisoformat(i['created_at'])).seconds
        for i in sev_incidents
    ]) / len(sev_incidents) / 60
    print(f"{severity} MTTR: {mttr:.1f}분")
```

---

## 4. 지표 대시보드 항목

```
월간 리포트에 포함할 지표:

신뢰성:
  □ 서비스별 가용성 (실제 vs SLO)
  □ 에러 버짓 잔량

장애 대응:
  □ 총 인시던트 수 (SEV별)
  □ MTTD / MTTA / MTTR 추이
  □ 반복 장애 비율

운영 부하:
  □ 온콜 알림 수 (오탐 포함)
  □ Toil 작업 시간 비율
  □ 포스트모템 작성률
  □ 액션 아이템 완료율
```

---

## 5. 알림 품질 측정

```
알림 품질 지표:

Action Rate (조치율):
  = 실제 조치가 필요했던 알림 / 전체 알림
  → 목표 > 80%

알림 피로도:
  온콜당 일 평균 알림 수
  → 목표 < 5개/일

오탐률:
  = 오탐 알림 / 전체 알림
  → 목표 < 10%
```

---

## 참고 문서

- [Google SRE Workbook - On-Call](https://sre.google/workbook/on-call/)
- [PagerDuty Operations Reviews](https://response.pagerduty.com/after/review/)
