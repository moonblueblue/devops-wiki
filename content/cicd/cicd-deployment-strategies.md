---
title: "무중단 배포 전략 (Rolling, Blue/Green, Canary)"
date: 2026-04-14
tags:
  - cicd
  - deployment
  - blue-green
  - canary
  - rolling
sidebar_label: "배포 전략"
---

# 무중단 배포 전략

## 1. Rolling Update

구버전 인스턴스를 하나씩 신버전으로 교체한다.

```
v1 v1 v1 v1
→ v2 v1 v1 v1
→ v2 v2 v1 v1
→ v2 v2 v2 v1
→ v2 v2 v2 v2
```

```yaml
# Kubernetes Deployment
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 최대 추가 Pod 수
      maxUnavailable: 0  # 중단 허용 Pod 수
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | 최소 |
| 롤백 속도 | 느림 (전체 재전환) |
| 다운타임 | 없음 |
| 쿠버네티스 기본 전략 | ✓ |

---

## 2. Blue/Green 배포

구버전(Blue)과 신버전(Green)을 동시에 운영하다가
트래픽을 한 번에 전환한다.

```
[전환 전]
Load Balancer → 100% → Blue(v1)
                        Green(v2) (준비 중)

[전환 후]
Load Balancer → 100% → Green(v2)
                Blue(v1) (롤백 대기)
```

```yaml
# Kubernetes Service 전환
# blue-service.yaml
spec:
  selector:
    version: blue   # → green 으로 변경하면 전환

# kubectl 전환
kubectl patch service myapp \
  -p '{"spec":{"selector":{"version":"green"}}}'
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | +100% (두 환경 동시 운영) |
| 롤백 속도 | 수초 (트래픽 재전환) |
| 다운타임 | 없음 |
| 적합 케이스 | DB 마이그레이션, 즉시 롤백 필요 |

---

## 3. Canary 배포

소수의 트래픽을 신버전으로 보내며 점진적으로 확대한다.

```
10% → v2    90% → v1  (검증 시작)
    ↓ 메트릭 정상
30% → v2    70% → v1
    ↓ 메트릭 정상
100% → v2              (전환 완료)
    ↓ 메트릭 이상
0% → v2               (즉시 롤백)
```

```yaml
# Kubernetes + Ingress-nginx 가중치
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"  # 10%
spec:
  rules:
  - http:
      paths:
      - path: /
        backend:
          service:
            name: myapp-v2
            port:
              number: 80
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | 최소 |
| 롤백 속도 | 즉시 (트래픽 0%로) |
| 실제 트래픽 검증 | ✓ |
| 필요 도구 | Ingress 가중치 또는 서비스 메시 |

---

## 4. Recreate (단순 재시작)

기존 버전을 모두 중단 후 신버전을 시작한다.
다운타임이 발생하므로 프로덕션에는 부적합하다.

```yaml
spec:
  strategy:
    type: Recreate   # 모두 내리고 새로 올림
```

| 항목 | 값 |
|-----|---|
| 다운타임 | 있음 |
| 인프라 비용 | 최소 |
| 적합 케이스 | 개발 환경, DB 스키마 변경 강제 시 |

---

## 5. 전략 비교

| 전략 | 비용 | 롤백 | 리스크 | 적합 케이스 |
|-----|------|------|--------|----------|
| Rolling | 낮음 | 느림 | 보통 | 일반적인 앱 |
| Blue/Green | 높음 | 즉시 | 낮음 | 즉시 롤백 필요 |
| Canary | 낮음 | 즉시 | 낮음 | 실사용자 검증 |
| Recreate | 최소 | 빠름 | 높음 | 개발 환경 |

---

## 참고 문서

- [Argo Rollouts](https://argoproj.github.io/argo-rollouts/)
- [Kubernetes Deployment Strategies](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#strategy)
