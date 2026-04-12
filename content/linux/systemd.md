---
title: "systemd 서비스 관리 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - systemd
  - service-management
  - devops
  - cgroup
  - journalctl
sidebar_label: "systemd"
---
format: md

# systemd 서비스 관리

## 1. systemd 개요

systemd는 Linux의 init 시스템이자 서비스 매니저다.
PID 1로 실행되며 부팅부터 종료까지 모든 프로세스를
관리한다.

### SysVinit vs systemd

| 항목 | SysVinit | systemd |
|------|----------|---------|
| 부팅 방식 | 순차 실행 (느림) | 병렬 실행 (빠름) |
| 설정 형식 | 쉘 스크립트 | 선언적 INI 파일 |
| 의존성 관리 | 없음 | 자동 해결 |
| 리소스 제한 | 없음 | cgroup 통합 |
| 로그 | syslog 분산 | journald 통합 |
| 서비스 감시 | 수동 | 자동 재시작/watchdog |

### 최신 동향

**systemd 259** (2025년 12월):

- 저널 기본 저장 모드가 `persistent`로 변경
- iptables 지원 제거, nftables만 지원
- SysVinit 지원 공식 폐기(deprecated)
- `OOMKills`, `ManagedOOMKills` 속성 추가

**systemd 260** (2026년 3월 릴리스):

- SysVinit 호환 코드 완전 제거

> 참고:
> [systemd GitHub Releases](https://github.com/systemd/systemd/releases)
> | [Arch Wiki - systemd](https://wiki.archlinux.org/title/Systemd)

---

## 2. systemctl 핵심 명령어

### 서비스 제어

| 명령어 | 설명 |
|--------|------|
| `systemctl start <svc>` | 서비스 시작 |
| `systemctl stop <svc>` | 서비스 중지 |
| `systemctl restart <svc>` | 재시작 |
| `systemctl reload <svc>` | 설정만 리로드 (무중단) |
| `systemctl enable <svc>` | 부팅 시 자동 시작 등록 |
| `systemctl disable <svc>` | 자동 시작 해제 |
| `systemctl enable --now <svc>` | 즉시 시작 + 자동 시작 |

### 상태 확인

| 명령어 | 설명 |
|--------|------|
| `systemctl status <svc>` | 상태 상세 확인 |
| `systemctl is-active <svc>` | 활성 여부 (스크립트용) |
| `systemctl is-enabled <svc>` | 자동 시작 여부 |
| `systemctl is-failed <svc>` | 실패 여부 |
| `systemctl --failed` | 실패한 서비스 목록 |

### Unit 파일 관리

| 명령어 | 설명 |
|--------|------|
| `systemctl daemon-reload` | unit 파일 변경 후 필수 |
| `systemctl cat <svc>` | unit 파일 내용 확인 |
| `systemctl edit <svc>` | drop-in override 생성 |
| `systemctl edit --full <svc>` | unit 파일 전체 편집 |

---

## 3. Unit 파일 구조

### 파일 위치

```text
/usr/lib/systemd/system/   ← 패키지 기본 (수정 금지)
/etc/systemd/system/       ← 커스텀 unit (여기에 작성)
/etc/systemd/system/<svc>.d/ ← drop-in override
```

우선순위: `/etc/` > `/usr/lib/` (커스텀이 기본을 덮어씀)

### 기본 구조

```ini
[Unit]
Description=서비스 설명
Documentation=https://example.com/docs
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=appuser
Group=appgroup
WorkingDirectory=/opt/myapp
ExecStart=/opt/myapp/bin/server
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### 주요 섹션 요약

```text
┌──────────────────────────────────────┐
│ [Unit]    - 설명, 문서, 의존성, 순서 │
│ [Service] - 타입, 실행, 재시작       │
│ [Install] - enable 시 연결 target    │
└──────────────────────────────────────┘
```

---

## 4. 커스텀 서비스 만들기

### 예제: Node.js 웹 앱

```ini title="/etc/systemd/system/mywebapp.service"
[Unit]
Description=My Node.js Web Application
Documentation=https://github.com/myorg/mywebapp
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=webapp
Group=webapp
WorkingDirectory=/opt/mywebapp
ExecStart=/usr/bin/node /opt/mywebapp/server.js
Restart=always
RestartSec=10
SyslogIdentifier=mywebapp

# 환경 변수
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/mywebapp/.env

# 보안 강화
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/mywebapp/data
PrivateTmp=yes

# 리소스 제한
MemoryMax=512M
CPUQuota=80%

[Install]
WantedBy=multi-user.target
```

### 예제: Go API 서버 (notify 타입)

```ini title="/etc/systemd/system/myapi.service"
[Unit]
Description=My Go API Server
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
Type=notify
User=apiuser
Group=apiuser
ExecStart=/usr/local/bin/myapi \
    --config /etc/myapi/config.yaml
WatchdogSec=30
Restart=on-failure
RestartSec=5

NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/myapi

MemoryMax=1G
MemoryHigh=768M
CPUQuota=200%
TasksMax=256
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### 배포 절차

```bash
# 1. unit 파일 복사
sudo cp mywebapp.service /etc/systemd/system/

# 2. 전용 사용자 생성
sudo useradd -r -s /usr/sbin/nologin webapp

# 3. 데몬 재로드
sudo systemctl daemon-reload

# 4. 시작 + 자동 시작 등록
sudo systemctl enable --now mywebapp.service

# 5. 상태 확인
sudo systemctl status mywebapp.service
```

---

## 5. 서비스 타입 비교

| Type | 동작 방식 | 준비 완료 시점 | 용도 |
|------|----------|-------------|------|
| `simple` | 포그라운드 | fork 직후 | Node, Go |
| `forking` | fork/부모 종료 | 부모 종료 시 | Apache |
| `oneshot` | 실행 후 종료 | 종료 시 | 초기화 |
| `notify` | sd_notify() | READY 전송 | 정밀 감지 |
| `dbus` | D-Bus 획득 | BusName 획득 | D-Bus |
| `idle` | 지연 실행 | simple 동일 | 콘솔 정리 |

### simple (기본값)

systemd가 프로세스를 fork하고 즉시 시작된 것으로
간주한다. 대부분의 현대 앱에 적합하다.

```ini
Type=simple
ExecStart=/usr/bin/myapp
```

### forking

전통적 데몬 방식. 프로세스가 fork 후 부모가 종료된다.
`PIDFile` 지정이 필요하다.

```ini
Type=forking
PIDFile=/run/myapp/myapp.pid
ExecStart=/usr/sbin/myapp -d
```

### oneshot

한 번 실행하고 종료되는 작업에 사용한다.
`RemainAfterExit=yes`로 종료 후에도 active 유지 가능.

```ini
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/bin/setup-network.sh
ExecStart=/usr/local/bin/setup-firewall.sh
```

### notify

`sd_notify()`로 준비 완료를 알린다.
`WatchdogSec`과 함께 헬스체크 구현이 가능하다.

```ini
Type=notify
WatchdogSec=30
ExecStart=/usr/local/bin/myserver
```

---

## 6. 의존성 관리

### 순서 vs 의존성

```text
순서 (After/Before) : "언제" 시작할지
의존성 (Requires/Wants) : "무엇이" 필요한지

→ 보통 둘 다 함께 지정해야 한다
```

| 디렉티브 | 강도 | 동작 |
|----------|------|------|
| `After` | 순서만 | 지정한 서비스 이후에 시작 |
| `Before` | 순서만 | 지정한 서비스 이전에 시작 |
| `Requires` | 강한 의존 | 대상 실패 시 이 서비스도 중지 |
| `Wants` | 약한 의존 | 대상 실패해도 계속 실행 |
| `BindsTo` | 최강 의존 | 대상 중지 시 즉시 중지 |

### 실전 패턴: 웹 앱

```ini
[Unit]
After=network-online.target postgresql.service redis.service
Wants=network-online.target
Requires=postgresql.service
Wants=redis.service
```

PostgreSQL은 필수(Requires), Redis는 선택(Wants).
네트워크 준비 후 DB, 캐시 순서로 시작한다.

### 의존성 확인 명령

```bash
# 의존성 트리 확인
systemctl list-dependencies nginx.service

# 역방향: 이 서비스에 의존하는 것들
systemctl list-dependencies --reverse nginx.service

# 부팅 순서 분석
systemd-analyze critical-chain myapp.service
```

---

## 7. 리소스 제한 (cgroup v2)

systemd는 cgroup v2와 통합되어 서비스별
리소스를 제한할 수 있다.
클라우드와 온프레미스 모두에서 동일하게 적용된다.

### 메모리 제한

```ini
[Service]
MemoryHigh=768M    # 소프트 제한 (회수 압력 증가)
MemoryMax=1G       # 하드 제한 (초과 시 OOM Kill)
MemoryMin=256M     # 최소 보장
MemorySwapMax=0    # 스왑 사용 금지
```

### CPU 제한

```ini
[Service]
CPUQuota=150%      # 1.5코어 할당 (100%=1코어)
CPUWeight=200      # 상대적 가중치 (기본 100)
```

### I/O 제한

```ini
[Service]
IOWeight=200
IOReadBandwidthMax=/dev/sda 50M
IOWriteBandwidthMax=/dev/sda 30M
```

### 기타 제한

```ini
[Service]
TasksMax=256           # 최대 프로세스/스레드 수
LimitNOFILE=65536      # 파일 디스크립터 제한
LimitCORE=infinity     # 코어 덤프 크기
```

### 런타임 리소스 변경

```bash
# 즉시 적용 + 영구 저장
sudo systemctl set-property myapp.service \
    MemoryMax=2G

# 런타임에만 적용 (재시작 시 원복)
sudo systemctl set-property --runtime \
    myapp.service MemoryMax=2G

# 현재 사용량 확인
systemctl show myapp.service \
    -p MemoryCurrent,CPUUsageNSec,TasksCurrent
```

### cgroup 직접 확인

```bash
# cgroup 경로
systemctl show myapp.service -p ControlGroup

# 실시간 메모리/CPU 확인
cat /sys/fs/cgroup/system.slice/\
myapp.service/memory.current
cat /sys/fs/cgroup/system.slice/\
myapp.service/cpu.stat
```

> 참고:
> [systemd.resource-control 공식 문서][res-ctrl]
> | [AWS AL2023 리소스 제한 가이드][aws-res]

[res-ctrl]: https://www.freedesktop.org/software/systemd/man/latest/systemd.resource-control.html
[aws-res]: https://docs.aws.amazon.com/linux/al2023/ug/resource-limiting-systemd.html

---

## 8. Timer (cron 대체)

### cron vs systemd Timer

| 항목 | cron | systemd Timer |
|------|------|---------------|
| 로그 | 별도 설정 필요 | journald 자동 통합 |
| 놓친 실행 | 보충 불가 | `Persistent=true` |
| 동시 실행 방지 | 별도 lock 필요 | 기본 제공 |
| 리소스 제한 | 불가 | cgroup 통합 |
| 의존성 | 없음 | 서비스 의존성 지원 |
| 상태 확인 | `crontab -l` | `systemctl list-timers` |
| 랜덤 지연 | 불가 | `RandomizedDelaySec` |

### 구성: 서비스 + 타이머 쌍

**서비스 파일** (`backup.service`):

```ini title="/etc/systemd/system/backup.service"
[Unit]
Description=Daily Backup Job

[Service]
Type=oneshot
User=backup
ExecStart=/opt/scripts/backup.sh

Nice=19
IOSchedulingClass=idle
MemoryMax=512M
CPUQuota=50%
```

**타이머 파일** (`backup.timer`):

```ini title="/etc/systemd/system/backup.timer"
[Unit]
Description=Daily Backup Timer

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
RandomizedDelaySec=30min
AccuracySec=1min

[Install]
WantedBy=timers.target
```

### OnCalendar 문법

| 표현식 | 의미 |
|--------|------|
| `hourly` | 매시 정각 |
| `daily` | 매일 00:00 |
| `weekly` | 매주 월요일 00:00 |
| `*-*-* 02:00:00` | 매일 02:00 |
| `Mon..Fri *-*-* 09:00:00` | 평일 09:00 |
| `*:0/15` | 15분마다 |
| `*-*-01 04:00:00` | 매월 1일 04:00 |
| `Sat *-*-* 03:00:00` | 매주 토요일 03:00 |

### Monotonic 타이머

```ini
[Timer]
OnBootSec=5min          # 부팅 후 5분 뒤
OnUnitActiveSec=1h      # 마지막 실행 후 1시간마다
OnActiveSec=10min       # 타이머 활성화 후 10분 뒤
```

### cron 변환 표

| cron | systemd OnCalendar |
|------|--------------------|
| `0 * * * *` | `hourly` |
| `0 2 * * *` | `*-*-* 02:00:00` |
| `*/15 * * * *` | `*:0/15` |
| `0 9 * * 1-5` | `Mon..Fri *-*-* 09:00:00` |
| `0 0 1 * *` | `*-*-01 00:00:00` |

### 타이머 관리

```bash
# 타이머 활성화
sudo systemctl enable --now backup.timer

# 모든 타이머 상태 확인
systemctl list-timers --all

# 수동 트리거 (테스트)
sudo systemctl start backup.service

# OnCalendar 문법 검증
systemd-analyze calendar "Mon..Fri *-*-* 09:00:00"

# 다음 5회 실행 시각 확인
systemd-analyze calendar --iterations=5 "daily"
```

---

## 9. journalctl 로그 관리

### 기본 사용법

```bash
# 특정 서비스 로그
journalctl -u nginx.service

# 실시간 추적 (tail -f 대체)
journalctl -u nginx.service -f

# 최근 50줄
journalctl -u nginx.service -n 50

# 현재 부트 로그만
journalctl -u nginx.service -b

# 이전 부트 로그
journalctl -u nginx.service -b -1
```

### 시간 필터링

```bash
# 특정 시간 이후
journalctl -u nginx.service \
    --since "2026-04-12 09:00:00"

# 상대 시간
journalctl -u nginx.service \
    --since "1 hour ago"

# 오늘 로그만
journalctl -u nginx.service --since today
```

### 우선순위 필터링

| 레벨 | 번호 | 설명 |
|------|------|------|
| `emerg` | 0 | 시스템 사용 불가 |
| `alert` | 1 | 즉시 조치 필요 |
| `crit` | 2 | 치명적 상태 |
| `err` | 3 | 에러 |
| `warning` | 4 | 경고 |
| `notice` | 5 | 주의 |
| `info` | 6 | 정보 |
| `debug` | 7 | 디버그 |

```bash
# 에러 이상만
journalctl -u nginx.service -p err

# 경고 이상
journalctl -u nginx.service -p warning

# 범위 지정
journalctl -u nginx.service -p err..crit
```

### 출력 형식

```bash
# JSON (파싱용)
journalctl -u nginx.service -o json-pretty -n 5

# 상세 (모든 필드)
journalctl -u nginx.service -o verbose

# 내장 grep (systemd 245+)
journalctl -u nginx.service \
    -g "error|timeout|failed"
```

### 저널 관리

```bash
# 디스크 사용량 확인
journalctl --disk-usage

# 1GB까지만 유지
sudo journalctl --vacuum-size=1G

# 2주 이전 삭제
sudo journalctl --vacuum-time=2weeks

# 무결성 검증
journalctl --verify
```

### 영구 저장소 설정

systemd 259부터 기본값이 `persistent`다.
이전 버전에서는 수동 설정이 필요하다.

```ini title="/etc/systemd/journald.conf"
[Journal]
Storage=persistent
SystemMaxUse=2G
SystemMaxFileSize=256M
MaxRetentionSec=1month
```

> 참고:
> [DigitalOcean - journalctl 가이드][do-journal]

[do-journal]: https://www.digitalocean.com/community/tutorials/how-to-use-journalctl-to-view-and-manipulate-systemd-logs

---

## 10. 트러블슈팅

### 체계적 진단 워크플로우

```text
1. systemctl status myapp.service
   └→ 현재 상태, 최근 로그 요약

2. systemctl --failed
   └→ 실패한 서비스 목록

3. journalctl -u myapp.service -xe
   └→ 상세 로그 (-x: 설명, -e: 끝부터)

4. systemd-analyze verify <unit-file>
   └→ unit 파일 문법 검증

5. sudo -u appuser /opt/myapp/bin/server
   └→ 수동 실행으로 에러 재현

6. systemctl list-dependencies myapp.service
   └→ 의존성 문제 확인
```

### 흔한 실패 패턴

#### 시작 즉시 실패

원인: 설정 오류, 파일 누락, 권한 문제

```bash
journalctl -u myapp -b --no-pager
sudo journalctl -u myapp.service -b \
    | grep -i "permission\|denied"
ls -la /opt/myapp/bin/server
```

#### 실행 중이나 응답 없음

원인: 앱 내부 오류, 포트 충돌

```bash
ss -tlnp | grep <port>
```

#### 간헐적 종료

원인: OOM Kill, watchdog 타임아웃

```bash
# OOM 확인
journalctl -u myapp.service -b \
    | grep -i "oom\|killed\|memory"
dmesg | grep -i "oom\|killed"

# OOM Kill 횟수 (systemd 259+)
systemctl show myapp.service \
    -p OOMKills,ManagedOOMKills
```

#### 의존성 문제

```bash
# 부팅 순서 분석
systemd-analyze critical-chain myapp.service

# 부팅 시간 분석
systemd-analyze blame
```

### 실패 상태 초기화

```bash
# 특정 서비스 리셋
sudo systemctl reset-failed myapp.service

# 전체 리셋
sudo systemctl reset-failed
```

### 보안 점검

```bash
# 서비스 보안 점수 확인
systemd-analyze security myapp.service
```

`UNSAFE` 항목을 개선하여 보안을 강화할 수 있다.

### 권장 보안 디렉티브

```ini
[Service]
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadWritePaths=/var/lib/myapp
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
PrivateDevices=yes
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
```

> 참고:
> [Red Hat - systemd unit 파일 문서][rh-unit]
> | [systemd 보안 강화 가이드][sec-guide]

[rh-unit]: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_systemd_unit_files_to_customize_and_optimize_your_system/assembly_working-with-systemd-unit-files_working-with-systemd
[sec-guide]: https://www.dotlinux.net/blog/how-to-increase-the-security-of-systemd-services/
