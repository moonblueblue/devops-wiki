---
title: "컨테이너 vs VM"
date: 2026-04-13
tags:
  - container
  - vm
  - virtualization
  - docker
sidebar_label: "컨테이너 vs VM"
---

# 컨테이너 vs VM

## 1. 아키텍처 차이

```
VM 방식:
  물리 서버
  └── 하이퍼바이저 (VMware, KVM, Hyper-V)
        ├── VM 1: Guest OS + App A
        ├── VM 2: Guest OS + App B
        └── VM 3: Guest OS + App C

컨테이너 방식:
  물리 서버
  └── Host OS + 컨테이너 런타임 (Docker, containerd)
        ├── Container 1: App A (Host 커널 공유)
        ├── Container 2: App B (Host 커널 공유)
        └── Container 3: App C (Host 커널 공유)
```

---

## 2. 핵심 비교

| 항목 | VM | 컨테이너 |
|------|-----|---------|
| OS 커널 | 각자 독립 | **Host와 공유** |
| 부팅 시간 | 수십 초~분 | **수 밀리초~초** |
| 이미지 크기 | GB 단위 | **MB 단위** |
| 리소스 오버헤드 | 높음 (Guest OS 포함) | **낮음** |
| 격리 수준 | **강함** (하드웨어 수준) | 상대적으로 약함 |
| 이식성 | OS 의존 | **높음** (OCI 표준) |
| 노드당 밀도 | 낮음 (수십 개) | **높음** (수백~수천 개) |
| 보안 공격 표면 | 작음 | 상대적으로 큼 |

---

## 3. 사용 사례

| 상황 | 권장 기술 | 이유 |
|------|---------|------|
| 마이크로서비스 | **컨테이너** | 빠른 시작, 높은 밀도 |
| CI/CD 파이프라인 | **컨테이너** | 일관된 환경, 빠른 빌드 |
| 레거시 앱 (특정 OS 필요) | **VM** | Guest OS 독립 |
| 강한 격리 필요 (멀티테넌트) | **VM** 또는 보안 컨테이너 | 커널 공유 없음 |
| 데이터베이스 (상태 있는 워크로드) | VM 또는 베어메탈 | I/O 성능, 격리 |

---

## 4. 보안 컨테이너 (하이브리드)

VM의 격리성과 컨테이너의 경량성을 결합한 기술이다.

| 기술 | 방식 | 특징 |
|------|------|------|
| **gVisor** | 사용자 공간 커널 (Go) | Host 커널과 분리, 구글 개발 |
| **Kata Containers** | 경량 VM (QEMU/Firecracker) | 진정한 VM 격리, OCI 호환 |
| **Firecracker** | microVM (AWS) | 125ms 부팅, Lambda/Fargate 기반 |

```bash
# RuntimeClass 목록 확인
kubectl get runtimeclass
```

```yaml
# gVisor로 Pod 실행
apiVersion: v1
kind: Pod
metadata:
  name: secure-pod
spec:
  runtimeClassName: gvisor
  containers:
    - name: app
      image: myapp
```

---

## 5. 컨테이너와 VM 혼합

```
클라우드 환경 (권장 패턴):
  물리 서버 (클라우드 하이퍼바이저)
      └── VM (EC2/GCE/Azure VM)
              └── 컨테이너 런타임 (containerd)
                      └── Kubernetes Pod
```

VM이 하드웨어 멀티테넌시를 담당하고,
컨테이너가 애플리케이션 격리를 담당한다.

---

## 참고 문서

- [Docker - 컨테이너 vs VM](https://www.docker.com/resources/what-container/)
- [Kata Containers 공식 문서](https://katacontainers.io/docs/)
- [gVisor 공식 문서](https://gvisor.dev/docs/)
- [Firecracker GitHub](https://github.com/firecracker-microvm/firecracker)
