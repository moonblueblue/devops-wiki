---
title: "파드 배치 전략 (Affinity, Taint/Toleration)"
date: 2026-04-14
tags:
  - kubernetes
  - scheduling
  - affinity
  - taint
  - toleration
sidebar_label: "파드 배치 전략"
---

# 파드 배치 전략

## 1. 배치 전략 비교

| 전략 | 설정 위치 | 용도 |
|-----|---------|------|
| NodeSelector | Pod spec | 단순한 Node 선택 |
| Node Affinity | Pod spec | 세밀한 Node 선택 (필수/선호) |
| Pod Affinity | Pod spec | 특정 Pod와 같은 Node에 |
| Pod Anti-Affinity | Pod spec | 특정 Pod와 다른 Node에 |
| Taint | Node | Node에 조건 부여 (차단) |
| Toleration | Pod spec | Taint 허용 |
| TopologySpreadConstraints | Pod spec | 균등 분산 |

---

## 2. NodeSelector

라벨 일치로 Node를 선택한다. 단순하지만 유연성이 부족하다.

```bash
# Node에 라벨 추가
kubectl label nodes node-1 disktype=ssd
kubectl label nodes node-2 disktype=ssd
```

```yaml
spec:
  nodeSelector:
    disktype: ssd
  containers:
  - name: app
    image: myapp:latest
```

---

## 3. Node Affinity

`required` (필수) vs `preferred` (선호) 두 가지 모드가 있다.

```yaml
spec:
  affinity:
    nodeAffinity:
      # 필수: 이 조건을 만족하는 Node가 없으면 Pending
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values: [amd64]
          - key: node-type
            operator: NotIn
            values: [gpu-node]

      # 선호: 가능하면 이 Node에, 없으면 다른 Node도 허용
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100        # 0-100, 높을수록 우선
        preference:
          matchExpressions:
          - key: disktype
            operator: In
            values: [ssd]
      - weight: 50
        preference:
          matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values: [ap-northeast-2a]
```

### matchExpressions 연산자

| 연산자 | 의미 |
|-------|------|
| `In` | values 중 하나 |
| `NotIn` | values에 없음 |
| `Exists` | 키만 존재 |
| `DoesNotExist` | 키 없음 |
| `Gt` / `Lt` | 숫자 비교 |

---

## 4. Pod Affinity / Anti-Affinity

다른 Pod의 위치를 기준으로 배치한다.

```yaml
spec:
  affinity:
    # 같은 Node에 Redis가 있으면 선호 (지연 최소화)
    podAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: redis
          topologyKey: kubernetes.io/hostname

    # 같은 앱의 Pod들을 다른 Node에 분산 (고가용성)
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: myapp
        topologyKey: kubernetes.io/hostname
```

**topologyKey 예시:**

| topologyKey | 분산 단위 |
|------------|---------|
| `kubernetes.io/hostname` | Node |
| `topology.kubernetes.io/zone` | 가용 영역 |
| `topology.kubernetes.io/region` | 리전 |

---

## 5. Taint & Toleration

**Taint**: Node에 "이 Pod만 허용" 조건을 설정한다.
**Toleration**: Pod에서 Taint를 허용한다.

```bash
# Node에 Taint 추가
kubectl taint nodes gpu-node gpu=true:NoSchedule
kubectl taint nodes maintenance-node maintenance=true:NoExecute

# Taint 제거 (끝에 - 붙임)
kubectl taint nodes gpu-node gpu=true:NoSchedule-

# Taint 확인
kubectl describe node gpu-node | grep Taints
```

### Taint Effect

| Effect | 동작 |
|--------|------|
| `NoSchedule` | Toleration 없으면 새 Pod 스케줄 불가 |
| `PreferNoSchedule` | 가능하면 회피 |
| `NoExecute` | 기존 실행 중인 Pod도 제거 |

```yaml
spec:
  tolerations:
  # GPU Taint 허용 (GPU 워크로드)
  - key: gpu
    operator: Equal
    value: "true"
    effect: NoSchedule

  # 유지보수 Taint 허용 (300초 후 제거)
  - key: maintenance
    operator: Exists
    effect: NoExecute
    tolerationSeconds: 300

  # Control Plane 노드에도 배포 (DaemonSet 등)
  - key: node-role.kubernetes.io/control-plane
    operator: Exists
    effect: NoSchedule
```

---

## 6. TopologySpreadConstraints

Pod을 Zone/Node에 균등하게 분산한다.

```yaml
spec:
  topologySpreadConstraints:
  # Zone에 균등 분산 (편차 최대 1)
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: myapp

  # Node에 균등 분산 (편차 최대 2, 불가능하면 그냥 배포)
  - maxSkew: 2
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app: myapp
```

| whenUnsatisfiable | 동작 |
|------------------|------|
| `DoNotSchedule` | 조건 불만족 시 Pending |
| `ScheduleAnyway` | 조건 불만족해도 배포 |

---

## 참고 문서

- [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/)
- [TopologySpreadConstraints](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)
