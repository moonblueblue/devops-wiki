---
title: "리눅스 로그 로테이션 완벽 가이드"
date: 2026-04-13
tags:
  - linux
  - logrotate
  - journald
  - docker
  - kubernetes
  - devops
  - logging
sidebar_label: "로그 로테이션"
---
format: md

# 리눅스 로그 로테이션 완벽 가이드

## 1. 로그 로테이션 개요

로그 로테이션은 로그 파일을 주기적으로 순환하여
디스크 공간을 확보하고 로그 관리를 자동화하는 기법이다.
설정하지 않으면 로그가 무한히 증가하여 장애를 유발한다.

리눅스에서 로그 로테이션을 담당하는
주요 도구는 다음과 같다.

| 도구 | 대상 | 설정 위치 |
|------|------|-----------|
| logrotate | 파일 기반 로그 | `/etc/logrotate.conf` |
| journald | systemd 저널 | `/etc/systemd/journald.conf` |
| Docker | 컨테이너 로그 | `/etc/docker/daemon.json` |
| kubelet | K8s 컨테이너 로그 | kubelet config |

> 참고:
> [logrotate(8) man page](https://man7.org/linux/man-pages/man8/logrotate.8.html)
> | [ArchWiki - Logrotate](https://wiki.archlinux.org/title/Logrotate)

---

## 2. logrotate 설정

### 설정 파일 구조

logrotate는 두 계층의 설정 파일을 사용한다.

- `/etc/logrotate.conf` : 전역 기본값 정의
- `/etc/logrotate.d/` : 애플리케이션별 개별 설정

```bash title="/etc/logrotate.conf"
# /etc/logrotate.conf 기본 구조
weekly
rotate 4
create
compress
include /etc/logrotate.d
```

### 실행 방식

최신 배포판은 systemd timer로 logrotate를 실행한다.
구형 시스템은 `/etc/cron.daily/logrotate`를 사용한다.

```bash
# systemd timer 상태 확인
systemctl status logrotate.timer
systemctl list-timers | grep logrotate

# 수동 실행 (cron 방식)
cat /etc/cron.daily/logrotate
```

### 주요 디렉티브 표

#### 순환 주기

| 디렉티브 | 설명 | 예시 |
|----------|------|------|
| `daily` | 매일 순환 | - |
| `weekly` | 매주 순환 | `weekly 0` (일요일) |
| `monthly` | 매월 순환 | `monthly 1` (1일) |
| `yearly` | 매년 순환 | - |
| `size` | 크기 초과 시 순환 | `size 100M` |
| `minsize` | 주기+크기 모두 충족 | `minsize 50M` |
| `maxsize` | 크기만으로 즉시 순환 | `maxsize 500M` |

#### 파일 관리

| 디렉티브 | 설명 |
|----------|------|
| `rotate <N>` | 보관할 순환 파일 수 |
| `maxage <days>` | 지정 일수 초과 시 삭제 |
| `compress` | gzip 압축 활성화 |
| `delaycompress` | 다음 주기까지 압축 지연 |
| `missingok` | 파일 없어도 에러 없이 진행 |
| `notifempty` | 빈 파일은 순환 안 함 |
| `create <mode> <owner> <group>` | 순환 후 새 파일 생성 |
| `copytruncate` | 복사 후 원본 truncate |
| `dateext` | YYYYMMDD 날짜 접미사 |
| `olddir <dir>` | 순환 파일 별도 디렉토리 |
| `su <user> <group>` | 지정 사용자로 순환 |

#### 스크립트 실행

| 디렉티브 | 실행 시점 |
|----------|-----------|
| `prerotate/endscript` | 순환 전 실행 |
| `postrotate/endscript` | 순환 후 실행 |
| `sharedscripts` | 여러 파일 매칭 시 1회만 실행 |
| `firstaction/endscript` | 전체 작업 시작 전 1회 |
| `lastaction/endscript` | 전체 작업 완료 후 1회 |

---

## 3. 실전 설정 예제

### nginx 로그

nginx는 `kill -USR1`로 로그 파일 핸들을 갱신한다.
`sharedscripts`로 시그널을 1회만 전송한다.

```bash title="/etc/logrotate.d/nginx"
# /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    create 0640 www-data adm
    postrotate
        [ -f /var/run/nginx.pid ] && \
          kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
```

### 커스텀 애플리케이션

PID 파일이 없거나 시그널을 지원하지 않는 앱은
`copytruncate`로 파일 핸들을 유지한 채 순환한다.

```bash title="/etc/logrotate.d/myapp"
# /etc/logrotate.d/myapp
/var/log/myapp/*.log {
    daily
    rotate 7
    maxsize 100M
    missingok
    notifempty
    compress
    delaycompress
    copytruncate
    su appuser appgroup
    dateext
}
```

### Docker 컨테이너 로그 (logrotate 방식)

Docker 자체 로그 드라이버 외에
logrotate로 직접 관리할 수도 있다.

```bash title="/etc/logrotate.d/docker-containers"
# /etc/logrotate.d/docker-containers
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    notifempty
    delaycompress
    copytruncate
}
```

---

## 4. logrotate 디버깅

### 주요 명령어

| 명령어 | 용도 |
|--------|------|
| `logrotate -d <config>` | dry-run (시뮬레이션) |
| `logrotate -f <config>` | 강제 순환 실행 |
| `logrotate -v <config>` | 상세 출력 |
| `logrotate -d -v <config>` | dry-run + 상세 |

### 디버깅 실전

```bash
# 개별 설정 테스트 (dry-run)
logrotate -d -v /etc/logrotate.d/nginx

# 강제 순환 (테스트용)
logrotate -f /etc/logrotate.d/nginx

# 상태 파일 확인 (마지막 순환 시각)
cat /var/lib/logrotate/status
# 또는
cat /var/lib/logrotate.status
```

### 흔한 문제와 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| 순환 안 됨 | 상태 파일의 날짜 | 상태 파일 해당 행 삭제 |
| permission denied | 로그 디렉토리 권한 | `su` 디렉티브 추가 |
| 빈 로그 생성 안 됨 | create 미설정 | `create 0644 root root` |
| postrotate 실패 | PID 파일 경로 오류 | PID 경로 확인 |

---

## 5. journald 로그 관리

systemd-journald는 바이너리 저널을 관리한다.
logrotate와 별도로 자체 로테이션 메커니즘을 제공한다.

### 설정 파일

```ini title="/etc/systemd/journald.conf"
# /etc/systemd/journald.conf
[Journal]
Storage=persistent
SystemMaxUse=500M
SystemMaxFileSize=50M
SystemKeepFree=1G
MaxRetentionSec=1month
MaxFileSec=1week
```

### 주요 설정 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `Storage` | auto | persistent/volatile/auto/none |
| `SystemMaxUse` | FS의 10% (최대 4G) | 영구 저장소 최대 크기 |
| `SystemKeepFree` | FS의 15% | 확보할 여유 공간 |
| `SystemMaxFileSize` | SystemMaxUse/8 | 개별 저널 파일 최대 크기 |
| `RuntimeMaxUse` | - | 휘발성 저장소 최대 크기 |
| `MaxRetentionSec` | 0 (무제한) | 최대 보관 기간 |
| `MaxFileSec` | 1month | 파일별 최대 보관 기간 |

### 수동 관리 명령

```bash
# 현재 저널 디스크 사용량 확인
journalctl --disk-usage

# 500M 이하로 정리
journalctl --rotate
journalctl --vacuum-size=500M

# 7일 이전 항목 삭제
journalctl --rotate
journalctl --vacuum-time=7d

# 최대 5개 파일만 유지
journalctl --vacuum-files=5

# 설정 변경 후 재시작
sudo systemctl restart systemd-journald
```

`--rotate`를 먼저 실행해야 현재 활성 저널도
vacuum 대상에 포함된다.

> 참고:
> [ArchWiki - systemd/Journal](https://wiki.archlinux.org/title/Systemd/Journal)
> | [DigitalOcean - journalctl](https://www.digitalocean.com/community/tutorials/how-to-use-journalctl-to-view-and-manipulate-systemd-logs)

---

## 6. 컨테이너/쿠버네티스 로그 로테이션

### Docker 로그 드라이버

Docker의 기본 `json-file` 드라이버는
로그 로테이션이 **기본 비활성화**이므로
반드시 설정해야 한다.

#### daemon.json 전역 설정

```json title="/etc/docker/daemon.json"
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

설정 후 Docker 데몬 재시작이 필요하며,
기존 컨테이너에는 적용되지 않는다 (재생성 필요).

#### docker run 개별 설정

```bash
docker run -d \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  nginx:latest
```

#### docker-compose 설정

```yaml
services:
  app:
    image: myapp:latest
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

> **주의**: `log-opts` 값은 반드시 문자열로 지정한다.
> 숫자 값도 따옴표로 감싸야 한다 (`"3"`, `"10m"`).

### Kubernetes kubelet 설정

kubelet이 컨테이너 로그 로테이션을 직접 관리한다.
kubelet 설정 파일에서 다음 파라미터를 조정한다.

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `containerLogMaxSize` | 10Mi | 로그 파일 최대 크기 |
| `containerLogMaxFiles` | 5 | 컨테이너당 최대 파일 수 |
| `containerLogMaxWorkers` | 1 | 동시 순환 워커 수 |
| `containerLogMonitorInterval` | 10s | 로그 모니터링 주기 |

```yaml title="kubelet-config.yaml"
# kubelet-config.yaml
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
containerLogMaxSize: "50Mi"
containerLogMaxFiles: 5
containerLogMaxWorkers: 2
containerLogMonitorInterval: "10s"
```

`kubectl logs`는 가장 최근 로그 파일만 반환한다.
`containerLogMaxSize=10Mi`이면 최대 10Mi만 조회 가능하다.

> **알려진 이슈 (K8s v1.27+)**: 고처리량 컨테이너에서
> timestamp 기반 로테이션이 실패하여 0.log가 무한 증가하는
> 버그가 보고되었다
> ([#134324](https://github.com/kubernetes/kubernetes/issues/134324)).

> 참고:
> [Kubernetes - Logging Architecture](https://kubernetes.io/docs/concepts/cluster-administration/logging/)

---

## 7. 베스트 프랙티스

### 보관 기간 가이드라인

| 로그 유형 | 권장 보관 기간 | 설정 예시 |
|-----------|---------------|-----------|
| 시스템 로그 | 4주 | `weekly`, `rotate 4` |
| 애플리케이션 로그 | 7-14일 | `daily`, `rotate 14` |
| 보안/감사 로그 | 90일 이상 | `daily`, `rotate 90` |
| 컨테이너 로그 | 7일 (로컬) | `max-size: 10m`, `max-file: 3` |

### 디스크 관리

로그 전용 파티션(`/var/log`)을 분리하면
로그 폭주가 루트 파티션에 영향을 주지 않는다.

- 디스크 사용률 80%에서 경고 알림 설정
- `compress` + `delaycompress` 조합으로 공간 절약
- `maxage`로 오래된 로그 자동 삭제

### 컨테이너 환경 체크리스트

Docker `daemon.json`에 `max-size`/`max-file`을 반드시 설정한다.
프로덕션 K8s에서 `containerLogMaxSize`는 50-100Mi를 권장한다.

- 중앙 로그 수집 (EFK/PLG 스택) 병행 필수
- 로컬 보관 1-7일, 중앙 저장소 30-90일
- journald와 logrotate 중복 관리 여부 확인

### 권장 설정 템플릿

```bash title="/etc/logrotate.d/app-template"
# /etc/logrotate.d/app-template
/var/log/APP/*.log {
    daily
    rotate 14
    maxsize 200M
    missingok
    notifempty
    compress
    delaycompress
    dateext
    create 0640 APP_USER APP_GROUP
    sharedscripts
    postrotate
        # 앱에 맞는 시그널 또는 reload 명령
        systemctl reload APP_SERVICE 2>/dev/null || true
    endscript
}
```

> 참고:
> [Red Hat - Setting up logrotate](https://www.redhat.com/en/blog/setting-logrotate)
> | [Better Stack - Log Files with Logrotate](https://betterstack.com/community/guides/logging/how-to-manage-log-files-with-logrotate-on-ubuntu-20-04/)
