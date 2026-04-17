---
title: "실무 자동화 스크립트 패턴"
sidebar_label: "자동화 패턴"
sidebar_position: 4
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - bash
  - shell
  - automation
  - devops
---

# 실무 자동화 스크립트 패턴

프로덕션 환경에서 검증된 Bash 자동화 패턴을 정리한다.
재시도, 병렬 처리, 배포, 모니터링 등 실무에서 자주 쓰이는
구조를 코드 중심으로 설명한다.

---

## 공통 헤더 (모든 스크립트 기본)

모든 자동화 스크립트는 아래 헤더로 시작한다.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# 스크립트 루트 디렉토리
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

# 로그 함수
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*" >&2; }
err()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }
die()  { err "$*"; exit 1; }
```

| 옵션 | 의미 |
|------|------|
| `-e` | 명령 실패 시 즉시 종료 |
| `-E` | 서브쉘에서도 ERR trap 상속 |
| `-u` | 미정의 변수 참조 시 오류 |
| `-o pipefail` | 파이프 중간 실패도 감지 |

---

## 1. 재시도(Retry) 패턴

### 기본 재시도

```bash
retry() {
  local max_attempts="${1}"
  local delay="${2}"
  local attempt=1
  shift 2

  while true; do
    if "$@"; then
      return 0
    fi

    if (( attempt >= max_attempts )); then
      err "최대 재시도 횟수 초과: $*"
      return 1
    fi

    warn "재시도 ${attempt}/${max_attempts} — ${delay}초 후 재시도"
    sleep "${delay}"
    (( attempt++ ))
  done
}

# 사용 예시
retry 3 5 curl -sf https://api.example.com/health
```

### 지수 백오프(Exponential Backoff)

```bash
retry_with_backoff() {
  local max_attempts="${1:-5}"
  local base_delay="${2:-1}"   # 초
  local max_delay="${3:-60}"   # 최대 대기 상한
  shift 3
  local attempt=1

  while (( attempt <= max_attempts )); do
    if "$@"; then
      return 0
    fi

    if (( attempt == max_attempts )); then
      err "모든 재시도 실패: $*"
      return 1
    fi

    # delay = min(base * 2^(attempt-1) + jitter, max_delay)
    local exp=$(( base_delay * (2 ** (attempt - 1)) ))
    local jitter=$(( RANDOM % 3 ))          # 0~2초 지터
    local delay=$(( exp + jitter ))
    delay=$(( delay > max_delay ? max_delay : delay ))

    warn "재시도 ${attempt}/${max_attempts} — ${delay}초 후 재시도"
    sleep "${delay}"
    (( attempt++ ))
  done
}
```

```
시도 1  → 즉시
시도 2  → 1s + jitter
시도 3  → 2s + jitter
시도 4  → 4s + jitter
시도 5  → 8s + jitter (상한: max_delay)
```

> **Jitter가 중요한 이유**: 동시에 실패한 여러 클라이언트가
> 같은 간격으로 재시도하면 서버에 동시 부하가 집중된다.
> 무작위 지터를 추가하면 요청이 분산된다.

---

## 2. 병렬 실행 패턴

| 방법 | 제어 | 설치 | 적합 상황 |
|------|------|------|----------|
| `& + wait` | 수동 | 불필요 | 간단한 고정 개수 |
| `xargs -P` | 자동 | 불필요 | 대량 입력 처리 |
| `GNU parallel` | 자동+고급 | 필요 | 복잡한 병렬 처리 |

### 백그라운드(&) + wait

```bash
# 최대 동시 실행 수를 제어하는 세마포어 패턴
MAX_JOBS=4
running=0

for host in "${HOSTS[@]}"; do
  # 최대 개수 도달 시 대기
  while (( running >= MAX_JOBS )); do
    wait -n 2>/dev/null && (( running-- )) || true  # Bash 4.3+ 필요
  done

  check_host "${host}" &
  (( running++ ))
done

# 나머지 모두 완료 대기
wait
log "전체 완료"
```

### xargs -P (대량 파일/입력 처리)

```bash
# 파일 목록을 4개 병렬로 압축
find /data -name "*.log" -mtime +7 | \
  xargs -P 4 -I{} gzip {}

# 결과 수집 (임시 디렉토리 활용)
TMPDIR=$(mktemp -d)
trap 'rm -rf "${TMPDIR}"' EXIT

process_item() {
  local item="${1}"
  local result
  result=$(do_work "${item}")
  echo "${result}" > "${TMPDIR}/${item##*/}.out"
}
export -f process_item

printf '%s\n' "${ITEMS[@]}" | xargs -P 8 -I{} bash -c \
  'process_item "$@"' _ {}

# 결과 집계
cat "${TMPDIR}"/*.out
```

### GNU parallel (고급 병렬 처리)

```bash
# 기본 사용 — 4개 병렬, 진행률 표시
parallel --jobs 4 --progress process_file ::: *.csv

# 입력을 그룹으로 나눠 처리
cat hosts.txt | parallel --jobs 10 \
  'ssh {} "uptime && df -h"' 2>/dev/null

# 메모리 여유 확인 후 실행 (OOM 방지)
parallel --memfree 2G --jobs 0 heavy_task ::: "${ITEMS[@]}"

# 실패 재시도
parallel --retries 3 --jobs 4 upload_file ::: *.tar.gz
```

---

## 3. 큐(Queue) 기반 작업 처리 패턴

디렉토리를 큐로 활용하는 패턴이다.
원자적 이동(`mv`)으로 경쟁 조건을 방지한다.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

QUEUE_DIR="/var/spool/myapp/queue"
PROCESSING_DIR="/var/spool/myapp/processing"
DONE_DIR="/var/spool/myapp/done"
FAILED_DIR="/var/spool/myapp/failed"

mkdir -p "${QUEUE_DIR}" "${PROCESSING_DIR}" \
         "${DONE_DIR}" "${FAILED_DIR}"

process_job() {
  local job_file="${1}"
  local job_name
  job_name="$(basename "${job_file}")"

  # 원자적 이동 — 다른 워커와 경쟁 조건 방지
  if ! mv "${job_file}" "${PROCESSING_DIR}/${job_name}" \
       2>/dev/null; then
    log "이미 처리 중: ${job_name}"
    return 0
  fi

  log "처리 시작: ${job_name}"

  if do_work "${PROCESSING_DIR}/${job_name}"; then
    mv "${PROCESSING_DIR}/${job_name}" \
       "${DONE_DIR}/${job_name}.$(date +%s)"
    log "완료: ${job_name}"
  else
    mv "${PROCESSING_DIR}/${job_name}" \
       "${FAILED_DIR}/${job_name}.$(date +%s)"
    err "실패: ${job_name}"
  fi
}

# 워커 루프
while true; do
  for job in "${QUEUE_DIR}"/*; do
    [[ -f "${job}" ]] || continue
    process_job "${job}"
  done
  sleep 1
done
```

```
queue/         ──mv──▶  processing/  ──mv──▶  done/
  job_001.json            job_001.json          job_001.json.1713340800
  job_002.json                                failed/
                                                job_002.json.1713340801
```

---

## 4. 설정 파일 파싱 패턴

### .env 파일 파싱

```bash
# 안전한 .env 로드 (주석, 빈 줄, 따옴표 처리)
load_env() {
  local env_file="${1:-.env}"
  [[ -f "${env_file}" ]] || die ".env 파일 없음: ${env_file}"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    # 빈 줄·주석 건너뜀
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue

    # KEY=VALUE 형식만 처리
    if [[ "${line}" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]}"
      local val="${BASH_REMATCH[2]}"
      # 양쪽 따옴표 제거
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      export "${key}=${val}"
    fi
  done < "${env_file}"
}

load_env ".env.production"
```

### INI 파일 파싱

```bash
# [section] key=value 구조 파싱
parse_ini() {
  local ini_file="${1}"
  local target_section="${2:-}"
  declare -gA INI_VALUES=()

  local current_section=""

  while IFS= read -r line || [[ -n "${line}" ]]; do
    # 주석·빈 줄 건너뜀
    [[ "${line}" =~ ^[[:space:]]*[#\;] ]] && continue
    [[ -z "${line//[[:space:]]/}" ]]      && continue

    # 섹션 헤더
    if [[ "${line}" =~ ^\[([^\]]+)\]$ ]]; then
      current_section="${BASH_REMATCH[1]}"
      continue
    fi

    # key=value
    if [[ "${line}" =~ ^([^=]+)=(.*)$ ]]; then
      local key="${BASH_REMATCH[1]// /}"
      local val="${BASH_REMATCH[2]}"
      val="${val%\"*}"; val="${val##*\"}"

      if [[ -z "${target_section}" || \
            "${current_section}" == "${target_section}" ]]; then
        INI_VALUES["${current_section}.${key}"]="${val}"
      fi
    fi
  done < "${ini_file}"
}

# 사용 예
parse_ini "config.ini" "database"
echo "${INI_VALUES[database.host]}"
echo "${INI_VALUES[database.port]}"
```

### YAML 기본 파싱 (yq 활용 권장)

```bash
# yq v4 (https://github.com/mikefarah/yq) 권장 도구
# 순수 bash는 복잡하므로 yq를 사용한다

parse_yaml_value() {
  local yaml_file="${1}"
  local key_path="${2}"       # 예: .database.host
  yq eval "${key_path}" "${yaml_file}"
}

# 다중 값 추출
load_yaml_config() {
  local yaml_file="${1}"
  DB_HOST=$(yq eval '.database.host'     "${yaml_file}")
  DB_PORT=$(yq eval '.database.port'     "${yaml_file}")
  DB_NAME=$(yq eval '.database.name'     "${yaml_file}")
  APP_ENV=$(yq eval '.app.environment'   "${yaml_file}")
  export DB_HOST DB_PORT DB_NAME APP_ENV
}
```

| 포맷 | 파싱 도구 | 비고 |
|------|----------|------|
| `.env` | 순수 bash | `source` 대신 안전한 파싱 권장 |
| `.ini` | 순수 bash / `crudini` | `crudini`는 Python 의존 |
| `.yaml/.yml` | `yq` v4 | Go 단일 바이너리, 의존성 없음 |
| `.json` | `jq` | 범용 JSON 처리기 |
| `.toml` | `tomlq` / `dasel` | yq와 유사한 인터페이스 |

---

## 5. HTTP API 호출 패턴

### 기본 API 래퍼

```bash
# curl 공통 옵션
CURL_OPTS=(
  --silent
  --show-error
  --location                    # 리다이렉트 추적
  --connect-timeout 10          # 연결 타임아웃 10초
  --max-time 30                 # 전체 요청 타임아웃 30초
  --retry 0                     # 재시도는 상위에서 관리
)

api_get() {
  local url="${1}"
  local token="${API_TOKEN:-}"
  local http_code response body

  # stderr를 분리 — 2>&1로 응답에 혼합하면 상태 코드 파싱이 깨짐
  local tmp_body
  tmp_body=$(mktemp)
  http_code=$(curl "${CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/json" \
    --write-out "%{http_code}" \
    --output "${tmp_body}" \
    "${url}")
  body=$(cat "${tmp_body}")
  rm -f "${tmp_body}"

  case "${http_code}" in
    2[0-9][0-9])
      echo "${body}"
      return 0
      ;;
    401) die "인증 실패 (401): ${url}" ;;
    403) die "권한 없음 (403): ${url}" ;;
    404) warn "리소스 없음 (404): ${url}"; return 1 ;;
    429)
      local retry_after
      retry_after=$(echo "${response}" | \
        grep -i 'retry-after' | awk '{print $2}' || echo 60)
      warn "Rate limit (429) — ${retry_after}초 후 재시도"
      sleep "${retry_after}"
      return 1
      ;;
    5[0-9][0-9]) warn "서버 오류 (${http_code})"; return 1 ;;
    *)   die "알 수 없는 응답 코드: ${http_code}" ;;
  esac
}

api_post() {
  local url="${1}"
  local payload="${2}"
  curl "${CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    "${url}"
}
```

### jq를 이용한 응답 처리

```bash
# JSON 응답에서 값 추출
get_service_status() {
  local service_name="${1}"
  local response

  response=$(retry_with_backoff 3 2 30 \
    api_get "https://api.example.com/services/${service_name}")

  # .status가 null이면 기본값 "unknown" 반환
  local status
  status=$(echo "${response}" | jq -r '.status // "unknown"')

  # 배열 순회
  echo "${response}" | jq -r '.instances[].id' | while read -r id; do
    log "인스턴스: ${id}"
  done

  echo "${status}"
}
```

---

## 6. 헬스체크 스크립트 패턴

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

TIMEOUT=5
ENDPOINTS=(
  "https://api.example.com/health"
  "https://www.example.com/"
)
SERVICES=("postgresql" "redis" "nginx")
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

check_http() {
  local url="${1}"
  local http_code
  http_code=$(curl -s -o /dev/null \
    --connect-timeout "${TIMEOUT}" \
    --max-time "${TIMEOUT}" \
    --write-out "%{http_code}" \
    "${url}")

  if [[ "${http_code}" =~ ^2 ]]; then
    log "OK  [HTTP ${http_code}] ${url}"
    return 0
  else
    warn "FAIL [HTTP ${http_code}] ${url}"
    return 1
  fi
}

check_service() {
  local svc="${1}"
  if systemctl is-active --quiet "${svc}"; then
    log "OK  [SERVICE] ${svc}"
    return 0
  else
    warn "FAIL [SERVICE] ${svc}"
    return 1
  fi
}

check_port() {
  local host="${1}"
  local port="${2}"
  if timeout "${TIMEOUT}" bash -c \
       "</dev/tcp/${host}/${port}" 2>/dev/null; then
    log "OK  [PORT] ${host}:${port}"
    return 0
  else
    warn "FAIL [PORT] ${host}:${port}"
    return 1
  fi
}

send_alert() {
  local message="${1}"
  [[ -z "${ALERT_WEBHOOK}" ]] && return 0
  curl -s -X POST "${ALERT_WEBHOOK}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"[ALERT] ${message}\"}" > /dev/null
}

main() {
  local failed=0

  for url in "${ENDPOINTS[@]}"; do
    check_http "${url}" || {
      send_alert "HTTP 헬스체크 실패: ${url}"
      (( failed++ ))
    }
  done

  for svc in "${SERVICES[@]}"; do
    check_service "${svc}" || {
      send_alert "서비스 다운: ${svc}"
      (( failed++ ))
    }
  done

  if (( failed > 0 )); then
    err "헬스체크 실패 항목: ${failed}개"
    exit 1
  fi

  log "모든 헬스체크 통과"
}

main "$@"
```

---

## 7. 배포 스크립트 패턴

### 롤링 업데이트 (서비스 목록 순차 교체)

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_DIR="/opt/myapp"
RELEASE_DIR="${DEPLOY_DIR}/releases"
CURRENT_LINK="${DEPLOY_DIR}/current"
NEW_VERSION="${1:?버전을 지정하세요}"
ROLLBACK_VERSION=""

# 배포 전 현재 버전 저장 (롤백용)
if [[ -L "${CURRENT_LINK}" ]]; then
  ROLLBACK_VERSION="$(readlink "${CURRENT_LINK}")"
fi

rollback() {
  if [[ -z "${ROLLBACK_VERSION}" ]]; then
    err "롤백할 이전 버전 없음"
    return 1
  fi
  warn "롤백 실행: ${ROLLBACK_VERSION}"
  ln -sfn "${ROLLBACK_VERSION}" "${CURRENT_LINK}"
  systemctl reload myapp
  err "배포 실패 — ${ROLLBACK_VERSION}으로 롤백 완료"
}

# 실패 시 자동 롤백
trap rollback ERR

deploy() {
  local version="${1}"
  local release_path="${RELEASE_DIR}/${version}"

  log "배포 시작: ${version}"

  # 1. 새 버전 다운로드 및 준비
  mkdir -p "${release_path}"
  download_artifact "${version}" "${release_path}"

  # 2. 헬스체크 — 준비 상태 확인
  log "사전 헬스체크..."
  check_http "http://localhost:8080/health"

  # 3. 심링크 교체 (원자적 전환)
  ln -sfn "${release_path}" "${CURRENT_LINK}"

  # 4. 서비스 재시작
  systemctl reload myapp

  # 5. 사후 헬스체크
  log "사후 헬스체크..."
  local retries=10
  while (( retries-- > 0 )); do
    check_http "http://localhost:8080/health" && break
    sleep 3
  done

  if (( retries == 0 )); then
    die "배포 후 헬스체크 실패"
  fi

  # 6. 오래된 릴리즈 정리 (최근 5개만 유지)
  # 현재 심링크가 가리키는 버전을 삭제 대상에서 반드시 제외한다
  local current_version
  current_version="$(readlink "${CURRENT_LINK}" 2>/dev/null || true)"
  ls -dt "${RELEASE_DIR}"/*/ 2>/dev/null | \
    grep -vF "${current_version}" | \
    tail -n +6 | xargs -r rm -rf

  log "배포 완료: ${version}"
}

deploy "${NEW_VERSION}"
```

### 롤링 업데이트 (다중 노드)

```bash
NODES=("node1.internal" "node2.internal" "node3.internal")
BATCH_SIZE=1          # 한 번에 교체할 노드 수

rolling_deploy() {
  local version="${1}"
  local total=${#NODES[@]}
  local i=0

  while (( i < total )); do
    local batch=("${NODES[@]:${i}:${BATCH_SIZE}}")
    log "배포 배치 $((i/BATCH_SIZE + 1)): ${batch[*]}"

    for node in "${batch[@]}"; do
      log "  배포 중: ${node}"
      ssh "${node}" "deploy.sh ${version}" || {
        err "노드 배포 실패: ${node}"
        return 1
      }

      # 노드별 헬스체크
      retry 5 3 check_http \
        "http://${node}:8080/health" || {
        err "노드 헬스체크 실패: ${node}"
        return 1
      }
    done

    i=$(( i + BATCH_SIZE ))
    log "배치 완료 — 다음 배치까지 5초 대기"
    sleep 5
  done
}
```

---

## 8. 로그 수집/집계 스크립트 패턴

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

LOG_DIR="/var/log/myapp"
REPORT_DIR="/var/reports/$(date +%Y%m%d)"
WINDOW_MIN="${1:-60}"   # 최근 N분

mkdir -p "${REPORT_DIR}"

# 대용량 파일 최적화: LC_ALL=C로 UTF-8 처리 비활성화
export LC_ALL=C

collect_errors() {
  local log_file="${1}"
  local output="${REPORT_DIR}/errors.txt"

  log "에러 수집: ${log_file}"

  # 최근 N분 이내 라인만 처리
  awk -v cutoff="$(date -d "${WINDOW_MIN} minutes ago" \
    '+%Y-%m-%dT%H:%M' 2>/dev/null || \
    date -v"-${WINDOW_MIN}M" '+%Y-%m-%dT%H:%M')" \
    '$0 >= cutoff' "${log_file}" | \
  grep -E '\[(ERROR|FATAL|CRITICAL)\]' >> "${output}"
}

aggregate_stats() {
  local log_file="${1}"

  log "통계 집계: ${log_file}"

  # 상태 코드별 요청 수 집계 (Nginx access log 형식)
  awk '{print $9}' "${log_file}" | \
    sort | uniq -c | sort -rn | \
    awk '{printf "HTTP %-3s : %d\n", $2, $1}' \
    >> "${REPORT_DIR}/status_codes.txt"

  # 느린 응답 추출 (응답 시간 > 3초)
  awk '$NF > 3000 {print $0}' "${log_file}" \
    >> "${REPORT_DIR}/slow_requests.txt"
}

rotate_and_compress() {
  find "${LOG_DIR}" -name "*.log" -mtime +7 \
    -not -name "*.gz" | \
  while read -r f; do
    gzip -9 "${f}" && log "압축 완료: ${f}.gz"
  done

  # 30일 이상 된 압축 파일 삭제
  find "${LOG_DIR}" -name "*.gz" -mtime +30 -delete
  log "오래된 로그 정리 완료"
}

# 병렬로 로그 처리
for log_file in "${LOG_DIR}"/*.log; do
  [[ -f "${log_file}" ]] || continue
  collect_errors "${log_file}" &
  aggregate_stats "${log_file}" &
done
wait

rotate_and_compress
log "로그 집계 완료 → ${REPORT_DIR}"
```

---

## 9. 시스템 모니터링 스크립트 패턴

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

# 임계값 설정
readonly THRESHOLD_CPU=85      # %
readonly THRESHOLD_MEM=85      # %
readonly THRESHOLD_DISK=80     # %
readonly THRESHOLD_LOAD=4.0    # load average (1분)

ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
HOSTNAME="$(hostname -f)"

send_alert() {
  local level="${1}"   # WARNING | CRITICAL
  local resource="${2}"
  local current="${3}"
  local threshold="${4}"
  local message

  message="[${level}] ${HOSTNAME} | ${resource}: \
${current} (임계값: ${threshold})"
  warn "${message}"

  [[ -z "${ALERT_WEBHOOK}" ]] && return 0
  curl -s -X POST "${ALERT_WEBHOOK}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"${message}\"}" > /dev/null
}

check_cpu() {
  # top -bn1은 필드 위치가 배포판마다 다르고 1회 스냅샷은 부정확
  # /proc/stat에서 2회 측정 차이로 정확한 현재 사용률 계산
  local -a vals1 vals2
  local idle1 total1 idle2 total2
  local diff_idle diff_total cpu_usage

  read -r _ cpu_line1 < /proc/stat
  read -ra vals1 <<< "$cpu_line1"
  idle1=${vals1[3]}
  total1=0
  for v in "${vals1[@]}"; do (( total1 += v )); done

  sleep 1

  read -r _ cpu_line2 < /proc/stat
  read -ra vals2 <<< "$cpu_line2"
  idle2=${vals2[3]}
  total2=0
  for v in "${vals2[@]}"; do (( total2 += v )); done

  diff_idle=$(( idle2 - idle1 ))
  diff_total=$(( total2 - total1 ))
  cpu_usage=$(( (diff_total - diff_idle) * 100 / diff_total ))

  if (( cpu_usage >= THRESHOLD_CPU )); then
    send_alert "WARNING" "CPU 사용률" \
      "${cpu_usage}%" "${THRESHOLD_CPU}%"
  else
    log "CPU: ${cpu_usage}% (정상)"
  fi
}

check_memory() {
  local mem_total mem_available mem_used mem_pct

  read -r mem_total mem_available < <(
    awk '/^MemTotal:/ {t=$2}
         /^MemAvailable:/ {a=$2; print t, a}' \
    /proc/meminfo
  )

  mem_used=$(( mem_total - mem_available ))
  mem_pct=$(( mem_used * 100 / mem_total ))

  if (( mem_pct >= THRESHOLD_MEM )); then
    send_alert "WARNING" "메모리 사용률" \
      "${mem_pct}%" "${THRESHOLD_MEM}%"
  else
    log "메모리: ${mem_pct}% (정상)"
  fi
}

check_disk() {
  while IFS= read -r line; do
    local usage mount
    usage=$(echo "${line}" | awk '{print $5}' | tr -d '%')
    mount=$(echo "${line}"  | awk '{print $6}')

    if (( usage >= THRESHOLD_DISK )); then
      send_alert "WARNING" "디스크 사용률 [${mount}]" \
        "${usage}%" "${THRESHOLD_DISK}%"
    fi
  done < <(df -h --output=source,size,used,avail,pcent,target \
    | tail -n +2 | grep -v 'tmpfs\|udev')
}

check_load() {
  local load1
  load1=$(awk '{print $1}' /proc/loadavg)

  if (( $(echo "${load1} > ${THRESHOLD_LOAD}" | bc -l) )); then
    send_alert "WARNING" "Load Average (1m)" \
      "${load1}" "${THRESHOLD_LOAD}"
  else
    log "Load Average: ${load1} (정상)"
  fi
}

main() {
  log "=== 시스템 모니터링 시작: ${HOSTNAME} ==="
  check_cpu
  check_memory
  check_disk
  check_load
  log "=== 모니터링 완료 ==="
}

main "$@"
```

---

## 10. 크론잡 래퍼 패턴

중복 실행 방지, 실행 시간 측정, 알림을 포함한
프로덕션 크론잡 래퍼다.

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME="$(basename "${0}" .sh)"
LOCK_FILE="/var/lock/${SCRIPT_NAME}.lock"
LOG_FILE="/var/log/cronjobs/${SCRIPT_NAME}.log"
ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}"
START_TIME=""

mkdir -p "$(dirname "${LOG_FILE}")"

# --- 로그를 파일에도 동시에 기록 ---
exec > >(tee -a "${LOG_FILE}") 2>&1

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
err()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

send_alert() {
  local status="${1}"  # SUCCESS | FAILURE
  local duration="${2}"
  local detail="${3:-}"
  [[ -z "${ALERT_WEBHOOK}" ]] && return 0

  local icon
  [[ "${status}" == "SUCCESS" ]] && icon="✅" || icon="❌"
  local msg="${icon} ${SCRIPT_NAME} | ${status} \
| 소요: ${duration}s"
  [[ -n "${detail}" ]] && msg+=" | ${detail}"

  curl -s -X POST "${ALERT_WEBHOOK}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"${msg}\"}" > /dev/null
}

cleanup() {
  local exit_code="${1}"
  local end_time
  end_time=$(date +%s)
  local duration=$(( end_time - START_TIME ))

  rm -f "${LOCK_FILE}"

  if (( exit_code == 0 )); then
    log "완료 (소요: ${duration}초)"
    send_alert "SUCCESS" "${duration}"
  else
    err "실패 (종료코드: ${exit_code}, 소요: ${duration}초)"
    send_alert "FAILURE" "${duration}" \
      "exit_code=${exit_code}"
  fi
}

acquire_lock() {
  # flock: 커널 수준 잠금 — 프로세스 종료 시 자동 해제
  exec 200>"${LOCK_FILE}"
  if ! flock -n 200; then
    log "이미 실행 중 (lock: ${LOCK_FILE}) — 건너뜀"
    exit 0
  fi
  echo $$ >&200
}

# ----- 여기서부터 실제 작업 정의 -----
run_job() {
  log "작업 시작"

  # TODO: 실제 작업 코드
  log "작업 완료"
}
# ------------------------------------

main() {
  acquire_lock

  START_TIME=$(date +%s)
  log "=== ${SCRIPT_NAME} 시작 (PID: $$) ==="

  # 종료 시 cleanup 실행 (성공/실패 모두)
  trap 'cleanup $?' EXIT

  run_job
}

main "$@"
```

### 크론탭 등록 예시

```cron
# 매일 02:00 — 표준 래퍼 패턴 적용
0 2 * * * /opt/scripts/daily_backup.sh

# 5분마다 — 실행 시간 > 5분이면 다음 실행 시 건너뜀(flock)
*/5 * * * * /usr/bin/flock -n /tmp/monitor.lock \
  /opt/scripts/monitor.sh
```

---

## 패턴 선택 가이드

```
작업 실패 가능성 있음?
  ├─ YES → 재시도 패턴 적용
  │        네트워크 관련? → 지수 백오프 추가
  └─ NO  → 그대로 실행

대량 처리가 필요한가?
  ├─ 단순 파일/URL 목록 → xargs -P
  ├─ 복잡한 의존성·로깅 → GNU parallel
  └─ 간단한 고정 개수    → & + wait

크론잡인가?
  └─ YES → 래퍼 패턴 필수
             ├─ 중복 방지: flock
             ├─ 실행 시간 측정: date +%s
             └─ 알림: Slack Webhook
```

---

## 참고 자료

- [GNU Parallel Tutorial](https://www.gnu.org/software/parallel/parallel_tutorial.html)
  — 확인일: 2026-04-17
- [Bash retry function with exponential backoff (Hacker News 토론)](https://news.ycombinator.com/item?id=34161661)
  — 확인일: 2026-04-17
- [Best practices when using curl in shell scripts](https://www.joyfulbikeshedding.com/blog/2020-05-11-best-practices-when-using-curl-in-shell-scripts.html)
  — 확인일: 2026-04-17
- [Bash Trap and Rollback Patterns for Safer Linux Deployments](https://blog.bariskode.com/blog/bash-trap-and-rollback-patterns-safe-linux-deployments/)
  — 확인일: 2026-04-17
- [Managing Duplicate Cron Jobs (Rackspace Docs)](https://docs.rackspace.com/docs/managing-duplicate-cron-jobs)
  — 확인일: 2026-04-17
- [Parsing config files with Bash (Opensource.com)](https://opensource.com/article/21/6/bash-config)
  — 확인일: 2026-04-17
- [How to Bash and jq: generate statistics for a REST API](https://advancedweb.hu/how-to-bash-and-jq-generate-statistics-for-a-rest-api/)
  — 확인일: 2026-04-17
