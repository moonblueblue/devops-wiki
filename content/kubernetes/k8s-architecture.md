---
title: "쿠버네티스 클러스터 구성요소"
date: 2026-04-14
tags:
  - kubernetes
  - architecture
  - control-plane
  - worker-node
sidebar_label: "클러스터 구성요소"
---

# 쿠버네티스 클러스터 구성요소

## 1. 클러스터 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                     │
├──────────────────────┬──────────────────────────────────┤
│   Control Plane      │        Worker Nodes              │
│                      │                                  │
│  kube-apiserver      │  ┌──────────────────────────┐   │
│  etcd                │  │ Worker Node              │   │
│  kube-scheduler      │  │  kubelet                 │   │
│  controller-manager  │──│  kube-proxy              │   │
│  cloud-ctrl-manager  │  │  container runtime       │   │
│                      │  └──────────────────────────┘   │
│                      │  (× N 개)                        │
└──────────────────────┴──────────────────────────────────┘
```

---

## 2. 구성요소 역할 요약

### Control Plane

| 구성요소 | 역할 |
|---------|------|
| `kube-apiserver` | 모든 API 요청 수신, 인증/인가/Admission |
| `etcd` | 클러스터 상태 저장 (Raft 합의) |
| `kube-scheduler` | Pod을 적절한 Worker Node에 배치 |
| `kube-controller-manager` | Deployment, ReplicaSet 등 제어 루프 실행 |
| `cloud-controller-manager` | AWS/GCP/Azure 등 CSP API 연동 |

### Worker Node

| 구성요소 | 역할 |
|---------|------|
| `kubelet` | Pod 수명주기 관리, CRI 호출 |
| `kube-proxy` | Service 트래픽 라우팅 (iptables/nftables 권장, IPVS는 K8s 1.35 deprecated·1.36 제거 예정) |
| `container runtime` | 실제 컨테이너 실행 (containerd) |

---

## 3. 요청 흐름

```
kubectl apply -f pod.yaml
         ↓
kube-apiserver (인증 → 인가 → Admission)
         ↓
etcd (상태 저장)
         ↓
kube-scheduler (배치할 Node 선택)
         ↓
kubelet (Worker Node에서 실행)
         ↓
container runtime (컨테이너 생성)
```

---

## 4. HA (고가용성) 구성

단일 Control Plane은 단일 장애점(SPOF)이다.
프로덕션은 최소 3개 Control Plane이 필요하다.

```
단일 Master:
  [Control Plane] → SPOF

HA 구성 (3 Masters):
  [API Server 1]
  [API Server 2]  ← Load Balancer
  [API Server 3]

  [etcd 1]
  [etcd 2]  ← Raft 합의 (과반수 = floor(N/2)+1 이상 동의 필요)
  [etcd 3]
```

**etcd Quorum 규칙:**
- 3 노드: 1개 장애 허용
- 5 노드: 2개 장애 허용
- 짝수 노드는 의미 없음 (4 = 3과 동일)

---

## 5. 주요 확인 명령어

```bash
# 클러스터 구성요소 상태
# ⚠️ kubectl get componentstatus는 K8s 1.19부터 deprecated
# 대신 아래 방법 사용
kubectl get pods -n kube-system
curl -s https://<api-server>/healthz  # API 서버 상태
curl -s https://<api-server>/readyz   # 준비 상태

# 시스템 Pod 전체 확인
kubectl get pods -n kube-system

# Node 상태
kubectl get nodes
kubectl describe node <node-name>
```

---

## 참고 문서

- [K8s 클러스터 아키텍처](https://kubernetes.io/docs/concepts/architecture/)
- [Control Plane 컴포넌트](https://kubernetes.io/docs/concepts/overview/components/)
