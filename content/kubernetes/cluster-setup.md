---
title: "클러스터 구축 방법 비교 (kubeadm, 매니지드, k3s, kind)"
date: 2026-04-14
tags:
  - kubernetes
  - kubeadm
  - eks
  - gke
  - aks
  - k3s
  - kind
sidebar_label: "클러스터 구축"
---

# 클러스터 구축 방법 비교

## 1. 방법별 비교

| 방법 | 환경 | 관리 부담 | 사용 시점 |
|-----|------|---------|---------|
| kubeadm | 온프레미스/VM | 높음 | 완전한 제어가 필요한 프로덕션 |
| EKS/GKE/AKS | 클라우드 | 낮음 | 클라우드 기반 프로덕션 |
| k3s | 엣지/IoT | 낮음 | 자원 제한 환경, 빠른 배포 |
| kind | 로컬 | 없음 | CI/CD, E2E 테스트 |
| minikube | 로컬 | 없음 | K8s 학습, 단순 개발 |

---

## 2. kubeadm

표준 K8s 클러스터를 구성하는 공식 도구다.

### 설치 흐름

```
1. 사전 준비
   - swap 비활성화: swapoff -a
   - kernel 모듈: overlay, br_netfilter
   - sysctl: net.bridge.bridge-nf-call-iptables=1
     (iptables 모드 기준. nftables 모드는 nf_tables 모듈 필요)
   - containerd 설치 후 cgroup driver를 systemd로 변경
     /etc/containerd/config.toml → SystemdCgroup = true
     systemctl restart containerd

2. kubeadm, kubelet, kubectl 설치

3. Control Plane 초기화
   kubeadm init --pod-network-cidr=10.244.0.0/16

4. CNI 플러그인 설치
   kubectl apply -f flannel.yaml  (또는 Calico, Cilium)

5. Worker Node 조인
   kubeadm join <CP-IP>:6443 --token <token> \
     --discovery-token-ca-cert-hash <hash>
```

```bash
# Control Plane 초기화
sudo kubeadm init \
  --pod-network-cidr=10.244.0.0/16 \
  --kubernetes-version=v1.33.0

# kubeconfig 설정
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config

# 조인 토큰 생성 (만료 후 재발급)
kubeadm token create --print-join-command

# 클러스터 업그레이드
kubeadm upgrade plan
kubeadm upgrade apply v1.33.x  # 클러스터 버전과 일치시킬 것
```

### HA 구성

```
[로드밸런서] ← kubectl
     ↓
[API Server 1] [API Server 2] [API Server 3]
[etcd 1]       [etcd 2]       [etcd 3]
     ↓
[Worker Node 1] [Worker Node 2] ...
```

```bash
# HA Control Plane 초기화
sudo kubeadm init \
  --control-plane-endpoint "<LB-IP>:6443" \
  --upload-certs \
  --pod-network-cidr=10.244.0.0/16

# 추가 Control Plane 노드 조인
sudo kubeadm join <LB-IP>:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash <hash> \
  --control-plane \
  --certificate-key <cert-key>
```

---

## 3. 매니지드 Kubernetes (클라우드)

Control Plane을 CSP가 관리한다. etcd 백업, API Server HA, 패치가 자동화된다.

| 항목 | EKS (AWS) | GKE (GCP) | AKS (Azure) |
|-----|---------|---------|-----------|
| Control Plane | AWS 관리 | GCP 관리 | Azure 관리 |
| 노드 자동 확장 | Karpenter/CA | Autopilot | CA + VMSS |
| 스토리지 | EBS, EFS | GCP PD | AzureDisk |
| LB | ALB/NLB | GCP LB | Azure LB |
| 인증 | IAM | Google IAM | Microsoft Entra ID |

```bash
# EKS
aws eks create-cluster \
  --name my-cluster \
  --version 1.33 \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/eks-role \
  --resources-vpc-config subnetIds=subnet-xxx,subnet-yyy
aws eks update-kubeconfig --name my-cluster --region ap-northeast-2

# GKE
gcloud container clusters create my-cluster \
  --zone asia-northeast3-a \
  --num-nodes 3 \
  --enable-autoscaling --min-nodes 1 --max-nodes 10
gcloud container clusters get-credentials my-cluster

# AKS
az aks create \
  --resource-group myRG \
  --name myCluster \
  --node-count 3 \
  --enable-cluster-autoscaler \
  --min-count 1 --max-count 10
az aks get-credentials --resource-group myRG --name myCluster
```

---

## 4. k3s (경량 K8s)

바이너리 한 개로 K8s를 실행한다.
엣지, IoT, 라즈베리파이, CI 환경에 적합하다.

| 항목 | 일반 K8s | k3s |
|-----|---------|-----|
| 바이너리 크기 | 100MB+ | ~60MB |
| 최소 메모리 | 2GB | 512MB |
| 설치 시간 | 10-15분 | ~30초 |
| 기본 etcd | 외부 필요 | SQLite(단일) / embedded etcd(HA) |
| 기본 CNI | 없음 | Flannel 내장 |

```bash
# 서버 설치
curl -sfL https://get.k3s.io | sh -

# 노드 조인 토큰 확인
sudo cat /var/lib/rancher/k3s/server/node-token

# Worker 노드 추가
curl -sfL https://get.k3s.io | \
  K3S_URL=https://<server-ip>:6443 \
  K3S_TOKEN=<token> \
  sh -

# 상태 확인
k3s kubectl get nodes
systemctl status k3s
```

---

## 5. kind (Kubernetes in Docker)

Docker 컨테이너 안에서 K8s 노드를 실행한다.
CI/CD 파이프라인과 멀티노드 테스트에 최적이다.

```bash
# 단일 노드 클러스터
kind create cluster --name dev

# 멀티노드 클러스터
cat > kind-config.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
- role: worker
- role: worker
EOF
kind create cluster --config kind-config.yaml

# 로컬 이미지 로드
kind load docker-image myapp:latest --name dev

# 클러스터 삭제
kind delete cluster --name dev
```

---

## 6. minikube (로컬 학습)

```bash
# 시작
minikube start --driver=docker --cpus=4 --memory=4g

# 유용한 add-on
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard

# 로컬 이미지 사용
eval $(minikube docker-env)
docker build -t myapp:latest .
# imagePullPolicy: Never 로 설정하면 로컬 이미지 사용

minikube delete
```

---

## 7. 선택 가이드

```
온프레미스/완전한 제어  → kubeadm
AWS 클라우드           → EKS
GCP 클라우드           → GKE
Azure 클라우드         → AKS
엣지/IoT/경량          → k3s
CI/CD 파이프라인        → kind
K8s 학습               → minikube or kind
```

---

## 참고 문서

- [kubeadm](https://kubernetes.io/docs/reference/setup-tools/kubeadm/)
- [EKS 문서](https://docs.aws.amazon.com/eks/latest/userguide/)
- [GKE 문서](https://cloud.google.com/kubernetes-engine/docs)
- [k3s 공식 문서](https://docs.k3s.io/)
- [kind 공식 문서](https://kind.sigs.k8s.io/)
