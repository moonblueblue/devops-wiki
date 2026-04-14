---
title: "리소스 관리와 오토스케일링 (HPA, VPA, Karpenter)"
date: 2026-04-14
tags:
  - kubernetes
  - hpa
  - vpa
  - autoscaling
  - karpenter
  - cluster-autoscaler
sidebar_label: "오토스케일링"
---

# 리소스 관리와 오토스케일링

## 1. 스케일링 종류 비교

| 종류 | 대상 | 기준 | 도구 |
|-----|------|------|------|
| HPA | Pod 수 | CPU/메모리/커스텀 메트릭 | 쿠버네티스 내장 |
| VPA | Pod 리소스 | 실제 사용량 | addon |
| Cluster Autoscaler | Node 수 | Pending Pod | addon |
| Karpenter | Node 수 | Pending Pod + 비용 최적화 | addon (AWS) |

---

## 2. HPA (Horizontal Pod Autoscaler)

Pod 수를 자동으로 조절한다.
`autoscaling/v2`가 현재 안정 버전이다.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: myapp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  minReplicas: 2
  maxReplicas: 20
  metrics:
  # CPU 사용률 기준
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60

  # 메모리 사용량 기준
  - type: Resource
    resource:
      name: memory
      target:
        type: AverageValue
        averageValue: 512Mi

  # 커스텀 메트릭 (Prometheus Adapter 필요)
  - type: Pods
    pods:
      metric:
        name: requests_per_second
      target:
        type: AverageValue
        averageValue: 1000
```

### Behavior (스케일 속도 제어)

```yaml
spec:
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60   # 1분 관찰 후 ScaleUp
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60              # 60초마다 최대 100% 증가
    scaleDown:
      stabilizationWindowSeconds: 300  # 5분 관찰 후 ScaleDown
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60             # 60초마다 최대 2개 감소
```

```bash
# HPA 상태 확인
kubectl get hpa
kubectl describe hpa myapp-hpa
```

---

## 3. VPA (Vertical Pod Autoscaler)

Pod의 CPU/메모리 requests를 자동으로 조정한다.
별도 설치 필요 (metrics-server + VPA addon).

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: myapp-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: myapp
  updatePolicy:
    updateMode: "Auto"   # Off, Initial, Recreate, Auto
  resourcePolicy:
    containerPolicies:
    - containerName: app
      minAllowed:
        cpu: 100m
        memory: 128Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi
```

### updateMode 비교

| 모드 | 동작 |
|-----|------|
| `Off` | 권장값만 표시, 적용 안 함 |
| `Initial` | Pod 최초 생성 시에만 적용 |
| `Recreate` | 범위 초과 시 Pod 재시작 |
| `Auto` | 자동 업데이트 (현재 Recreate와 동일) |

```bash
# VPA 권장값 확인
kubectl describe vpa myapp-vpa
# Recommendation:
#   Container Recommendations:
#     Container Name: app
#     Lower Bound:    cpu: 50m, memory: 64Mi
#     Target:         cpu: 200m, memory: 256Mi
#     Upper Bound:    cpu: 500m, memory: 512Mi
```

> HPA와 VPA는 CPU 기준으로 동시 사용 불가.
> VPA `Off` 모드로 권장값 참고 후 HPA 적용이 일반적이다.

---

## 4. Cluster Autoscaler

Pending Pod 발생 시 Node를 추가하고,
리소스가 여유로울 때 Node를 제거한다.

```yaml
# AWS Auto Scaling Group 기반
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - name: cluster-autoscaler
        image: registry.k8s.io/autoscaling/cluster-autoscaler:v1.29.0
        command:
        - ./cluster-autoscaler
        - --cloud-provider=aws
        - --namespace=kube-system
        - --nodes=2:10:my-node-group  # min:max:ASG명
        - --scale-down-enabled=true
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
```

```bash
# Cluster Autoscaler 로그 확인
kubectl logs -n kube-system \
  -l app=cluster-autoscaler -f

# 노드 스케일 이벤트 확인
kubectl get events -n kube-system \
  --field-selector reason=TriggeredScaleUp
```

---

## 5. Karpenter

AWS에서 Cluster Autoscaler를 대체하는 차세대 오토스케일러다.
ASG 없이 직접 EC2를 프로비저닝한다.

```yaml
# NodePool (v1 API, Karpenter v0.33+)
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["on-demand", "spot"]
      - key: node.kubernetes.io/instance-type
        operator: In
        values: ["m5.large", "m5.xlarge", "m6i.large"]
      - key: kubernetes.io/arch
        operator: In
        values: ["amd64"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
  limits:
    cpu: 100              # 클러스터 전체 CPU 상한
    memory: 400Gi
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
---
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2023
  role: KarpenterNodeRole
  subnetSelectorTerms:
  - tags:
      karpenter.sh/discovery: my-cluster
  securityGroupSelectorTerms:
  - tags:
      karpenter.sh/discovery: my-cluster
```

### Cluster Autoscaler vs Karpenter

| 항목 | Cluster Autoscaler | Karpenter |
|-----|-------------------|-----------|
| 프로비저닝 | ASG 기반 | 직접 EC2 생성 |
| 속도 | ~수분 | ~수십 초 |
| 인스턴스 선택 | 고정 (ASG 설정) | 동적 (요구사항 기반) |
| Spot 지원 | 제한적 | 강력 (자동 다변화) |
| 플랫폼 | 멀티 클라우드 | AWS 전용 |

---

## 6. 스케일링 도구 선택 가이드

```
요청량 변화가 심한 워크로드
  → HPA (CPU/커스텀 메트릭 기반)

적정 리소스 산정이 어려운 경우
  → VPA Off 모드로 권장값 수집 후 requests 설정

Node 수 자동 조절이 필요한 경우
  → AWS: Karpenter
  → GCP/Azure/온프레미스: Cluster Autoscaler

비용 최적화 + 빠른 프로비저닝
  → Karpenter (Spot 자동 활용)
```

---

## 참고 문서

- [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [VPA](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [Cluster Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler)
- [Karpenter](https://karpenter.sh/docs/)
