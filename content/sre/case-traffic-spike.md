---
title: "실전 케이스: 트래픽 급증 장애"
date: 2026-04-14
tags:
  - sre
  - incident-case
  - traffic
  - scaling
sidebar_label: "케이스: 트래픽 급증"
---

# 실전 케이스: 트래픽 급증 장애

## 1. 장애 개요

```
시나리오: 이벤트·세일로 트래픽 10배 급증
증상:
  - 결제 실패율 급증
  - 레이턴시 p99 30초
  - Pod CPU throttling
  - DB 연결 풀 고갈
```

---

## 2. 즉각 대응

```bash
# 1. 현재 Pod/노드 상태 확인
kubectl top pods -n production
kubectl top nodes

# 2. HPA 상태 확인
kubectl get hpa -n production
kubectl describe hpa payment-hpa

# 3. 즉시 수동 스케일아웃
kubectl scale deployment payment \
  --replicas=50 -n production

# 4. DB 연결 수 확인 및 조치
kubectl exec -it postgres-0 -- psql -c \
  "SELECT count(*) FROM pg_stat_activity;"

# 연결 수가 max_connections에 근접하면
# 유휴 연결 종료
kubectl exec -it postgres-0 -- psql -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle';"
```

---

## 3. 트래픽 제어

```nginx
# NGINX Ingress 속도 제한 즉시 활성화
kubectl annotate ingress payment-ingress \
  nginx.ingress.kubernetes.io/limit-rps="50" \
  nginx.ingress.kubernetes.io/limit-connections="200"
```

```yaml
# 비핵심 서비스 트래픽 차단 (피처 플래그)
# ConfigMap으로 기능 비활성화
apiVersion: v1
kind: ConfigMap
metadata:
  name: feature-flags
data:
  RECOMMENDATIONS_ENABLED: "false"
  ANALYTICS_ENABLED: "false"
  # 결제 핵심 기능만 유지
```

---

## 4. 자동 스케일링 최적화

```yaml
# HPA - 트래픽 급증 대응 설정
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payment-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: payment
  minReplicas: 5       # 최소 5개 (사전 워밍)
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50    # 낮게 설정 (빠른 반응)
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0    # 즉시 스케일아웃
      policies:
      - type: Pods
        value: 10                      # 한 번에 10개씩
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 안정화 후 축소
```

---

## 5. 사전 준비 (예측된 트래픽 급증)

```bash
# 이벤트 전 사전 스케일아웃
# (Kubernetes CronJob으로 자동화)
kubectl scale deployment payment \
  --replicas=30 -n production

# 사전 DB 연결 풀 확장
# PgBouncer max_client_conn 증가
kubectl set env deployment/pgbouncer \
  PGBOUNCER_MAX_CLIENT_CONN=2000

# CDN 캐시 워밍
curl -X PURGE https://cdn.example.com/cache/warm
```

---

## 6. 장애 예방 체크리스트

```
이벤트 전 준비:
  □ 사전 부하 테스트 (예상 피크 × 2)
  □ HPA maxReplicas 충분히 설정
  □ DB 연결 풀 여유 확인
  □ CDN 캐시 미리 워밍
  □ 피처 플래그로 비핵심 기능 즉시 비활성화 준비
  □ 온콜 당직 강화 (이벤트 당일)

아키텍처 수준:
  □ 읽기 요청 DB 복제본으로 분산
  □ 결과 캐싱 (Redis)
  □ 비동기 처리 (이메일, 알림 큐잉)
  □ Circuit Breaker로 cascade failure 방지
```

---

## 참고 문서

- [K8s HPA Behavior](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/#configurable-scaling-behavior)
- [KEDA HTTP 스케일링](https://keda.sh/docs/2.14/scalers/http/)
