---
title: "Worker Node (kubelet, kube-proxy, 컨테이너 런타임)"
date: 2026-04-14
tags:
  - kubernetes
  - worker-node
  - kubelet
  - kube-proxy
  - containerd
sidebar_label: "Worker Node"
---

# Worker Node

## 1. Worker Node 구조

```
Worker Node
┌─────────────────────────────────────────────┐
│  kubelet                                    │
│  (API Server와 통신, Pod 수명주기 관리)     │
│           ↓ CRI (gRPC)                      │
│  Container Runtime (containerd)             │
│           ↓ OCI                             │
│  runc → 실제 컨테이너                       │
│                                             │
│  kube-proxy                                 │
│  (iptables/nftables 규칙으로 Service 구현)      │
└─────────────────────────────────────────────┘
```

---

## 2. kubelet

Node의 에이전트. Control Plane에서 Pod 스펙을 받아 실행한다.

### 주요 역할

- API Server를 Watch하여 이 Node에 배치된 Pod 감지
- CRI를 통해 컨테이너 생성/삭제
- Liveness/Readiness/Startup Probe 실행
- 리소스 사용량 수집 및 보고

### CRI 인터페이스

```
kubelet → CRI (gRPC) → containerd
                         ├── RuntimeService (컨테이너 생명주기)
                         └── ImageService (이미지 관리)
```

### Health Probe

```yaml
containers:
- name: app
  image: myapp:latest
  livenessProbe:      # 실패 시 컨테이너 재시작
    httpGet:
      path: /healthz
      port: 8080
    initialDelaySeconds: 15
    periodSeconds: 20
    failureThreshold: 3

  readinessProbe:     # 실패 시 Service 트래픽 차단
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 10

  startupProbe:       # 시작 완료 전까지 liveness 대기
    httpGet:
      path: /healthz
      port: 8080
    failureThreshold: 30
    periodSeconds: 10
```

| Probe | 실패 시 동작 |
|-------|------------|
| liveness | 컨테이너 재시작 |
| readiness | Service 트래픽 제거 (재시작 X) |
| startup | liveness/readiness 실행 보류 |

```bash
# kubelet 상태 확인
systemctl status kubelet
journalctl -u kubelet -f

# Pod 상세 정보 (Events 섹션 중요)
kubectl describe pod <pod-name>
```

---

## 3. kube-proxy

모든 Node에서 실행되며 Service의 네트워크 규칙을 관리한다.

### kube-proxy 모드 비교

> ⚠️ IPVS 모드는 K8s 1.35에서 deprecated, 1.36에서 제거 예정.
> 신규 클러스터는 **nftables** 모드 권장 (K8s 1.29 GA, kernel 5.13+).

| 항목 | iptables | nftables (권장) | IPVS (deprecated) |
|-----|---------|----------------|-------------------|
| 구현 방식 | 체인 규칙 순차 탐색 | nf_tables 서브시스템 | 커널 해시 테이블 |
| 확장성 | 느려짐 | 빠름 | 빠름 |
| LB 알고리즘 | random | random | rr, lc, dh 등 |
| 적합한 환경 | 레거시 환경 | 현재 권장 | 사용 비권장 |

### Service 트래픽 흐름

```
클라이언트 → ClusterIP:80
                  ↓
     iptables/IPVS 규칙 (kube-proxy가 설정)
                  ↓
     실제 Pod IP:8080 (여러 Pod 중 하나)
```

```bash
# kube-proxy 모드 확인 (data.config.conf 내 KubeProxyConfiguration 블록)
kubectl get configmap kube-proxy -n kube-system -o yaml

# iptables 규칙 확인 (Node에서)
sudo iptables -t nat -L -n | grep KUBE | head -20

# IPVS 규칙 확인
sudo ipvsadm -Ln

# Service와 연결된 Pod 목록 (K8s 1.33+ 권장)
kubectl get endpointslices -l kubernetes.io/service-name=<service-name>
# 구형 방법 (K8s 1.33에서 Endpoints API deprecated)
# kubectl get endpoints <service-name>
```

---

## 4. containerd (컨테이너 런타임)

K8s 1.24에서 dockershim이 제거되면서 CRI 호환 런타임을 직접 지정해야 한다.
대부분의 배포판(EKS, GKE, AKS, kubeadm)은 containerd를 기본으로 사용한다.

```
kubelet
   ↓ CRI (gRPC)
containerd
   ↓ OCI
runc → namespace/cgroup → 컨테이너
```

```bash
# containerd 상태
systemctl status containerd

# containerd 설정 파일
cat /etc/containerd/config.toml

# K8s 네임스페이스의 컨테이너 목록
crictl ps

# 이미지 목록
crictl images

# 컨테이너 로그
crictl logs <container-id>
```

---

## 5. Node 상태 확인

```bash
# Node 목록 및 상태
kubectl get nodes
kubectl get nodes -o wide   # IP 포함

# Node 상세 (Conditions, Capacity 확인)
kubectl describe node <node-name>

# 리소스 사용량
kubectl top nodes
kubectl top pods -A

# Node의 Pod 목록
kubectl get pods --field-selector spec.nodeName=<node-name> -A
```

### Node Conditions

| Condition | 의미 |
|-----------|------|
| `Ready` | 정상 (True여야 함) |
| `MemoryPressure` | 메모리 부족 위험 |
| `DiskPressure` | 디스크 공간 부족 |
| `PIDPressure` | 프로세스 수 과다 |
| `NetworkUnavailable` | 네트워크 플러그인 문제 |

---

## 참고 문서

- [kubelet](https://kubernetes.io/docs/reference/command-line-tools-reference/kubelet/)
- [kube-proxy](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-proxy/)
- [CRI](https://kubernetes.io/docs/concepts/architecture/cri/)
