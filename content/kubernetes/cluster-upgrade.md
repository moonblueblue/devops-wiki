---
title: "클러스터 버전 업그레이드"
date: 2026-04-14
tags:
  - kubernetes
  - upgrade
  - kubeadm
  - maintenance
sidebar_label: "클러스터 업그레이드"
---

# 클러스터 버전 업그레이드

## 1. 업그레이드 원칙

```
업그레이드 순서: Control Plane → Worker Node
버전 정책: 한 번에 minor 버전 1개씩 (1.29 → 1.30 → 1.31)
```

### Version Skew Policy

| 컴포넌트 | 허용 버전 차이 |
|---------|-------------|
| kube-apiserver | N (기준) |
| controller-manager, scheduler | N-1 |
| kubelet | N-3 (K8s 1.28+) |
| kube-proxy | N-3 (K8s 1.28+) |
| kubectl | N-1 ~ N+1 |

- apiserver가 항상 가장 높은 버전이어야 한다.

---

## 2. kubeadm 업그레이드

### Control Plane 업그레이드

> K8s 1.28+ 패키지는 `pkgs.k8s.io` 공식 레포를 사용한다.
> 마이너 버전 업그레이드 시 레포 URL도 함께 변경해야 한다.

```bash
# 0. 레포 URL 업그레이드 (예: 1.30 → 1.31)
# /etc/apt/sources.list.d/kubernetes.list 편집
sed -i 's|/v1.30/|/v1.31/|' /etc/apt/sources.list.d/kubernetes.list
apt-get update

# 1. kubeadm 업그레이드
apt-mark unhold kubeadm
apt-get install -y kubeadm=1.31.0-1.1
apt-mark hold kubeadm

# 2. 업그레이드 계획 확인
kubeadm upgrade plan

# 3. 업그레이드 실행 (첫 번째 Control Plane만)
kubeadm upgrade apply v1.31.0

# HA 클러스터의 추가 Control Plane 노드는 아래 명령 사용
# kubeadm upgrade node

# 4. kubelet, kubectl 업그레이드
apt-mark unhold kubelet kubectl
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubelet kubectl

# 5. kubelet 재시작
systemctl daemon-reload
systemctl restart kubelet

# 6. 버전 확인
kubectl version
kubectl get nodes
```

### Worker Node 업그레이드

```bash
# 1. 노드 격리 (신규 Pod 스케줄 중단 + 기존 Pod 이전)
kubectl drain node-1 \
  --ignore-daemonsets \
  --delete-emptydir-data

# 2. Worker Node에서 패키지 업그레이드
# 레포 URL 업그레이드 (Control Plane과 동일하게)
sed -i 's|/v1.30/|/v1.31/|' /etc/apt/sources.list.d/kubernetes.list
apt-get update
apt-mark unhold kubeadm kubelet kubectl
apt-get install -y kubeadm=1.31.0-1.1
kubeadm upgrade node
apt-get install -y kubelet=1.31.0-1.1 kubectl=1.31.0-1.1
apt-mark hold kubeadm kubelet kubectl

# 3. kubelet 재시작
systemctl daemon-reload
systemctl restart kubelet

# 4. 노드 복구 (스케줄 재개)
kubectl uncordon node-1
```

---

## 3. 매니지드 K8s 업그레이드

### EKS

```bash
# Control Plane 업그레이드
aws eks update-cluster-version \
  --name my-cluster \
  --kubernetes-version 1.31

# 진행 상태 확인
aws eks describe-update \
  --name my-cluster \
  --update-id <update-id>

# 노드 그룹 업그레이드
aws eks update-nodegroup-version \
  --cluster-name my-cluster \
  --nodegroup-name my-nodegroup \
  --kubernetes-version 1.31
```

### GKE

```bash
# Control Plane 업그레이드
gcloud container clusters upgrade my-cluster \
  --master \
  --cluster-version 1.31

# 노드 풀 업그레이드
gcloud container clusters upgrade my-cluster \
  --node-pool my-pool \
  --cluster-version 1.31
```

### AKS

```bash
# 업그레이드 가능 버전 확인
az aks get-upgrades \
  --resource-group my-rg \
  --name my-cluster

# 업그레이드 실행
az aks upgrade \
  --resource-group my-rg \
  --name my-cluster \
  --kubernetes-version 1.31.0
```

---

## 4. 업그레이드 전 체크리스트

```bash
# 1. 현재 버전 확인
kubectl version
kubectl get nodes

# 2. 클러스터 상태 확인
kubectl get pods -A | grep -v Running
kubectl get nodes

# 3. etcd 백업 (kubeadm 클러스터)
ETCDCTL_API=3 etcdctl snapshot save \
  /backup/etcd-snapshot-$(date +%Y%m%d).db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key

# 4. 변경 내역 확인
# https://kubernetes.io/releases/

# 5. deprecated API 확인
kubectl api-resources
kubectl get --raw /apis | python3 -m json.tool
```

---

## 5. Deprecated API 마이그레이션

```bash
# 사용 중인 deprecated API 확인
kubectl get pods -A \
  -o jsonpath='{range .items[*]}{.apiVersion}{"\n"}{end}' \
  | sort | uniq

# pluto로 deprecated API 스캔 (Helm/YAML)
pluto detect-files -d ./manifests
pluto detect-helm --helm-version 3
```

| 버전 | 변경 사항 |
|-----|---------|
| v1.25 | PodSecurityPolicy 제거 |
| v1.26 | FlowSchema/PriorityLevelConfig v1beta1 제거 |
| v1.29 | flowcontrol.apiserver.k8s.io/v1beta2 제거 |
| v1.32 | flowcontrol.apiserver.k8s.io/v1beta3 제거 |
| v1.33 | Endpoints API deprecated, `status.nodeInfo.kubeProxyVersion` 필드 제거 |

---

## 6. 업그레이드 후 검증

```bash
# 노드 상태
kubectl get nodes

# 시스템 Pod 상태
kubectl get pods -n kube-system

# 핵심 워크로드 상태
kubectl get deployments -A
kubectl get daemonsets -A

# API 서버 버전 (--short는 K8s 1.28에서 제거됨)
kubectl version
```

---

## 참고 문서

- [Upgrading kubeadm clusters](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/)
- [Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/)
- [EKS Upgrade](https://docs.aws.amazon.com/eks/latest/userguide/update-cluster.html)
