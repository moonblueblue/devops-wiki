---
title: "컨테이너 런타임 비교 (runc, gVisor, Kata)"
date: 2026-04-14
tags:
  - container
  - runtime
  - runc
  - gvisor
  - kata
  - security
sidebar_label: "런타임 비교"
---

# 컨테이너 런타임 비교 (runc, gVisor, Kata)

## 1. 런타임 계층 구조

```
Kubernetes (kubelet)
       ↓ CRI
High-level Runtime
┌─────────────┐  ┌────────┐
│ containerd  │  │ CRI-O  │
└──────┬──────┘  └───┬────┘
       └──────┬───────┘
              ↓ OCI Runtime Interface
Low-level Runtime
┌──────┐  ┌──────────┐  ┌───────────────────┐
│ runc │  │ gVisor   │  │ Kata Containers   │
└──────┘  └──────────┘  └───────────────────┘
  (기본)   (보안 샌드박스) (VM 기반 격리)
```

---

## 2. runc vs gVisor vs Kata 비교

| 항목 | runc | gVisor | Kata Containers |
|-----|------|--------|----------------|
| 격리 수준 | 프로세스 (namespace) | 시스템 콜 레벨 | VM (하이퍼바이저) |
| 호스트 커널 공유 | O | X (gVisor 커널) | X (게스트 커널) |
| 성능 | 매우 빠름 | 5~15% 오버헤드 | 10~30% 오버헤드 |
| 시작 시간 | ~100ms | ~200ms | ~500ms~2s |
| 메모리 오버헤드 | 최소 | 낮음 | 중간 (VM) |
| 보안 강도 | 표준 | 높음 | 매우 높음 |
| GPU/특수 하드웨어 | O | 제한적 | 제한적 |

---

## 3. runc — 표준 런타임

Linux namespaces + cgroups를 직접 사용한다.
컨테이너가 호스트 커널을 공유한다.

```bash
# Docker/containerd의 기본 런타임
docker run --runtime=runc nginx:latest
# 기본값이므로 --runtime 생략 가능
```

```
컨테이너 프로세스
      ↓ syscall
호스트 Linux Kernel
(namespaces로 격리, cgroups로 제한)
```

**적합한 사용 시점:**
- 신뢰할 수 있는 내부 워크로드
- 최고 성능이 필요한 경우
- 대부분의 프로덕션 환경

---

## 4. gVisor — 시스템 콜 샌드박스

컨테이너의 syscall을 인터셉트하여 사용자 공간 커널(Sentry)이 처리한다.
호스트 커널에 도달하는 syscall을 최소화한다.

```
컨테이너 프로세스
      ↓ syscall
gVisor Sentry (사용자 공간 커널)
  - 안전한 syscall만 처리
  - 위험한 syscall 차단
      ↓ 제한된 syscall만
호스트 Linux Kernel
```

```bash
# gVisor 설치 후 런타임 등록
# /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.gvisor]
  runtime_type = "io.containerd.runsc.v1"

# gVisor로 컨테이너 실행
docker run --runtime=runsc nginx:latest

# K8s RuntimeClass
nerdctl run --runtime=gvisor nginx:latest
```

**적합한 사용 시점:**
- 외부 사용자 코드 실행 (PaaS, SaaS)
- 악의적 코드 가능성이 있는 워크로드
- 멀티테넌트 환경

---

## 5. Kata Containers — VM 기반 격리

각 컨테이너(또는 Pod)마다 경량 VM을 생성한다.
컨테이너와 호스트 사이에 완전한 하이퍼바이저 경계가 존재한다.

```
호스트 OS
    ↓
하이퍼바이저 (QEMU/KVM, Firecracker)
    ↓
경량 VM
    ├── 게스트 커널 (별도 Linux)
    └── 컨테이너 프로세스
```

```bash
# Kata 런타임 등록
# /etc/containerd/config.toml
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.kata]
  runtime_type = "io.containerd.kata.v2"

# Kata로 컨테이너 실행
docker run --runtime=kata nginx:latest
```

| 하이퍼바이저 | 특징 |
|------------|------|
| QEMU/KVM | 성숙도 높음, 풍부한 기능 |
| Firecracker | AWS 기반, 초경량, 빠른 시작 |
| Cloud Hypervisor | 최소 기능, 고성능 |

**적합한 사용 시점:**
- 강력한 격리가 필요한 멀티테넌트
- PCI-DSS, HIPAA 등 규정 준수
- 서로 다른 신뢰 수준의 워크로드 혼합

---

## 6. K8s RuntimeClass

클러스터에서 Pod별로 런타임을 선택할 수 있다.

```yaml
# RuntimeClass 정의
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: gvisor
---
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: kata
handler: kata
overhead:
  podFixed:
    cpu: 250m
    memory: 256Mi   # VM 오버헤드 예약
```

```yaml
# 보안이 필요한 Pod에 gVisor 사용
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  runtimeClassName: gvisor
  containers:
  - name: app
    image: nginx:latest
```

```bash
# 노드 런타임 확인
kubectl get nodes -o jsonpath=\
'{range .items[*]}{.metadata.name}{"\t"}\
{.status.nodeInfo.containerRuntimeVersion}{"\n"}{end}'

# Pod 런타임 확인
kubectl get pods -o \
  custom-columns=NAME:.metadata.name,RUNTIME:.spec.runtimeClassName
```

---

## 7. 런타임 선택 가이드

```
신뢰할 수 없는 코드 실행? ──Yes──→ 매우 강한 격리 필요? ──Yes──→ Kata
                                                          ──No───→ gVisor
         ──No──→ 최고 성능 필요?  ──Yes──→ runc (기본값)
                 규정 준수 필요?  ──Yes──→ Kata or gVisor
                 그 외           ────────→ runc + 보안 정책
```

| 시나리오 | 추천 |
|---------|------|
| 내부 서비스, 신뢰 가능 | runc |
| 외부 코드 실행 (PaaS) | gVisor |
| 금융·의료 규정 준수 | Kata |
| 서버리스 워크로드 | Firecracker (Kata) |
| GPU 워크로드 | runc (하드웨어 직접 접근) |

---

## 참고 문서

- [gVisor 공식 문서](https://gvisor.dev/docs/)
- [Kata Containers 공식 문서](https://katacontainers.io/)
- [K8s RuntimeClass](https://kubernetes.io/docs/concepts/containers/runtime-class/)
- [OCI Runtime Spec](https://github.com/opencontainers/runtime-spec)
