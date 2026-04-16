---
title: "Immutable OS (Flatcar, Bottlerocket, Talos Linux, Fedora CoreOS)"
sidebar_label: "Immutable OS"
sidebar_position: 2
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - immutable-os
  - kubernetes
  - flatcar
  - bottlerocket
  - talos
---

# Immutable OS (Flatcar, Bottlerocket, Talos Linux, Fedora CoreOS)

범용 배포판(Ubuntu, RHEL)으로 Kubernetes 노드를 운영하면
설정 드리프트, 보안 패치 지연, 수동 패키지 관리가 불가피하다.
Immutable OS는 "노드는 교체 가능한 어플라이언스"라는 철학에서
출발해 이 문제를 구조적으로 해결한다.

## 핵심 개념

### 불변(Immutable) 루트 파일시스템

루트 파일시스템(`/` 또는 `/usr`)이 **읽기 전용**으로 마운트된다.
런타임 중 OS 바이너리를 직접 수정할 수 없다.

```bash
# Ubuntu 노드
$ touch /usr/bin/test && echo "성공"  # 가능 → 드리프트 발생

# Talos 노드
$ touch /usr/bin/test
# 쉘 자체가 없음. API로만 관리
```

읽기 전용 루트 FS가 해결하는 문제:
- **설정 드리프트 차단**: 선언된 상태와 실제 상태가 항상 일치
- **컨테이너 탈출 방어**: CVE-2019-5736(runc)처럼
  `/proc/self/exe`에 쓰는 공격 차단
- **감사 가능성**: 노드 상태가 언제나 알려진 이미지에서 비롯됨

### A/B 파티션 업데이트

```
┌──────────┬──────────────┬──────────────┬──────────┐
│ Boot/EFI │  파티션 A    │  파티션 B    │  /var    │
│          │  (현재 활성) │  (업데이트)  │ (데이터) │
└──────────┴──────────────┴──────────────┴──────────┘
                                ↑
                      새 버전을 여기에 기록
                      → 재부팅 시 활성 전환
                      → 실패 시 A로 자동 롤백
```

전통적인 `apt upgrade`와의 차이점:
- 업데이트 도중 실패해도 기존 파티션이 온전히 남아 있다
- 재부팅 1회로 완전한 버전 전환 또는 롤백이 완료된다

**롤백이 실패하는 케이스**:
- 부트로더(GRUB/systemd-boot) 설정 손상
- Secure Boot 활성화 상태에서 TPM PCR 측정값 불일치
- `/var` 데이터 스키마와 새 커널 간 비호환 (예: etcd 데이터 포맷 변경)

롤백에 의존하는 운영 전략을 구성할 때는 이 케이스들을
장애 시나리오에 포함해야 한다.

### 선언적 구성

| OS | 구성 형식 | 적용 시점 |
|----|---------|---------|
| Flatcar / Fedora CoreOS | Butane(YAML) → Ignition(JSON) | 최초 부팅 (initramfs) |
| Bottlerocket | TOML + `apiclient` API | 런타임 |
| Talos | machine config YAML → gRPC | 프로비저닝 및 런타임 |

**Ignition vs cloud-init**: Ignition은 initramfs 단계(userspace
시작 전)에서 실행된다. 디스크 파티셔닝, 파일시스템 포맷, 사용자
생성까지 처리할 수 있어 cloud-init보다 훨씬 이른 시점에 구성을
완성한다.

---

## 배포판별 상세

### Flatcar Container Linux

```
Stable: 4459.2.4 (2026-03-09)  커널 6.12, containerd 2.0.7, systemd 256
LTS:    4081.3.6                18개월 지원 (LTS-2024, 2026년 중반 EOL 예정)
```

> **LTS-2024 EOL 주의**: 4081.x 시리즈는 2026년 중반 종료된다.
> 신규 도입 시 Stable 채널을 사용하고, 차기 LTS 채널로 전환을 준비한다.

**계보**: CoreOS Container Linux → Kinvolk 포크(2018) →
Microsoft 인수(2021) → **CNCF Incubating(2024)**
(CNCF 역사상 최초 OS 배포판 프로젝트)

**특징**:
- systemd 기반 → 기존 Linux 운영 지식 재사용 가능
- Butane/Ignition 프로비저닝
- **Update Engine + locksmithd**: 재부팅 타이밍 조율
- **FLUO** (Flatcar Linux Update Operator): K8s 환경에서
  drain → 업데이트 → uncordon 자동화
- cgroups v1 **완전 제거** (4230+ 버전부터)
- 멀티클라우드 동일 이미지: AWS, Azure, GCP, Equinix Metal,
  VMware, 베어메탈

```yaml
# Butane 구성 예시 (SSH 키 설정)
variant: flatcar
version: 1.0.0
passwd:
  users:
    - name: core
      ssh_authorized_keys:
        - ssh-ed25519 AAAA...
```

**적합한 환경**: 멀티클라우드·하이브리드 클러스터,
CoreOS 계보 친숙한 팀

---

### Bottlerocket

```
Stable: v1.57.0 (2026-03-23)
Variants: aws-k8s-1.29 ~ 1.35, NVIDIA GPU, FIPS, arm64, vmware, metal
```

AWS가 EKS/ECS 노드를 위해 처음부터 설계한 OS.
"OS를 관리 부담 없는 어플라이언스처럼"이 설계 철학이다.

**특징**:
- **API 서버 기반 구성**: `apiclient`로만 설정 변경.
  SSH 서버 없음. 기본 접근은 AWS SSM
- **Variant 빌드**: K8s 버전 × 플랫폼 × 하드웨어 조합으로 AMI 제공

  | Variant | 용도 |
  |---------|------|
  | `aws-k8s-1.35` | EKS 표준 노드 |
  | `aws-k8s-1.35-nvidia` | GPU 워크로드 |
  | `aws-k8s-1.35-fips` | 규제 환경 (FedRAMP 등) |
  | `vmware-k8s-1.35` | EKS Anywhere |
  | `metal-k8s-1.29` | 베어메탈 (제한적) |

- **초기 부팅 구성**: EC2 user-data에 TOML을 주입하는 방식으로
  K8s 클러스터 설정을 지정한다. EKS 관리형 노드 그룹의 기본 동작.

  ```toml
  # user-data (TOML) 예시
  [settings.kubernetes]
  cluster-name = "my-cluster"
  api-server = "https://..."
  cluster-certificate = "..."
  ```

- **BRUP** (Bottlerocket Update Operator): K8s 오퍼레이터로
  동시 업데이트 노드 수를 제어한다.
  `maxConcurrentUpdates`는 Helm values로 설정한다.

  ```bash
  # BRUP 설치 (Helm)
  helm install brupop \
    oci://public.ecr.aws/bottlerocket/bottlerocket-update-operator \
    --set max_concurrent_updates=1
  ```

- **dm-verity**: 루트 파일시스템 무결성 검증.
  블록 단위 해시 불일치 시 **커널 패닉 또는 I/O 오류**를 반환한다.
  예상치 못한 노드 재시작 원인이 될 수 있다.
- **Secure Boot + TPM**: 측정 부트(measured boot) 지원

**적합한 환경**: AWS EKS 전용 클러스터. GPU 워크로드.
EKS 버전 업그레이드 = 노드 교체로 처리.

**주의**: 베어메탈 프로덕션은 1.29 variant까지만 공식 지원.
AWS 종속성이 강해 멀티클라우드 이전 시 OS 교체 필요.

---

### Talos Linux

```
Stable: v1.12.6 (2026-03-19)  Linux 6.18, runc 1.3.5
Beta:   v1.13.0-beta.1         Clang 빌드 커널 + ThinLTO
```

가장 급진적인 Immutable OS.
**쉘, 패키지 관리자, SSH가 모두 없다.**

**핵심 아키텍처**:

```
기존 Linux 노드:
  systemd → sshd → bash → 패키지 관리자
                 ↓ 운영자가 직접 접속·수정

Talos 노드:
  machined(PID 1)
    ├── apid        (gRPC 게이트웨이, 포트 50000) ← talosctl 연결
    ├── trustd      (인증서 배포, Root of Trust)
    ├── containerd  (컨테이너 런타임)
    └── kubelet     (K8s 에이전트)
```

방화벽 규칙: talosctl은 **apid**(포트 50000/TCP)와 통신한다.
machined가 직접 gRPC를 노출하는 것이 아니므로 이 구분이 중요하다.

- **machined**: systemd 대체. Go로 작성. 네트워킹, 디스크,
  containerd, kubelet, etcd를 단일 프로세스가 오케스트레이션
- **mTLS**: 클러스터 부트스트래핑 시 자동 인증서 교환
- **Control plane 내장**: worker와 동일한 OS에서 etcd +
  API server 구동
- **Stageˣ**: 재현 가능 빌드. SBOM 전체 제공, 서명된 커널 모듈
- v1.10+: cgroups v1 완전 제거, systemd-boot 기본값

```bash
# Talos 클러스터 부트스트래핑
talosctl apply-config --insecure \
  --nodes 192.168.1.10 \
  --file controlplane.yaml

talosctl bootstrap --nodes 192.168.1.10

# OS + K8s 동시 업그레이드
talosctl upgrade --nodes 192.168.1.10 \
  --image ghcr.io/siderolabs/installer:v1.12.6
```

**디버깅**: 영구 쉘이 없으므로 Kubernetes ephemeral container를
사용한다.

```bash
# 노드 레벨 디버깅 (v1.13+)
kubectl debug node/talos-worker-01 \
  -it --image=busybox
```

**적합한 환경**: 보안 최우선·air-gapped 환경 (PCI DSS, SOC 2),
대규모 K8s fleet 자동화 (Sidero Metal + Omni).

**주의**: 진입 장벽이 높다. talosctl, machine config YAML,
부트스트랩 절차를 팀 전체가 학습해야 한다.

etcd 백업은 **일반 kubeadm 방식과 다르다**.
`talosctl etcd snapshot`으로 스냅샷을 생성하고
외부 오브젝트 스토리지(S3 등)에 오프로드해야 한다.

```bash
# etcd 스냅샷 저장
talosctl etcd snapshot db.snapshot \
  --nodes 192.168.1.10

# S3에 업로드 (예시)
aws s3 cp db.snapshot s3://my-bucket/etcd/$(date +%Y%m%d).snapshot
```

---

### Fedora CoreOS

```
Stable stream: 44.x (2026-04 기준)
Streams: stable / testing / next (2주 주기 프로모션)
```

Fedora 생태계 위의 컨테이너 호스트.
RPM 생태계와 호환성을 유지하면서 불변성을 제공한다.

**특징**:
- **rpm-ostree**: OSTree(원자적 파일시스템 트리) + RPM 레이어링.
  추가 패키지 설치 가능하되 재부팅 후 적용
- **zincati**: 자동 업데이트 + 재부팅 오케스트레이션
- **FCOS Update Operator**: K8s 환경에서 drain/cordon 자동화
- **RHEL CoreOS(RHCOS)**: OpenShift 노드 OS. 동일 기술 기반,
  Red Hat 상용 지원 제공

```yaml
# Butane 구성 예시 (systemd 서비스 추가)
variant: fcos
version: 1.5.0
systemd:
  units:
    - name: containerd.service
      enabled: true
storage:
  files:
    - path: /etc/hostname
      contents:
        inline: k8s-node-01
```

**bootc**: RHEL 9.4 / Fedora 40부터 Technology Preview로 제공.
OCI 컨테이너 이미지로 OS를 배포·관리하는 방식이다.
rpm-ostree와 병행하여 사용 가능하며, Fedora CoreOS는
중장기적으로 bootc 기반으로 이행할 예정이다.

```bash
# bootc 이미지로 전환 (예시)
bootc switch quay.io/myorg/my-os-image:latest
```

**적합한 환경**: Red Hat/OpenShift 생태계, 커뮤니티 K8s 온프레미스,
RPM 패키지 추가가 필요한 환경.

---

## 4가지 비교 요약

### K8s 지원 방식

| OS | K8s 통합 | Control Plane | 업데이트 오퍼레이터 |
|----|---------|--------------|-----------------|
| Flatcar | kubeadm, k3s, RKE2, CAPI | 가능 | FLUO |
| Bottlerocket | EKS 최적화 AMI (K8s 버전별) | 불가 (worker 전용) | BRUP |
| Talos | machined 내장 (kubeadm 불필요) | 기본 설계 | `talosctl upgrade` |
| Fedora CoreOS | kubeadm, k3s, OpenShift(RHCOS) | 가능 | FCOS Update Operator |

### 플랫폼 지원

| OS | AWS | Azure | GCP | VMware | 베어메탈 |
|----|-----|-------|-----|--------|---------|
| Flatcar | O | O | O | O | O |
| Bottlerocket | O (주) | X | X | O (EKS Anywhere) | 제한적 |
| Talos | O | O | O | O | O (PXE/ISO) |
| Fedora CoreOS | O | O | O | O | O (PXE/ISO) |

### 운영 특성

| 항목 | Flatcar | Bottlerocket | Talos | Fedora CoreOS |
|------|---------|-------------|-------|--------------|
| 진입 장벽 | 낮음 | 낮음 | 높음 | 낮음~중간 |
| 쉘 접근 | O (SSM) | 제한적 | X (ephemeral만) | O |
| 커스터마이징 | 중간 | 낮음 | 낮음 | 높음 (rpm) |
| 공격 표면 | 작음 | 매우 작음 | 최소 | 중간 |
| CNCF 상태 | **Incubating** | 없음 | 없음 | 없음 |

---

## 선택 가이드

```
어떤 환경인가?
│
├─ AWS EKS 전용
│   └─ Bottlerocket (EKS 최적화 AMI, BRUP)
│
├─ 멀티클라우드 / 하이브리드
│   └─ Flatcar (CNCF, 동일 이미지 멀티환경)
│
├─ 보안 최우선 / air-gapped
│   └─ Talos (SSH 없음, SBOM, 재현 가능 빌드)
│
├─ Red Hat / OpenShift 생태계
│   └─ Fedora CoreOS / RHCOS
│
└─ 대규모 베어메탈 K8s fleet
    └─ Talos + Sidero Metal
```

**Immutable OS를 쓰지 말아야 할 경우**:
- 커널 모듈을 런타임에 자주 로드해야 하는 환경
  (특수 하드웨어 드라이버, 사내 커스텀 모듈)
- Ansible/Chef가 노드에 직접 개입하는 레거시 운영 워크플로우
- 소규모 팀(2~3인)에서 Talos 학습 비용을 감당하기 어려운 경우
- 노드 수 3~5개의 실험·학습 환경 (범용 배포판이 간단하다)

> 범용 배포판(Ubuntu, RHEL) 비교는
> [리눅스 배포판 비교](./linux-distro-comparison.md) 참고

---

## 참고 자료

- [Flatcar 릴리즈](https://www.flatcar.org/releases)
  (확인: 2026-04-16)
- [Flatcar CNCF Incubating 발표](https://www.cncf.io/blog/2024/10/29/flatcar-brings-container-linux-to-the-cncf-incubator/)
  (확인: 2026-04-16)
- [Bottlerocket 보안 기능](https://github.com/bottlerocket-os/bottlerocket/blob/develop/SECURITY_FEATURES.md)
  (확인: 2026-04-16)
- [Bottlerocket Update Operator](https://github.com/bottlerocket-os/bottlerocket-update-operator)
  (확인: 2026-04-16)
- [Talos Linux 릴리즈](https://github.com/siderolabs/talos/releases)
  (확인: 2026-04-16)
- [Talos Q1 2026 업데이트](https://www.siderolabs.com/blog/talos-omni-q1-2026-updates/)
  (확인: 2026-04-16)
- [Fedora CoreOS 공식 문서](https://docs.fedoraproject.org/en-US/fedora-coreos/)
  (확인: 2026-04-16)
- [rpm-ostree 공식](https://coreos.github.io/rpm-ostree/)
  (확인: 2026-04-16)
- [Immutable OS 비교 — The New Stack](https://thenewstack.io/3-immutable-operating-systems-bottlerocket-flatcar-and-talos-linux/)
  (확인: 2026-04-16)
