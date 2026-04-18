---
title: "Linux Namespaces 전종 (PID, Mount, Net, UTS, IPC, User, Cgroup, Time)"
sidebar_label: "Namespaces"
sidebar_position: 4
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - namespace
  - container
  - isolation
  - security
---

# Linux Namespaces

Namespace는 커널 자원을 프로세스 집합별로 격리하는
Linux 커널 기능이다. 컨테이너(Docker, containerd, Podman)는
namespace와 cgroups를 조합해 격리 환경을 만든다.

---

## 전체 Namespace 종류

| 이름 | 플래그 | 도입 버전 | 격리 대상 |
|------|--------|----------|---------|
| **PID** | `CLONE_NEWPID` | 3.8 | 프로세스 ID 공간 |
| **Mount** | `CLONE_NEWNS` | 2.4.19 | 마운트 포인트 |
| **Network** | `CLONE_NEWNET` | 2.6.24 | 네트워크 스택 |
| **UTS** | `CLONE_NEWUTS` | 2.6.19 | hostname, domainname |
| **IPC** | `CLONE_NEWIPC` | 2.6.19 | SysV IPC, POSIX MQ |
| **User** | `CLONE_NEWUSER` | 3.8 | UID/GID 매핑 |
| **Cgroup** | `CLONE_NEWCGROUP` | 4.6 | cgroup 루트 뷰 |
| **Time** | `CLONE_NEWTIME` | 5.6 | CLOCK_MONOTONIC 등 |

```bash
# 현재 프로세스의 namespace 확인
ls -la /proc/self/ns/
# lrwxrwxrwx ... cgroup -> cgroup:[4026531835]
# lrwxrwxrwx ... mnt    -> mnt:[4026531841]
# lrwxrwxrwx ... net    -> net:[4026531840]
# ...

# 특정 프로세스의 namespace
ls -la /proc/<PID>/ns/
```

---

## 핵심 시스템콜

| 시스템콜 | 동작 |
|---------|------|
| `clone(flags)` | 새 namespace와 함께 자식 프로세스 생성 |
| `unshare(flags)` | 현재 프로세스를 새 namespace로 이동 |
| `setns(fd)` | `fd`가 가리키는 namespace에 합류 |

---

## 1. PID Namespace

프로세스 ID 공간을 격리한다.
namespace 내 최초 프로세스는 PID 1이 된다.

| 호스트 PID | 컨테이너 A 내부 | 컨테이너 B 내부 |
|-----------|--------------|--------------|
| PID 1 (init) | PID 1 (app) | PID 1 (app) |
| PID 100 | PID 2 | PID 2 |
| PID 101 | PID 3 | — |

**PID 1의 의미**: namespace 내 init 역할.
PID 1이 종료되면 namespace 내 모든 프로세스가 즉시 종료된다.

```bash
# 새 PID namespace에서 bash 실행
unshare --fork --pid --mount-proc bash

# 컨테이너 내부에서 보이는 PID와 호스트 PID 매핑 확인
# 컨테이너 내: ps aux → PID 1
# 호스트: cat /proc/<host-pid>/status | grep NSpid
```

---

## 2. Mount Namespace

마운트 포인트 목록을 격리한다.
namespace 내에서의 마운트/언마운트는 호스트에 영향을 주지 않는다.

```bash
# 새 Mount namespace 생성
unshare --mount bash

# namespace 내에서만 tmpfs 마운트
mount -t tmpfs tmpfs /tmp

# 호스트에서는 보이지 않음
# cat /proc/mounts → 호스트 마운트 목록
```

**pivot_root vs chroot**:

| | chroot | pivot_root |
|--|--------|-----------|
| 루트 변경 | 단순 경로 변경 | 전체 루트 교체 |
| 이전 루트 | 접근 가능 | 언마운트 가능 |
| 보안 | 우회 가능 | 더 강력한 격리 |
| 컨테이너 사용 | 레거시 | 현대 컨테이너 표준 |

---

## 3. Network Namespace

네트워크 스택 전체(인터페이스, 라우팅, iptables, 소켓)를 격리한다.

```bash
# 새 Network namespace 생성
ip netns add mynet

# namespace 내에서 명령 실행
ip netns exec mynet ip addr    # lo만 있음

# veth pair로 호스트-namespace 연결
ip link add veth0 type veth peer name veth1
ip link set veth1 netns mynet

ip addr add 192.168.100.1/24 dev veth0
ip netns exec mynet ip addr add 192.168.100.2/24 dev veth1
ip link set veth0 up
ip netns exec mynet ip link set veth1 up
ip netns exec mynet ip link set lo up

# 연결 확인
ip netns exec mynet ping 192.168.100.1
```

**컨테이너 네트워크 모델**: 각 컨테이너가 독립 Network namespace를 가지고, veth pair로 브리지(docker0, cni0)에 연결된다.

---

## 4. UTS Namespace

hostname과 NIS domainname을 격리한다.

```bash
# 새 UTS namespace에서 hostname 변경
unshare --uts bash
hostname mycontainer

# 호스트의 hostname은 변경되지 않음
```

---

## 5. IPC Namespace

System V IPC 객체(세마포어, 공유 메모리, 메시지 큐)와
POSIX 메시지 큐를 격리한다.

```bash
# 호스트의 IPC 객체 목록
ipcs -a

# 새 IPC namespace → 빈 IPC 환경
unshare --ipc bash
ipcs -a   # 아무것도 없음
```

---

## 6. User Namespace ⭐ (보안 핵심)

UID/GID를 namespace 내외부로 매핑한다.
**루트리스 컨테이너의 핵심 기반**이다.

| 컨테이너 내부 | 호스트 |
|-------------|--------|
| UID 0 (root) | UID 100000 (일반 사용자) |
| UID 1000 | UID 101000 |

```bash
# 루트리스 namespace 생성 (root 권한 불필요)
unshare --user --map-root-user bash

# 컨테이너 내부에서 UID 확인
id   # uid=0(root) gid=0(root)

# 호스트에서 실제 UID 확인
cat /proc/<PID>/status | grep Uid
# Uid: 1000 1000 1000 1000  ← 호스트에서는 UID 1000
```

### UID/GID 매핑 설정

```bash
# /etc/subuid - 사용자별 UID 범위 할당
cat /etc/subuid
# alice:100000:65536
# 의미: alice의 컨테이너는 호스트 100000~165535를 사용

# /etc/subgid - 동일 구조
cat /etc/subgid

# newuidmap/newgidmap으로 매핑 적용 (rootless 런타임이 사용)
newuidmap <PID> 0 100000 65536
```

### Kubernetes User Namespace (1.33 Beta, 기본 활성화)

KEP-127 진행 현황: 1.25 Alpha → 1.30 Beta(비활성) →
**1.33 Beta(기본 활성화)**. GA 승격 미완료.

```yaml
apiVersion: v1
kind: Pod
spec:
  hostUsers: false   # User namespace 활성화
  containers:
  - name: app
    securityContext:
      runAsUser: 0    # 컨테이너 내 root
      # 호스트에서는 unprivileged UID로 매핑됨
```

> **보안 이점**: 컨테이너 탈출 취약점이 있더라도
> 호스트에서 unprivileged UID로 실행되므로
> 호스트 권한 상승이 차단된다.
> (CVE-2021-25741 등 마운트 기반 취약점 완화)

---

## 7. Cgroup Namespace

cgroup 계층의 루트 뷰를 격리한다.
컨테이너 내부에서 `/proc/self/cgroup`이
호스트 경로 대신 namespace 루트(`/`)를 보여준다.

```bash
# 호스트에서 컨테이너 cgroup 경로
cat /proc/<container-PID>/cgroup
# 0::/system.slice/containerd.service/...

# 컨테이너 내부에서는
cat /proc/self/cgroup
# 0::/   ← 루트로 보임 (호스트 경로 노출 없음)
```

---

## 8. Time Namespace (Linux 5.6+)

`CLOCK_MONOTONIC`, `CLOCK_BOOTTIME`을 격리한다.
컨테이너 내부에서 다른 시계 기준점을 가질 수 있다.

```bash
# Time namespace는 unshare로는 생성 어려움
# (fork 이전에만 설정 가능)
# 컨테이너 런타임이 내부적으로 사용
cat /proc/<PID>/timens_offsets
```

> **동작 특이사항**: `CLONE_NEWTIME`은 다른 namespace flag와
> 달리 `unshare()` 호출 프로세스 자체는 새 namespace에
> 들어가지 않고, 이후 fork된 자식만 새 namespace에 배치된다.
> 이 특성 때문에 CRIU 체크포인트/복원에서 활용 가능하다.

---

## Namespace 조합: 컨테이너

현대 컨테이너는 아래 namespace를 모두 조합한다.

| 플래그 | 격리 대상 |
|--------|---------|
| `CLONE_NEWPID` | 프로세스 ID |
| `CLONE_NEWNS` | 파일시스템 (마운트) |
| `CLONE_NEWNET` | 네트워크 |
| `CLONE_NEWUTS` | hostname |
| `CLONE_NEWIPC` | IPC |
| `CLONE_NEWUSER` | UID/GID (rootless) |
| `CLONE_NEWCGROUP` | cgroup 뷰 |

`docker run`은 위 플래그를 조합해 `clone()` 시스템 콜을 호출한다.

---

## Namespace 조합 시 순서 제약

unprivileged 프로세스가 여러 namespace를 동시에 생성할 때
**User namespace를 먼저 또는 동시에** 지정해야 한다.

```bash
# EPERM 발생 (User namespace 없이 Net namespace 생성 시도)
unshare --net bash   # → unshare: unshare failed: Operation not permitted

# 올바른 방법: User namespace 포함
unshare --user --map-root-user --net bash   # 성공
```

---

## 실무 명령어

### nsenter: 실행 중인 namespace 진입

```bash
# 특정 namespace만 진입 (--all 대신 필요한 것만 지정 권장)
nsenter -t 1234 --net bash       # 네트워크만
nsenter -t 1234 --mount bash     # 마운트만

# 컨테이너 네트워크 디버깅
nsenter -t $(docker inspect -f '{{.State.Pid}}' mycontainer) \
  --net ss -tnp
```

> **주의**: `nsenter`는 `CAP_SYS_PTRACE` 또는 root가 필요하다.
> 프로덕션 파드에 무분별하게 진입하지 말 것.
> 진입 이력은 `auditd` 또는 Falco로 감사 로그를 남겨야 한다.

### unshare: 새 namespace에서 실행

```bash
# 완전히 격리된 환경
unshare --fork --pid --mount-proc \
        --net --uts --ipc \
        --user --map-root-user \
        bash

# Mount namespace + pivot_root 없이 간단 테스트
unshare --mount bash
mount -t tmpfs none /mnt
```

### lsns: namespace 목록

```bash
# 시스템 전체 namespace 목록
lsns

# 특정 타입만
lsns -t net

# 특정 PID의 namespace
lsns -p <PID>
```

---

## 보안 고려사항

| 취약점 패턴 | 완화 방법 |
|-----------|---------|
| 특권 컨테이너 namespace 탈출 | User namespace + `--cap-drop ALL` |
| `/proc` 마운트를 통한 정보 노출 | `hidepid=invisible,gid=proc` |
| Cgroup namespace 미적용 시 경로 노출 | Cgroup namespace 활성화 확인 |
| User namespace UID 매핑 충돌 | `/etc/subuid` 범위 겹치지 않게 관리 |

### 주요 CVE 사례

| CVE | 메커니즘 | 완화 |
|-----|---------|------|
| CVE-2024-21626 | runc `CLONE_NEWNS` 우회 → 호스트 파일시스템 접근 | runc 1.1.12+ 업데이트 |
| CVE-2021-25741 | symlink 경쟁으로 호스트 임의 파일 읽기 | K8s User namespace 활성화 |
| CVE-2022-0492 | cgroup v1 release_agent 통한 컨테이너 탈출 | cgroup v2 전환, seccomp |

> **namespace는 syscall 수준 보안을 제공하지 않는다.**
> seccomp RuntimeDefault 프로파일 + AppArmor/SELinux가
> namespace의 필수 보완 계층이다.

```bash
# /proc hidepid 설정 (Linux 5.8+ 권장 방식)
# hidepid=invisible (구 hidepid=2), gid=proc 으로 proc 그룹만 조회 허용
mount -o remount,hidepid=invisible,gid=proc /proc

# /etc/fstab 영구 적용
# proc /proc proc defaults,hidepid=invisible,gid=proc 0 0

# proc 그룹에 모니터링 사용자 추가
usermod -aG proc prometheus
```

---

## 참고 자료

- [namespaces(7) - Linux manual page](https://man7.org/linux/man-pages/man7/namespaces.7.html)
  — 확인: 2026-04-17
- [User Namespaces - Kubernetes](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/)
  — 확인: 2026-04-17
- [Container security fundamentals: Isolation & namespaces - Datadog](https://securitylabs.datadoghq.com/articles/container-security-fundamentals-part-2/)
  — 확인: 2026-04-17
- [Understanding user namespaces with rootless containers - Red Hat](https://access.redhat.com/articles/5946151)
  — 확인: 2026-04-17
