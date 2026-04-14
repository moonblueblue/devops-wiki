---
title: "서버 스펙 산정과 용량 계획"
date: 2026-04-14
tags:
  - sre
  - capacity-planning
  - performance
sidebar_label: "용량 계획"
---

# 서버 스펙 산정과 용량 계획

## 1. 용량 계획의 목적

```
과소 산정:
  → 서비스 장애, SLO 위반

과다 산정:
  → 비용 낭비

용량 계획:
  → 필요한 만큼만, 여유 있게
  → 트래픽 증가에 자동 대응
```

---

## 2. 리소스 요구사항 계산

### 서비스 처리량 기반

```
목표:
  - 최대 RPS: 1,000 req/s
  - p99 레이턴시: 200ms

측정값 (부하 테스트):
  - 인스턴스 1개당 최대 RPS: 100 req/s
  - 처리 당 CPU: 0.1 core
  - 처리 당 메모리: 50MB

계산:
  필요 인스턴스: 1,000 / 100 = 10개
  버퍼 (30%): 10 * 1.3 = 13개
  
  CPU: 13 * 0.1 * 1,000 = 130 cores
  메모리: 13 * 50 * 1,000 = 650 GB

Kubernetes 요청:
  requests.cpu: 100m
  requests.memory: 128Mi
  limits.cpu: 500m
  limits.memory: 256Mi
```

---

## 3. 트래픽 예측

```python
# 과거 데이터 기반 트래픽 예측
import numpy as np
from scipy.stats import linregress

# 월별 DAU 데이터
months = np.array([1, 2, 3, 4, 5, 6])
dau = np.array([10000, 12000, 13500, 15000, 16800, 18000])

# 선형 회귀
slope, intercept, r, p, se = linregress(months, dau)

# 6개월 후 예측
future_month = 12
predicted_dau = slope * future_month + intercept
print(f"예측 DAU: {predicted_dau:.0f}")

# RPS 산정 (DAU → RPS)
# DAU × 평균 세션수 × 평균 요청수 / 하루 초
avg_rps = predicted_dau * 3 * 50 / 86400
peak_rps = avg_rps * 3  # 피크는 평균의 3배
print(f"예상 피크 RPS: {peak_rps:.0f}")
```

---

## 4. Kubernetes 리소스 최적화

```yaml
# VPA (Vertical Pod Autoscaler)로 적정 리소스 추천
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: payment-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payment
  updatePolicy:
    updateMode: "Off"    # 추천만 하고 자동 적용 안 함
```

```bash
# VPA 추천값 확인
kubectl describe vpa payment-vpa
# → Lower Bound, Upper Bound, Target 확인
```

---

## 5. 용량 계획 프로세스

```
분기별 리뷰:

1. 현재 사용량 분석
   □ 평균/피크 CPU·메모리 사용률
   □ 노드 활용률
   □ 비용 트렌드

2. 성장률 예측
   □ 비즈니스 목표 기반 트래픽 예측
   □ 신규 기능 영향 고려

3. 갭 분석
   □ 6개월 후 필요 용량 계산
   □ 현재 용량과 차이 파악

4. 계획 수립
   □ 클러스터 확장 계획
   □ 인스턴스 타입 최적화
   □ 예약 인스턴스/Savings Plans 검토
```

---

## 6. 비용 최적화

```
오른쪽 사이징:
  → VPA 추천값 주기적 검토
  → 과다 프로비저닝 인스턴스 조정

Spot/Preemptible 활용:
  → 스테이트리스 워크로드에 Spot 인스턴스
  → Karpenter로 자동 노드 타입 선택

예약 인스턴스:
  → 기본 용량은 1년/3년 예약 (최대 72% 절감)
  → 피크 용량은 On-demand
```

---

## 참고 문서

- [Google SRE - Software Engineering in SRE](https://sre.google/sre-book/software-engineering-in-sre/)
- [AWS Compute Optimizer](https://aws.amazon.com/compute-optimizer/)
- [Karpenter](https://karpenter.sh/)
