---
title: "사용자, 그룹, 퍼미션 관리 실무 가이드"
date: 2026-04-12
tags:
  - linux
  - permission
  - security
  - sudo
  - devops
---

# 사용자, 그룹, 퍼미션 관리

리눅스의 모든 접근 제어는 사용자(User), 그룹(Group), 퍼미션(Permission) 세 축으로 동작한다. DevOps 엔지니어가 서버 보안의 기본을 잡으려면 이 개념을 확실히 이해해야 한다.

## UID / GID 기초

모든 사용자는 숫자 ID(UID)를 가지며, 그룹도 GID를 가진다.

| UID 범위 | 용도 |
|----------|------|
| 0 | root (슈퍼유저) |
| 1-999 | 시스템/서비스 계정 (배포판마다 다름) |
| 1000+ | 일반 사용자 |

```bash
# 현재 사용자 UID/GID 확인
id
# uid=1000(deploy) gid=1000(deploy) groups=1000(deploy),27(sudo),999(docker)

# 사용자 정보가 저장된 파일
cat /etc/passwd   # 사용자 계정 정보 (이름:x:UID:GID:설명:홈:셸)
cat /etc/shadow   # 암호화된 패스워드 (root만 읽기 가능)
cat /etc/group    # 그룹 정보 (그룹명:x:GID:멤버)
```

### 사용자/그룹 관리 명령어

```bash
# 사용자 생성
useradd -m -s /bin/bash -G sudo,docker deploy
#   -m: 홈 디렉토리 생성
#   -s: 기본 셸 지정
#   -G: 보조 그룹 추가

# 패스워드 설정
passwd deploy

# 사용자 수정
usermod -aG docker deploy    # docker 그룹에 추가 (-a 빠뜨리면 기존 그룹에서 제거됨!)

# 그룹 생성/삭제
groupadd devteam
groupdel devteam

# 사용자 삭제
userdel -r deploy            # -r: 홈 디렉토리도 삭제
```

## 퍼미션 (chmod, chown, chgrp)

### 기본 퍼미션 구조

```text
-rwxr-xr-- 1 deploy devteam 4096 Apr 12 10:00 deploy.sh
│└┬┘└┬┘└┬┘
│ │  │  └── Others: r-- (읽기만)
│ │  └───── Group:  r-x (읽기+실행)
│ └──────── Owner:  rwx (읽기+쓰기+실행)
└────────── 파일 타입 (- = 일반, d = 디렉토리, l = 심볼릭 링크)
```

| 권한 | 숫자 | 의미 |
|------|------|------|
| r | 4 | 읽기 |
| w | 2 | 쓰기 |
| x | 1 | 실행 (디렉토리의 경우 진입) |

### chmod - 권한 변경

```bash
# 숫자 모드
chmod 755 deploy.sh          # rwxr-xr-x
chmod 644 config.yaml        # rw-r--r--
chmod 600 id_rsa             # rw------- (SSH 키 필수 권한)
chmod 700 .ssh/              # rwx------ (SSH 디렉토리 필수 권한)

# 심볼릭 모드
chmod u+x script.sh          # 소유자에 실행 권한 추가
chmod g+w shared/             # 그룹에 쓰기 권한 추가
chmod o-rwx secret.conf       # 다른 사용자의 모든 권한 제거
chmod a+r public.html         # 모든 사용자에게 읽기 권한

# 재귀적 적용
chmod -R 755 /var/www/html/
```

### chown - 소유자 변경

```bash
# 소유자 변경
chown deploy deploy.sh

# 소유자와 그룹 동시 변경
chown deploy:devteam /opt/app/

# 재귀적 변경
chown -R deploy:devteam /opt/app/

# 그룹만 변경
chgrp devteam /opt/app/shared/
```

### 실무에서 자주 쓰는 퍼미션 조합

| 퍼미션 | 용도 |
|--------|------|
| `600` | SSH 개인키, 비밀 설정 파일 |
| `644` | 일반 설정 파일, HTML |
| `700` | `~/.ssh/` 디렉토리 |
| `755` | 실행 스크립트, 웹 디렉토리 |
| `750` | 그룹만 접근 가능한 앱 디렉토리 |
| `777` | 절대 사용 금지 (보안 취약) |

## 특수 퍼미션 (Setuid, Setgid, Sticky Bit)

일반 rwx 외에 3가지 특수 퍼미션이 있다.

### Setuid (4000)

파일을 **소유자 권한으로** 실행한다. 주로 root 소유의 시스템 명령어에 사용.

```bash
# passwd 명령어: 일반 사용자가 실행해도 root 권한으로 /etc/shadow 수정
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root ... /usr/bin/passwd
#    ^ s = setuid 설정됨

# setuid 설정
chmod u+s /usr/local/bin/special
chmod 4755 /usr/local/bin/special
```

> 보안 주의: setuid가 설정된 파일은 권한 상승(privilege escalation) 공격의 대상이 된다. 정기적으로 감사해야 한다.

```bash
# setuid + setgid 파일 전체 검색 (보안 감사용)
find / -perm /6000 -type f 2>/dev/null
```

### Setgid (2000)

- **파일**: 파일 그룹 권한으로 실행
- **디렉토리**: 하위에 생성되는 파일이 부모 디렉토리의 그룹을 자동 상속

```bash
# 팀 공유 디렉토리에 setgid 설정 - DevOps 실무에서 매우 유용
mkdir /opt/shared
chown :devteam /opt/shared
chmod 2775 /opt/shared
#     ^ 2 = setgid

# 이후 누가 파일을 만들어도 그룹은 devteam
touch /opt/shared/newfile
ls -l /opt/shared/newfile
# -rw-r--r-- 1 deploy devteam ...
```

### Sticky Bit (1000)

디렉토리에 설정하면 **파일 소유자나 root만** 해당 파일을 삭제할 수 있다.

```bash
# /tmp에 기본 적용
ls -ld /tmp
# drwxrwxrwt 1 root root ...
#          ^ t = sticky bit

# 직접 설정
chmod +t /opt/shared/uploads
chmod 1777 /opt/shared/uploads
```

### 특수 퍼미션 요약

| 퍼미션 | 숫자 | 파일 효과 | 디렉토리 효과 | 표시 |
|--------|------|-----------|---------------|------|
| Setuid | 4000 | 소유자 권한으로 실행 | (리눅스에서 무시됨, 설정 자제) | `s` (owner x 자리) |
| Setgid | 2000 | 그룹 권한으로 실행 | 하위 파일 그룹 상속 | `s` (group x 자리) |
| Sticky | 1000 | (무시) | 소유자만 삭제 가능 | `t` (others x 자리) |

## sudo 설정 베스트 프랙티스

### 기본 원칙

1. **`visudo`만 사용** - 직접 편집 시 문법 오류로 잠길 수 있음
2. **`/etc/sudoers.d/` 활용** - 주 sudoers 파일 수정 대신 별도 파일로 관리
3. **그룹 기반 관리** - 개인이 아닌 그룹에 권한 부여
4. **최소 권한** - `ALL=(ALL:ALL) ALL`은 최대한 피함

### 실무 설정 예시

```bash title="/etc/sudoers.d/deploy-team"
# /etc/sudoers.d/deploy-team (visudo -f로 편집)

# deploy 그룹에 특정 명령만 허용
%deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx, \
                            /usr/bin/systemctl restart app, \
                            /usr/bin/journalctl -u nginx, \
                            /usr/bin/journalctl -u app

# 모니터링 그룹 - 읽기 전용 명령만
%monitoring ALL=(ALL) NOPASSWD: /usr/bin/journalctl, \
                                /usr/bin/ss
# ⚠️ top, vim, less 등 대화형 바이너리는 NOPASSWD 부여 금지
#    GTFOBins 등재 바이너리로 셸 탈출이 가능하다
```

### 보안 강화 옵션

```bash title="/etc/sudoers"
# /etc/sudoers에 추가 (visudo로)

# sudo 세션 타임아웃 (5분)
Defaults timestamp_timeout=5

# sudo 실행 시 사용할 PATH 제한
Defaults secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# sudo 활동 별도 로그 파일
Defaults logfile="/var/log/sudo.log"

# 실패 시 메일 알림
Defaults mail_badpass
Defaults mailto="admin@example.com"
```

## 서비스 계정 관리

애플리케이션 전용 계정은 보안의 기본이다. 절대 root로 서비스를 실행하지 말 것.

### 서비스 계정 생성

```bash
# 비대화형 서비스 계정 생성
useradd --system \
        --no-create-home \
        --shell /usr/sbin/nologin \
        --group prometheus \
        prometheus

# 또는 그룹을 먼저 만들고
groupadd --system appgroup
useradd --system --no-create-home --shell /usr/sbin/nologin -g appgroup appuser
```

### systemd 서비스에서 활용

```ini title="/etc/systemd/system/myapp.service"
# /etc/systemd/system/myapp.service
[Service]
User=appuser
Group=appgroup
# 추가 보안 설정
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/myapp /var/log/myapp
```

### CI/CD 러너 계정 원칙

- 전용 서비스 계정 사용 (root 금지)
- 필요한 디렉토리에만 쓰기 권한
- docker 그룹 추가 시 보안 영향 인지 (docker 그룹 = 사실상 root)
- docker 소켓 공유 대신 rootless Docker 또는 Podman 사용을 권장
- SSH 키는 배포 전용으로 분리

## 참고 링크

- [Mastering Linux User and Permission Management (2025)](https://dasroot.net/posts/2025/12/mastering-linux-user-permission-management/)
- [Red Hat - SUID, SGID, Sticky Bit](https://www.redhat.com/en/blog/suid-sgid-sticky-bit)
- [Red Hat - Managing sudo access (RHEL 10)](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/security_hardening/managing-sudo-access)
- [Best Practices for Configuring Sudoers](https://wafaicloud.com/blog/best-practices-for-configuring-sudoers-in-linux/)
