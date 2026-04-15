---
title: "컨테이너를 구성하는 리눅스 기술"
date: 2026-04-13
tags:
  - container
  - linux
  - namespace
  - cgroup
  - overlayfs
sidebar_label: "컨테이너 내부 구조"
---

# 컨테이너를 구성하는 리눅스 기술

컨테이너는 새로운 기술이 아니다.
Linux의 Namespace, cgroup, OverlayFS를 조합한 것이다.

## 1. Linux Namespaces (격리)

각 컨테이너가 독립적인 시스템 뷰를 갖도록 격리한다.

| Namespace | 격리 대상 | 효과 |
|-----------|---------|------|
| `pid` | 프로세스 ID | 컨테이너 내 PID 1부터 시작 |
| `net` | 네트워크 | 독립 IP, 포트, 라우팅 테이블 |
| `mnt` | 마운트 포인트 | 독립 파일시스템 뷰 |
| `uts` | 호스트명, 도메인명 | 독립 hostname |
| `ipc` | IPC, 공유 메모리 | 프로세스 간 통신 격리 |
| `user` | UID/GID | 컨테이너 내 root ≠ Host root |
| `cgroup` | cgroup 뷰 | cgroup 계층 격리 (Linux 4.6+) |
| `time` | 시스템 클럭 | 독립 타임 오프셋 (Linux 5.6+) |

```bash
# 현재 프로세스의 Namespace 확인
ls -la /proc/$$/ns/

# 컨테이너 PID의 Namespace 확인
ls -la /proc/<container-pid>/ns/

# Namespace 공유 여부 확인
lsns
```

---

## 2. cgroups (리소스 제한)

cgroups는 프로세스 그룹의 리소스 사용을 제한·측정·격리한다.

### cgroup v1 vs v2

| 항목 | cgroup v1 | cgroup v2 |
|------|---------|---------|
| 계층 구조 | 컨트롤러별 독립 트리 | **통합 단일 트리** |
| 기본값 | Ubuntu 20.04 이하 | **Ubuntu 21.10+/22.04 LTS/24.04 LTS, RHEL 9+** |
| 쓰레드 제어 | 없음 | 있음 (thread mode) |
| PSI 지원 | 없음 | **있음** |
| 권장 | 레거시 | **현재 표준** |

```bash
# cgroup v2 여부 확인
stat -fc %T /sys/fs/cgroup/
# cgroup2fs → v2, tmpfs → v1

# 컨테이너 cgroup 확인
cat /proc/<pid>/cgroup
# 0::/system.slice/docker-<id>.scope  ← v2
```

### 리소스 제한 확인

```bash
# cgroup v2 메모리 한도
cat /sys/fs/cgroup/system.slice/docker-<id>.scope/memory.max

# CPU 한도
cat /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.max
# "100000 100000" → 1 CPU (100ms/100ms period)
```

---

## 3. OverlayFS (레이어 파일시스템)

Docker 이미지는 읽기 전용 레이어를 쌓고,
컨테이너 실행 시 쓰기 가능한 레이어를 추가한다.

```
컨테이너 레이어 (읽기/쓰기)   ← 컨테이너마다 독립
    ├── 이미지 레이어 3 (읽기 전용)
    ├── 이미지 레이어 2 (읽기 전용)
    └── 이미지 레이어 1 (Base OS, 읽기 전용)
```

```
OverlayFS 구조:
  upperdir  → 쓰기 레이어 (컨테이너 변경사항)
  lowerdir  → 읽기 전용 레이어 (이미지)
  workdir   → OverlayFS 내부 작업 디렉토리
  merged    → 실제 컨테이너가 보는 뷰
```

```bash
# Docker 이미지 레이어 확인
docker history nginx

# OverlayFS 마운트 확인
mount | grep overlay
# overlay on /var/lib/docker/overlay2/xxx/merged type overlay
# (lowerdir=..,upperdir=..,workdir=..)
```

**Copy-on-Write (CoW):**
파일 수정 시 lowerdir에서 upperdir로 파일을 복사한 후 수정한다.
읽기는 lowerdir에서 직접, 변경된 파일은 upperdir에서 읽는다.
복사는 **첫 번째 쓰기에만** 발생한다.
대용량 파일을 자주 수정하는 워크로드(DB 등)는
bind mount(볼륨)를 사용해야 이 오버헤드를 피할 수 있다.

---

## 4. seccomp (시스템콜 필터링)

컨테이너가 사용할 수 있는 시스템콜을 제한한다.

```bash
# Docker 기본 seccomp 프로파일 확인
docker run --security-opt seccomp=unconfined alpine sh
# 제한 없이 실행 (비권장)

# 커스텀 seccomp 프로파일 적용
docker run --security-opt seccomp=./my-seccomp.json alpine sh
```

Docker 기본 프로파일은 수백 개의 syscall 중
위험한 수십 개를 차단한다.
(버전마다 차단 목록이 변경됨 —
최신 목록은 [Docker GitHub seccomp 프로파일](https://github.com/moby/moby/blob/master/profiles/seccomp/default.json) 참조)

---

## 5. Linux Capabilities (특권 최소화)

root 권한을 세분화하여 필요한 권한만 부여한다.

```bash
# 컨테이너 기본 Capabilities
docker run --cap-add NET_ADMIN alpine  # 네트워크 관리 추가
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE nginx  # 최소 권한
```

| Capability | 용도 |
|-----------|------|
| `NET_ADMIN` | 네트워크 설정 변경 |
| `NET_BIND_SERVICE` | 1024 미만 포트 바인딩 |
| `SYS_PTRACE` | 프로세스 추적 (디버깅) |
| `SYS_ADMIN` | 광범위한 시스템 관리 (비권장) |

---

## 6. docker run 내부 동작

```
docker run ubuntu /bin/bash
    ↓
1. dockerd → containerd에 요청
2. containerd → 이미지 pull (없으면)
3. containerd-shim 프로세스 생성
   (runc 종료 후에도 stdio 및 exit 코드 관리, 재연결 허용)
4. runc 호출:
   a. Namespace 생성 (pid, net, mnt, uts, ipc)
      (user namespace는 rootless 모드에서만 기본 활성화)
   b. cgroup 설정 (리소스 제한 적용)
   c. OverlayFS 마운트
   d. seccomp/capabilities 설정
   e. /bin/bash 실행 (PID 1로)
```

```bash
# 실제 컨테이너 프로세스 확인
docker run -d nginx
ps aux | grep containerd-shim
```

---

## 참고 문서

- [Kernel Docs - Namespaces](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [Kernel Docs - cgroups v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)
- [Kernel Docs - OverlayFS](https://www.kernel.org/doc/html/latest/filesystems/overlayfs.html)
- [Docker - 스토리지 드라이버](https://docs.docker.com/storage/storagedriver/)
