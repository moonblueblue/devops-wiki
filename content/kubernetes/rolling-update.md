---
title: "롤링 업데이트와 롤백"
date: 2026-04-14
tags:
  - kubernetes
  - deployment
  - rolling-update
  - rollback
  - canary
sidebar_label: "롤링 업데이트·롤백"
---

# 롤링 업데이트와 롤백

## 1. 업데이트 전략 비교

| 전략 | 다운타임 | 속도 | 용도 |
|-----|---------|------|------|
| `RollingUpdate` | 없음 | 점진적 | 기본값, 무중단 배포 |
| `Recreate` | 있음 | 빠름 | DB 마이그레이션, 단일 인스턴스 |

---

## 2. RollingUpdate 파라미터

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1   # 동시에 Unavailable 허용 Pod 수
      maxSurge: 1         # 초과 생성 허용 Pod 수
  replicas: 4
```

### maxUnavailable / maxSurge 예시

replicas=4 기준:

| 설정 | 의미 |
|-----|------|
| `maxUnavailable: 1, maxSurge: 1` | 최소 3개 유지, 최대 5개 동시 실행 |
| `maxUnavailable: 0, maxSurge: 1` | 항상 4개 유지 (안전 중시) |
| `maxUnavailable: 25%, maxSurge: 25%` | 기본값 |

- `maxUnavailable: 0` → 구버전 제거 전 신버전 먼저 생성
- `maxSurge: 0` → 구버전 제거 후 신버전 생성 (리소스 부족 시)

---

## 3. 업데이트 실행

```bash
# 이미지 업데이트
kubectl set image deployment/myapp \
  app=myapp:v2.0.0

# YAML로 적용
kubectl apply -f deployment.yaml

# 진행 상태 확인
kubectl rollout status deployment/myapp
# Waiting for deployment "myapp" rollout to finish...
# deployment "myapp" successfully rolled out

# 롤아웃 일시 중단 (문제 감지 시)
kubectl rollout pause deployment/myapp

# 재개
kubectl rollout resume deployment/myapp
```

---

## 4. 롤백

```bash
# 이전 버전으로 즉시 롤백
kubectl rollout undo deployment/myapp

# 특정 revision으로 롤백
kubectl rollout undo deployment/myapp --to-revision=2

# 롤아웃 이력 확인
kubectl rollout history deployment/myapp
# REVISION  CHANGE-CAUSE
# 1         kubectl apply --record
# 2         image update to v2.0.0
# 3         image update to v3.0.0

# 특정 revision 상세 확인
kubectl rollout history deployment/myapp --revision=2
```

### CHANGE-CAUSE 기록

```bash
# --record 플래그 (deprecated, 대신 annotation 사용)
kubectl annotate deployment/myapp \
  kubernetes.io/change-cause="v2.0.0: feat - 결제 모듈 추가"
```

---

## 5. Recreate 전략

```yaml
spec:
  strategy:
    type: Recreate
  # 전체 Pod 종료 후 새 버전 시작
  # 다운타임 발생하지만 두 버전 동시 실행 없음
```

---

## 6. 배포 패턴

### Canary 배포

트래픽 일부만 신버전으로 보내 검증한다.

```yaml
# 구버전 Deployment (9개 Pod)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-stable
spec:
  replicas: 9
  selector:
    matchLabels:
      app: myapp
      version: stable
  template:
    metadata:
      labels:
        app: myapp
        version: stable
---
# 신버전 Deployment (1개 Pod → 10% 트래픽)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
      version: canary
  template:
    metadata:
      labels:
        app: myapp
        version: canary
---
# Service는 app: myapp으로 두 버전 모두 선택
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  selector:
    app: myapp   # version 라벨 없음 → 전체 선택
```

### Blue-Green 배포

구버전(blue)과 신버전(green)을 동시에 운영 후
Service의 selector를 전환한다.

```yaml
# Blue Deployment (현재 운영)
metadata:
  name: myapp-blue
  labels:
    version: blue

# Green Deployment (신버전 준비)
metadata:
  name: myapp-green
  labels:
    version: green

# Service selector 전환
kubectl patch service myapp \
  -p '{"spec":{"selector":{"version":"green"}}}'

# 검증 후 blue 제거
kubectl delete deployment myapp-blue
```

---

## 7. 배포 검증

```bash
# 현재 ReplicaSet 상태
kubectl get rs -l app=myapp
# NAME              DESIRED  CURRENT  READY
# myapp-7d9f8b6c4   4        4        4     ← 신버전
# myapp-5c8b9d7f2   0        0        0     ← 구버전 (보존)

# Pod 업데이트 확인
kubectl get pods -l app=myapp \
  -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}'

# revision 개수 제한 (기본 10)
spec:
  revisionHistoryLimit: 5
```

---

## 참고 문서

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Rolling Update Strategy](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
