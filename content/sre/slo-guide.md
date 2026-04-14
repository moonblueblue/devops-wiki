---
title: "SLO 설정 실전 가이드"
date: 2026-04-14
tags:
  - sre
  - slo
  - reliability
sidebar_label: "SLO 설정"
---

# SLO 설정 실전 가이드

## 1. SLO 설정 프로세스

```
1. 사용자 여정 파악
   → 중요한 사용자 행동 식별

2. SLI 선택
   → 해당 행동을 대표하는 메트릭

3. 목표치 결정
   → 현재 성능 기반 + 사용자 기대치

4. 측정 방법 정의
   → 데이터 소스, 집계 방식, 측정 창

5. 에러 버짓 계산
   → 정책 수립

6. 리뷰 주기 설정
   → 분기별 SLO 검토
```

---

## 2. 서비스 유형별 SLO 예시

### API 서비스

```yaml
slo:
  name: payment-api-availability
  description: 결제 API 가용성
  
  sli:
    metric: http_requests_total
    good: code !~ "5.."
    total: all requests
    
  objective:
    target: 0.999    # 99.9%
    window: 30d
    
  alerting:
    burn_rate_threshold: 14.4    # 1h 창
    long_burn_rate_threshold: 6  # 6h 창
```

### 데이터 파이프라인

```yaml
slo:
  name: etl-freshness
  description: ETL 데이터 신선도
  
  sli:
    # 마지막 성공 처리 후 경과 시간
    metric: etl_last_success_timestamp_seconds
    good: (time() - etl_last_success) < 3600  # 1시간 이내
    
  objective:
    target: 0.99     # 99%
    window: 7d
```

---

## 3. 레이턴시 SLO

```yaml
# 다중 백분위수 SLO
slo:
  name: api-latency
  
  objectives:
  - percentile: 50
    threshold: 100ms
    target: 0.99
    
  - percentile: 95
    threshold: 500ms
    target: 0.95
    
  - percentile: 99
    threshold: 2000ms
    target: 0.99
```

---

## 4. SLO Toolkit (OpenSLO)

```yaml
# OpenSLO 표준 형식
apiVersion: openslo/v1
kind: SLO
metadata:
  name: payment-availability
  displayName: 결제 서비스 가용성
spec:
  service: payment-api
  description: 결제 요청 성공률
  
  indicator:
    metadata:
      name: payment-success-rate
    spec:
      ratioMetric:
        counter: true
        good:
          metricSource:
            type: Prometheus
            spec:
              query: |
                sum(rate(http_requests_total
                  {service="payment",code!~"5.."}[5m]))
        total:
          metricSource:
            type: Prometheus
            spec:
              query: |
                sum(rate(http_requests_total
                  {service="payment"}[5m]))
  
  objectives:
  - target: 0.999
    timeWindow:
    - duration: 30d
      isRolling: true
```

---

## 5. 현실적인 SLO 설정 원칙

```
너무 높은 SLO의 문제:
  → 에러 버짓이 너무 적음
  → 배포·실험 불가
  → 팀 번아웃 위험

너무 낮은 SLO의 문제:
  → 사용자 불만
  → 브랜드 신뢰도 하락

적정 SLO 찾기:
  1. 지난 분기 실제 가용성 측정
  2. 사용자 불만 발생한 임계점 파악
  3. 여유있는 목표 (현재 성능의 10~20% 낮게)
  4. 분기마다 상향 조정
```

---

## 참고 문서

- [OpenSLO](https://openslo.com/)
- [SLO Generator (Google)](https://github.com/google/slo-generator)
- [Sloth (SLO Prometheus)](https://github.com/slok/sloth)
