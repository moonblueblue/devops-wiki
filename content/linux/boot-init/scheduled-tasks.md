---
title: "systemd-timer와 crontab"
sidebar_label: "스케줄 작업"
sidebar_position: 3
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - cron
  - systemd
  - scheduling
---

# systemd-timer와 crontab

Linux의 스케줄 작업은 크게 두 가지 방식이 있다.
cron은 단순하고 이식성이 높으며,
systemd-timer는 의존성·리소스 제한·보안 격리를 제공한다.

---

## crontab

### 문법

```
분(0-59)  시(0-23)  일(1-31)  월(1-12)  요일(0-7)  명령어
```

| 문자 | 의미 | 예시 |
|------|------|------|
| `*` | 와일드카드 (모든 값) | `*` |
| `,` | 목록 | `1,15,45` |
| `-` | 범위 | `9-17` |
| `/` | 단계 (step) | `*/15`, `0-59/15` |
| `~` | 범위 내 무작위 (cronie 전용) | `6~15` |

```
# 예시
0 2 * * *       # 매일 오전 2시
*/15 * * * *    # 15분마다
0 9-17 * * 1-5  # 평일 오전 9시~오후 5시 매 시 정각
0 0 1 * *       # 매달 1일 자정
```

### @special 단축 표현

| 표현 | 동등 표현 |
|------|----------|
| `@reboot` | 재부팅 후 1회 |
| `@yearly` / `@annually` | `0 0 1 1 *` |
| `@monthly` | `0 0 1 * *` |
| `@weekly` | `0 0 * * 0` |
| `@daily` / `@midnight` | `0 0 * * *` |
| `@hourly` | `0 * * * *` |

### 파일 위치

| 위치 | 형식 | 용도 |
|------|------|------|
| `crontab -e` | `분 시 일 월 요일 명령` | 사용자 개인 스케줄 |
| `/etc/cron.d/` | `분 시 일 월 요일 사용자 명령` | 패키지·자동화 배포 **권장** |
| `/etc/crontab` | `분 시 일 월 요일 사용자 명령` | 시스템 전체 (직접 수정 비권장) |
| `/etc/cron.{hourly,daily,weekly,monthly}/` | 실행 파일 | `run-parts`로 호출 |

`/etc/cron.d/`에 개별 파일로 관리하는 것이 권장된다.
`/etc/crontab` 직접 수정은 패키지 업데이트 시 충돌 위험이 있다.

### 환경변수

```crontab
SHELL=/bin/bash
# cron 환경의 PATH는 최소한으로 설정됨 (/usr/bin:/bin)
# "셸에서는 되는데 cron에서 안 된다"의 주요 원인
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=admin@example.com    # 출력 이메일 수신; ""이면 비활성
CRON_TZ=Asia/Seoul          # 스케줄 기준 타임존 (cronie 확장)
RANDOM_DELAY=30             # 최대 N분 내 무작위 지연 (cronie 확장)
```

### 출력 처리

```crontab
# 표준 출력 + 에러를 파일에 append
0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1

# 출력 버리기 (MAILTO=가 없을 때도 cron 메일 없음)
0 2 * * * /usr/local/bin/backup.sh > /dev/null 2>&1

# stderr만 파일에 기록
0 2 * * * /usr/local/bin/backup.sh 2>> /var/log/backup-err.log
```

### 보안: cron.allow / cron.deny

| 파일 | 동작 |
|------|------|
| `/etc/cron.allow` | 존재 시: 파일에 명시된 사용자만 사용 가능 |
| `/etc/cron.deny` | `cron.allow` 없을 때: 명시된 사용자는 사용 불가 |
| 둘 다 없음 | cronie: root만, Debian cron: 모두 허용 |

### 구현체 현황 (2026)

| 구현체 | 기본 배포판 | 버전 |
|--------|-----------|------|
| **cronie** | RHEL/Fedora/Arch | **1.7.2** (2024-04-08) |
| cronie (RHEL 9) | RHEL 9, AlmaLinux 9 | 1.5.7 (보수적 정책) |
| **Vixie cron** | Debian/Ubuntu **기본** | 3.0pl1+패치 |

---

## systemd-timer

systemd-timer는 .timer 유닛과 .service 유닛 두 파일로 구성된다.
이름이 같으면 자동으로 연결된다(`Unit=` 지정 불필요).

### 기본 구조

```ini
# /etc/systemd/system/mybackup.timer
[Unit]
Description=Daily backup at 2 AM

[Timer]
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=900     # 최대 15분 무작위 지연
Persistent=true            # missfire 처리
AccuracySec=1s             # 정밀도 (기본: 1min)

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/mybackup.service
[Unit]
Description=Daily backup
After=network-online.target

[Service]
Type=oneshot
User=backup
ExecStart=/usr/local/bin/backup.sh
CPUQuota=30%
MemoryMax=2G
StandardOutput=journal
StandardError=journal

# 보안 격리 (배치 잡에도 하드닝 권장)
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/backups
```

```bash
systemctl enable --now mybackup.timer
systemctl list-timers                   # 다음 실행 시간 확인
```

### 타이밍 옵션

#### 달력 기반 (Realtime)

```ini
OnCalendar=daily                       # 매일 자정
OnCalendar=*-*-* 02:30:00             # 매일 오전 2시 30분
OnCalendar=Mon..Fri *-*-* 09:00:00    # 평일 오전 9시
OnCalendar=*-*-01 00:00:00            # 매달 1일 자정
OnCalendar=*-*~1 00:00:00             # 매달 마지막 날 자정
OnCalendar=quarterly                   # 분기 1회
OnCalendar=*-*-* *:0/15:00            # 15분마다
```

#### 단조시계 기반 (Monotonic)

| 옵션 | 기준 시점 |
|------|----------|
| `OnBootSec=` | 머신 부팅 시점 |
| `OnStartupSec=` | systemd 서비스 매니저 시작 시점 |
| `OnActiveSec=` | 타이머 활성화 시점 |
| `OnUnitActiveSec=` | 서비스 마지막 활성화 시점 (반복 간격) |
| `OnUnitInactiveSec=` | 서비스 마지막 완료 시점 (완료 후 X초 뒤) |

#### 동작 제어 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `AccuracySec=` | **1min** | 실행 정확도. 초 단위 정밀도 필요 시 `1s` 명시 필요 |
| `RandomizedDelaySec=` | 0 | 0~N 무작위 지연 (thundering herd 방지) |
| `Persistent=` | false | `OnCalendar=` 전용. 꺼져 있던 동안 missfire를 부팅 후 즉시 실행 |
| `WakeSystem=` | false | 절전 상태에서 타이머 발화 시 시스템 깨움 |
| `DeferReactivation=` | false | 서비스 실행 중 타이머 재발화 시 즉시 재시작 건너뜀 (v257+) |

> `AccuracySec=`의 기본값은 **1분**이다.
> 배치 잡은 1분으로 충분하지만, 초 단위 정확도가 필요하면
> 반드시 `AccuracySec=1s`를 명시해야 한다.

> `Persistent=true`는 `OnCalendar=`에만 적용된다.
> 단조시계(`OnBootSec=` 등) 타이머에는 무효.

### 표현식 검증

```bash
# 표현식 파싱 및 다음 실행 시간 확인
systemd-analyze calendar "Mon..Fri *-*-* 09:00:00"

# 출력 예시
#   Original form: Mon..Fri *-*-* 09:00:00
# Normalized form: Mon..Fri *-*-* 09:00:00
#     Next elapse: Mon 2026-04-20 09:00:00 KST
#        From now: 3 days 11h left

# 다음 5회 발화 시점 확인
systemd-analyze calendar --iterations=5 "monthly"

# 현재 활성 타이머 전체 목록
systemctl list-timers
```

---

## cron vs systemd-timer 비교

| 항목 | cron | systemd-timer |
|------|------|---------------|
| 설정 | 1줄 | 파일 2개 |
| 의존성 관리 | 없음 | `After=`, `Requires=` 완전 지원 |
| 로그 | `/var/log/syslog` (or MAILTO) | journald 통합 |
| Missfire 처리 | 없음 | `Persistent=true` |
| 중복 실행 방지 | flock 필요 | 기본 방지 (실행 중 재발화 불가) |
| 리소스 제한 | 없음 | cgroup v2: CPU/메모리/IO |
| 보안 샌드박스 | 없음 | `ProtectSystem=`, `DynamicUser=` 등 |
| 실패 알림 | MAILTO | `OnFailure=alert.service` |
| 이식성 | BSDs 포함 범용 | systemd Linux only |
| 표현식 | `0 2 * * 1` | `Mon *-*-* 02:00:00` |

### cron을 선호하는 경우

- 비systemd 환경 (BSDs, Alpine + OpenRC, 일부 컨테이너)
- 수십 줄의 단순 사용자 스케줄
- 기존 cron이 잘 돌고 있고 마이그레이션 ROI가 낮은 경우
- 팀 전원이 cron에 익숙하고 학습 비용이 부담인 경우

---

## anacron

anacron은 **항상 켜져 있지 않은 시스템**을 위한 cron 보완 도구다.
"지난 N일 안에 이 작업이 실행된 적 없으면 실행"하는 의미론이다.

```
# /etc/anacrontab
# 주기(일)  지연(분)  job-id          명령
1           5         cron.daily       nice run-parts /etc/cron.daily
7           10        cron.weekly      nice run-parts /etc/cron.weekly
@monthly    15        cron.monthly     nice run-parts /etc/cron.monthly
```

| 항목 | anacron | systemd `Persistent=true` |
|------|---------|--------------------------|
| 지원 단위 | 일/주/월 | 임의 `OnCalendar=` 표현식 |
| 부팅 지연 | delay 필드 | `RandomizedDelaySec=` 조합 |
| 로그 | syslog | journald |

systemd 환경이라면 `Persistent=true`가 anacron을 대체한다.

---

## 실무 패턴

### 중복 실행 방지 (cron + flock)

systemd-timer는 실행 중인 서비스가 있으면 기본적으로 중복 시작을 막는다.
cron은 직접 잠금을 구현해야 한다.

```bash
# flock — 잠금 획득 실패 시 즉시 스킵
* * * * * /usr/bin/flock -n /var/lock/myjob.lock \
  /usr/local/bin/myjob.sh

# run-one (Ubuntu/Debian)
* * * * * run-one /usr/local/bin/myjob.sh
```

> 파일 락은 **단일 서버**에서만 유효하다.
> 여러 서버에서 동일 잡이 실행되는 분산 환경에서는
> Redis/DB 기반 분산 락 또는 Kubernetes CronJob을 사용한다.

### DB 백업 타이머 예시

```ini
# /etc/systemd/system/pg-backup.timer
[Unit]
Description=PostgreSQL daily backup

[Timer]
OnCalendar=*-*-* 02:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/pg-backup.service
[Unit]
Description=PostgreSQL backup
After=postgresql.service
Requires=postgresql.service
OnFailure=notify-failure@%n.service

[Service]
Type=oneshot
User=postgres
ExecStart=/usr/local/bin/pg-backup.sh
CPUQuota=30%
MemoryMax=2G
```

### 작업 완료 모니터링 (Dead Man's Switch)

작업이 **완료됐다는 신호를 보내지 않으면 알림 발생**.
서버 다운, 데몬 중단, 무한 루프 등 모든 실패 시나리오를 탐지한다.

```bash
# cron에서 healthchecks.io ping (성공 시에만)
0 2 * * * /usr/local/bin/backup.sh \
  && curl -fsS https://hc-ping.com/<uuid> \
  || curl -fsS https://hc-ping.com/<uuid>/fail
```

```ini
# systemd-timer에서 ExecStartPost로 ping
[Service]
ExecStart=/usr/local/bin/backup.sh
ExecStartPost=/usr/bin/curl -fsS https://hc-ping.com/<uuid>
```

healthchecks.io는 오픈소스(Python/Django)로 self-host 가능하다.

### cron → systemd-timer 마이그레이션

```bash
# 기존 cron 엔트리
# 0 2 * * * /usr/local/bin/cleanup.sh

# 1. 서비스 유닛 생성
cat > /etc/systemd/system/cleanup.service << 'EOF'
[Unit]
Description=Daily cleanup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup.sh
User=deploy
EOF

# 2. 타이머 유닛 생성
cat > /etc/systemd/system/cleanup.timer << 'EOF'
[Unit]
Description=Run cleanup daily at 2 AM

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# 3. 활성화 및 검증
systemctl daemon-reload
systemctl enable --now cleanup.timer
systemctl list-timers cleanup.timer
journalctl -u cleanup.service -b

# 4. 충분한 검증 후 기존 crontab 엔트리 제거
```

---

## 대안 도구

| 항목 | cron/systemd-timer | Ofelia (Docker) | K8s CronJob |
|------|-------------------|-----------------|-------------|
| 환경 | 베어메탈/VM | Docker Compose | Kubernetes |
| 격리 | 프로세스 | 컨테이너 | Pod |
| 중복 방지 | flock 필요 / 기본 방지 | `no-overlap` 내장 | `concurrencyPolicy` |
| 실패 재시도 | 없음 (별도 구현) | 없음 | `backoffLimit` |
| 분산 환경 | flock=단일 서버 한정 | flock=단일 서버 한정 | 분산 기본 지원 |

```yaml
# K8s CronJob 예시
apiVersion: batch/v1
kind: CronJob
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid         # 중복 실행 방지
  startingDeadlineSeconds: 3600     # missfire 허용 범위
  jobTemplate:
    spec:
      backoffLimit: 3               # 실패 시 재시도 횟수
      template:
        spec:
          containers:
          - name: backup
            image: backup:1.2.3  # latest 태그 금지 — 재현성·보안 위험
```

---

## 참고 자료

- [crontab(5) — man7.org](https://man7.org/linux/man-pages/man5/crontab.5.html)
  (확인: 2026-04-16)
- [systemd.timer(5) — Arch Manpages](https://man.archlinux.org/man/systemd.timer.5.en)
  (확인: 2026-04-16)
- [systemd.time(7) — man7.org](https://man7.org/linux/man-pages/man7/systemd.time.7.html)
  (확인: 2026-04-16)
- [cronie GitHub Releases](https://github.com/cronie-crond/cronie/releases)
  (확인: 2026-04-16)
- [healthchecks.io — Cron Job Monitoring](https://healthchecks.io/docs/monitoring_cron_jobs/)
  (확인: 2026-04-16)
- [Ofelia — Docker Job Scheduler](https://github.com/mcuadros/ofelia)
  (확인: 2026-04-16)
