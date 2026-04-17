---
title: "auditd 감사 로깅 — 커널 감사 서브시스템 완전 가이드"
sidebar_label: "auditd 감사 로깅"
sidebar_position: 5
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - security
  - auditd
  - audit
  - stig
  - cis
---

# auditd 감사 로깅

auditd는 Linux 커널에 내장된 감사(audit) 서브시스템의
사용자 영역 데몬이다.
모든 보안 관련 이벤트를 커널 수준에서 포착하여 디스크에 기록한다.

PCI-DSS, HIPAA, STIG, CIS Benchmark 등
컴플라이언스 기준에서 필수로 요구하며,
침해 사고 대응(IR)과 위협 탐지의 핵심 데이터 소스다.

---

## 아키텍처

### 이벤트 흐름

```
┌─────────────────────────────────────────────────────────┐
│                       커널 공간                          │
│                                                         │
│  syscall / file watch / user event                      │
│         │                                               │
│         ▼                                               │
│  [kernel audit subsystem]                               │
│   - 이벤트 생성 & 직렬화                                  │
│   - 필터 규칙 평가 (task/exit/user/exclude/filesystem)   │
│   - 백로그 큐에 적재                                      │
└──────────────┬──────────────────────────────────────────┘
               │  NETLINK_AUDIT socket
               ▼
┌─────────────────────────────────────────────────────────┐
│                      사용자 공간                          │
│                                                         │
│  auditd (데몬)                                          │
│   ├── 로그 파일 기록 (/var/log/audit/audit.log)           │
│   └── audisp dispatcher                                 │
│         ├── audisp-syslog  → syslog/journald            │
│         ├── audisp-remote  → 원격 audit 서버             │
│         └── laurel         → JSON 변환 → SIEM           │
│                                                         │
│  auditctl  ─── 규칙 로드/조회/삭제                        │
│  ausearch  ─── 이벤트 검색                               │
│  aureport  ─── 요약 보고서                               │
│  augenrules ── rules.d/ 컴파일 → audit.rules            │
└─────────────────────────────────────────────────────────┘
```

**핵심 특성**: auditd가 없어도 커널은 이벤트를 생성한다.
auditd 미실행 시 이벤트는 `dmesg`에 출력된다.
커널과 auditd 사이에 추가 계층이 없어 우회가 불가능하다.

---

### 주요 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `auditd` | 커널 이벤트 수신 → 로그 파일 기록, audisp에 배포 |
| `auditctl` | 규칙 로드·삭제·조회, 커널 파라미터 설정 |
| `augenrules` | `rules.d/*.rules` 파일을 하나의 `audit.rules`로 컴파일 |
| `ausearch` | 이벤트 검색 (시간·사용자·syscall·키·파일 등) |
| `aureport` | 인증·파일·syscall·실행파일별 요약 보고서 생성 |
| `audisp` | 실시간 이벤트 디스패처 (auditd 내장) |
| `audisp-plugins` | syslog·remote·af_unix 등 외부 플러그인 |

---

### 주요 파일 위치

```
/etc/audit/
├── auditd.conf              # 데몬 설정
├── audit.rules              # augenrules가 컴파일한 최종 규칙
├── audit-stop.rules         # 종료 시 로드 규칙
└── rules.d/                 # 규칙 소스 파일 (번호순 병합)
    ├── 10-base-config.rules
    ├── 30-stig.rules
    └── 99-finalize.rules

/etc/audit/plugins.d/        # audisp 플러그인 설정
├── af_unix.conf
├── au-remote.conf
└── syslog.conf

/var/log/audit/
└── audit.log                # 감사 로그 (기본 위치)

/usr/share/audit/sample-rules/  # 배포판 제공 예시 규칙
```

---

## audit.rules 규칙 문법

### 규칙 3가지 유형

| 유형 | 문법 | 목적 |
|------|------|------|
| **Control** | `-b`, `-e`, `-f`, `-r` | 버퍼 크기, 활성화 모드, 실패 정책 설정 |
| **File watch** | `-w path -p perms -k key` | 파일·디렉토리 접근 감시 |
| **System call** | `-a action,filter -S syscall -F field=val -k key` | syscall 이벤트 감사 |

---

### `-a` action, filter 상세

```
-a action,filter
```

**action**

| 값 | 동작 |
|----|------|
| `always` | 감사 컨텍스트 할당, 항상 레코드 생성 |
| `never` | 레코드 생성 안 함 (노이즈 제거용) |

**filter (목록 이름)**

| 필터 | 평가 시점 | 사용 가능 필드 |
|------|----------|--------------|
| `task` | fork/clone 시 | uid, gid, euid, egid, loginuid |
| `exit` | syscall 종료 시 | 모든 필드 (가장 일반적) |
| `user` | 사용자 공간 이벤트 | uid, pid, msgtype |
| `exclude` | 이벤트 제외 필터 | msgtype |
| `filesystem` | 파일시스템 단위 | fstype |

---

### `-w` 파일 감시 (File Watch)

```bash
# 형식
-w <path> -p <perms> -k <key>

# 권한 필터 (조합 가능)
r = 읽기
w = 쓰기
x = 실행
a = 속성 변경 (chmod, chown, setxattr 등)
```

```bash
# /etc/passwd 쓰기·속성 변경 감시
-w /etc/passwd -p wa -k identity

# /etc/sudoers 디렉토리 전체 감시
-w /etc/sudoers.d/ -p wa -k sudo_rules

# /usr/bin/ 실행 파일 감시
-w /usr/bin/sudo -p x -k sudo_exec
```

> **주의**: `-w`는 내부적으로 `-a always,exit -F path=...`로
> 변환된다. 공식 문서에서는 `-F path`/`-F dir` 직접 사용을
> 권장한다(deprecated 경고 없이 동등).

---

### `-S` syscall 규칙

```bash
# 형식
-a always,exit -F arch=b64 -S <syscall>[,syscall2,...] \
  -F <field>=<value> -k <key>

# 단일 syscall
-a always,exit -F arch=b64 -S openat -F success=0 -k access_denied

# 복수 syscall (성능상 권장)
-a always,exit -F arch=b64 \
  -S unlink,unlinkat,rename,renameat \
  -F auid>=1000 -F auid!=unset -k delete
```

**아키텍처 명시 필수**: x86_64에서 32비트 호환 syscall은
번호가 다르므로 b32/b64 규칙을 각각 작성해야 한다.

```bash
# 올바른 bi-arch 규칙 작성
-a always,exit -F arch=b32 -S chmod,fchmod,fchmodat -k perm_mod
-a always,exit -F arch=b64 -S chmod,fchmod,fchmodat -k perm_mod
```

---

### `-k` 키 태그

```bash
# 최대 32바이트 문자열
-k <keyname>

# 동일 키로 여러 규칙 그룹화 → ausearch -k <key>로 한번에 조회
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/group  -p wa -k identity
```

---

### `-F` 주요 필드

| 필드 | 설명 | 예시 |
|------|------|------|
| `arch` | CPU 아키텍처 | `arch=b64` |
| `auid` | 로그인 감사 UID (su 후에도 유지) | `auid>=1000` |
| `uid` / `euid` | 프로세스 UID / 유효 UID | `uid=0` |
| `path` | 단일 파일 경로 | `path=/etc/shadow` |
| `dir` | 디렉토리 (재귀) | `dir=/home` |
| `perm` | 파일 접근 권한 | `perm=wa` |
| `success` | syscall 성공 여부 | `success=0` |
| `exit` | syscall 반환 코드 | `exit=-EACCES` |
| `exe` | 실행 중인 바이너리 | `exe=/usr/bin/sudo` |

---

### 규칙 우선순위와 첫 매칭 종료

auditd 규칙은 **파일 번호순(오름차순)** 으로 로드된다.
순서대로 평가하며 **`never` 규칙에 먼저 매칭되면
이후 `always` 규칙은 무시**된다.

```
# 10-base-config.rules  → 제어 규칙 (버퍼, 모드)
# 20-dont-audit.rules   → 노이즈 제외 (never)  ← 상단 배치 핵심
# 30-stig.rules         → 주요 규칙
# 99-finalize.rules     → 불변 모드 설정 (-e 2)
```

---

## 표준 규칙 세트

### CIS Benchmark 기반 핵심 규칙

CIS Linux Benchmark는 섹션별로 auditd 규칙을 정의한다.

```bash
## ── 제어 설정 ──────────────────────────────────────────
# 백로그 버퍼 크기 (기본 8192)
-b 8192
# 실패 시 동작 (1=printk 로그만, 2=kernel panic)
# -f 2는 backlog 오버플로 등 일시적 이벤트에도 커널 패닉 유발
# 프로덕션 적용 전 -f 1로 안정성 확인 필수
-f 2

## ── 시간 변경 감시 ──────────────────────────────────────
-a always,exit -F arch=b32 -S adjtimex,settimeofday,stime -k time-change
-a always,exit -F arch=b64 -S adjtimex,settimeofday -k time-change
-a always,exit -F arch=b32 -S clock_settime -k time-change
-a always,exit -F arch=b64 -S clock_settime -k time-change
-w /etc/localtime -p wa -k time-change

## ── 신원 정보 변경 ──────────────────────────────────────
-w /etc/group   -p wa -k identity
-w /etc/passwd  -p wa -k identity
-w /etc/gshadow -p wa -k identity
-w /etc/shadow  -p wa -k identity
-w /etc/security/opasswd -p wa -k identity

## ── 네트워크 환경 변경 ───────────────────────────────────
-a always,exit -F arch=b32 -S sethostname,setdomainname -k system-locale
-a always,exit -F arch=b64 -S sethostname,setdomainname -k system-locale
-w /etc/hosts    -p wa -k system-locale
-w /etc/hostname -p wa -k system-locale

## ── MAC 정책 변경 (SELinux/AppArmor) ────────────────────
-w /etc/selinux/ -p wa -k MAC-policy
-w /usr/share/selinux/ -p wa -k MAC-policy
-w /etc/apparmor/   -p wa -k MAC-policy
-w /etc/apparmor.d/ -p wa -k MAC-policy

## ── 로그인/로그아웃 감시 ─────────────────────────────────
-w /var/log/lastlog -p wa -k logins
-w /var/run/faillock -p wa -k logins

## ── 세션 시작 감시 ──────────────────────────────────────
-w /var/run/utmp -p wa -k session
-w /var/log/wtmp -p wa -k logins
-w /var/log/btmp -p wa -k logins

## ── 권한 변경 감시 ──────────────────────────────────────
-a always,exit -F arch=b32 \
  -S chmod,fchmod,fchmodat,chown,fchown,fchownat,lchown \
  -F auid>=1000 -F auid!=unset -k perm_mod
-a always,exit -F arch=b64 \
  -S chmod,fchmod,fchmodat,chown,fchown,fchownat,lchown \
  -F auid>=1000 -F auid!=unset -k perm_mod
-a always,exit -F arch=b32 \
  -S setxattr,lsetxattr,fsetxattr,removexattr,lremovexattr,fremovexattr \
  -F auid>=1000 -F auid!=unset -k perm_mod
-a always,exit -F arch=b64 \
  -S setxattr,lsetxattr,fsetxattr,removexattr,lremovexattr,fremovexattr \
  -F auid>=1000 -F auid!=unset -k perm_mod

## ── 접근 실패 감시 ──────────────────────────────────────
-a always,exit -F arch=b32 \
  -S open,openat,creat,truncate,ftruncate \
  -F exit=-EACCES -F auid>=1000 -F auid!=unset -k access
-a always,exit -F arch=b64 \
  -S open,openat,creat,truncate,ftruncate \
  -F exit=-EACCES -F auid>=1000 -F auid!=unset -k access
-a always,exit -F arch=b32 \
  -S open,openat,creat,truncate,ftruncate \
  -F exit=-EPERM -F auid>=1000 -F auid!=unset -k access
-a always,exit -F arch=b64 \
  -S open,openat,creat,truncate,ftruncate \
  -F exit=-EPERM -F auid>=1000 -F auid!=unset -k access

## ── 파일 삭제 감시 ──────────────────────────────────────
-a always,exit -F arch=b32 \
  -S unlink,unlinkat,rename,renameat \
  -F auid>=1000 -F auid!=unset -k delete
-a always,exit -F arch=b64 \
  -S unlink,unlinkat,rename,renameat \
  -F auid>=1000 -F auid!=unset -k delete

## ── sudo 규칙 변경 감시 ─────────────────────────────────
-w /etc/sudoers   -p wa -k sudo_rules
-w /etc/sudoers.d -p wa -k sudo_rules

## ── 커널 모듈 관련 ──────────────────────────────────────
-w /sbin/insmod  -p x -k modules
-w /sbin/rmmod   -p x -k modules
-w /sbin/modprobe -p x -k modules
-a always,exit -F arch=b32 -S init_module,finit_module,delete_module -k modules
-a always,exit -F arch=b64 -S init_module,finit_module,delete_module -k modules
```

---

### STIG 추가 규칙 (30-stig.rules 핵심)

STIG은 CIS보다 더 광범위한 syscall 감사를 요구한다.

```bash
## ── mount 이벤트 ────────────────────────────────────────
-a always,exit -F arch=b32 -S mount -F auid>=1000 -F auid!=unset -k export
-a always,exit -F arch=b64 -S mount -F auid>=1000 -F auid!=unset -k export

## ── 권한 상승 도구 감시 ─────────────────────────────────
-w /usr/bin/sudo    -p x -k priv_esc
-w /usr/bin/su      -p x -k priv_esc
-w /usr/bin/newgrp  -p x -k priv_esc
-w /bin/umount      -p x -k priv_esc

## ── setuid 바이너리 실행 (특권 프로세스) ────────────────
-a always,exit -F arch=b32 -S execve -C uid!=euid -F euid=0 -k setuid
-a always,exit -F arch=b64 -S execve -C uid!=euid -F euid=0 -k setuid
-a always,exit -F arch=b32 -S execve -C gid!=egid -F egid=0 -k setgid
-a always,exit -F arch=b64 -S execve -C gid!=egid -F egid=0 -k setgid

## ── 네트워크 연결 감시 ──────────────────────────────────
-a always,exit -F arch=b32 -S connect -F auid!=unset -k network_connect
-a always,exit -F arch=b64 -S connect -F auid!=unset -k network_connect
-a always,exit -F arch=b32 -S accept  -F auid!=unset -k network_connect
-a always,exit -F arch=b64 -S accept  -F auid!=unset -k network_connect

## ── 불변 모드 (반드시 마지막) ───────────────────────────
-e 2
```

---

## 로그 이벤트 타입

### 멀티레코드 이벤트 구조

하나의 감사 이벤트는 **동일한 serial number**를 공유하는
복수의 레코드로 구성된다.

```
# 동일 이벤트 (serial=1728234567.890:12345)
type=SYSCALL  msg=audit(1728234567.890:12345): arch=c000003e syscall=59 ...
type=EXECVE   msg=audit(1728234567.890:12345): argc=3 a0="cat" ...
type=CWD      msg=audit(1728234567.890:12345): cwd="/root"
type=PATH     msg=audit(1728234567.890:12345): item=0 name="/usr/bin/cat" ...
type=PROCTITLE msg=audit(1728234567.890:12345): proctitle=636174002F...
```

---

### 주요 이벤트 타입

| 타입 | 설명 |
|------|------|
| `SYSCALL` | syscall 메타데이터 (PID, UID, auid, exe, 성공 여부) |
| `EXECVE` | 실행된 명령어와 인자 (a0, a1, a2...) |
| `PATH` | syscall에 전달된 파일 경로, 권한, inode |
| `CWD` | 프로세스의 현재 작업 디렉토리 |
| `PROCTITLE` | 프로세스 제목 (hex 인코딩, 256자 제한) |
| `LOGIN` | 로그인 이벤트 (uid, auid, tty) |
| `USER_AUTH` | PAM 인증 성공/실패 |
| `USER_LOGIN` | 사용자 로그인 완료 |
| `USER_CMD` | sudo 명령 실행 |
| `USER_START` | 세션 시작 |
| `USER_END` | 세션 종료 |
| `AVC` | SELinux/AppArmor 접근 거부 |
| `SECCOMP` | seccomp 필터 위반 |
| `ANOM_ABEND` | 비정상 프로세스 종료 |
| `CONFIG_CHANGE` | auditd 설정 변경 |
| `KERN_MODULE` | 커널 모듈 로드/언로드 |

---

### SYSCALL 레코드 주요 필드

```
type=SYSCALL msg=audit(1728234567.890:12345): \
  arch=c000003e \     # CPU 아키텍처 (c000003e = x86_64)
  syscall=59 \        # syscall 번호 (59 = execve)
  success=yes \       # 성공 여부
  exit=0 \            # 반환값
  a0=5625c8 \         # 인자 0 (hex)
  a1=5625d0 \         # 인자 1
  a2=5625e8 \         # 인자 2
  a3=7fff \           # 인자 3
  items=2 \           # PATH 레코드 수
  ppid=1234 \         # 부모 PID
  pid=5678 \          # 프로세스 PID
  auid=1000 \         # 로그인 감사 UID (su 후에도 유지!)
  uid=0 \             # 현재 UID
  gid=0 \             # 현재 GID
  euid=0 \            # 유효 UID
  suid=0 \            # 저장 UID
  fsuid=0 \           # 파일시스템 UID
  egid=0 \
  sgid=0 \
  fsgid=0 \
  tty=pts0 \          # 터미널
  ses=5 \             # 세션 ID
  comm="bash" \       # 명령어 이름
  exe="/usr/bin/bash" \ # 실행 파일 경로
  subj=unconfined \   # SELinux 레이블
  key="delete"        # 매칭된 규칙 키
```

> **auid**: 로그인 시 할당되는 감사 UID.
> `su`나 `sudo`로 UID가 변경되어도 auid는 유지된다.
> 원래 사용자를 추적하는 핵심 필드다.

---

## auditd.conf 주요 설정

```ini
# /etc/audit/auditd.conf

## ── 로그 파일 ────────────────────────────────────────
log_file = /var/log/audit/audit.log
# RAW: 커널 원본 형식 | ENRICHED: uid→이름 등 변환
log_format = ENRICHED
log_group = root
write_logs = yes

## ── 로그 로테이션 ────────────────────────────────────
# 단일 파일 최대 크기 (MiB)
max_log_file = 100
# 도달 시 동작: ROTATE | SYSLOG | SUSPEND | KEEP_LOGS | IGNORE
max_log_file_action = ROTATE
# 유지할 로그 파일 수 (ROTATE 사용 시)
num_logs = 10

## ── 플러시 정책 ──────────────────────────────────────
# SYNC: 매 이벤트마다 fsync (가장 안전, 가장 느림)
# DATA: 데이터만 fsync (메타데이터 제외)
# INCREMENTAL_ASYNC: freq개마다 비동기 fsync (기본값)
# INCREMENTAL: freq개마다 동기 fsync
# NONE: 플러시 안 함
flush = INCREMENTAL_ASYNC
freq = 50

## ── 디스크 공간 관리 ─────────────────────────────────
# 첫 번째 경고 (MiB 기준 여유 공간)
space_left = 250
# 첫 번째 경고 시 동작: SYSLOG | EMAIL | EXEC | SUSPEND | SINGLE | HALT
space_left_action = SYSLOG
# 관리자 이메일 (email 액션 사용 시)
action_mail_acct = root

# 긴급 경고 (space_left보다 작아야 함)
admin_space_left = 50
# SINGLE = 단일 사용자 모드 전환 → 서비스 다운 동등
# CIS/STIG 요구사항이나 고가용성 서버는 SYSLOG + 외부 알림 조합 권장
admin_space_left_action = SINGLE

# 디스크 가득 참
disk_full_action = SINGLE

## ── 기타 ────────────────────────────────────────────
# auditd 시작 시 우선순위
priority_boost = 4
# dispatcher (audisp) 비활성화 시 none
name_format = NONE
```

### 플러시 정책 비교

```
보안성 우선:  SYNC > DATA > INCREMENTAL > INCREMENTAL_ASYNC > NONE
성능 우선:    NONE > INCREMENTAL_ASYNC > INCREMENTAL > DATA > SYNC
```

| 설정 | 성능 | 데이터 안전성 | 권장 환경 |
|------|------|-------------|---------|
| `SYNC` | 낮음 | 최고 | 컴플라이언스 엄격 |
| `DATA` | 보통 | 높음 | 균형 환경 |
| `INCREMENTAL_ASYNC` | 높음 | 보통 | 일반 서버 (기본값) |
| `INCREMENTAL` | 보통 | 보통 | — |
| `NONE` | 최고 | 낮음 | 개발/테스트 |

---

## audisp 플러그인

### plugins.d 설정 파일 구조

```ini
# /etc/audit/plugins.d/syslog.conf
active = yes
direction = out
path = builtin_syslog
type = builtin
args = LOG_INFO LOG_LOCAL6
format = string
```

```ini
# /etc/audit/plugins.d/au-remote.conf
active = no
direction = out
path = /sbin/audisp-remote
type = always
args = /etc/audit/audisp-remote.conf
format = string
```

### audisp-remote 원격 집계 설정

```ini
# /etc/audit/audisp-remote.conf
remote_server = siem.example.com
port = 60
transport = TCP            # TCP | KRB5
mode = immediate           # immediate | forward (큐 사용)
queue_file = /var/spool/audit/remote.log
queue_depth = 2048
fail_action = syslog       # 연결 실패 시: ignore | syslog | suspend | single | halt
network_retry_time = 1
max_tries_per_record = 3
```

---

## ausearch / aureport 실무 쿼리

### ausearch 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-k KEY` | 키 태그로 검색 |
| `-m TYPE` | 메시지 타입으로 검색 |
| `-ui UID` | UID로 검색 |
| `-ul AUID` | 로그인 UID로 검색 |
| `-ts TIME` | 시작 시간 (today, yesterday, boot, recent) |
| `-te TIME` | 종료 시간 |
| `-f FILE` | 파일명으로 검색 |
| `-sc SYSCALL` | syscall명으로 검색 |
| `-i` | 숫자 값을 사람이 읽기 쉽게 변환 |
| `--format text` | 텍스트 형식 출력 |

```bash
## ── 기본 검색 ────────────────────────────────────────
# 키 태그로 검색
ausearch -k identity -i

# 오늘 실패한 접근 시도
ausearch -k access -ts today -i

# 특정 사용자의 sudo 사용 내역
ausearch -k sudo_rules -ul 1000 -i

# AVC(SELinux 거부) 이벤트
ausearch -m AVC,USER_AVC -ts today -i

# 최근 로그인 실패
ausearch -m USER_AUTH --success no -ts today -i

## ── 시간 범위 검색 ────────────────────────────────────
# 특정 시간대
ausearch -ts 2026-04-17 08:00:00 -te 2026-04-17 18:00:00 -k delete -i

# 어제 전체
ausearch -ts yesterday -te today -k identity -i

## ── 이벤트 상세 조회 ──────────────────────────────────
# 특정 이벤트 ID로 전체 레코드 조회
ausearch -a 12345 -i

# raw 출력을 aureport에 파이프
ausearch -k sudo_rules --raw | aureport --executable -i

## ── 실행 파일 추적 ────────────────────────────────────
# root가 실행한 명령 (성공만)
ausearch --uid 0 --syscall execve --success yes -i
```

### aureport 주요 보고서

```bash
## ── 요약 보고서 ──────────────────────────────────────
# 전체 요약
aureport --summary

# 인증 시도 보고서 (성공/실패 포함)
aureport --auth --summary -i

# 오늘 실패한 인증
aureport --auth --failed -ts today -i

# 실행 파일별 요약 (가장 많이 실행된 것 확인)
aureport --executable --summary -i

# syscall별 요약
aureport --syscall --summary -i

# 사용자별 활동 요약
aureport --user --summary -i

# 파일 접근 이벤트
aureport --file --summary -i

## ── 특정 기간 분석 ────────────────────────────────────
# 주간 보고서
aureport -ts this-week --summary -i

# 프로세스별 보고서
aureport --pid --summary -ts today -i

## ── 필터링 조합 ──────────────────────────────────────
# 특정 로그 파일 분석
aureport --auth --input /var/log/audit/audit.log.1 -i

# 실패한 syscall만
aureport --syscall --failed -i
```

---

## 고급 사용 사례

### 1. sudoers 변경 감시

```bash
# 규칙
-w /etc/sudoers   -p wa -k sudo_rules
-w /etc/sudoers.d -p wa -k sudo_rules

# 조회
ausearch -k sudo_rules -i | grep -E "type=PATH|type=SYSCALL"
```

### 2. /etc/passwd, /etc/shadow 변경 감시

```bash
# 규칙
-w /etc/passwd  -p wa -k identity
-w /etc/shadow  -p wa -k identity
-w /etc/gshadow -p wa -k identity

# 조회 (마지막 변경 시간 포함)
ausearch -k identity -ts today -i
```

### 3. 파일 삭제 탐지

```bash
# 규칙 (unlinkat, rename 포함)
-a always,exit -F arch=b64 \
  -S unlink,unlinkat,rename,renameat,rmdir \
  -F auid>=1000 -F auid!=unset -k delete

# 조회
ausearch -k delete -ts today -i | grep "success=yes"
```

### 4. setuid 바이너리 실행 탐지

```bash
# 규칙: UID가 0이 아닌 사용자가 euid=0으로 실행 (setuid 바이너리)
-a always,exit -F arch=b64 -S execve \
  -C uid!=euid -F euid=0 -k setuid_exec

# 조회
ausearch -k setuid_exec -i | grep "euid=0"
```

### 5. 네트워크 연결 이벤트 감시

```bash
# 규칙 (outbound connect)
-a always,exit -F arch=b64 -S connect \
  -F auid!=unset -F auid>=1000 -k network_out

# 조회
ausearch -k network_out -ts today -i

# ausearch 결과에서 주소 추출
ausearch -k network_out -i | grep "saddr="
```

### 6. 커널 모듈 로드 감시

```bash
# 규칙
-a always,exit -F arch=b64 \
  -S init_module,finit_module,delete_module -k modules

# 조회
ausearch -k modules -i
```

### 7. 권한 없는 파일 접근 실패

```bash
# 규칙
-a always,exit -F arch=b64 \
  -S openat -F exit=-EACCES -k access_denied
-a always,exit -F arch=b64 \
  -S openat -F exit=-EPERM  -k access_denied

# 조회: 오늘 가장 많이 접근 거부된 파일
ausearch -k access_denied -ts today --raw \
  | aureport --file -i | sort -k 4 -rn | head -20
```

---

## 컨테이너 환경에서의 auditd

### 핵심 원칙

```
┌─────────────────────────────────────────────┐
│               호스트 커널                    │
│                                             │
│  audit subsystem (네임스페이스 미격리)         │
│         │                                   │
│         ├── 호스트 프로세스 이벤트             │
│         ├── container-A 이벤트               │
│         └── container-B 이벤트               │
│                                             │
│  호스트 auditd가 모든 이벤트를 수집            │
└─────────────────────────────────────────────┘
```

- audit 서브시스템은 **네트워크 네임스페이스처럼 격리되지 않는다**
- 호스트의 auditd 하나가 **모든 컨테이너의 syscall을 수집**한다
- 컨테이너 내부에서 auditd를 직접 실행하는 것은 불가능하다
  (`CONFIG_AUDIT`가 컨테이너에 노출되지 않음)

---

### audit_container_id (배포판 패치 커널)

컨테이너 식별자를 audit 레코드에 포함하는 기능이다.
패치셋이 2018년부터 제안됐지만 upstream 메인라인에는
아직 미포함 상태이며, 일부 배포판 커널에서만 실험적 지원이다.

```bash
# 컨테이너 프로세스에 container ID 부여
echo 123456 > /proc/<container_init_pid>/audit_containerid

# 레코드에 contid 필드가 추가됨
type=SYSCALL msg=audit(...): ... contid=123456

# 특정 컨테이너 이벤트만 필터링
auditctl -a always,exit -F arch=b64 -S execve \
  -F contid=123456 -k container_exec

# 조회
ausearch --containerid 123456 -i
```

> 이 기능은 컨테이너 런타임(containerd 등)이
> `audit_containerid`를 설정해야 동작한다.
> 현재 대부분의 런타임이 아직 지원하지 않는다.

---

### Kubernetes에서 Falco vs auditd 역할 분리

```
┌───────────────────────────────────────────────────────────┐
│                    Kubernetes 클러스터                     │
│                                                           │
│  [API Server Audit Logs]  ←── Falco (k8s 이벤트)          │
│  - API 오브젝트 변경 감사                                   │
│  - RBAC 위반, namespace 변경                              │
│                                                           │
│  [노드 레벨]              ←── auditd (OS 이벤트)            │
│  - syscall 감사                                           │
│  - 파일시스템 변경                                         │
│  - 컨테이너 프로세스 실행 추적                              │
│                                                           │
│  [런타임 레벨]            ←── Falco (eBPF/커널 모듈)        │
│  - 컨테이너 이상 행동 탐지                                  │
│  - 실시간 알림                                             │
└───────────────────────────────────────────────────────────┘
```

| 도구 | 강점 | 약점 |
|------|------|------|
| auditd | 표준 컴플라이언스, 영구 로그, STIG/CIS 준수 | 컨테이너 context 부족, 실시간 알림 없음 |
| Falco | 실시간 알림, K8s context, 컨테이너 인식 | 영구 로그 기록 약함, 학습 곡선 |

실무에서는 **두 도구를 병행** 운영하는 것이 권장된다.

---

## laurel — JSON 변환 플러그인

### 왜 laurel인가

기본 auditd 로그는 SIEM 파싱이 어렵다:

```
# 기존 auditd 로그 (파싱 어려움)
type=EXECVE msg=audit(1728234567.890:123): argc=3 \
  a0="perl" a1="-e" a2=7368656C6C5F65786563
```

laurel이 변환한 JSON:

```json
{
  "ID": "1728234567.890:123",
  "SYSCALL": {
    "syscall": "execve",
    "success": "yes",
    "pid": 5678,
    "ppid": 1234,
    "auid": 1000,
    "uid": 0,
    "exe": "/usr/bin/perl",
    "key": "shell_exec"
  },
  "EXECVE": {
    "argc": 3,
    "ARGV": ["perl", "-e", "shell_exec"]
  },
  "PARENT_INFO": {
    "ARGV": ["bash", "--login"],
    "ppid": 999,
    "launch_time": 1728230000.000
  },
  "PATH": [
    {"name": "/usr/bin/perl", "mode": "0o100755"}
  ]
}
```

### 설치 및 설정

```bash
## ── 설치 (RHEL/Ubuntu) ────────────────────────────────
# GitHub Releases에서 최신 바이너리 다운로드
curl -LO https://github.com/threathunters-io/laurel/releases/latest/\
download/laurel-x86_64-musl.tar.gz
tar xf laurel-x86_64-musl.tar.gz
install -m 0755 laurel /usr/local/sbin/

# laurel 실행 사용자 생성
useradd -r -s /sbin/nologin _laurel

## ── audisp 플러그인 등록 ──────────────────────────────
cat > /etc/audit/plugins.d/laurel.conf << 'EOF'
active = yes
direction = out
path = /usr/local/sbin/laurel
type = always
args = --config /etc/laurel/config.toml
format = string
EOF
```

```toml
# /etc/laurel/config.toml
[user]
name = "_laurel"

[output.main]
file = "/var/log/audit/audit.log.json"
size = 10485760      # 10 MiB
generations = 10

[transform]
execve-argv = ["array", "string"]   # ARGV를 배열로 변환
# 캡처할 환경변수는 최소화할 것
# AWS_ACCESS_KEY, DATABASE_URL 같은 시크릿이 로그에 평문으로 기록됨
execve-env = ["HOME", "PATH", "SHELL"]

[enrich]
pid = true           # 프로세스 정보 추가
ppid = true          # 부모 프로세스 정보 추가
cgroup = true        # cgroup 정보 (컨테이너 식별)
```

```bash
# auditd 재시작으로 laurel 활성화
# RHEL/CentOS: RefuseManualStop=yes 때문에
# systemctl restart auditd 는 실패한다 → service 명령 사용
service auditd restart

# 로그 확인
tail -f /var/log/audit/audit.log.json | python3 -m json.tool
```

---

## 성능 및 운영 팁

### 성능 영향 이해

```
규칙이 많을수록 커널이 매 syscall마다 더 많은 규칙을 평가한다.
exit 필터 규칙은 모든 syscall에 평가 비용이 발생한다.

일반 서버:  +2~5% CPU 오버헤드
DB 서버:    I/O syscall 집약적 → +10~20% 가능
네트워크:   connect/accept 규칙 다수 → 연결 많을수록 증가
```

### 성능 최적화 전략

```bash
## 1. never 규칙으로 노이즈 제거 (규칙 상단에 배치)
-a never,exit -F arch=b64 -S getattr -k ignore
-a never,exit -F msgtype=CRYPTO_KEY_USER
-a never,exit -F msgtype=ANOM_ACCESS_FS
-a never,user  -F subj_type=crond_t

## 2. 복수 syscall을 단일 규칙으로 통합 (규칙 수 감소)
# 비효율
-a always,exit -F arch=b64 -S unlink -k delete
-a always,exit -F arch=b64 -S unlinkat -k delete

# 효율
-a always,exit -F arch=b64 -S unlink,unlinkat,rename,renameat -k delete

## 3. 백로그 상태 모니터링
auditctl -s
# backlog 값이 backlog_limit에 근접하면 -b 값 증가
# lost 값이 증가하면 규칙 최적화 필요

## 4. 과부하 이벤트 분석
aureport --executable --summary -ts today -i | head -20
aureport --syscall --summary -ts today -i | head -20
```

### 불변 모드 (-e 2)

```bash
# audit.rules 마지막 줄에 추가
-e 2
```

- 설정 후 **재부팅 없이는 규칙 변경 불가**
- `auditctl`, `augenrules --load` 모두 실패
- 공격자가 감사 로그 비활성화 시도를 차단
- 변경 시도 자체가 `CONFIG_CHANGE` 레코드로 기록됨

```bash
# 현재 모드 확인
auditctl -s | grep enabled
# enabled 2 → 불변 모드

# 불변 모드에서 규칙 변경 필요 시: 재부팅 후 작업
# 재부팅 전 임시 확인 (현재 세션에서만 효과 없음)
systemctl reboot
```

---

### 재시작 없이 규칙 반영

```bash
# rules.d/ 파일 수정 후 augenrules로 컴파일 + 로드
augenrules --load

# 또는 특정 파일에서 직접 로드
auditctl -R /etc/audit/rules.d/30-custom.rules

# 현재 로드된 규칙 확인
auditctl -l

# 특정 키의 규칙만 삭제
auditctl -D -k test_key

# 모든 규칙 삭제
auditctl -D
```

---

### SIEM 연동 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                   로그 파이프라인                         │
│                                                         │
│  auditd → laurel → /var/log/audit/audit.log.json        │
│                          │                              │
│               ┌──────────┴──────────┐                   │
│               │                     │                   │
│           Vector              Auditbeat                 │
│    (경량, 고성능)           (Elasticsearch 공식)          │
│               │                     │                   │
│               └──────────┬──────────┘                   │
│                          ▼                              │
│                    SIEM / Elastic                       │
│              (Splunk / OpenSearch)                      │
└─────────────────────────────────────────────────────────┘
```

**Vector 설정 예시 (laurel JSON 수집)**:

```toml
# /etc/vector/vector.toml
[sources.auditd_json]
type = "file"
include = ["/var/log/audit/audit.log.json"]
read_from = "end"

[transforms.parse_audit]
type = "remap"
inputs = ["auditd_json"]
source = '''
. = parse_json!(.message)
.host = get_hostname!()
'''

[sinks.elasticsearch]
type = "elasticsearch"
inputs = ["parse_audit"]
endpoints = ["https://elastic.example.com:9200"]
index = "auditd-%Y.%m.%d"
```

---

## 운영 체크리스트

```
설치 및 초기 설정
├── [ ] auditd 패키지 설치 및 서비스 활성화
├── [ ] /etc/audit/auditd.conf 설정 검토
│         (max_log_file, num_logs, space_left_action)
├── [ ] rules.d/ 아래 기본 규칙 세트 배치
│         (10-base-config, 30-stig, 99-finalize)
├── [ ] augenrules --load 로 규칙 로드
└── [ ] auditctl -s 로 상태 확인 (lost=0 확인)

규칙 관리
├── [ ] -e 2 불변 모드 활성화 (프로덕션)
├── [ ] 아키텍처별 b32/b64 규칙 쌍 확인
├── [ ] never 규칙으로 불필요한 노이즈 제거
└── [ ] 키 태그 명명 규칙 팀 내 통일

SIEM 연동
├── [ ] laurel 설치 및 JSON 변환 확인
├── [ ] 로그 전달 에이전트 (Vector/Auditbeat) 설정
└── [ ] SIEM에서 대시보드/알림 구성

정기 점검
├── [ ] aureport --summary 주간 검토
├── [ ] backlog lost 카운터 모니터링
└── [ ] 규칙 커버리지 vs 성능 영향 균형 검토
```

---

## 참고 자료

- [auditd(8) - Linux Manual Page](https://man7.org/linux/man-pages/man8/auditd.8.html)
  (확인: 2026-04-17)
- [auditctl(8) - Linux Manual Page](https://man7.org/linux/man-pages/man8/auditctl.8.html)
  (확인: 2026-04-17)
- [auditd.conf(5) - Linux Manual Page](https://man7.org/linux/man-pages/man5/auditd.conf.5.html)
  (확인: 2026-04-17)
- [audit.rules(7) - Linux Manual Page](https://man7.org/linux/man-pages/man7/audit.rules.7.html)
  (확인: 2026-04-17)
- [ausearch(8) - Linux Manual Page](https://man7.org/linux/man-pages/man8/ausearch.8.html)
  (확인: 2026-04-17)
- [aureport(8) - Linux Manual Page](https://man7.org/linux/man-pages/man8/aureport.8.html)
  (확인: 2026-04-17)
- [linux-audit/audit-userspace (GitHub)](https://github.com/linux-audit/audit-userspace)
  — audit-4.1.4 (2026-03-23) (확인: 2026-04-17)
- [threathunters-io/laurel (GitHub)](https://github.com/threathunters-io/laurel)
  — v0.7.3 (2025-08-04) (확인: 2026-04-17)
- [Red Hat Enterprise Linux 9 - Auditing the System](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/security_hardening/auditing-the-system_security-hardening)
  (확인: 2026-04-17)
- [linux-audit/audit-userspace: 30-stig.rules](https://github.com/linux-audit/audit-userspace/blob/master/rules/30-stig.rules)
  (확인: 2026-04-17)
- [steveandreassend/linux_auditd - CIS/STIG Rules](https://github.com/steveandreassend/linux_auditd)
  (확인: 2026-04-17)
- [Tuning auditd: high-performance Linux Auditing](https://linux-audit.com/linux-audit-framework/tuning-auditd-high-performance-linux-auditing/)
  (확인: 2026-04-17)
- [What You Need to Know About Linux Audit Framework - Teleport](https://goteleport.com/blog/linux-audit/)
  (확인: 2026-04-17)
- [Container IDs for the audit subsystem - LWN.net](https://lwn.net/Articles/740621/)
  (확인: 2026-04-17)
