---
title: "Namespace, ResourceQuota, LimitRange"
date: 2026-04-14
tags:
  - kubernetes
  - namespace
  - resourcequota
  - limitrange
sidebar_label: "Namespace·Quota"
---

# Namespace, ResourceQuota, LimitRange

## 1. Namespace

클러스터를 논리적으로 격리하는 단위다.
팀별, 환경별(dev/staging/prod)로 분리하는 데 사용한다.

### 기본 Namespace

| Namespace | 용도 |
|-----------|------|
| `default` | 명시 안 하면 사용되는 기본값 |
| `kube-system` | K8s 시스템 컴포넌트 (API Server, DNS 등) |
| `kube-public` | 모든 사용자가 읽을 수 있는 공개 데이터 |
| `kube-node-lease` | Node heartbeat 관리 |

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    environment: prod
    team: backend
```

```bash
# Namespace 생성/조회
kubectl create namespace staging
kubectl get namespaces

# 특정 Namespace 리소스 조회
kubectl get pods -n production
kubectl get all -n production

# 기본 Namespace 변경 (context)
kubectl config set-context --current --namespace=production
```

---

## 2. ResourceQuota

**Namespace 전체**의 리소스 총량을 제한한다.
팀 또는 환경별 리소스 상한을 설정하는 데 사용한다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    # 컴퓨트
    requests.cpu: "20"        # 모든 Pod의 CPU request 합계
    requests.memory: "40Gi"   # 모든 Pod의 memory request 합계
    limits.cpu: "40"
    limits.memory: "80Gi"

    # 오브젝트 수
    pods: "200"
    services: "50"
    services.loadbalancers: "5"
    services.nodeports: "0"
    persistentvolumeclaims: "20"
    secrets: "50"
    configmaps: "50"
```

```bash
# ResourceQuota 확인 (사용량 포함)
kubectl describe resourcequota -n production
# 출력:
# Name: production-quota
# Resource          Used   Hard
# --------          ----   ----
# pods              12     200
# requests.cpu      3500m  20
# requests.memory   7Gi    40Gi
```

> ResourceQuota를 설정한 Namespace에서는
> 모든 Pod에 requests/limits가 반드시 있어야 한다.
> 없으면 Pod 생성이 거부된다. → LimitRange로 기본값 설정 필요.

---

## 3. LimitRange

**개별 Pod/Container**의 기본값과 상한/하한을 설정한다.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: production-limits
  namespace: production
spec:
  limits:
  - type: Container
    max:
      cpu: "4"
      memory: 8Gi
    min:
      cpu: 50m
      memory: 64Mi
    default:          # limits 미지정 시 이 값 사용
      cpu: 500m
      memory: 512Mi
    defaultRequest:   # requests 미지정 시 이 값 사용
      cpu: 250m
      memory: 256Mi

  - type: PersistentVolumeClaim
    max:
      storage: 100Gi
    min:
      storage: 1Gi
```

### 동작 원리

```
Container에 resources 미지정
    ↓
LimitRange의 defaultRequest → requests에 적용
LimitRange의 default        → limits에 적용

Container의 limits가 max 초과
    ↓ Pod 생성 거부

Container의 requests가 min 미만
    ↓ Pod 생성 거부
```

---

## 4. 실무 패턴

### 환경별 Namespace + 쿼타

```yaml
# production: 엄격한 제한
---
apiVersion: v1
kind: Namespace
metadata:
  name: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: quota
  namespace: production
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    pods: "500"
    services.nodeports: "0"  # NodePort 금지
---
apiVersion: v1
kind: LimitRange
metadata:
  name: limits
  namespace: production
spec:
  limits:
  - type: Container
    defaultRequest:
      cpu: 500m
      memory: 512Mi
    default:
      cpu: "1"
      memory: 1Gi
    max:
      cpu: "4"
      memory: 8Gi

# development: 느슨한 제한
---
apiVersion: v1
kind: Namespace
metadata:
  name: development
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: quota
  namespace: development
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 40Gi
    pods: "100"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: limits
  namespace: development
spec:
  limits:
  - type: Container
    defaultRequest:
      cpu: 100m
      memory: 128Mi
    default:
      cpu: 500m
      memory: 512Mi
```

```bash
# 리소스 사용 현황 확인
kubectl describe quota -n production
kubectl describe limitrange -n production

# 네임스페이스 전체 리소스 보기
kubectl top pods -n production --sort-by=cpu
```

---

## 참고 문서

- [Namespaces](https://kubernetes.io/docs/concepts/overview/working-with-objects/namespaces/)
- [ResourceQuota](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
- [LimitRange](https://kubernetes.io/docs/concepts/policy/limit-range/)
