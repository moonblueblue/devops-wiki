---
title: "리눅스 파일시스템 구조 (FHS) 완전 가이드"
date: 2026-04-12
tags:
  - linux
  - filesystem
  - fhs
  - devops
---

# 리눅스 파일시스템 구조 (FHS)

Filesystem Hierarchy Standard(FHS)는 리눅스/유닉스 계열 OS의 디렉토리 구조 표준이다. Linux Foundation이 관리하며, 현재 FHS 3.0이 최신 버전이다.

DevOps 엔지니어가 서버를 다루려면 각 디렉토리의 역할을 정확히 알아야 한다. 설정 파일 위치, 로그 경로, 임시 파일 처리 등 모든 작업의 기본이다.

## 핵심 디렉토리 정리

### `/` (루트)

모든 파일과 디렉토리의 최상위. 물리적으로 다른 디스크에 있어도 논리적으로는 모두 `/` 아래에 마운트된다.

### `/etc` - 시스템 설정

호스트별 설정 파일이 위치한다. DevOps에서 가장 자주 건드리는 디렉토리.

```bash
# DevOps 실무에서 자주 다루는 파일들
/etc/hostname              # 호스트명
/etc/hosts                 # 정적 호스트-IP 매핑
/etc/resolv.conf           # DNS 설정
/etc/fstab                 # 파일시스템 마운트 테이블
/etc/ssh/sshd_config       # SSH 서버 설정
/etc/nginx/nginx.conf      # Nginx 설정
/etc/systemd/system/       # 커스텀 systemd 유닛
/etc/sudoers.d/            # sudo 권한 설정
/etc/crontab               # 시스템 cron
/etc/passwd                # 사용자 계정 정보
/etc/shadow                # 암호화된 패스워드
/etc/group                 # 그룹 정보
```

### `/var` - 가변 데이터

런타임에 변하는 데이터. 로그, 캐시, 스풀 등이 여기에 쌓인다.

```bash
/var/log/                  # 시스템 로그 (syslog, auth.log, journal)
/var/log/nginx/            # 애플리케이션 로그
/var/lib/docker/           # Docker 데이터 (이미지, 컨테이너, 볼륨)
/var/lib/kubelet/          # kubelet 데이터
/var/cache/apt/            # APT 패키지 캐시
/var/spool/cron/           # 사용자 crontab
/var/run -> /run           # 런타임 데이터 (심볼릭 링크)
```

> `/var/log`이 꽉 차면 시스템 전체가 먹통이 될 수 있다. 프로덕션 서버에서는 `/var`를 별도 파티션으로 분리하는 것이 권장된다.

### `/tmp` - 임시 파일

누구나 읽고 쓸 수 있는 임시 디렉토리. 재부팅 시 삭제된다 (systemd 기준 `systemd-tmpfiles-clean` 서비스가 관리).

```bash
# sticky bit이 설정되어 있어 다른 사용자의 파일 삭제 불가
ls -ld /tmp
# drwxrwxrwt 1 root root 4096 ...
#         ^ sticky bit (t)
```

보안상 중요: 빌드 스크립트나 CI/CD 파이프라인에서 `/tmp`에 민감한 데이터를 남기지 말 것.

### `/opt` - 서드파티 소프트웨어

패키지 관리자를 통하지 않고 설치하는 서드파티 소프트웨어의 표준 위치.

```bash
/opt/grafana/              # Grafana 수동 설치
/opt/prometheus/           # Prometheus 바이너리
/opt/cni/bin/              # Kubernetes CNI 플러그인
```

### `/usr` - 사용자 프로그램과 데이터

시스템의 대부분의 바이너리, 라이브러리, 문서가 위치한다. 읽기 전용으로 마운트 가능.

```bash
/usr/bin/                  # 일반 사용자 명령어 (ls, grep, kubectl 등)
/usr/sbin/                 # 시스템 관리 명령어 (iptables, systemctl 등)
/usr/lib/                  # 라이브러리
/usr/local/                # 로컬에서 직접 컴파일/설치한 소프트웨어
/usr/share/                # 아키텍처 독립 데이터 (man 페이지, 문서 등)
```

### `/home` - 사용자 홈 디렉토리

각 사용자의 개인 디렉토리. 서버에서는 SSH 키(`~/.ssh/`)와 셸 설정(`~/.bashrc`)이 주로 관리 대상.

```bash
/home/deploy/.ssh/authorized_keys   # 배포 계정 SSH 공개키
/home/deploy/.kube/config           # kubectl 설정
```

### `/proc` - 프로세스 정보 (가상)

커널이 메모리에 생성하는 가상 파일시스템. 실제 디스크에 존재하지 않는다.

```bash
cat /proc/cpuinfo          # CPU 정보
cat /proc/meminfo          # 메모리 정보
cat /proc/loadavg          # 시스템 부하
cat /proc/<PID>/status     # 특정 프로세스 상태
cat /proc/sys/net/ipv4/ip_forward  # IP 포워딩 설정 (Kubernetes 필수)

# 커널 파라미터 변경 (sysctl)
echo 1 > /proc/sys/net/ipv4/ip_forward
# 영구 적용은 /etc/sysctl.conf 또는 /etc/sysctl.d/
```

### `/sys` - 디바이스/드라이버 정보 (가상)

sysfs 가상 파일시스템. 하드웨어 및 드라이버 정보를 계층적으로 노출한다.

```bash
/sys/class/net/            # 네트워크 인터페이스 정보
/sys/block/                # 블록 디바이스 정보
/sys/fs/cgroup/            # cgroup 정보 (컨테이너 리소스 제한의 핵심)
```

### `/dev` - 디바이스 파일

시스템에 연결된 장치를 파일로 표현한다.

```bash
/dev/sda                   # 첫 번째 SCSI/SATA 디스크
/dev/nvme0n1               # 첫 번째 NVMe 디스크
/dev/null                  # 블랙홀 (출력 버리기)
/dev/zero                  # 무한 0 바이트 스트림
/dev/urandom               # 난수 생성기
```

### `/run` - 런타임 데이터

FHS 3.0에서 추가. tmpfs로 마운트되어 부팅 시 초기화된다.

```bash
/run/systemd/              # systemd 런타임 데이터
/run/docker.sock           # Docker 소켓
/run/containerd/           # containerd 런타임 소켓
```

## 2025-2026 변화: /usr Merge

현재 리눅스 생태계의 가장 큰 파일시스템 변화는 **`/usr` 병합**이다.

### 무엇이 바뀌나

기존에 분리되어 있던 `/bin`, `/sbin`, `/lib`가 `/usr/bin`, `/usr/sbin`, `/usr/lib`의 **심볼릭 링크**로 변경된다.

```bash
# /usr merge 완료된 시스템에서 확인
ls -la /bin
# lrwxrwxrwx 1 root root 7 ... /bin -> usr/bin

ls -la /sbin
# lrwxrwxrwx 1 root root 8 ... /sbin -> usr/sbin
```

### 배포판별 현황 (2026년 기준)

| 배포판 | /usr merge 상태 |
|--------|----------------|
| Fedora | 완료 (Fedora 17부터) |
| Debian 12+ | 완료 |
| Ubuntu 23.04+ | 완료 |
| RHEL 9 | 완료 |
| Alpine 3.23 | 도입 (신규 설치 기본 적용) |
| Gentoo | 진행 중 |

### 왜 하는가

- **systemd 255+** 에서 필수 요건
- 패키지 관리 단순화 (바이너리 중복 제거)
- 읽기 전용 `/usr` 마운트로 **불변(immutable) 이미지** 기반 배포 지원
- 컨테이너/OSTree 기반 시스템과의 호환성

### DevOps 영향

- Dockerfile에서 바이너리 경로를 `/bin/sh` 대신 `/usr/bin/sh`로 작성해도 되지만, 심볼릭 링크 덕분에 기존 경로도 계속 동작
- Alpine 기반 컨테이너 이미지를 사용한다면 3.23 이후 변화에 주의
- Ansible/Terraform 스크립트에서 하드코딩된 경로가 있다면 점검 필요

## 실무 팁

### 파티션 분리 권장 구성

프로덕션 서버에서는 다음 디렉토리를 별도 파티션/볼륨으로 분리하는 것이 좋다:

| 디렉토리 | 이유 |
|----------|------|
| `/var/log` | 로그 폭증으로 인한 디스크 풀 방지 |
| `/var/lib/docker` | 컨테이너 데이터 격리 |
| `/tmp` | 임시 파일이 루트 파티션 침범 방지 |
| `/home` | 사용자 데이터 격리 |

### 디렉토리 확인 명령어

```bash
# 디스크 사용량 확인
df -h

# 디렉토리별 사용량
du -sh /var/log/*

# 파일시스템 타입 확인
findmnt --real

# 마운트된 tmpfs 확인
findmnt -t tmpfs
```

## 참고 링크

- [FHS 3.0 공식 문서](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html)
- [The Case for the /usr Merge (systemd.io)](https://systemd.io/THE_CASE_FOR_THE_USR_MERGE/)
- [Alpine Linux /usr Merge 공지](https://www.alpinelinux.org/posts/2025-10-01-usr-merge.html)
