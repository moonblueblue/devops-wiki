---
title: "syslog과 journald: 리눅스 로깅 시스템 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - syslog
  - journald
  - rsyslog
  - logging
  - systemd
  - devops
sidebar_label: "syslog·journald"
---
format: md

# syslog과 journald

## 1. 리눅스 로깅 개요

리눅스에는 두 가지 핵심 로깅 시스템이 존재한다.
전통적인 **syslog** 계열과
systemd 기반의 **journald**다.

2025-2026년 현재 대부분의 배포판은 두 시스템을
함께 운영한다. journald가 모든 로그를 수집하고
rsyslog가 파일 저장과 원격 전송을 담당한다.

### 로깅 아키텍처 흐름

```
커널/서비스/앱
    │
    ▼
journald (수집·인덱싱·저장)
    │
    ▼  ForwardToSyslog=yes
rsyslog (파일 분류·원격 전송)
    │
    ▼
/var/log/*  또는  원격 서버
```

> 참고:
> [Arch Wiki - systemd/Journal][arch-journal]
> | [rsyslog 공식 문서][rsyslog-doc]

[arch-journal]: https://wiki.archlinux.org/title/Systemd/Journal
[rsyslog-doc]: https://www.rsyslog.com/doc/configuration/index.html

---

## 2. syslog 프로토콜과 facility/priority

syslog는 RFC 5424로 표준화된 로그 전송 프로토콜이다.
모든 메시지는 **facility**(출처)와
**severity**(심각도)로 분류된다.

### Facility 목록

| 코드 | 키워드 | 설명 |
|------|--------|------|
| 0 | `kern` | 커널 메시지 |
| 1 | `user` | 사용자 수준 메시지 |
| 2 | `mail` | 메일 시스템 |
| 3 | `daemon` | 시스템 데몬 |
| 4 | `auth` | 보안/인증 |
| 5 | `syslog` | syslogd 내부 |
| 9 | `cron` | cron 데몬 |
| 10 | `authpriv` | 보안/인증 (private) |
| 11 | `ftp` | FTP 데몬 |
| 16-23 | `local0`-`local7` | 사용자 정의 |

### Severity 목록

| 코드 | 키워드 | 설명 |
|------|--------|------|
| 0 | `emerg` | 시스템 사용 불가 |
| 1 | `alert` | 즉시 조치 필요 |
| 2 | `crit` | 치명적 상황 |
| 3 | `err` | 오류 |
| 4 | `warning` | 경고 |
| 5 | `notice` | 정상이지만 주의 필요 |
| 6 | `info` | 정보성 메시지 |
| 7 | `debug` | 디버그 메시지 |

### Priority 값 계산

Priority(PRI) = Facility x 8 + Severity 로 계산한다.
예를 들어 `local4.notice`는
20 x 8 + 5 = **165**다.

> 참고:
> [RFC 5424 - The Syslog Protocol][rfc5424]

[rfc5424]: https://datatracker.ietf.org/doc/html/rfc5424

---

## 3. rsyslog 설정

rsyslog는 가장 널리 사용되는 syslog 구현체다.
RHEL, Ubuntu 등 주요 배포판에서
기본 syslog 데몬으로 채택하고 있다.

### 설정 파일 구조

```
/etc/rsyslog.conf          # 메인 설정
/etc/rsyslog.d/*.conf      # 드롭인 설정
```

### 기본 규칙 (selector + action)

```bash
# facility.priority    action(대상)
*.info;mail.none       /var/log/messages
authpriv.*             /var/log/secure
mail.*                 -/var/log/maillog
cron.*                 /var/log/cron
*.emerg                :omusrmsg:*
```

| 문법 | 의미 |
|------|------|
| `*.*` | 모든 facility, 모든 priority |
| `mail.none` | mail facility 제외 |
| `=err` | err만 (상위 제외) |
| `!err` | err 제외 |
| `-/path` | 비동기 쓰기 (성능 우선) |

### 모듈 로드

```bash
# journald에서 메시지 수신
module(load="imjournal")

# 로컬 유닉스 소켓 입력
module(load="imuxsock")

# UDP 원격 수신
module(load="imudp")
input(type="imudp" port="514")

# TCP 원격 수신
module(load="imtcp")
input(type="imtcp" port="514")
```

### 템플릿 (RainerScript)

```bash
# 문자열 템플릿
template(name="RemoteFmt" type="string"
  string="<%PRI%>%TIMESTAMP% %HOSTNAME% %msg%\n"
)

# JSON 템플릿
template(name="JsonFmt" type="list") {
  constant(value="{")
  property(name="timestamp"
           outname="@timestamp" format="jsonf")
  constant(value=",")
  property(name="hostname"
           outname="host" format="jsonf")
  constant(value=",")
  property(name="msg"
           outname="message" format="jsonf")
  constant(value="}")
}
```

### 설정 반영

```bash
# 문법 검증
rsyslogd -N 1

# 서비스 재시작
sudo systemctl restart rsyslog
```

> 참고:
> [rsyslog 설정 문서][rsyslog-cfg]
> | [RHEL 로깅 설정 가이드][rhel-log]

[rsyslog-cfg]: https://docs.rsyslog.com/doc/configuration/index.html
[rhel-log]: https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/security_hardening/assembly_configuring-a-remote-logging-solution_security-hardening

---

## 4. systemd journald

journald는 systemd에 통합된 로깅 데몬이다.
바이너리 형식으로 저장하며 구조화된 메타데이터를
자동 수집한다.

### 저장 위치

| 모드 | 경로 | 특징 |
|------|------|------|
| persistent | `/var/log/journal/` | 재부팅 후 유지 |
| volatile | `/run/log/journal/` | 재부팅 시 삭제 |
| auto | 디렉토리 존재 여부에 따라 결정 | 기본값 (259 이전) |

systemd 259(2025년 12월)부터 기본 Storage가
`persistent`로 변경되었다.

### /etc/systemd/journald.conf

```ini
[Journal]
# 저장 모드
Storage=persistent

# 디스크 제한 (영구 저장)
SystemMaxUse=500M
SystemKeepFree=1G
SystemMaxFileSize=50M

# 보존 기간
MaxRetentionSec=1month
MaxFileSec=1week

# 압축
Compress=yes

# syslog 전달
ForwardToSyslog=yes
ForwardToKMsg=no
ForwardToConsole=no
ForwardToWall=yes

# 저장/전달 최대 레벨
MaxLevelStore=debug
MaxLevelSyslog=debug
```

### 주요 기본값

| 옵션 | 기본값 |
|------|--------|
| `SystemMaxUse` | 파일시스템의 10% (상한 4GiB) |
| `SystemKeepFree` | 파일시스템의 15% (상한 4GiB) |
| `SystemMaxFileSize` | SystemMaxUse의 1/8 |
| `Compress` | yes |
| `ForwardToSyslog` | yes |

### 설정 반영

```bash
sudo systemctl restart systemd-journald
```

> 참고:
> [journald.conf 매뉴얼][journald-conf]

[journald-conf]: https://www.freedesktop.org/software/systemd/man/latest/journald.conf.html

---

## 5. journalctl 실전 명령어

journalctl은 systemd 저널을 조회하는 도구다.
다양한 필터를 조합해 원하는 로그를
빠르게 검색할 수 있다.

### 기본 조회

```bash
# 전체 로그 (오래된 순)
journalctl

# 최신순 역순 조회
journalctl -r

# 최근 50줄만
journalctl -n 50

# 실시간 추적 (tail -f와 유사)
journalctl -f

# 페이저 없이 출력
journalctl --no-pager
```

### 유닛 필터 (-u)

```bash
# 단일 서비스
journalctl -u nginx.service

# 복수 서비스
journalctl -u nginx -u php-fpm

# 실시간 추적 + 유닛 필터
journalctl -fu sshd
```

### 우선순위 필터 (-p)

```bash
# err 이상만 (err + crit + alert + emerg)
journalctl -p err

# 범위 지정 (warning ~ err)
journalctl -p warning..err

# 특정 서비스의 에러만
journalctl -u nginx -p err
```

### 시간 필터 (--since / --until)

```bash
# 특정 시각 이후
journalctl --since "2026-04-12 09:00"

# 상대 시간
journalctl --since "1 hour ago"

# 기간 지정
journalctl --since yesterday --until today

# 조합 활용
journalctl -u nginx --since "30 min ago" -p err
```

### 부트 필터 (-b)

```bash
# 현재 부트 로그만
journalctl -b

# 이전 부트 로그
journalctl -b -1

# 부트 목록 확인
journalctl --list-boots
```

### 프로세스/사용자 필터

```bash
# PID로 필터
journalctl _PID=1234

# 실행 파일명으로 필터
journalctl _COMM=sshd

# UID로 필터
journalctl _UID=1000

# 커널 메시지만
journalctl -k
```

### 출력 형식 (-o)

| 옵션 | 설명 |
|------|------|
| `-o short` | 기본 (syslog 스타일) |
| `-o short-iso` | ISO 8601 타임스탬프 |
| `-o verbose` | 모든 필드 표시 |
| `-o json` | JSON 형식 |
| `-o json-pretty` | 읽기 쉬운 JSON |
| `-o cat` | 메시지 본문만 |

### 디스크 관리

```bash
# 저널 디스크 사용량 확인
journalctl --disk-usage

# 500MB까지 축소
journalctl --vacuum-size=500M

# 30일 이전 삭제
journalctl --vacuum-time=30d

# 파일 수 제한 (최대 5개)
journalctl --vacuum-files=5
```

> 참고:
> [journalctl 매뉴얼][journalctl-man]

[journalctl-man]: https://www.freedesktop.org/software/systemd/man/latest/journalctl.html

---

## 6. syslog vs journald 비교

두 시스템은 서로 대체가 아닌
상호 보완 관계로 운영된다.

### 기능 비교표

| 항목 | syslog (rsyslog) | journald |
|------|-----------------|----------|
| 저장 형식 | 텍스트 | 바이너리 |
| 구조화 로깅 | 제한적 | 네이티브 |
| 인덱싱 | 없음 | 자동 |
| 검색 | grep 의존 | 빠른 필터링 |
| 로그 회전 | logrotate 필요 | 자동 관리 |
| 원격 전송 | 네이티브 지원 | journal-remote 필요 |
| 텍스트 도구 | 직접 사용 가능 | journalctl 필요 |
| 디스크 효율 | 낮음 | 높음 (압축) |
| 메타데이터 | 제한적 | 풍부 |
| 부트 분리 | 수동 | 자동 |

### 선택 기준

| 상황 | 권장 |
|------|------|
| 로컬 디버깅·검색 | journalctl |
| 텍스트 기반 분석 파이프라인 | rsyslog 파일 |
| 원격 중앙 집중 로깅 | rsyslog 전송 |
| 구조화된 메타데이터 활용 | journald |
| 레거시 시스템 호환 | rsyslog |

### 공존 모델 (권장 구성)

```
[journald]
  Storage=persistent
  ForwardToSyslog=yes
       │
       ▼
[rsyslog]
  imjournal 모듈로 수신
  /var/log/* 파일 분류
  omfwd로 원격 전송
```

> 참고:
> [journald vs syslog][oo-compare]
> | [ManageEngine 비교][me-compare]

[oo-compare]: https://openobserve.ai/blog/journald-vs-syslog/
[me-compare]: https://www.manageengine.com/products/eventlog/logging-guide/syslog/syslog-vs-journald.html

---

## 7. 원격 로깅

운영 환경에서는 여러 서버의 로그를
중앙 서버로 전송하여 관리한다.

### rsyslog 원격 전송 (클라이언트)

```bash
# UDP 전송
*.* @log-server:514

# TCP 전송 (권장)
*.* @@log-server:514

# RELP 전송 (신뢰성 보장)
module(load="omrelp")
*.* :omrelp:log-server:2514

# 전송 실패 대비 큐 설정
*.* action(
  type="omfwd"
  target="log-server"
  port="514"
  protocol="tcp"
  queue.type="LinkedList"
  queue.filename="fwd_queue"
  queue.maxDiskSpace="1g"
  queue.saveOnShutdown="on"
  action.resumeRetryCount="-1"
)
```

### rsyslog 원격 수신 (서버)

```bash
# TCP 수신 활성화
module(load="imtcp")
input(type="imtcp" port="514")

# 호스트별 파일 분리
template(name="PerHost" type="string"
  string="/var/log/remote/%HOSTNAME%/%PROGRAMNAME%.log"
)
*.* ?PerHost
```

### systemd-journal-remote

journald 네이티브 원격 로깅 솔루션이다.
HTTPS 기반으로 포트 19532를 사용한다.

```bash
# --- 수신 서버 ---
sudo apt install systemd-journal-remote
sudo systemctl enable --now \
  systemd-journal-remote.socket

# /etc/systemd/journal-remote.conf
[Remote]
SplitMode=host

# --- 전송 클라이언트 ---
sudo apt install systemd-journal-remote
# /etc/systemd/journal-upload.conf
[Upload]
URL=https://log-server:19532

sudo systemctl enable --now \
  systemd-journal-upload.service
```

### 로그 집계 시스템 연동

| 시스템 | 연동 방식 |
|--------|----------|
| ELK Stack | rsyslog omelasticsearch 모듈 |
| Grafana Loki | promtail journald 입력 |
| Fluent Bit | systemd input 플러그인 |
| Datadog Agent | journald 로그 수집기 |

로그 집계 시스템의 상세 구성은
[Observability 카테고리](/observability/)에서 다룬다.

> 참고:
> [systemd-journal-remote 매뉴얼][jr-man]

[jr-man]: https://www.freedesktop.org/software/systemd/man/latest/systemd-journal-remote.service.html

---

## 8. 구조화된 로깅

journald는 키-값 형태의 구조화된 로깅을
네이티브로 지원한다. 이를 통해
정교한 필터링과 분석이 가능하다.

### 자동 수집 필드

journald는 로그 메시지마다 아래 메타데이터를
자동으로 첨부한다.

| 필드 | 설명 |
|------|------|
| `_PID` | 프로세스 ID |
| `_UID` | 사용자 ID |
| `_GID` | 그룹 ID |
| `_COMM` | 실행 파일명 |
| `_EXE` | 실행 파일 경로 |
| `_SYSTEMD_UNIT` | systemd 유닛명 |
| `_HOSTNAME` | 호스트명 |
| `_BOOT_ID` | 부트 ID |

### logger 명령어로 구조화 로그 전송

```bash
# 기본 syslog 메시지
logger "배포 완료"

# 구조화된 journald 메시지
logger --journald <<EOF
MESSAGE=디플로이 완료
DEPLOY_VERSION=v2.1.0
ENVIRONMENT=production
PRIORITY=5
EOF
```

### systemd-cat으로 파이프라인 연결

```bash
# 명령어 출력을 journal로 전송
echo "백업 시작" | systemd-cat -t backup-script

# 스크립트 실행 결과를 journal로
systemd-cat -t my-cron-job /opt/scripts/backup.sh
```

### C API (sd_journal_send)

```c
#include <systemd/sd-journal.h>

sd_journal_send(
  "MESSAGE=요청 처리 완료",
  "REQUEST_ID=abc-123",
  "DURATION_MS=42",
  "PRIORITY=6",
  NULL
);
```

### 구조화 필드로 검색

```bash
# 사용자 정의 필드로 필터
journalctl DEPLOY_VERSION=v2.1.0

# 복수 필드 조합 (AND)
journalctl _SYSTEMD_UNIT=nginx.service \
           PRIORITY=3

# 필드 목록 확인
journalctl -o verbose -n 1
```

구조화된 로깅을 활용하면 grep 기반의
텍스트 검색보다 훨씬 정확하고
빠른 로그 분석이 가능하다.

> 참고:
> [sd_journal_send 매뉴얼][sd-send]

[sd-send]: https://www.freedesktop.org/software/systemd/man/latest/sd_journal_send.html
