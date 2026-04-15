---
title: "Pod, ReplicaSet, Deployment"
date: 2026-04-14
tags:
  - kubernetes
  - pod
  - deployment
  - replicaset
sidebar_label: "Pod·Deployment"
---

# Pod, ReplicaSet, Deployment

## 1. 관계도

```
Deployment
    ↓ 관리
ReplicaSet (버전별로 생성됨)
    ↓ 관리
Pod × N
    ↓ 포함
Container(s)
```

직접 Pod를 만들지 말고 Deployment를 통해 관리하라.
Deployment가 ReplicaSet을, ReplicaSet이 Pod을 관리한다.

---

## 2. Pod

K8s의 최소 배포 단위. 하나 이상의 컨테이너를 포함한다.
같은 Pod의 컨테이너는 네트워크 네임스페이스를 공유한다 (localhost 통신 가능).

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  initContainers:          # 메인 컨테이너 실행 전 완료
  - name: init-db-check
    image: busybox:1.37
    command:
    - sh
    - -c
    - until nc -z db 5432; do sleep 1; done

  containers:
  - name: app
    image: myapp:1.0.0
    ports:
    - containerPort: 8080
    resources:
      requests:            # 스케줄링 기준
        cpu: 250m
        memory: 256Mi
      limits:              # 최대 사용량
        cpu: 500m
        memory: 512Mi

  - name: sidecar          # 로깅, 프록시 등 부가 기능
    image: fluent/fluent-bit:3.3
```

---

## 3. ReplicaSet

Pod 개수를 보장한다. 보통 직접 만들지 않고 Deployment가 생성한다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: myapp-rs
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:1.0.0
```

---

## 4. Deployment

선언형으로 애플리케이션을 배포하고 업데이트한다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 동시에 추가 생성 가능한 Pod 수 (기본값 25%)
      maxUnavailable: 1  # 동시에 Unavailable 허용 Pod 수 (Ready 아닌 상태, 기본값 25%)
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:1.0.0
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 20
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            cpu: 250m
            memory: 256Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

### 업데이트 전략

| 전략 | 동작 | 다운타임 |
|-----|------|---------|
| `RollingUpdate` | 점진적 교체 (기본값) | 없음 |
| `Recreate` | 전체 삭제 후 재생성 | 있음 |

---

## 5. 주요 명령어

```bash
# 배포
kubectl apply -f deployment.yaml

# 이미지 업데이트
kubectl set image deployment/myapp app=myapp:2.0.0

# 롤아웃 상태 확인
kubectl rollout status deployment/myapp

# 히스토리 확인
kubectl rollout history deployment/myapp

# 롤백
kubectl rollout undo deployment/myapp
kubectl rollout undo deployment/myapp --to-revision=2

# 스케일
kubectl scale deployment myapp --replicas=5

# 일시 중지 / 재개 (여러 변경사항 일괄 적용 시)
kubectl rollout pause deployment/myapp
kubectl set image deployment/myapp app=myapp:2.0.0
kubectl set env deployment/myapp ENV=prod
kubectl rollout resume deployment/myapp
```

---

## 참고 문서

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Pods](https://kubernetes.io/docs/concepts/workloads/pods/)
