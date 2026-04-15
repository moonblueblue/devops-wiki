---
title: "SSH 설정과 키 관리"
date: 2026-04-13
tags:
  - linux
  - ssh
  - security
  - key-management
  - tunneling
  - devops
  - cloud
sidebar_label: "SSH"
---

# SSH 설정과 키 관리

## 1. SSH 개요

### SSH란

SSH(Secure Shell)는 암호화된 네트워크 프로토콜이다.
원격 서버에 안전하게 접속하고 명령을 실행하며
파일을 전송하는 데 사용한다.

기본 포트는 **22번**이며
클라이언트(`ssh`)와 서버(`sshd`)로 구성된다.
모든 통신은 대칭키 암호화로 보호된다.

### 연결 과정

SSH 연결은 다음 단계로 이루어진다.
각 단계에서 암호화 협상과 인증이 수행되며
중간자 공격을 방지하는 구조를 갖는다.

```text
1. TCP 3-way 핸드셰이크 (포트 22)
2. 프로토콜 버전 교환
3. 키 교환 (DH/ECDH) → 세션 키 생성
4. 서버 호스트 키로 서버 인증
5. 사용자 인증 (공개키/비밀번호/인증서)
6. 암호화된 세션 수립
```

### 인증 방식 비교

| 방식 | 보안성 | 편의성 | 용도 |
|------|--------|--------|------|
| 공개키 | 높음 | 높음 | **일반 권장** |
| 인증서 | 매우 높음 | 중간 | 대규모 환경 |
| 비밀번호 | 낮음 | 높음 | 비권장 |
| FIDO2/SK | 최고 | 중간 | 고보안 환경 |

### OpenSSH 최신 동향

OpenSSH 10.0이 2025년 4월에 릴리스되었다.

주요 변경사항:
- **DSA 키 지원 완전 제거** → Ed25519가 사실상 표준 키 타입으로 자리잡음
- **기본 KEX 변경**: `mlkem768x25519-sha256`(ML-KEM 기반 포스트퀀텀) 기본 채택
- **sshd-auth 바이너리 분리**: 인증 단계를 별도 프로세스로 격리하여
  공격 표면 축소

> 2025년 초 CVE-2025-26465(MITM)와
> CVE-2025-26466(Pre-auth DoS)이 발견되었다.
> OpenSSH 9.9p2에서 패치되었으므로 반드시 업데이트한다.

- [OpenSSH 릴리스 노트](https://www.openssh.org/releasenotes.html)

---

## 2. 키 생성과 관리

### 키 타입 선택

2026년 기준으로 Ed25519를 기본 선택한다.
RSA는 레거시 시스템 호환이 필요할 때만 사용하며
최소 3072비트 이상을 지정해야 한다.

| 알고리즘 | 키 길이 | 보안성 | 성능 | 권장 |
|----------|---------|--------|------|------|
| Ed25519 | 256bit 고정 | 최고 | 매우 빠름 | **기본** |
| Ed25519-SK | 256bit+FIDO2 | 최고+물리 | 빠름 | 하드웨어 키 |
| RSA | 3072-4096bit | 양호 | 느림 | 레거시 호환 |
| ECDSA | 256-521bit | 양호 | 빠름 | 비권장 (ECDSA-SK는 FIDO2 하드웨어 키에 한해 사용) |

### ssh-keygen 사용법

```bash
# Ed25519 키 생성 (권장)
ssh-keygen -t ed25519 \
  -C "user@example.com" \
  -f ~/.ssh/id_ed25519

# RSA 4096 키 생성 (레거시 호환)
ssh-keygen -t rsa -b 4096 \
  -C "user@example.com" \
  -f ~/.ssh/id_rsa_legacy

# FIDO2 하드웨어 키 (YubiKey 등)
ssh-keygen -t ed25519-sk \
  -O resident \
  -C "yubikey@corp"
```

`-C` 옵션으로 의미 있는 코멘트를 지정한다.
기본값은 `username@hostname`이므로
이메일이나 용도를 명시하는 것이 관리에 유리하다.

### 키 파일 권한

SSH는 파일 권한이 느슨하면 키를 거부한다.
반드시 아래 권한을 유지해야 한다.

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 600 ~/.ssh/authorized_keys
chmod 644 ~/.ssh/known_hosts
chmod 600 ~/.ssh/config
```

### 공개키 배포

```bash
# ssh-copy-id 사용 (권장)
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server

# 수동 배포
cat ~/.ssh/id_ed25519.pub | \
  ssh user@server \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### ssh-agent와 ssh-add

ssh-agent는 개인키를 메모리에 캐시하여
패스프레이즈를 매번 입력하지 않게 해준다.

```bash
# 에이전트 시작
eval $(ssh-agent)

# 키 등록
ssh-add ~/.ssh/id_ed25519

# 타임아웃 설정 (1시간 후 자동 제거)
ssh-add -t 3600 ~/.ssh/id_ed25519

# 등록된 키 목록 확인
ssh-add -l

# 키 사용 시 확인 프롬프트 활성화
ssh-add -c ~/.ssh/id_ed25519

# 에이전트 잠금/해제
ssh-add -x   # 잠금 (비밀번호 설정)
ssh-add -X   # 해제

# 모든 키 제거
ssh-add -D
```

> 에이전트 포워딩(`ForwardAgent yes`)은
> 원격 호스트 root가 소켓에 접근할 수 있어 위험하다.
> 대신 **ProxyJump**를 사용하는 것을 권장한다.

---

## 3. SSH 클라이언트 설정

### ~/.ssh/config 기본 구조

`~/.ssh/config` 파일로 호스트별 접속 설정을 관리한다.
매번 긴 명령어를 입력할 필요 없이
`ssh myserver`처럼 간단히 접속할 수 있다.

```ssh-config title="~/.ssh/config"
# 전역 설정
Host *
    ServerAliveInterval 60
    ServerAliveCountMax 3
    AddKeysToAgent yes
    IdentitiesOnly yes

# 개별 호스트
Host myserver
    HostName 192.168.1.100
    User admin
    Port 2222
    IdentityFile ~/.ssh/id_ed25519_work

# 와일드카드 패턴
Host *.dev.example.com
    User deployer
    ProxyJump bastion.example.com
    IdentityFile ~/.ssh/id_ed25519_dev

# 점프 호스트 (배스천)
Host bastion
    HostName bastion.example.com
    User jump-user
    IdentityFile ~/.ssh/id_ed25519_bastion
    ForwardAgent no
```

### 주요 클라이언트 옵션

| 옵션 | 설명 | 권장값 |
|------|------|--------|
| `HostName` | 실제 호스트 주소 | IP 또는 FQDN |
| `User` | 접속 사용자명 | - |
| `Port` | SSH 포트 | 서버 설정에 맞춤 |
| `IdentityFile` | 사용할 키 파일 | 호스트별 지정 |
| `IdentitiesOnly` | 지정된 키만 시도 | **yes** |
| `ProxyJump` | 점프 호스트 | 내부 서버 접속 시 |
| `ServerAliveInterval` | 킵얼라이브 간격(초) | 60 |
| `ServerAliveCountMax` | 킵얼라이브 최대 횟수 | 3 |
| `StrictHostKeyChecking` | 호스트 키 검증 | ask |
| `ForwardAgent` | 에이전트 포워딩 | **no** |
| `AddKeysToAgent` | 자동 에이전트 등록 | yes |

> `IdentitiesOnly yes`를 설정하면 ssh-agent에 등록된
> 모든 키를 순차 시도하는 것을 방지한다.
> 호스트별로 올바른 키만 사용하게 되어 효율적이다.

---

## 4. sshd 서버 설정과 보안 강화

### 핵심 보안 설정

`/etc/ssh/sshd_config`에서 아래 4가지를
반드시 설정한다. 이것만으로 대부분의 자동화 공격을
차단할 수 있다.

```bash title="/etc/ssh/sshd_config"
# 1. 비밀번호 인증 비활성화
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no

# 2. root 직접 로그인 차단
PermitRootLogin no
# 키 전용 허용 시: PermitRootLogin prohibit-password

# 3. 접속 허용 사용자/그룹 제한
AllowUsers deploy admin
AllowGroups sshusers

# 4. 최신 암호화 알고리즘만 허용
Ciphers chacha20-poly1305@openssh.com,\
aes256-gcm@openssh.com,\
aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,\
hmac-sha2-256-etm@openssh.com
# OpenSSH 10.0+: mlkem768x25519-sha256 기본 채택
# 명시적 고정 시 ML-KEM 알고리즘 배제 위험이 있으므로
# 기본값 신뢰를 권장하며, 고정이 필요한 경우 아래 사용
KexAlgorithms mlkem768x25519-sha256,\
sntrup761x25519-sha512@openssh.com,\
curve25519-sha256,curve25519-sha256@libssh.org
```

### 추가 보안 설정

```bash title="/etc/ssh/sshd_config"
# 포트 변경
Port 2222

# 빈 비밀번호 차단
PermitEmptyPasswords no

# X11 포워딩 비활성화
X11Forwarding no

# 인증 시도 제한
MaxAuthTries 3
LoginGraceTime 30

# 유휴 세션 타임아웃 (5분)
ClientAliveInterval 60
ClientAliveCountMax 5

# 배너 설정
Banner /etc/ssh/banner
```

### sshd 설정 요약 테이블

| 설정 | 권장값 | 목적 |
|------|--------|------|
| `PasswordAuthentication` | no | 브루트포스 차단 |
| `PermitRootLogin` | no | root 공격 차단 |
| `AllowUsers/Groups` | 지정 | 접속 화이트리스트 |
| `MaxAuthTries` | 3 | 인증 시도 제한 |
| `Port` | 비표준 | 스캐너 노이즈 감소 (보조 수단, AllowUsers·fail2ban 병행 필수) |
| `X11Forwarding` | no | 불필요한 기능 차단 |
| `ClientAliveInterval` | 60 | 유휴 세션 감지 |
| `PermitEmptyPasswords` | no | 빈 비밀번호 차단 |

### fail2ban 연동

```bash
# fail2ban 설치
sudo apt install fail2ban    # Debian/Ubuntu
sudo dnf install fail2ban    # RHEL/Fedora
```

```ini title="/etc/fail2ban/jail.local"
[sshd]
enabled  = true
port     = 2222
filter   = sshd
# Ubuntu 22.04+/Debian 12+는 rsyslog 미설치 시 journald만 사용
# → backend = systemd 설정 필요 (logpath 불필요)
backend  = systemd
# rsyslog 사용 환경에서는 아래 logpath 사용 (backend 주석 처리)
# backend  = auto
# logpath  = /var/log/auth.log
maxretry = 3
bantime  = 3600
findtime = 600
```

### 설정 변경 안전 절차

```bash
# 1. 기존 설정 백업
sudo cp /etc/ssh/sshd_config \
  /etc/ssh/sshd_config.bak

# 2. 설정 문법 검증
sudo sshd -t

# 3. 설정 리로드 (기존 세션 유지, 포트 변경 없는 경우 권장)
sudo systemctl reload sshd
# 포트 변경 등 reload가 효과 없는 경우에만 restart 사용
# sudo systemctl restart sshd

# 4. 새 터미널에서 접속 테스트
ssh user@server -p 2222

# 5. 성공 확인 후 기존 세션 종료
```

> 설정 변경 시 반드시 기존 SSH 세션을 유지한다.
> 잘못된 설정으로 접속이 불가능해지면
> 열려 있는 세션에서 롤백할 수 있다.

- [OpenSSH sshd_config 매뉴얼](https://man.openbsd.org/sshd_config)

---

## 5. SSH 터널링

### 로컬 포트 포워딩 (-L)

로컬 머신의 포트를 원격 서비스로 전달한다.
방화벽 뒤의 내부 서비스에 접근할 때 유용하며
가장 많이 사용되는 터널링 방식이다.

```text
[로컬] :8080 → SSH 터널 → [bastion] → [db]:3306
```

```bash
# 로컬 8080 → bastion 경유 → db.internal:3306
ssh -L 8080:db.internal:3306 user@bastion

# 백그라운드 실행
ssh -fNL 8080:db.internal:3306 user@bastion
```

| 플래그 | 의미 |
|--------|------|
| `-f` | 백그라운드 실행 |
| `-N` | 원격 명령 실행 안 함 |
| `-L` | 로컬 포트 포워딩 |

### 리모트 포트 포워딩 (-R)

원격 서버의 포트를 로컬 서비스로 전달한다.
NAT 뒤의 로컬 서비스를 외부에 노출할 때 사용하며
웹훅 테스트 등에 활용된다.

```text
[public-server] :9090 → SSH 터널 → [로컬] :3000
```

```bash
# public-server:9090 → 로컬 3000
ssh -R 9090:localhost:3000 user@public-server

# 외부 바인딩 허용 시 sshd_config에서:
# GatewayPorts yes
```

### 다이나믹 포트 포워딩 (-D)

SOCKS5 프록시를 생성하여 모든 트래픽을
SSH 터널을 통해 라우팅한다.
특정 포트가 아닌 모든 트래픽을 전달할 수 있다.

```bash
# SOCKS5 프록시 생성
ssh -D 1080 user@server

# 브라우저 또는 애플리케이션에서
# SOCKS5 프록시: localhost:1080 설정

# curl로 SOCKS 프록시 사용
curl --socks5 localhost:1080 https://example.com
```

### ProxyJump (점프 호스트)

ProxyJump는 OpenSSH 7.3에서 도입되었다.
배스천 호스트를 경유하는 가장 안전한 방법이며
에이전트 포워딩보다 권장된다.

```bash
# 단일 점프
ssh -J user@bastion user@internal

# 다중 점프 (체이닝)
ssh -J user@jump1,user@jump2 user@target
```

```ssh-config title="~/.ssh/config"
# ~/.ssh/config 설정
Host internal-*
    ProxyJump bastion.example.com
    User admin

Host bastion.example.com
    User jump-user
    IdentityFile ~/.ssh/id_ed25519_bastion
```

> ProxyJump는 에이전트 포워딩과 달리
> 중간 호스트에 키가 노출되지 않는다.
> 배스천 서버가 침해되어도 내부 키는 안전하다.

---

## 6. 멀티플렉싱

### 개요

SSH 멀티플렉싱은 하나의 TCP 연결 위에
여러 SSH 세션을 다중화하는 기능이다.
OpenSSH 3.9부터 지원한다.

### 설정

```ssh-config title="~/.ssh/config"
# ~/.ssh/config
Host *
    ControlMaster auto
    ControlPath ~/.ssh/cm/%r@%h:%p
    ControlPersist 10m
```

```bash
# 소켓 디렉터리 생성
mkdir -p ~/.ssh/cm
chmod 700 ~/.ssh/cm
```

| 디렉티브 | 설명 |
|----------|------|
| `ControlMaster auto` | 마스터 없으면 생성, 있으면 재사용 |
| `ControlPath` | 제어 소켓 경로 |
| `ControlPersist 10m` | 마지막 세션 종료 후 10분 유지 |

### ControlPath 토큰

| 토큰 | 의미 |
|------|------|
| `%r` | 원격 사용자명 |
| `%h` | 대상 호스트명 |
| `%p` | 대상 포트 |
| `%C` | 연결 해시 (긴 경로 방지) |

### 성능 이점

멀티플렉싱의 두 번째 연결부터는
TCP 핸드셰이크와 인증을 건너뛴다.
반복적으로 SSH를 호출하는 도구에서 효과가 크다.

| 시나리오 | 효과 |
|----------|------|
| Ansible 플레이북 | 태스크 간 재연결 제거 |
| rsync 반복 실행 | 연결 오버헤드 최소화 |
| git over SSH | push/pull 속도 향상 |
| SCP 다중 파일 전송 | 연결 재사용 |

### 제어 명령

```bash
# 마스터 연결 상태 확인
ssh -O check user@host

# 마스터 연결 종료
ssh -O stop user@host

# 마스터 연결 즉시 종료 (세션 포함)
ssh -O exit user@host
```

---

## 7. 클라우드 환경 SSH

### AWS SSM Session Manager

SSM Session Manager는 SSH 키 없이
IAM 인증으로 EC2에 접속하는 서비스다.
인바운드 포트를 열지 않아 보안이 강화된다.

```bash
# SSM으로 직접 세션
aws ssm start-session \
  --target i-0abcdef1234567890

# SSH over SSM (포트 포워딩 등 SSH 기능 사용)
# ~/.ssh/config
Host i-*
    ProxyCommand sh -c \
      "aws ssm start-session \
      --target %h \
      --document-name AWS-StartSSHSession \
      --parameters 'portNumber=%p'"
```

| 특징 | 설명 |
|------|------|
| 인증 | IAM 역할/정책 기반 |
| 네트워크 | 인바운드 포트 불필요 |
| 감사 | CloudTrail + S3 로깅 |
| 에이전트 | SSM Agent 필요 |
| 멀티클라우드 | 온프레미스/타 클라우드도 지원 |

### GCP OS Login과 IAP

```bash
# OS Login으로 SSH 접속
gcloud compute ssh instance-name \
  --zone us-central1-a

# IAP 터널링
gcloud compute ssh instance-name \
  --tunnel-through-iap
```

| 서비스 | 용도 |
|--------|------|
| OS Login | Google IAM 연동 SSH 접근 관리 |
| Cloud IAP | 제로트러스트 프록시 터널링 |

### Azure Bastion

Azure Bastion은 브라우저 기반 SSH/RDP를 제공한다.
VM에 공인 IP가 필요 없으며
Azure Portal에서 직접 접속한다.

| 특징 | 설명 |
|------|------|
| 접속 | 브라우저 기반 (에이전트 불필요) |
| 네트워크 | 공인 IP / NSG 불필요 |
| 동시 접속 | 25 RDP / 50 SSH |

### 클라우드 SSH 비교

| 항목 | AWS SSM | GCP IAP | Azure Bastion |
|------|---------|---------|---------------|
| 인증 | IAM | Google IAM | Azure AD |
| 에이전트 | SSM Agent | gcloud CLI | 없음 |
| SSH 키 | 불필요 | OS Login 연동 | 선택적 |
| 감사 로그 | CloudTrail | Cloud Audit | Activity Log |
| 포트 개방 | 불필요 | 불필요 | 불필요 |

- [AWS SSM Session Manager 문서](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [GCP OS Login 문서](https://cloud.google.com/compute/docs/instances/managing-instance-access)
- [Azure Bastion 문서](https://learn.microsoft.com/azure/bastion/bastion-overview)

---

## 8. 키 관리 베스트 프랙티스

### 키 생성 원칙

| 원칙 | 세부 사항 |
|------|-----------|
| Ed25519 사용 | RSA는 레거시 호환 시에만 (3072+) |
| 패스프레이즈 설정 | 모든 키에 반드시 적용 |
| 용도별 키 분리 | 업무/개인/CI/서비스별 별도 키 |
| FIDO2 활용 | 고보안 환경에서 하드웨어 키 사용 |

### 키 순환 (Rotation)

```bash
# 1. 새 키 생성 (연도 포함 네이밍)
ssh-keygen -t ed25519 \
  -f ~/.ssh/id_ed25519_2026 \
  -C "user@corp-2026"

# 2. 새 키를 서버에 배포
ssh-copy-id -i ~/.ssh/id_ed25519_2026.pub \
  user@server

# 3. 새 키로 접속 테스트
ssh -i ~/.ssh/id_ed25519_2026 user@server

# 4. 이전 키를 authorized_keys에서 제거
ssh user@server \
  "sed -i '/old-key-comment/d' \
  ~/.ssh/authorized_keys"

# 5. 이전 키 파일 안전 삭제
shred -u ~/.ssh/id_ed25519_2024
```

권장 순환 주기는 **1~2년**이다.
키 파일명에 생성 연도를 포함하면
어떤 키가 교체 대상인지 쉽게 파악할 수 있다.

### SSH 인증서 도입

대규모 환경(서버 50대 이상)에서는
SSH 인증서를 도입하는 것이 효율적이다.
authorized_keys 배포 없이 중앙 관리가 가능하다.

```bash
# CA 키 생성
ssh-keygen -t ed25519 -f ssh_ca \
  -C "Corporate SSH CA"

# 사용자 인증서 발급 (유효기간 8시간)
ssh-keygen -s ssh_ca \
  -I "user@corp" \
  -n username \
  -V +8h \
  id_ed25519.pub

# 서버에 CA 신뢰 설정 (/etc/ssh/sshd_config)
# TrustedUserCAKeys /etc/ssh/ssh_ca.pub
```

| 항목 | SSH 키 | SSH 인증서 |
|------|--------|-----------|
| 신뢰 모델 | TOFU | CA 기반 |
| 만료 | 없음 | 유효기간 설정 |
| 확장성 | 서버별 배포 | CA 공개키만 배포 |
| 접근 제어 | 서버별 개별 | 인증서 제약조건 |
| 감사 | 어려움 | ID 포함 |

### 보안 체크리스트

```text
[ ] Ed25519 키 사용 중인가
[ ] 모든 키에 패스프레이즈가 설정되어 있는가
[ ] 개인키 파일 권한이 600인가
[ ] 사용하지 않는 키가 authorized_keys에 남아 있지 않은가
[ ] ssh-agent 타임아웃이 설정되어 있는가
[ ] ForwardAgent가 no로 설정되어 있는가
[ ] ProxyJump를 에이전트 포워딩 대신 사용하는가
[ ] sshd에서 비밀번호 인증이 비활성화되어 있는가
[ ] root 직접 로그인이 차단되어 있는가
[ ] fail2ban 또는 유사 도구가 활성화되어 있는가
[ ] 키 순환 주기가 정해져 있는가
[ ] 개인키가 클라우드 스토리지에 동기화되지 않는가
```

---

## 참고 자료

- [OpenSSH 공식 매뉴얼](https://www.openssh.com/manual.html)
- [OpenSSH 릴리스 노트](https://www.openssh.org/releasenotes.html)
- [SSH Key Best Practices 2025](https://www.brandonchecketts.com/archives/ssh-ed25519-key-best-practices-for-2025)
- [SSH Hardening Best Practices](https://www.msbiro.net/posts/back-to-basics-sshd-hardening/)
- [SSH Agent Explained](https://smallstep.com/blog/ssh-agent-explained/)
- [SSH Certificates Guide](https://smallstep.com/blog/use-ssh-certificates/)
- [SSH Tunneling Complete Guide](https://devtoolbox.dedyn.io/blog/ssh-tunneling-complete-guide)
- [OpenSSH Multiplexing](https://en.wikibooks.org/wiki/OpenSSH/Cookbook/Multiplexing)
- [AWS SSM Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
