---
title: "사용자·그룹·퍼미션 (ACL, setuid)"
sidebar_label: "사용자·그룹·퍼미션"
sidebar_position: 4
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - security
  - permissions
  - acl
  - capabilities
---

# 사용자·그룹·퍼미션 (ACL, setuid)

Linux 권한 체계는 컨테이너 보안의 기반이다.
잘못된 권한 설정 하나가 컨테이너 탈출로 이어지고,
SUID 바이너리 취약점이 root 권한 탈취로 이어진다.

## 기본 퍼미션 체계

### rwx 비트

| 비트 | 파일 | 디렉토리 |
|------|------|---------|
| `r` (4) | 내용 읽기 | `ls` 목록 조회 |
| `w` (2) | 내용 수정/삭제 | 파일 생성·삭제 |
| `x` (1) | 실행 | `cd`로 진입 (traverse) |

디렉토리에서 `x` 없이 `r`만 있으면 파일명은 보이지만
진입·접근이 불가하다.

예시 `-rwxr-xr-x  root  root  /usr/bin/ls`의 권한 해석:

| 위치 | 비트 | 대상 | 값 |
|------|------|------|------|
| 1~3 | `rwx` | 소유자 | 7 |
| 4~6 | `r-x` | 그룹 | 5 |
| 7~9 | `r-x` | 기타 | 5 |

합계 755.

### 자주 쓰는 권한 패턴

| 모드 | 설명 | 용도 |
|------|------|------|
| `600` | rw------- | 개인 SSH 키, 인증서 |
| `640` | rw-r----- | 설정 파일 (그룹만 읽기) |
| `644` | rw-r--r-- | 일반 파일 기본값 |
| `700` | rwx------ | 개인 스크립트 |
| `750` | rwxr-x--- | 서비스 실행 파일 (그룹만 실행) |
| `755` | rwxr-xr-x | 공용 바이너리, 디렉토리 기본값 |
| `770` | rwxrwx--- | 팀 공유 디렉토리 |

### umask

umask는 새로 생성되는 파일·디렉토리의 기본 권한에서
**제거할 비트**를 지정한다.

계산식: 파일 최대 권한 666, 디렉토리 최대 권한 777에서 umask 비트를 제거.

| umask | 파일 | 디렉토리 | 용도 |
|-------|------|---------|------|
| `022` | 644 | 755 | 가장 일반적 |
| `027` | 640 | 750 | 보안 강화 |
| `077` | 600 | 700 | 최대 보안 |

```bash
# 현재 umask 확인
umask

# 영구 설정 (시스템 전체)
echo "umask 027" >> /etc/profile.d/security.sh

# 서비스 계정 umask는 systemd로 관리
# /etc/systemd/system/myapp.service
[Service]
UMask=0027
```

---

## 특수 퍼미션 비트

### setuid (SUID)

파일 실행 시 **파일 소유자 권한**으로 실행된다.
`ls -l` 출력에서 소유자 `x` 자리가 `s`로 표시된다.

```bash
$ ls -l /usr/bin/passwd
-rwsr-xr-x  root  root  /usr/bin/passwd
```

소유자 실행 비트 자리의 `s`가 SUID 활성화 표시다.

`/usr/bin/passwd`가 root 소유 SUID인 이유:
일반 사용자가 자신의 비밀번호를 바꾸려면 root 전용 파일인
`/etc/shadow`에 쓰기가 필요하기 때문이다.

**설정 방법**:
```bash
chmod u+s /path/to/file   # 또는
chmod 4755 /path/to/file
```

**보안 위험**: SUID 바이너리의 취약점은 즉시 root 탈취로
이어진다. PwnKit(CVE-2021-4034)은 `pkexec` SUID 취약점으로
모든 Linux 배포판에서 root 탈취가 가능했다.

### setgid (SGID)

- **파일**: 실행 시 파일 **소유 그룹** 권한으로 실행
- **디렉토리**: 하위에 생성되는 파일이 디렉토리 소유 그룹을 상속

```bash
# 팀 공유 디렉토리 — 새 파일도 devteam 소유로 생성
chmod g+s /srv/shared
ls -ld /srv/shared
# drwxrwsr-x  root  devteam  /srv/shared
# 그룹 실행 비트 자리의 s가 SGID 활성화 표시
```

### sticky bit

디렉토리에서 **파일 소유자 또는 root**만 해당 파일을 삭제할 수 있다.

```bash
$ ls -ld /tmp
drwxrwxrwt  root  root  /tmp
# 기타 실행 비트 자리의 t가 sticky bit 활성화 표시

chmod +t /path/to/dir   # 또는
chmod 1777 /path/to/dir
```

### 특수 비트 정리

| 비트 | Octal | 파일 효과 | 디렉토리 효과 |
|------|-------|---------|------------|
| SUID | 4000 | 소유자 권한으로 실행 | (대부분 무시) |
| SGID | 2000 | 소유 그룹 권한으로 실행 | 새 파일이 그룹 상속 |
| Sticky | 1000 | (현대 Linux 무효) | 소유자만 파일 삭제 가능 |

### SUID/SGID 감사

```bash
# SUID 바이너리 목록
find / -perm -4000 -type f -ls 2>/dev/null

# SGID 바이너리 목록
find / -perm -2000 -type f -ls 2>/dev/null

# 둘 다
find / -perm /6000 -type f -ls 2>/dev/null

# 베이스라인 저장 → 변경 감지
find / -perm -4000 -type f 2>/dev/null | sort > /var/lib/suid-baseline.txt
# (주기적 실행 후 diff로 비교)
```

CIS Benchmark는 모든 SUID/SGID 바이너리의 존재 이유를
문서화하도록 요구한다.

---

## ACL (Access Control Lists)

기본 rwx 3계층 권한으로는 "특정 사용자에게만 접근 허용" 같은
세밀한 제어가 불가능하다. POSIX ACL은 이를 해결한다.

ACL 사용 전 파일시스템이 ACL을 지원하는지 확인한다.
ext4는 커널 3.8+ 이후 기본 활성화. XFS, NFS 등은 별도 확인이 필요하다.

```bash
# 파일시스템 ACL 지원 여부 확인 (ext4)
tune2fs -l /dev/sda1 | grep "Default mount options"
# "Default mount options: acl" 이 있어야 함

# 마운트 시 명시적 활성화 (/etc/fstab)
# UUID=...  /srv  ext4  defaults,acl  0 2

# ACL 확인
getfacl /srv/project

# 특정 사용자에게 읽기 권한 부여
setfacl -m u:alice:r-- /srv/project/report.txt

# 그룹에게 읽기+실행 권한
setfacl -m g:devteam:r-x /srv/project/

# 재귀 적용
setfacl -R -m g:devteam:r-x /srv/project/

# 권한 제거
setfacl -x u:alice /srv/project/report.txt

# 모든 ACL 제거
setfacl -b /srv/project/report.txt
```

### Default ACL — 하위 파일 자동 상속

```bash
# /srv/shared 아래 새로 생성되는 파일에도 감사팀 읽기 적용
setfacl -m d:g:auditors:r-x /srv/shared

# 기존 파일 + 향후 파일 모두 적용
setfacl -R -m u:ci:rwX,d:u:ci:rwX /srv/deploy
```

`getfacl` 출력에서 `default:` 접두사 항목이 상속 규칙이다.

### ACL mask

소유자를 제외한 모든 ACL 엔트리의 **최대 유효 권한 상한선**.
`chmod g-w`로 그룹 권한을 낮추면 ACL mask도 함께 낮아져
명시적 ACL이 의도치 않게 축소될 수 있다.

```bash
# mask 확인
getfacl /srv/project | grep mask

# mask 명시적 설정
setfacl -m m::rx /srv/project
```

### 실무 시나리오

- 개발/QA/운영 팀이 같은 디렉토리 공유
- CI/CD 서비스 계정에만 특정 디렉토리 쓰기 권한
- 감사팀에게 로그 디렉토리 읽기 권한

---

## Linux Capabilities

전통적으로 특권 작업은 root(UID 0)만 가능했다.
프로그램은 setuid-root로 **전체 root 권한**을 얻어야 했다.
Capabilities는 root 권한을 독립 단위로 분해하여
**최소 권한 원칙**을 실현한다.

### 주요 Capabilities

| Capability | 권한 | 위험도 |
|-----------|------|--------|
| `CAP_NET_BIND_SERVICE` | 1024 미만 포트 바인딩 | 낮음 |
| `CAP_CHOWN` | 파일 UID/GID 임의 변경 | 중 |
| `CAP_KILL` | 임의 프로세스에 시그널 전송 | 중 |
| `CAP_NET_RAW` | RAW/PACKET 소켓 사용 | 중 |
| `CAP_DAC_OVERRIDE` | 파일 권한 검사 우회 | 높음 |
| `CAP_NET_ADMIN` | 네트워크 설정·방화벽 | 높음 |
| `CAP_SYS_PTRACE` | 프로세스 디버깅 | 높음 |
| `CAP_SETUID` | 임의 UID 조작 | 매우 높음 |
| `CAP_SYS_ADMIN` | 마운트, 네임스페이스 등 | 매우 높음 |

> `CAP_SYS_ADMIN`은 "새로운 root"라 불릴 만큼 너무 많은 권한을
> 포함한다. 가능하면 더 구체적인 capability를 사용한다.

### 파일 Capabilities 설정

```bash
# 80 포트를 root 없이 바인딩 (Python 예시)
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/python3.12

# 확인
getcap /usr/bin/python3.12
# /usr/bin/python3.12 cap_net_bind_service=ep

# 제거
sudo setcap -r /usr/bin/python3.12

# 시스템 전체 capabilities 파일 탐색
find / -xdev -exec getcap {} + 2>/dev/null
```

**접미사 의미**:

| 접미사 | 설명 |
|--------|------|
| `+e` | Effective set에 추가 |
| `+p` | Permitted set에 추가 |
| `+i` | Inheritable set에 추가 |
| `=ep` | Effective + Permitted (일반적 사용) |

### 컨테이너와 Capabilities

Docker 기본 부여 Capabilities (14개):
```text
AUDIT_WRITE, CHOWN, DAC_OVERRIDE, FOWNER, FSETID, KILL,
MKNOD, NET_BIND_SERVICE, NET_RAW, SETFCAP, SETGID,
SETPCAP, SETUID, SYS_CHROOT
```

**보안 강화**: 모든 capability를 제거하고 필요한 것만 추가한다.

```bash
# Docker
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myapp
```

```yaml
# Kubernetes SecurityContext
securityContext:
  capabilities:
    drop: ["ALL"]
    add: ["NET_BIND_SERVICE"]
```

`privileged: true`는 호스트 커널이 지원하는 **모든 capability를 부여**한다
(커널 버전에 따라 상이, Linux 6.x 기준 40개 이상).
**가능하면 절대 사용하지 않는다.**

---

## /etc/passwd, /etc/shadow, /etc/group

### /etc/passwd

```text
root:x:0:0:root:/root:/bin/bash
nginx:x:101:101:nginx user:/var/cache/nginx:/usr/sbin/nologin
```

| 필드 | 설명 |
|------|------|
| username | 로그인 이름 |
| password | `x` = shadow 파일 사용 |
| UID | 0=root, 1-999=시스템, 1000+=일반 사용자 |
| GID | 기본 그룹 ID |
| GECOS | 전체 이름·부서·전화 (주석) |
| home | 로그인 시 `$HOME` |
| shell | `/usr/sbin/nologin` = 로그인 불가 |

### /etc/shadow — 비밀번호 해시

```text
alice:$y$j9T$salt$hash:19845:0:99999:7:::
```

두 번째 필드의 `$id$` 접두사가 해시 알고리즘 식별자다.

| `$id$` | 알고리즘 | 상태 |
|---------|---------|------|
| `$1$` | MD5 | **사용 금지** |
| `$5$` | SHA-256 | 레거시 |
| `$6$` | SHA-512 | 구형 시스템 기본값 |
| `$y$` | **yescrypt** | Debian 11+, Ubuntu 22.04+ 기본값 ← 권장 |

yescrypt는 메모리 하드 함수로 GPU 브루트포스에 강하다.

```bash
# 현재 기본 알고리즘 확인
grep ENCRYPT /etc/login.defs
```

**특수 패스워드 값**:
- `*` 또는 `!` : 계정 잠금 (직접 로그인 불가)
- `!!` : 비밀번호 미설정 (초기 계정)
- `!$6$...` : `passwd -l`로 잠금한 계정

---

## 실무 보안 패턴

### 서비스 계정 생성

```bash
# 쉘 없음, 홈 없음, 시스템 계정
useradd \
  --system \
  --no-create-home \
  --shell /usr/sbin/nologin \
  --comment "Nginx Service Account" \
  nginx

# systemd 서비스에서 umask도 지정
# /etc/systemd/system/nginx.service
[Service]
User=nginx
Group=nginx
UMask=0027
```

### sudo 정책

| 방법 | 특징 | 권장 여부 |
|------|------|----------|
| `su -` | root 비밀번호 필요, 개인 추적 불가 | 비권장 |
| `sudo` | 개인 계정 인증, `/var/log/auth.log`에 전체 로깅 | 권장 |
| root SSH | `/etc/ssh/sshd_config`에 `PermitRootLogin no` | 차단 |

```bash
# sudoers 편집 (항상 visudo 사용 — 문법 검사 포함)
visudo

# 최소 권한 위임 예시
alice  ALL=(ALL) /usr/bin/systemctl restart nginx
bob    ALL=(ALL) NOPASSWD: /usr/bin/journalctl -u nginx

# /etc/sudoers.d/ 분리 관리
# ⚠️ docker CLI 접근 = 사실상 root 권한
# docker run -v /:/host ubuntu chroot /host 한 줄로 호스트 탈출 가능
# rootless Docker 또는 Podman으로 대체하는 것이 올바른 접근
echo "devteam ALL=(ALL) /usr/bin/docker" > /etc/sudoers.d/devteam
chmod 440 /etc/sudoers.d/devteam
```

### PAM 계정 잠금 (pam_faillock)

CIS Benchmark는 브루트포스 방어를 위해 로그인 실패 횟수 제한을 요구한다.

```bash
# /etc/security/faillock.conf
deny = 5          # 5회 실패 시 잠금
unlock_time = 900 # 15분 후 자동 해제
fail_interval = 900

# 잠긴 계정 확인
faillock --user alice

# 수동 해제
faillock --user alice --reset
```

RHEL/Fedora: `pam_faillock`이 기본 활성화.
Ubuntu: `pam_faillock` 또는 `pam_tally2`를 `/etc/pam.d/common-auth`에 추가.

### 최소 권한 체크리스트

- [ ] 서비스 계정: nologin 쉘, 홈 없음
- [ ] 중요 설정 파일: 640 또는 600
- [ ] 서비스 디렉토리: 750 (기타 접근 차단)
- [ ] SUID 바이너리: 주기적 감사, 불필요한 것 제거
- [ ] capabilities: setuid 대신 파일 capabilities 사용
- [ ] sudo: 특정 명령어만 허용, NOPASSWD 최소화
- [ ] root SSH 로그인: 차단

---

## 컨테이너 환경

### Dockerfile USER

```dockerfile
FROM ubuntu:24.04
RUN groupadd -r appgroup && \
    useradd -r -g appgroup \
      -s /usr/sbin/nologin \
      --no-create-home \
      appuser
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["./myapp"]
```

### rootless 컨테이너

| 항목 | rootful Docker | rootless Docker | Podman rootless |
|------|---------------|----------------|----------------|
| 데몬 권한 | root | 사용자 | 데몬 없음 |
| 탈출 시 위험 | **root 탈취** | 사용자 권한만 | 사용자 권한만 |
| User Namespace | 없음 | 있음 | 있음 |

**User Namespace UID 매핑**:

| 컨테이너 내부 UID | 호스트 UID |
|-----------------|-----------|
| 0 (root) | 100000 |
| 1000 | 101000 |

범위는 `/etc/subuid`, `/etc/subgid`로 설정한다.

### Kubernetes SecurityContext

```yaml
spec:
  securityContext:
    runAsUser: 1000           # 컨테이너 실행 UID
    runAsGroup: 3000          # 컨테이너 실행 GID
    fsGroup: 2000             # 볼륨 마운트 소유 GID
    runAsNonRoot: true        # root 실행 차단
  containers:
  - name: app
    securityContext:
      # 기본값 nil = 허용(true). false로 명시해야 no_new_privs 플래그 설정됨
      # privileged: true 컨테이너에는 설정 불가 (API 유효성 검사 오류)
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        add: ["NET_BIND_SERVICE"]
      seccompProfile:
        type: RuntimeDefault
```

- `fsGroup`: 마운트된 볼륨의 GID 지정 → 공유 스토리지 접근에 필수
- `allowPrivilegeEscalation: false`: SUID/capabilities 상승 차단

---

## 참고 자료

- [Linux man7 capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html)
  (확인: 2026-04-16)
- [Kubernetes SecurityContext 공식 문서](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
  (확인: 2026-04-16)
- [Docker runtime privilege and capabilities](https://docs.docker.com/engine/containers/run/#runtime-privilege-and-linux-capabilities)
  (확인: 2026-04-16)
- [Docker rootless mode](https://docs.docker.com/engine/security/rootless/)
  (확인: 2026-04-16)
- [Rootless Podman User Namespace Modes — Red Hat](https://www.redhat.com/en/blog/rootless-podman-user-namespace-modes)
  (확인: 2026-04-16)
- [RHEL 10 sudo 관리 가이드](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/security_hardening/managing-sudo-access)
  (확인: 2026-04-16)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
  (확인: 2026-04-16)
