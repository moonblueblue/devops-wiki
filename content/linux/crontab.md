---
title: "crontab과 주기적 작업 관리"
date: 2026-04-13
tags:
  - linux
  - crontab
  - cron
  - scheduling
  - devops
  - automation
sidebar_label: "crontab"
---
format: md

# crontab과 주기적 작업 관리

## 1. cron 개요

cron은 유닉스/리눅스의 시간 기반 작업 스케줄러다.
crond 데몬이 매분 crontab을 스캔하여
시각이 일치하는 명령을 자동 실행한다.

서버 운영에서 로그 정리, 백업, 헬스체크,
인증서 갱신 등 반복 작업에 필수적이다.

> 참고:
> [crontab(5) - Linux man page](https://man7.org/linux/man-pages/man5/crontab.5.html)
> | [Ubuntu CronHowto](https://help.ubuntu.com/community/CronHowto)

---

## 2. crontab 문법

### 5-field 구조

```text
┌──────────── 분 (0-59)
│ ┌────────── 시 (0-23)
│ │ ┌──────── 일 (1-31)
│ │ │ ┌────── 월 (1-12)
│ │ │ │ ┌──── 요일 (0-6, 0=일)
│ │ │ │ │
* * * * * command
```

### 필드별 범위와 특수 문자

| 필드 | 범위 | 설명 |
|------|------|------|
| 분 | 0-59 | 실행할 분 |
| 시 | 0-23 | 실행할 시 (0=자정) |
| 일 | 1-31 | 실행할 날짜 |
| 월 | 1-12 | 실행할 월 |
| 요일 | 0-6 | 0=일, 1=월, ..., 6=토 |

### 특수 문자

| 문자 | 의미 | 예시 |
|------|------|------|
| `*` | 모든 값 | `* * * * *` (매분) |
| `,` | 값 나열 | `0,30 * * * *` (0분, 30분) |
| `-` | 범위 | `9-17 * * *` (9시~17시) |
| `/` | 간격 | `*/5 * * * *` (매 5분) |

### 특수 키워드

| 키워드 | 동일 표현 | 설명 |
|--------|-----------|------|
| `@reboot` | - | 부팅 시 1회 |
| `@yearly` | `0 0 1 1 *` | 매년 1월 1일 |
| `@monthly` | `0 0 1 * *` | 매월 1일 |
| `@weekly` | `0 0 * * 0` | 매주 일요일 |
| `@daily` | `0 0 * * *` | 매일 자정 |
| `@hourly` | `0 * * * *` | 매시 정각 |

---

## 3. 자주 쓰는 스케줄 패턴

| 패턴 | 표현식 | 설명 |
|------|--------|------|
| 매 5분 | `*/5 * * * *` | 모니터링, 헬스체크 |
| 매 30분 | `*/30 * * * *` | 데이터 동기화 |
| 매시 정각 | `0 * * * *` | 로그 수집 |
| 매일 자정 | `0 0 * * *` | 일일 백업, 정리 |
| 매일 오전 6시 | `0 6 * * *` | 일일 리포트 |
| 평일 9시 | `0 9 * * 1-5` | 업무 시간 작업 |
| 매주 월요일 9시 | `0 9 * * 1` | 주간 리포트 |
| 매월 1일 자정 | `0 0 1 * *` | 월간 정산 |
| 매월 15,30일 | `0 0 15,30 * *` | 반월 작업 |
| 부팅 시 1회 | `@reboot` | 데몬 시작 |

---

## 4. crontab 관리 명령어

### 기본 명령어

| 명령어 | 설명 |
|--------|------|
| `crontab -e` | crontab 편집 |
| `crontab -l` | crontab 조회 |
| `crontab -r` | crontab 전체 삭제 (주의) |
| `crontab -u user -l` | 특정 사용자 조회 (root) |
| `crontab file.txt` | 파일에서 불러오기 |

### 실전 예시

```bash
# 현재 crontab 백업
crontab -l > ~/crontab_backup_$(date +%F).txt

# 백업에서 복원
crontab ~/crontab_backup_2026-04-13.txt

# 특정 사용자의 crontab 편집 (root 권한)
sudo crontab -u deploy -e

# crontab 삭제 전 확인 (실수 방지)
crontab -l && echo "---삭제합니다---" && crontab -r
```

> **주의**: `crontab -r`은 확인 없이
> 즉시 모든 작업을 삭제한다.
> 반드시 `-l`로 백업 후 실행할 것.

---

## 5. 시스템 crontab vs 사용자 crontab

### 비교표

| 항목 | 사용자 crontab | /etc/crontab |
|------|---------------|--------------|
| 편집 방법 | `crontab -e` | 직접 편집 |
| 저장 위치 | `/var/spool/cron/` | `/etc/crontab` |
| 사용자 필드 | 없음 (본인) | **있음 (필수)** |
| 권한 | 본인만 | root만 |
| 용도 | 개인 작업 | 시스템 전역 작업 |

### 시스템 crontab 형식

```bash title="/etc/crontab"
# /etc/crontab - 사용자 필드 포함
# 분 시 일 월 요일 사용자 명령
0  3  *  *  *  root  /usr/local/bin/backup.sh
*/5 * * * * nobody /usr/local/bin/healthcheck.sh
```

### cron 디렉토리 구조

| 디렉토리 | 용도 | 형식 |
|----------|------|------|
| `/etc/cron.d/` | 패키지별 cron 작업 | crontab 문법 |
| `/etc/cron.hourly/` | 매시 실행 스크립트 | 쉘 스크립트 |
| `/etc/cron.daily/` | 매일 실행 스크립트 | 쉘 스크립트 |
| `/etc/cron.weekly/` | 매주 실행 스크립트 | 쉘 스크립트 |
| `/etc/cron.monthly/` | 매월 실행 스크립트 | 쉘 스크립트 |

`/etc/cron.d/`는 `/etc/crontab`과 같은 문법이다.
나머지 디렉토리는 `run-parts`로 실행되는
일반 쉘 스크립트를 넣는 곳이다.

```bash title="/etc/cron.d/certbot"
# /etc/cron.d/certbot - 패키지가 설치한 예시
0 */12 * * * root certbot renew --quiet

# /etc/cron.daily/ 에 스크립트 추가
sudo cp cleanup.sh /etc/cron.daily/cleanup
sudo chmod +x /etc/cron.daily/cleanup
```

---

## 6. 환경 변수

cron은 로그인 쉘이 아니므로
`.bashrc`나 `.profile`이 로드되지 않는다.
PATH가 매우 제한적이다.

### crontab 내 환경 변수 설정

```bash
# crontab 상단에 환경 변수 정의
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
MAILTO=ops-team@example.com
HOME=/home/deploy

# 작업 정의
0 3 * * * /home/deploy/scripts/backup.sh
```

### 주요 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `SHELL` | `/bin/sh` | 명령 실행 쉘 |
| `PATH` | `/usr/bin:/bin` | 명령 검색 경로 |
| `MAILTO` | crontab 소유자 | 출력 메일 수신자 |
| `HOME` | 사용자 홈 | 작업 실행 디렉토리 |

```bash
# MAILTO 비활성화 (메일 안 보냄)
MAILTO=""

# 여러 수신자 지정
MAILTO="admin@example.com,oncall@example.com"
```

> **팁**: 스크립트 내부에서 필요한 환경 변수를
> source로 로드하면 crontab을 깔끔하게 유지할 수 있다.
> 예: `source /etc/profile.d/app-env.sh`

---

## 7. 로깅과 디버깅

### 로그 확인

| 배포판 | 로그 위치 | 명령어 |
|--------|----------|--------|
| RHEL/CentOS | `/var/log/cron` | `tail -f /var/log/cron` |
| Ubuntu/Debian | `/var/log/syslog` | `grep CRON /var/log/syslog` |
| systemd 전체 | journald | `journalctl -u cron` |

### 출력 리다이렉트

```bash
# stdout + stderr를 파일로 저장
0 3 * * * /opt/backup.sh >> /var/log/backup.log 2>&1

# 타임스탬프 포함 로깅
*/5 * * * * /opt/check.sh 2>&1 \
  | ts '[%Y-%m-%d %H:%M:%S]' >> /var/log/check.log

# 출력 완전 무시
0 * * * * /opt/cleanup.sh > /dev/null 2>&1
```

### 디버깅 체크리스트

```bash
# 1. cron 데몬 실행 확인
systemctl status cron    # Debian/Ubuntu
systemctl status crond   # RHEL/CentOS

# 2. crontab 등록 확인
crontab -l

# 3. 스크립트 실행 권한 확인
ls -la /opt/backup.sh

# 4. 스크립트 수동 실행 테스트
/bin/sh -c '/opt/backup.sh'

# 5. 최근 cron 로그 확인
journalctl -u cron --since "1 hour ago"
```

---

## 8. systemd Timer와 비교

### 비교표

| 항목 | cron | systemd timer |
|------|------|---------------|
| 설정 복잡도 | 낮음 (한 줄) | 높음 (2개 파일) |
| 로깅 | 수동 설정 필요 | journald 자동 통합 |
| 의존성 관리 | 없음 | 유닛 간 의존성 |
| 놓친 작업 | 무시 | `Persistent=true` |
| 리소스 제한 | 없음 | cgroup 통합 |
| 최소 단위 | 1분 | 1초 이하 |
| 상태 확인 | 로그 확인 | `systemctl list-timers` |
| 이식성 | 거의 모든 유닉스 | systemd 기반만 |

### systemd timer 예시

```ini title="/etc/systemd/system/backup.timer"
# /etc/systemd/system/backup.timer
[Unit]
Description=Daily backup timer

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```ini title="/etc/systemd/system/backup.service"
# /etc/systemd/system/backup.service
[Unit]
Description=Daily backup

[Service]
Type=oneshot
ExecStart=/opt/backup.sh
User=deploy
```

```bash
# 타이머 활성화
sudo systemctl enable --now backup.timer

# 타이머 상태 확인
systemctl list-timers --all | grep backup
```

### anacron

항상 켜져 있지 않은 시스템(노트북, 개발 VM)에서는
anacron이 놓친 daily/weekly/monthly 작업을 보완한다.

```bash title="/etc/anacrontab"
# /etc/anacrontab 형식
# 주기(일)  지연(분)  식별자  명령
1    5    daily-backup   /opt/backup.sh
7    10   weekly-report  /opt/report.sh
```

### 선택 가이드

- **단순 주기 작업** → cron
- **로깅/의존성/리소스 제어** → systemd timer
- **꺼질 수 있는 서버** → anacron 또는 Persistent=true

---

## 9. 보안

### cron.allow / cron.deny

| 파일 | 설명 |
|------|------|
| `/etc/cron.allow` | 목록에 있는 사용자만 허용 |
| `/etc/cron.deny` | 목록에 있는 사용자만 차단 |

**적용 우선순위:**

1. `cron.allow` 존재 → 목록 사용자만 허용
2. `cron.allow` 없고 `cron.deny` 존재 → deny 사용자만 차단
3. 둘 다 없음 → 배포판에 따라 다름

```bash
# 화이트리스트 방식 (권장)
echo "deploy" | sudo tee /etc/cron.allow
echo "admin" | sudo tee -a /etc/cron.allow

# 차단 방식
echo "guest" | sudo tee /etc/cron.deny
```

### 보안 체크리스트

- cron.allow로 화이트리스트 운영
- crontab에 비밀값(패스워드, API키) 직접 넣지 않기
- 가능하면 root 대신 전용 서비스 계정 사용
- 스크립트 파일 권한 최소화 (750 이하)
- /etc/cron.d/ 파일 소유자/권한 확인

---

## 10. 실전 베스트 프랙티스

### 중복 실행 방지 (flock)

```bash
# flock으로 락 파일 기반 중복 방지
*/5 * * * * flock -n /tmp/sync.lock \
  /opt/sync.sh >> /var/log/sync.log 2>&1
```

### 변경 전 백업 습관

```bash
# 편집 전 반드시 백업
crontab -l > ~/crontab_$(date +%F_%H%M).bak
crontab -e
```

### 외부 모니터링 연동

```bash
# healthchecks.io 핑 방식
0 3 * * * /opt/backup.sh \
  && curl -fsS -o /dev/null https://hc-ping.com/UUID

# 실패 시에도 핑 (상태 전달)
0 3 * * * /opt/backup.sh; \
  curl -fsS -o /dev/null https://hc-ping.com/UUID/$?
```

### 운영 팁 정리

| 항목 | 권장 사항 |
|------|-----------|
| 경로 | 절대 경로만 사용 |
| 출력 | `>> log 2>&1` 필수 |
| 중복 방지 | `flock` 사용 |
| 백업 | 편집 전 `crontab -l` 저장 |
| 테스트 | 짧은 주기로 먼저 확인 |
| 모니터링 | 외부 핑 서비스 연동 |
| 메일 | `MAILTO` 설정 |
| 비밀값 | 환경 파일에서 source |

> 참고:
> [crontab(5) man page](https://man7.org/linux/man-pages/man5/crontab.5.html)
> | [Cron vs Systemd Timers 2026](https://crongen.com/blog/cron-vs-systemd-timers-2026)
> | [Healthchecks.io Blog](https://blog.healthchecks.io/2023/01/using-logs-to-troubleshoot-failing-cron-jobs/)
> | [SigNoz - Crontab Logs](https://signoz.io/guides/crontab-logs/)
