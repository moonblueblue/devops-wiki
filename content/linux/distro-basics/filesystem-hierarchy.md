---
title: "파일시스템 계층 구조 (FHS)"
sidebar_label: "FHS"
sidebar_position: 3
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - filesystem
  - fhs
---

# 파일시스템 계층 구조 (FHS)

FHS(Filesystem Hierarchy Standard)는 Linux 파일시스템의
디렉토리 구조와 각 디렉토리의 용도를 정의하는 표준이다.
DevOps 엔지니어가 이 구조를 이해해야 하는 이유는 세 가지다.

1. **컨테이너 이미지 설계**: 어떤 파일이 어디에 있어야 하는가
2. **디스크 파티셔닝 전략**: /var, /tmp를 왜 분리하는가
3. **보안 강화**: hostPath 마운트의 위험 디렉토리 파악

## 표준 현황

- **버전**: FHS 3.0 (2015년 발표, 최신)
- **관리 주체**: FreeDesktop.org
  (Linux Foundation → FreeDesktop.org로 이전, 2025-11)
- **FHS 4.0은 없음**. 향후 현대화 예고 단계

---

## 디렉토리 맵

```
/
├── bin  → /usr/bin (심볼릭 링크, usr-merge)
├── sbin → /usr/sbin (심볼릭 링크)
├── lib  → /usr/lib (심볼릭 링크)
├── boot          커널, initrd, 부트로더
├── dev           디바이스 파일 (udev 관리)
├── etc           호스트 고유 설정
├── home          사용자 홈 디렉토리
├── media         이동식 미디어 자동 마운트
├── mnt           임시 수동 마운트
├── opt           외부(비패키지) 애플리케이션
├── proc          프로세스·커널 가상 FS
├── root          루트 사용자 홈
├── run           런타임 데이터 (tmpfs)
├── srv           서비스 데이터
├── sys           커널 객체 가상 FS (sysfs)
├── tmp           임시 파일 (tmpfs 권장)
├── usr           읽기 전용 사용자 데이터
│   ├── bin       모든 사용자용 명령어
│   ├── lib       공유 라이브러리
│   ├── local     수동 설치 소프트웨어
│   ├── sbin      비필수 시스템 바이너리
│   └── share     아키텍처 독립 데이터 (man, doc)
└── var           가변 데이터
    ├── cache     재생성 가능 캐시
    ├── lib       가변 상태 (DB, 패키지 상태)
    ├── log       로그 파일
    ├── run  → /run (심볼릭 링크)
    ├── spool     큐 데이터 (메일, cron)
    └── tmp       재부팅 후에도 유지되는 임시 파일
```

---

## 핵심 디렉토리 상세

### /usr — 읽기 전용 사용자 데이터

FHS에서 `/usr`은 **두 번째 주요 계층**으로, 읽기 전용으로
마운트할 수 있도록 설계됐다.

```
/usr/bin    → 사용자 명령어 (ls, grep, python3 등)
/usr/sbin   → 시스템 관리 명령어 (useradd, iptables 등)
/usr/lib    → 공유 라이브러리
/usr/local  → 패키지 매니저 외 수동 설치 (로컬 오버라이드)
/usr/share  → 매뉴얼 페이지, 로케일, 문서
/usr/libexec → 다른 프로그램이 내부적으로 호출하는 바이너리
```

#### usr-merge: /bin → /usr/bin 통합

현대 배포판은 `/bin`, `/sbin`, `/lib`를 `/usr` 하위의
심볼릭 링크로 통합한다.

| 배포판 | usr-merge 상태 |
|--------|--------------|
| Fedora | 완료 (~2013) |
| RHEL 7+ | 완료 |
| Ubuntu | 완료 (신규 설치) |
| Debian 12+ | 완료 |
| openSUSE | 완료 (2021) |

**왜 중요한가**: `/usr`를 읽기 전용으로 마운트하면 Flatcar,
Fedora CoreOS 같은 Immutable OS의 원자적 업데이트가 가능해진다.
공격자가 루트 권한을 탈취해도 OS 바이너리를 수정할 수 없다.

---

### /var — 가변 데이터

재부팅 간에 지속되어야 하는 가변 데이터. 로그, DB 상태,
패키지 캐시, 스풀 등이 위치한다.

```
/var/log        시스템·애플리케이션 로그
/var/lib        영구 상태 데이터
  /var/lib/docker    Docker 이미지·컨테이너 데이터
  /var/lib/kubelet   Kubernetes 노드 상태
  /var/lib/etcd      etcd 데이터 (컨트롤 플레인)
/var/cache      재생성 가능 캐시 (apt 패키지 등)
/var/spool      처리 대기 큐 (메일, cron, 프린터)
/var/tmp        재부팅 후에도 유지되는 임시 파일
                (atime/mtime 모두 30일 초과 시 정리)
```

`/var/lib/docker`는 이미지·레이어 누적으로 디스크를 빠르게 소진한다.
정기적으로 점검하고 정리해야 한다.

```bash
# 사용량 확인
docker system df

# 미사용 이미지·컨테이너·볼륨·빌드 캐시 일괄 정리
docker system prune -a
```

**프로덕션에서 /var를 별도 파티션으로 분리하는 이유**:

- 로그·캐시 폭증이 루트 파티션 고갈로 이어지지 않는다
- 루트 파티션이 풀 때도 SSH 로그인 및 조치가 가능하다
- CIS Benchmark에서 `/var`, `/var/log`, `/var/log/audit`를
  별도 파티션으로 요구한다

---

### /tmp vs /var/tmp

| 항목 | /tmp | /var/tmp |
|------|------|----------|
| 저장 위치 | tmpfs (RAM) | 디스크 |
| 재부팅 후 | **삭제** | **유지** |
| 자동 정리 | 10일 초과 파일 | 30일 초과 파일 |
| 용도 | 소용량, 단기 임시 | 재부팅 간 유지 필요 임시 |

**tmpfs로 마운트하는 방법** (CIS 권장):

```ini
# /etc/fstab
tmpfs  /tmp  tmpfs  defaults,noatime,nosuid,nodev,noexec,size=2G  0  0
```

```bash
# systemd 방식 (이미 많은 배포판에서 기본 활성화)
systemctl enable tmp.mount

# 비활성화
systemctl mask tmp.mount
```

tmpfs 장점: I/O 성능 향상, 재부팅 시 자동 정리, 보안 옵션(`noexec`)
tmpfs 주의: RAM 소비, 대용량 임시 파일에 부적합

---

### /proc — 프로세스·커널 인터페이스 가상 파일시스템

커널이 프로세스 정보와 시스템 상태를 파일 형태로 노출한다.
**실제 파일이 아니다.** 읽을 때마다 커널에서 동적으로 생성된다.

**시스템 전체 정보**

```bash
# 메모리 상태
cat /proc/meminfo

# 로드 애버리지
cat /proc/loadavg          # 1분/5분/15분 평균, 실행중/전체 프로세스

# CPU 정보
cat /proc/cpuinfo

# 네트워크 소켓 상태
cat /proc/net/tcp          # 활성 TCP 연결 (16진수 주소)

# 마운트 목록
cat /proc/mounts
```

**프로세스별 정보 (/proc/PID/)**

```bash
PID=$(pidof nginx)

# 열린 파일 디스크립터 수
ls /proc/$PID/fd | wc -l

# 메모리 맵
cat /proc/$PID/maps

# I/O 통계
cat /proc/$PID/io

# 상태 요약
cat /proc/$PID/status
```

**sysctl — 커널 파라미터 조정**

```bash
# 런타임 변경 (재부팅 시 초기화)
sysctl -w net.ipv4.ip_forward=1

# 영구 적용 (파일로 관리)
cat > /etc/sysctl.d/99-custom.conf << EOF
net.ipv4.ip_forward = 1
vm.swappiness = 10
fs.file-max = 1000000
EOF

sysctl --system   # 전체 sysctl.d 파일 로드
```

sysctl 파일 로드 우선순위 (man 7 sysctl.d):
```
규칙 1: 파일명이 같으면 /etc/ > /run/ > /usr/lib/ 순으로 우선
규칙 2: 파일명이 다르면 사전순(lexicographic) 정렬로 뒤에 오는 파일이 이김
```

즉 `/usr/lib/sysctl.d/99-foo.conf`가 `/etc/sysctl.d/10-custom.conf`보다
**나중에** 적용된다. 운영자 설정 파일은 반드시 **60~90번대 접두사**를 사용해야
패키지 기본값에 덮어쓰이지 않는다.

```
/etc/sysctl.d/99-custom.conf    ← 99 접두사로 최우선 보장
/run/sysctl.d/
/usr/lib/sysctl.d/              ← 패키지 기본값
```

---

### /sys — 커널 객체 내보내기 (sysfs)

udev, cgroups, 드라이버 파라미터 등 커널 내부 객체를
파일시스템으로 노출한다.

```bash
# 네트워크 인터페이스 MTU
cat /sys/class/net/eth0/mtu

# 블록 디바이스 I/O 스케줄러 확인/변경
cat /sys/block/sda/queue/scheduler
echo mq-deadline > /sys/block/sda/queue/scheduler

# cgroups v2 메모리 제한 (컨테이너 관련)
cat /sys/fs/cgroup/memory.max

# CPU 주파수 거버너
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor
```

**cgroups와 /sys/fs/cgroup**: Docker, containerd, Kubernetes가
컨테이너 CPU/메모리 제한을 구현하는 핵심 경로다.
cgroups v2는 `/sys/fs/cgroup/` 아래 단일 계층 구조로 관리된다.

---

### /run — tmpfs 런타임 데이터

FHS 3.0이 `/var/run`을 대체하기 위해 추가한 디렉토리.
시스템 시작 시 tmpfs로 마운트되어 RAM에만 존재한다.

```
/run/docker.sock     Docker 소켓 (containerd 런타임 통신)
/run/sshd.pid        SSH 데몬 PID 파일
/run/lock/           락 파일 (이전 /var/lock)
/run/user/$UID/      로그인 사용자별 런타임 디렉토리
```

`/var/run` → `/run` 심볼릭 링크로 하위 호환성 유지.

---

### /etc — 호스트 고유 설정

바이너리를 제외한 호스트 고유 설정 파일만 위치한다.

**DevOps 관련 주요 경로**

```
/etc/systemd/           systemd 유닛·오버라이드
/etc/sysctl.d/          커널 파라미터 영구 설정
/etc/fstab              파일시스템 마운트 설정
/etc/hosts              로컬 DNS 오버라이드
/etc/resolv.conf        DNS 리졸버 설정
/etc/ssh/               SSH 서버·클라이언트 설정
/etc/kubernetes/        kubeadm 클러스터 설정
/etc/docker/            Docker 데몬 설정
/etc/cron.d/            예약 작업
```

---

## 디스크 파티셔닝 전략

### CIS Benchmark 권장 분리 파티션

| 파티션 | 마운트 옵션 | 이유 |
|--------|-----------|------|
| `/tmp` | nosuid, nodev, noexec | 악성 실행 파일 차단 |
| `/var` | — | 로그 폭증으로 인한 루트 고갈 방지 |
| `/var/tmp` | nosuid, nodev, noexec | 악성 실행 파일 차단 |
| `/var/log` | — | 감사 로그 격리 |
| `/var/log/audit` | — | auditd 데이터 보호 |
| `/home` | nosuid, nodev | 사용자 데이터 격리 |
| `/boot` | nodev | 부트로더·커널 보호, LUKS 루트 시 필수 |

```ini
# /etc/fstab 예시 (보안 강화)
/dev/sda3  /var         ext4  defaults             0 2
/dev/sda4  /var/log     ext4  defaults             0 2
tmpfs      /tmp         tmpfs nosuid,nodev,noexec,size=2G  0 0
```

---

## 컨테이너와 FHS

### OverlayFS와 이미지 레이어

Docker `overlay2` 드라이버는 이미지 레이어(읽기 전용)와
컨테이너 레이어(쓰기 가능)를 union mount한다.

```
컨테이너 레이어 (쓰기 가능)   ← 런타임 변경사항
이미지 레이어 3 (읽기 전용)
이미지 레이어 2 (읽기 전용)
이미지 레이어 1 (읽기 전용)   ← FROM 기반 이미지
```

**레이어 수 주의**: overlay2는 최대 128개 레이어를 지원한다.
`apt-get install` 후 `apt-get clean`을 **같은 RUN 명령**에서
실행해야 캐시가 레이어에 남지 않는다.

```dockerfile
# 잘못된 패턴: apt 캐시가 레이어에 남음
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get clean

# 올바른 패턴: 한 RUN에서 정리
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
```

### 컨테이너 내 /proc, /sys

컨테이너 시작 시 런타임이 새 마운트 네임스페이스를 생성한다.
- `/proc`: PID 네임스페이스 범위로 격리 → 자신의 프로세스만 보임
- `/sys/fs/cgroup`: 컨테이너 리소스 제한 경로 (호스트 공유)
- `/dev`: 최소한의 디바이스만 노출 (`/dev/null`, `/dev/zero` 등)

### Kubernetes hostPath 보안

hostPath로 민감 경로를 마운트하면 컨테이너 탈출이 가능하다.

```yaml
# 위험: 쓰기 가능 hostPath
volumes:
- name: proc
  hostPath:
    path: /proc       # 컨테이너 탈출 위험

# 안전: 읽기 전용 + 특정 서브경로
volumes:
- name: proc-stat
  hostPath:
    path: /proc/stat  # 최소 필요 경로만
volumeMounts:
- name: proc-stat
  mountPath: /host/proc/stat
  readOnly: true      # 반드시 readOnly
```

**고위험 hostPath 경로**: `/proc`, `/sys`, `/var/run`, `/root`,
`/etc`, `/dev`

**Kubernetes sysctl 설정**:

```yaml
# 네임스페이스화된 sysctl은 Pod 단위 설정 가능
apiVersion: v1
kind: Pod
spec:
  securityContext:
    sysctls:
    - name: net.ipv4.ip_local_port_range
      value: "1024 65535"
```

비네임스페이스 sysctl(예: `kernel.pid_max`)은 노드 직접 설정
또는 Node Tuning Operator가 필요하다.

---

## 참고 자료

- [FHS 3.0 공식 (FreeDesktop.org)](https://specifications.freedesktop.org/fhs/latest-single/)
  (확인: 2026-04-16)
- [FHS 3.0 아카이브 (Linux Foundation)](https://refspecs.linuxfoundation.org/FHS_3.0/index.html)
  (확인: 2026-04-16)
- [FreeDesktop.org FHS 관리 이전 — Phoronix](https://www.phoronix.com/news/FreeDesktop-Adopts-FHS)
  (확인: 2026-04-16)
- [Linux Kernel /proc 문서](https://docs.kernel.org/filesystems/proc.html)
  (확인: 2026-04-16)
- [systemd 임시 디렉토리 가이드](https://systemd.io/TEMPORARY_DIRECTORIES/)
  (확인: 2026-04-16)
- [Debian UsrMerge](https://wiki.debian.org/UsrMerge)
  (확인: 2026-04-16)
- [Kubernetes sysctl 클러스터 설정](https://kubernetes.io/docs/tasks/administer-cluster/sysctl-cluster/)
  (확인: 2026-04-16)
- [CIS RHEL 9 Benchmark v2.0.0](https://www.cisecurity.org/benchmark/red_hat_linux)
  (확인: 2026-04-16)
