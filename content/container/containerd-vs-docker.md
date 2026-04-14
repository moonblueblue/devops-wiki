---
title: "containerd vs Docker Engine"
date: 2026-04-14
tags:
  - container
  - docker
  - containerd
  - runtime
  - kubernetes
sidebar_label: "containerd vs Docker"
---

# containerd vs Docker Engine

## 1. Docker Engine 아키텍처

Docker CLI 명령이 컨테이너에 도달하기까지의 경로:

```
docker run nginx
      ↓
Docker CLI
      ↓ REST API
dockerd (Docker Daemon)
      ↓ gRPC
containerd
      ↓ OCI Runtime
runc
      ↓
Linux Kernel (namespaces, cgroups)
```

Docker Engine은 내부에서 이미 containerd를 사용한다.
`dockerd`는 네트워크, 스토리지, 이미지 관리 등 상위 오케스트레이션을 담당한다.

---

## 2. K8s에서 containerd 단독 사용

Kubernetes는 CRI(Container Runtime Interface)를 통해 런타임과 통신한다.
Docker는 CRI를 직접 구현하지 않아 별도 shim이 필요했다.
2022년 K8s 1.24부터 dockershim이 제거되었고,
2026년 기준 거의 모든 클러스터가 containerd를 직접 사용한다.

```
kubelet
   ↓ CRI (gRPC)
containerd (CRI 플러그인 포함)
   ↓ OCI Runtime
runc
   ↓
Linux Kernel
```

```bash
# K8s 노드의 런타임 확인
kubectl get nodes \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.nodeInfo.containerRuntimeVersion}{"\n"}{end}'
# 출력 예: node1  containerd://1.7.14
```

---

## 3. crictl — K8s 노드 디버깅 CLI

`crictl`은 CRI 호환 런타임을 직접 제어하는 디버깅 도구다.
K8s 노드에서 컨테이너 문제를 진단할 때 사용한다.

```bash
# crictl 설정
cat > /etc/crictl.yaml <<EOF
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
EOF
```

| 기능 | docker | crictl |
|-----|--------|--------|
| 이미지 목록 | `docker images` | `crictl images` |
| 컨테이너 목록 | `docker ps -a` | `crictl ps -a` |
| 로그 확인 | `docker logs` | `crictl logs` |
| 명령 실행 | `docker exec` | `crictl exec` |
| 상세 정보 | `docker inspect` | `crictl inspect` |
| Pod 목록 | 없음 | `crictl pods` |

```bash
# 실무 사용 예시
crictl ps -a                        # 모든 컨테이너
crictl logs <container-id>          # 로그 확인
crictl exec -it <container-id> sh   # 컨테이너 접속
crictl images                       # 이미지 목록
crictl rmi <image-id>               # 이미지 삭제
```

> `crictl`은 K8s 노드 디버깅 전용이다.
> 일반 개발에는 `docker` 또는 `nerdctl`을 사용하라.

---

## 4. nerdctl — Docker 호환 containerd CLI

Docker 명령어와 거의 동일한 인터페이스로 containerd를 직접 제어한다.

```bash
# 설치 (Linux)
wget https://github.com/containerd/nerdctl/releases/latest/download/nerdctl-2.0.0-linux-amd64.tar.gz
sudo tar -xf nerdctl-2.0.0-linux-amd64.tar.gz -C /usr/local/bin

# Docker와 동일한 명령어
nerdctl run -d --name nginx -p 80:80 nginx:latest
nerdctl ps
nerdctl logs nginx
nerdctl exec -it nginx sh

# Compose 지원
nerdctl compose up -d

# K8s 네임스페이스 확인
nerdctl --namespace k8s.io ps
```

---

## 5. Podman — Daemon-less 대안

Red Hat 생태계(RHEL, Fedora)의 기본 컨테이너 도구다.

```
Docker:    CLI → dockerd → containerd → runc
Podman:    CLI             ────────── → runc
           (데몬 없음, 직접 OCI 런타임 호출)
```

| 항목 | Docker | Podman |
|-----|--------|--------|
| 데몬 | 있음 | 없음 |
| Rootless | 복잡 | 네이티브 |
| Pod 지원 | 없음 | 네이티브 |
| K8s 호환 | 간접 | 높음 |
| 보안 | 표준 | 더 안전 (daemon-less) |

```bash
# Docker와 동일한 명령어 (alias 가능)
podman run -d --name nginx nginx:latest
podman ps
podman logs nginx

# Pod 생성 (K8s 스타일)
podman pod create --name web-pod -p 80:80
podman run -d --pod web-pod nginx:latest
```

---

## 6. 2026년 K8s 런타임 현황

| 환경 | 기본 런타임 | 비고 |
|-----|-----------|------|
| EKS (AWS) | containerd | Docker 제거됨 |
| GKE (Google) | containerd | Docker 제거됨 |
| AKS (Azure) | containerd | Docker 제거됨 |
| kubeadm | containerd | 권장 |
| RHEL/Fedora | CRI-O or Podman | Red Hat 기본 |
| Docker Desktop | containerd (내부) | 호환성 유지 |

---

## 참고 문서

- [containerd 공식 문서](https://containerd.io/docs/)
- [K8s Container Runtimes](https://kubernetes.io/docs/setup/production-environment/container-runtimes/)
- [nerdctl GitHub](https://github.com/containerd/nerdctl)
- [Podman 공식 문서](https://podman.io/)
