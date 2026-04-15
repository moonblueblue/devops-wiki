---
title: "실무 자동화 스크립트 예제 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - bash
  - automation
  - devops
  - monitoring
  - backup
sidebar_label: "자동화 스크립트"
---

# 실무 자동화 스크립트 예제

DevOps 환경에서 반복적으로 사용하는 자동화 스크립트를
주제별로 정리했다.
모든 예제는 프로덕션 환경에서 바로 활용할 수 있다.

---

## 1. 스크립트 작성 원칙

### 1.1 기본 템플릿

모든 자동화 스크립트는 아래 템플릿으로 시작한다.
strict mode, 로깅, 에러 처리를 기본으로 포함하며
일관된 구조를 유지하는 것이 핵심이다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly SCRIPT_NAME=$(basename "$0")
readonly LOG_FILE="/var/log/${SCRIPT_NAME%.sh}.log"
readonly LOCK_FILE="/tmp/${SCRIPT_NAME%.sh}.lock"

log() {
    local level="$1"; shift
    printf "[%s] [%s] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" \
        "$level" "$*" | tee -a "$LOG_FILE"
}

cleanup() {
    rm -f "$LOCK_FILE"
    log INFO "스크립트 종료"
}
trap cleanup EXIT
```

### 1.2 strict mode 옵션

| 옵션 | 설명 |
|------|------|
| `-e` | 명령 실패 시 즉시 종료 |
| `-u` | 미정의 변수 참조 시 에러 |
| `-o pipefail` | 파이프라인 중간 명령 실패 감지 |

`set -euo pipefail`은 모든 스크립트에
반드시 포함해야 하는 안전장치다.
파이프라인 에러를 놓치는 실수를 방지한다.

### 1.3 Lock 파일 (flock)

동시 실행을 방지하려면 `flock`을 사용한다.
cron 스케줄이 겹칠 때 중복 실행 문제를 막으며
스크립트 종료 시 락이 자동으로 해제된다.

```bash
exec 200>"$LOCK_FILE"
flock -n 200 || {
    log WARN "이미 실행 중. 종료합니다."
    exit 1
}
```

| flock 옵션 | 설명 |
|------------|------|
| `-n` | 논블로킹 (즉시 실패) |
| `-w 10` | 최대 10초 대기 후 실패 |
| `-s` | 공유 락 (읽기 전용) |
| `-x` | 배타 락 (기본값) |

> 참고:
> [flock(1) man page](https://linux.die.net/man/1/flock)

### 1.4 멱등성 (Idempotency)

스크립트를 여러 번 실행해도 결과가 동일해야 한다.
디렉토리 생성엔 `mkdir -p`,
파일 작업엔 존재 여부를 먼저 확인한다.

```bash
# 멱등한 디렉토리 생성
mkdir -p /backup/daily

# 이미 처리된 파일 건너뛰기
if [[ -f "/backup/done_${TODAY}" ]]; then
    log INFO "이미 처리됨. 건너뜁니다."
    exit 0
fi
```

### 1.5 Dry-run 모드와 인자 파싱

실제 실행 전에 어떤 작업을 할지 확인하는
dry-run 모드를 제공하면 실수를 방지할 수 있다.
`getopts`로 명령행 인자를 파싱한다.

```bash
DRY_RUN=false
THRESHOLD=80

usage() {
    cat <<EOF
Usage: $0 [-d] [-t threshold] [-h]
  -d  dry-run 모드 (실제 실행 안 함)
  -t  임계값 (기본값: 80)
  -h  도움말 출력
EOF
}

while getopts "dt:h" opt; do
    case $opt in
        d) DRY_RUN=true ;;
        t) THRESHOLD="$OPTARG" ;;
        h) usage; exit 0 ;;
        *) usage; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

run_cmd() {
    if $DRY_RUN; then
        log INFO "[DRY-RUN] $*"
    else
        "$@"
    fi
}
```

---

## 2. 서버 상태 점검 스크립트

CPU, 메모리, 디스크, 네트워크를 한 번에 점검하는
종합 헬스체크 스크립트다.
cron으로 주기 실행하면 서버 이상을 빠르게 감지한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly REPORT_FILE="/tmp/health_$(date +%Y%m%d).txt"

check_cpu() {
    local usage
    # LC_ALL=C: 로케일에 따른 필드 순서 변화 방지
    usage=$(LC_ALL=C top -bn1 \
        | awk '/Cpu\(s\)/ {printf "%.1f", 100-$8}')
    echo "CPU 사용률: ${usage}%"
    if (( $(echo "$usage > 90" | bc -l) )); then
        echo "  [경고] CPU 사용률 높음"
    fi
}

check_memory() {
    local usage
    usage=$(free | awk '/Mem:/ {
        printf "%.1f", $3/$2*100
    }')
    echo "메모리 사용률: ${usage}%"
    if (( $(echo "$usage > 85" | bc -l) )); then
        echo "  [경고] 메모리 사용률 높음"
    fi
}

check_disk() {
    echo "디스크 사용률:"
    df -Ph | awk 'NR>1 {
        usage=$5+0
        status="OK"
        if (usage > 90) status="[위험]"
        else if (usage > 80) status="[경고]"
        printf "  %-20s %s %s\n", $6, $5, status
    }'
}

check_zombie() {
    local count
    count=$(ps aux \
        | awk '$8 ~ /^Z/ {c++} END {print c+0}')
    echo "좀비 프로세스: ${count}개"
    if (( count > 0 )); then
        echo "  [경고] 좀비 프로세스 존재"
    fi
}

check_uptime() {
    echo "가동 시간: $(uptime -p)"
    echo "로드 평균: $(uptime \
        | awk -F'load average:' '{print $2}')"
}

main() {
    {
        echo "===== 서버 상태 보고서 ====="
        echo "호스트: $(hostname)"
        echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
        echo ""
        check_uptime
        echo ""
        check_cpu
        echo ""
        check_memory
        echo ""
        check_disk
        echo ""
        check_zombie
        echo ""
        echo "============================="
    } | tee "$REPORT_FILE"
}

main "$@"
```

### 주요 점검 항목 요약

| 항목 | 명령어 | 경고 기준 |
|------|--------|-----------|
| CPU | `top -bn1` | > 90% |
| 메모리 | `free` | > 85% |
| 디스크 | `df -Ph` | > 80% |
| 좀비 프로세스 | `ps aux` | > 0개 |
| 로드 평균 | `uptime` | > CPU 코어 수 |

cron 등록 예시:

```bash
# 매시간 헬스체크 실행
0 * * * * /opt/scripts/health_check.sh
```

> 참고:
> [TecMint - Bash Script to Monitor Linux Health](https://www.tecmint.com/bash-script-automate-system-health-checks/)

---

## 3. 디스크 공간 모니터링

디스크 용량과 inode를 함께 점검하는 스크립트다.
임계값 초과 시 Slack 또는 이메일로 알림을 보내며
cron과 함께 사용하면 자동 모니터링이 가능하다.

```bash
#!/usr/bin/env bash
set -euo pipefail

WARN_THRESHOLD=80
CRIT_THRESHOLD=90
ALERT_METHOD="slack"  # slack | email

check_disk_space() {
    local alerts=""
    while IFS= read -r line; do
        local mount usage
        mount=$(echo "$line" | awk '{print $6}')
        usage=$(echo "$line" | awk '{print $5}' \
            | tr -d '%')
        if (( usage >= CRIT_THRESHOLD )); then
            alerts+="[위험] ${mount}: ${usage}%\n"
        elif (( usage >= WARN_THRESHOLD )); then
            alerts+="[경고] ${mount}: ${usage}%\n"
        fi
    done < <(df -Ph | tail -n +2)
    echo -e "$alerts"
}

check_inode_usage() {
    local alerts=""
    while IFS= read -r line; do
        local mount usage
        mount=$(echo "$line" | awk '{print $6}')
        usage=$(echo "$line" | awk '{print $5}' \
            | tr -d '%')
        if (( usage >= CRIT_THRESHOLD )); then
            alerts+="[위험] inode ${mount}: "
            alerts+="${usage}%\n"
        fi
    done < <(df -Pi | tail -n +2)
    echo -e "$alerts"
}

main() {
    local disk_alerts inode_alerts all_alerts
    disk_alerts=$(check_disk_space)
    inode_alerts=$(check_inode_usage)
    all_alerts="${disk_alerts}${inode_alerts}"

    if [[ -n "$all_alerts" ]]; then
        local hostname
        hostname=$(hostname)
        local msg="[${hostname}] 디스크 알림\n"
        msg+="${all_alerts}"
        send_alert "$msg"
    fi
}

main "$@"
```

### 임계값 권장 기준

| 수준 | 디스크 사용률 | inode 사용률 | 조치 |
|------|-------------|-------------|------|
| 정상 | < 80% | < 80% | - |
| 경고 | 80-89% | 80-89% | 정리 계획 수립 |
| 위험 | >= 90% | >= 90% | 즉시 조치 필요 |

> 참고:
> [TecMint - Monitor Linux Disk Usage](https://www.tecmint.com/monitor-disk-usage-bash-script/)

---

## 4. 로그 정리 스크립트

오래된 로그를 압축하고 삭제하는 스크립트다.
logrotate와 병행하거나 커스텀 로그 경로에 사용한다.
안전한 truncate도 함께 다룬다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly LOG_DIRS=(
    "/var/log/app"
    "/var/log/nginx"
    "/opt/app/logs"
)
readonly COMPRESS_DAYS=7
readonly DELETE_DAYS=30
readonly DRY_RUN="${1:-false}"

log() {
    printf "[%s] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

compress_old_logs() {
    local dir="$1"
    local count
    count=$(find "$dir" -name "*.log" \
        -mtime +"$COMPRESS_DAYS" \
        -not -name "*.gz" | wc -l)
    log "${dir}: 압축 대상 ${count}개"

    if [[ "$DRY_RUN" != "true" ]]; then
        find "$dir" -name "*.log" \
            -mtime +"$COMPRESS_DAYS" \
            -not -name "*.gz" \
            -exec gzip -9 {} \;
    fi
}

delete_old_logs() {
    local dir="$1"
    local count
    count=$(find "$dir" -name "*.log.gz" \
        -mtime +"$DELETE_DAYS" | wc -l)
    log "${dir}: 삭제 대상 ${count}개"

    if [[ "$DRY_RUN" != "true" ]]; then
        find "$dir" -name "*.log.gz" \
            -mtime +"$DELETE_DAYS" -delete
    fi
}

main() {
    log "로그 정리 시작 (dry-run: ${DRY_RUN})"
    for dir in "${LOG_DIRS[@]}"; do
        if [[ -d "$dir" ]]; then
            compress_old_logs "$dir"
            delete_old_logs "$dir"
        else
            log "경고: ${dir} 디렉토리 없음"
        fi
    done
    log "로그 정리 완료"
}

main "$@"
```

### logrotate 설정 예시

커스텀 앱 로그에도 logrotate를 적용할 수 있다.
`/etc/logrotate.d/` 아래에 설정 파일을 생성하면
시스템이 자동으로 로테이션을 수행한다.

```text
/var/log/app/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    postrotate
        systemctl reload app > /dev/null 2>&1 \
            || true
    endscript
}
```

| 옵션 | 설명 |
|------|------|
| `daily` | 매일 로테이션 |
| `rotate 14` | 14개 파일 보관 |
| `compress` | gzip 압축 |
| `delaycompress` | 직전 파일은 압축 지연 |
| `missingok` | 파일 없어도 에러 안 남 |
| `notifempty` | 빈 파일은 로테이션 안 함 |

### 안전한 로그 truncate

실행 중인 프로세스의 로그를 비우려면
`truncate`를 사용한다.
inode가 유지되어 프로세스가 중단되지 않는다.

```bash
# 권장: inode 유지
truncate -s 0 /var/log/app/current.log

# 동일한 효과
: > /var/log/app/current.log

# 비권장: 새 inode 생성 (프로세스가 기존 fd 유지)
# cp /dev/null /var/log/app/current.log
```

> 참고:
> [LinuxBash - Safely truncate a log file](https://www.linuxbash.sh/post/safely-truncate-a-log-file-without-disrupting-the-writing-process)

---

## 5. 백업 스크립트 (DB + 파일)

DB 덤프와 파일 백업을 수행하고
오래된 백업을 자동으로 정리하는 스크립트다.
백업 무결성 검증까지 포함한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly BACKUP_DIR="/backup"
readonly DATE=$(date +%Y%m%d_%H%M%S)
readonly DB_RETENTION_DAYS=7
readonly FILE_RETENTION_DAYS=30

# 설정 파일에서 민감 정보 로드
source /etc/backup/backup.conf
# backup.conf 예시:
# DB_HOST="localhost"
# DB_USER="backup_user"
# DB_PASS="secure_password"
# DB_NAME="myapp"

log() {
    printf "[%s] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$*" \
        | tee -a "${BACKUP_DIR}/backup.log"
}

backup_mysql() {
    local dest="${BACKUP_DIR}/db/mysql_${DATE}.sql.gz"
    mkdir -p "${BACKUP_DIR}/db"
    log "MySQL 백업 시작: ${DB_NAME}"

    # -p"$DB_PASS" 방식은 ps aux에 비밀번호 노출 위험
    # 프로덕션에서는 ~/.my.cnf 또는 --defaults-extra-file 사용 권장
    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        -p"$DB_PASS" \
        --single-transaction \
        --routines \
        --triggers \
        "$DB_NAME" | gzip > "$dest"

    # 무결성 검증
    if gzip -t "$dest" 2>/dev/null; then
        local size
        size=$(du -h "$dest" | cut -f1)
        log "MySQL 백업 완료: ${dest} (${size})"
    else
        log "오류: 백업 파일 손상 - ${dest}"
        return 1
    fi
}

backup_postgresql() {
    local dest
    dest="${BACKUP_DIR}/db/pg_${DB_NAME}_${DATE}.dump"
    mkdir -p "${BACKUP_DIR}/db"
    log "PostgreSQL 백업 시작: ${DB_NAME}"

    # -Fc는 자체 압축 포함 → gzip 이중 압축 불필요
    # 파일 확장자는 .dump 관례에 맞게 변경 권장
    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -U "$DB_USER" \
        -Fc "$DB_NAME" > "$dest"

    if [[ -s "$dest" ]]; then
        local size
        size=$(du -h "$dest" | cut -f1)
        log "PostgreSQL 백업 완료: ${dest} (${size})"
    else
        log "오류: 백업 파일 손상 - ${dest}"
        return 1
    fi
}

backup_files() {
    local src="$1"
    local name="$2"
    local dest="${BACKUP_DIR}/files/"
    dest+="${name}_${DATE}.tar.gz"
    mkdir -p "${BACKUP_DIR}/files"
    log "파일 백업 시작: ${src}"

    tar czf "$dest" -C "$(dirname "$src")" \
        "$(basename "$src")"

    local size
    size=$(du -h "$dest" | cut -f1)
    log "파일 백업 완료: ${dest} (${size})"
}

rotate_backups() {
    log "오래된 백업 정리 시작"

    local db_deleted file_deleted
    db_deleted=$(find "${BACKUP_DIR}/db" \
        -name "*.sql.gz" \
        -mtime +"$DB_RETENTION_DAYS" | wc -l)
    find "${BACKUP_DIR}/db" -name "*.sql.gz" \
        -mtime +"$DB_RETENTION_DAYS" -delete

    file_deleted=$(find "${BACKUP_DIR}/files" \
        -name "*.tar.gz" \
        -mtime +"$FILE_RETENTION_DAYS" | wc -l)
    find "${BACKUP_DIR}/files" -name "*.tar.gz" \
        -mtime +"$FILE_RETENTION_DAYS" -delete

    log "정리 완료: DB ${db_deleted}개, "
    log "파일 ${file_deleted}개 삭제"
}

main() {
    log "====== 백업 시작 ======"

    # 락 획득
    exec 200>"/tmp/backup.lock"
    flock -n 200 || {
        log "이미 백업 실행 중"; exit 1
    }

    backup_mysql
    backup_files "/var/www/html" "webapp"
    backup_files "/etc/nginx" "nginx-conf"
    rotate_backups

    log "====== 백업 완료 ======"
}

main "$@"
```

### 백업 전략 요약

| 항목 | 도구 | 보관 기간 | 주기 |
|------|------|----------|------|
| MySQL | `mysqldump` | 7일 | 매일 |
| PostgreSQL | `pg_dump` | 7일 | 매일 |
| 웹 파일 | `tar` | 30일 | 매일 |
| 설정 파일 | `tar` | 30일 | 매주 |

### rsync 증분 백업

전체 백업 대신 변경분만 동기화하려면
rsync를 사용한다.
`--delete` 옵션은 원본에서 삭제된 파일도 반영한다.

```bash
rsync -avz --delete \
    /var/www/html/ \
    /backup/html_mirror/
```


> 참고:
> [DEV Community - Automating Backups with Rsync](https://dev.to/sourav3366/automate-your-backups-with-a-bash-script-17jl)

---

## 6. SSL 인증서 만료 모니터링

`openssl`로 인증서 만료일을 점검하는 스크립트다.
Let's Encrypt가 2025년 6월부터 만료 알림 이메일을
중단하여 자체 모니터링의 중요성이 높아졌다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly DOMAINS=(
    "example.com"
    "api.example.com"
    "cdn.example.com"
)
readonly WARNING_DAYS=30
readonly CRITICAL_DAYS=7

check_ssl_expiry() {
    local domain="$1"
    local expiry_date days_left

    expiry_date=$(echo \
        | openssl s_client \
            -servername "$domain" \
            -connect "${domain}:443" \
            2>/dev/null \
        | openssl x509 -noout -enddate \
        | cut -d= -f2)

    if [[ -z "$expiry_date" ]]; then
        echo "-1"
        return
    fi

    local expiry_epoch current_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s \
        2>/dev/null || \
        date -jf "%b %d %T %Y %Z" \
            "$expiry_date" +%s 2>/dev/null)
    current_epoch=$(date +%s)
    days_left=$(( (expiry_epoch - current_epoch) \
        / 86400 ))
    echo "$days_left"
}

main() {
    local has_alert=false

    printf "%-30s %-10s %-8s\n" \
        "도메인" "남은일수" "상태"
    printf "%s\n" \
        "$(printf '%.0s-' {1..50})"

    for domain in "${DOMAINS[@]}"; do
        local days status color
        days=$(check_ssl_expiry "$domain")

        if (( days < 0 )); then
            status="연결실패"
            has_alert=true
        elif (( days <= CRITICAL_DAYS )); then
            status="위험"
            has_alert=true
        elif (( days <= WARNING_DAYS )); then
            status="경고"
            has_alert=true
        else
            status="정상"
        fi

        printf "%-30s %-10s %-8s\n" \
            "$domain" "${days}일" "$status"
    done

    if $has_alert; then
        send_alert "SSL 인증서 만료 임박 확인 필요"
    fi
}

main "$@"
```

### 만료 기준 및 조치

| 남은 일수 | 수준 | 조치 |
|-----------|------|------|
| > 30일 | 정상 | 모니터링 유지 |
| 8-30일 | 경고 | 갱신 계획 수립 |
| <= 7일 | 위험 | 즉시 갱신 |
| 만료됨 | 장애 | 긴급 대응 |

### certbot 자동 갱신 확인

```bash
# certbot 타이머 상태 확인
systemctl status certbot.timer

# 수동 갱신 테스트
certbot renew --dry-run
```

> 참고:
> [HeyOnCall - Check SSL Certificate Expiration](https://heyoncall.com/blog/barebone-scripts-to-check-ssl-certificate-expiration)

---

## 7. 서비스 모니터링 및 자동 재시작

systemd 서비스 상태를 점검하고
장애 시 자동 재시작하는 스크립트다.
HTTP 헬스체크까지 포함하여 실질적인 가용성을 확인한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly SERVICES=("nginx" "mysql" "redis-server")
readonly HEALTH_ENDPOINTS=(
    "http://localhost:80/health"
    "http://localhost:8080/api/health"
)
readonly MAX_RESTART_ATTEMPTS=3
readonly LOG_FILE="/var/log/service_monitor.log"

log() {
    printf "[%s] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$*" \
        | tee -a "$LOG_FILE"
}

check_service() {
    local service="$1"
    if systemctl is-active --quiet "$service"; then
        return 0
    fi
    return 1
}

restart_service() {
    local service="$1"
    local attempt=0

    while (( attempt < MAX_RESTART_ATTEMPTS )); do
        (( attempt++ ))
        log "경고: ${service} 재시작 시도 "
        log "(${attempt}/${MAX_RESTART_ATTEMPTS})"
        systemctl restart "$service"
        sleep 3

        if check_service "$service"; then
            log "성공: ${service} 재시작 완료"
            return 0
        fi
    done

    log "실패: ${service} 재시작 ${attempt}회 실패"
    return 1
}

check_http_health() {
    local url="$1"
    local status_code
    status_code=$(curl -s -o /dev/null \
        -w "%{http_code}" \
        --connect-timeout 5 \
        --max-time 10 \
        "$url" 2>/dev/null || echo "000")

    if [[ "$status_code" == "200" ]]; then
        return 0
    fi
    log "경고: HTTP 헬스체크 실패 ${url} "
    log "(status: ${status_code})"
    return 1
}

main() {
    local alerts=""

    # systemd 서비스 점검
    for service in "${SERVICES[@]}"; do
        if ! check_service "$service"; then
            log "감지: ${service} 중단됨"
            if ! restart_service "$service"; then
                alerts+="${service} 재시작 실패\n"
            fi
        fi
    done

    # HTTP 헬스체크
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        if ! check_http_health "$endpoint"; then
            alerts+="헬스체크 실패: ${endpoint}\n"
        fi
    done

    # 알림 발송
    if [[ -n "$alerts" ]]; then
        send_alert "서비스 이상 감지:\n${alerts}"
    fi
}

main "$@"
```

### systemd 자체 복구 설정

스크립트 없이 systemd만으로도
서비스 자동 재시작을 구성할 수 있다.
`Restart=on-failure`가 가장 일반적인 설정이다.

```ini title="/etc/systemd/system/myapp.service"
[Unit]
Description=My Application
After=network.target

[Service]
Type=simple
ExecStart=/opt/app/bin/server
Restart=on-failure
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
```

| Restart 옵션 | 설명 |
|--------------|------|
| `no` | 재시작 안 함 (기본값) |
| `on-failure` | 비정상 종료 시 재시작 |
| `on-abnormal` | 시그널/타임아웃 시 재시작 |
| `always` | 항상 재시작 |

> 참고:
> [Red Hat - Self-healing services with systemd](https://www.redhat.com/en/blog/systemd-automate-recovery)

---

## 8. 배포 스크립트 (롤백 포함)

심볼릭 링크 방식으로 무중단 배포를 구현한다.
실패 시 즉시 이전 버전으로 롤백할 수 있으며
오래된 릴리스를 자동으로 정리한다.

```bash
#!/usr/bin/env bash
set -euo pipefail

readonly APP_NAME="myapp"
readonly REPO_URL="git@github.com:org/myapp.git"
readonly DEPLOY_BASE="/opt/deploy"
readonly RELEASES_DIR="${DEPLOY_BASE}/releases"
readonly CURRENT_LINK="${DEPLOY_BASE}/current"
readonly SHARED_DIR="${DEPLOY_BASE}/shared"
readonly KEEP_RELEASES=5
readonly LOG_FILE="/var/log/deploy.log"

log() {
    printf "[%s] [deploy] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$*" \
        | tee -a "$LOG_FILE"
}

PREV_RELEASE=""

rollback_on_failure() {
    log "오류: 배포 실패, 롤백 시작"
    if [[ -n "$PREV_RELEASE" ]]; then
        ln -sfn "$PREV_RELEASE" "$CURRENT_LINK"
        systemctl restart "$APP_NAME"
        log "롤백 완료: ${PREV_RELEASE}"
    fi
    send_alert "배포 실패 - 롤백 수행됨"
}
trap rollback_on_failure ERR

prepare() {
    mkdir -p "$RELEASES_DIR" "$SHARED_DIR/log"
    if [[ -L "$CURRENT_LINK" ]]; then
        PREV_RELEASE=$(readlink -f "$CURRENT_LINK")
    fi
}

build_release() {
    local release_dir="$1"
    log "코드 클론 시작"
    git clone --depth 1 "$REPO_URL" "$release_dir"

    cd "$release_dir"
    log "의존성 설치"
    if [[ -f "package.json" ]]; then
        npm ci --omit=dev  # npm v9+: --production → --omit=dev
    elif [[ -f "requirements.txt" ]]; then
        pip install -r requirements.txt
    fi

    log "빌드 실행"
    if [[ -f "Makefile" ]]; then
        make build
    fi

    # 공유 디렉토리 심볼릭 링크
    ln -sfn "${SHARED_DIR}/log" \
        "${release_dir}/log"
}

switch_release() {
    local release_dir="$1"
    log "릴리스 전환: ${release_dir}"
    ln -sfn "$release_dir" "$CURRENT_LINK"
}

health_check() {
    log "헬스체크 대기 (10초)"
    sleep 10

    local status_code
    status_code=$(curl -s -o /dev/null \
        -w "%{http_code}" \
        --max-time 10 \
        "http://localhost:8080/health" \
        || echo "000")

    if [[ "$status_code" != "200" ]]; then
        log "헬스체크 실패 (HTTP ${status_code})"
        return 1
    fi
    log "헬스체크 성공"
}

cleanup_old_releases() {
    local count
    count=$(ls -1 "$RELEASES_DIR" | wc -l)
    if (( count > KEEP_RELEASES )); then
        ls -1t "$RELEASES_DIR" \
            | tail -n +$((KEEP_RELEASES + 1)) \
            | while read -r dir; do
                rm -rf "${RELEASES_DIR}/${dir}"
                log "이전 릴리스 삭제: ${dir}"
            done
    fi
}

deploy() {
    local release_dir
    release_dir="${RELEASES_DIR}/$(date +%Y%m%d_%H%M%S)"

    prepare
    build_release "$release_dir"
    switch_release "$release_dir"
    systemctl restart "$APP_NAME"
    health_check
    cleanup_old_releases

    log "배포 성공 완료"
    send_alert "배포 성공: ${APP_NAME}"
}

manual_rollback() {
    local target="${1:-}"
    if [[ -z "$target" ]]; then
        target=$(ls -1t "$RELEASES_DIR" \
            | sed -n '2p')
    fi

    if [[ -z "$target" ]]; then
        log "롤백 대상 없음"
        exit 1
    fi

    local target_path="${RELEASES_DIR}/${target}"
    if [[ ! -d "$target_path" ]]; then
        log "릴리스 없음: ${target_path}"
        exit 1
    fi

    ln -sfn "$target_path" "$CURRENT_LINK"
    systemctl restart "$APP_NAME"
    log "수동 롤백 완료: ${target}"
}

case "${1:-deploy}" in
    deploy)   deploy ;;
    rollback) manual_rollback "${2:-}" ;;
    *)        echo "Usage: $0 {deploy|rollback}" ;;
esac
```

### 배포 디렉토리 구조

```text
/opt/deploy/
├── current -> releases/20260413_120000
├── releases/
│   ├── 20260413_120000/
│   ├── 20260412_150000/
│   └── 20260411_090000/
└── shared/
    └── log/
```

### 롤백 명령

```bash
# 자동 롤백 (직전 릴리스)
./deploy.sh rollback

# 특정 릴리스로 롤백
./deploy.sh rollback 20260412_150000
```

> 참고:
> [BarisKode - Bash Trap and Rollback Patterns](https://blog.bariskode.com/blog/bash-trap-and-rollback-patterns-safe-linux-deployments/)

---

## 9. Slack/이메일 알림 연동

앞서 다룬 모든 스크립트에서 사용할 수 있는
공통 알림 함수를 정리한다.
설정 파일을 분리하여 webhook URL을 안전하게 관리한다.

### 설정 파일

```bash title="/etc/scripts/notify.conf"
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
SLACK_CHANNEL="#ops-alerts"
ALERT_EMAIL="ops-team@example.com"
HOSTNAME=$(hostname)
```

### Slack 알림 함수

```bash title="/opt/scripts/lib/notify.sh"
#!/usr/bin/env bash

source /etc/scripts/notify.conf

send_slack() {
    local message="$1"
    local level="${2:-info}"
    local color

    case "$level" in
        info)     color="#36a64f" ;;
        warning)  color="#ff9900" ;;
        error)    color="#ff0000" ;;
        *)        color="#439FE0" ;;
    esac

    # attachments는 레거시 API — Slack Block Kit 마이그레이션 권장
    # https://api.slack.com/messaging/attachments-to-blocks
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{
            \"channel\": \"${SLACK_CHANNEL}\",
            \"attachments\": [{
                \"color\": \"${color}\",
                \"title\": \"[${HOSTNAME}] ${level^^}\",
                \"text\": \"${message}\",
                \"ts\": $(date +%s)
            }]
        }" > /dev/null 2>&1
}
```

### 이메일 알림 함수

```bash
send_email() {
    local subject="$1"
    local body="$2"
    local to="${3:-$ALERT_EMAIL}"

    echo -e "$body" \
        | mailx -s "[${HOSTNAME}] ${subject}" "$to"
}
```

### 통합 알림 함수

```bash
send_alert() {
    local message="$1"
    local level="${2:-warning}"

    # Slack 알림
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        send_slack "$message" "$level"
    fi

    # 이메일 알림 (error 이상)
    if [[ "$level" == "error" ]] && \
       [[ -n "${ALERT_EMAIL:-}" ]]; then
        send_email "Alert: ${level}" "$message"
    fi
}
```

### 스크립트에서 사용

```bash
#!/usr/bin/env bash
set -euo pipefail

# 알림 라이브러리 로드
source /opt/scripts/lib/notify.sh

# 사용 예시
send_alert "디스크 사용률 92%" "warning"
send_alert "서비스 nginx 중단" "error"
send_alert "백업 완료 (2.3GB)" "info"
```

### Slack Webhook 설정 방법

| 단계 | 설명 |
|------|------|
| 1 | Slack App 생성 (api.slack.com/apps) |
| 2 | Incoming Webhooks 기능 활성화 |
| 3 | 채널 선택 후 Webhook URL 생성 |
| 4 | URL을 설정 파일에 저장 |

### 알림 레벨 기준

| 레벨 | 색상 | 용도 |
|------|------|------|
| info | 녹색 | 작업 완료 통보 |
| warning | 주황 | 임계값 초과 경고 |
| error | 빨강 | 장애 발생 긴급 알림 |

> 참고:
> [LinuxHandbook - Send Slack Notifications from Shell](https://linuxhandbook.com/bash-shell-slack-notification/),
> [OneUptime - Slack Alert Notifications (2026)](https://oneuptime.com/blog/post/2026-03-04-set-up-slack-alert-notifications-rhel-webhooks/view)

---

## 참고 자료

- [Bash Scripting Best Practices (2026)](https://oneuptime.com/blog/post/2026-02-13-bash-best-practices/view)
- [14 Essential Bash Scripts for Production (2026)](https://earezki.com/ai-news/2026-04-06-14-bash-scripts-i-use-on-every-production-server/)
- [flock(1) - Linux man page](https://linux.die.net/man/1/flock)
- [Red Hat - Self-healing with systemd](https://www.redhat.com/en/blog/systemd-automate-recovery)
- [GNU Bash Reference Manual](https://www.gnu.org/software/bash/manual/)
