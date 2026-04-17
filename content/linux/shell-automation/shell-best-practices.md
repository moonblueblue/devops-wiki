---
title: "셸 스크립트 베스트 프랙티스 (set -euo pipefail)"
sidebar_label: "셸 베스트 프랙티스"
sidebar_position: 3
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - bash
  - shell
  - best-practices
  - shellcheck
---

# 셸 스크립트 베스트 프랙티스 (set -euo pipefail)

셸 스크립트는 "그냥 동작하면 된다"는 인식이 강하지만,
프로덕션 환경에서 잘못 작성된 스크립트는 데이터 손실,
무한 루프, 침묵하는 오류(silent failure)를 유발한다.

이 글은 Google, Netflix 등 탑티어 엔지니어링 팀이
실제 사용하는 Bash 베스트 프랙티스를 다룬다.

---

## 1. strict mode: set -euo pipefail

셸 스크립트의 첫 번째 방어선이다. 네 가지 옵션을
조합하여 "조용한 실패"를 차단한다.

```bash
set -euo pipefail
```

| 옵션 | 이름 | 동작 |
|------|------|------|
| `-e` | errexit | 명령 실패 시 즉시 스크립트 종료 |
| `-u` | nounset | 미정의 변수 참조 시 오류 발생 |
| `-o pipefail` | pipefail | 파이프 중간 실패도 감지 |
| `-x` | xtrace | 실행 명령을 stderr에 출력 (디버그용) |

### 1-1. set -e (errexit)

```bash
set -e

rm -rf /nonexistent   # 실패 → 즉시 종료
echo "이 줄은 실행되지 않음"
```

#### 예외 케이스 — 실패를 허용하는 문맥

`-e` 는 아래 문맥에서는 **종료하지 않는다**.
이 동작을 모르면 버그가 숨는다.

```bash
set -e

# if 조건 내부 — 실패해도 계속 진행
if grep -q "pattern" file.txt; then
  echo "found"
fi

# while 조건 내부 — 실패해도 계속 진행
while read -r line; do
  process "$line"
done < file.txt

# && 체인 — 앞 명령 실패 시 뒤 명령 생략, 스크립트는 유지
mkdir /tmp/foo && touch /tmp/foo/bar

# || 체인 — 오른쪽이 실패 감지 흡수
grep "key" file.txt || echo "not found"
```

`-e` 를 믿지 말고 **명시적 오류 처리**를 병행한다.

```bash
# 안전한 패턴: 반환값 명시 확인
if ! command_that_might_fail; then
  echo "ERROR: 실패했습니다" >&2
  exit 1
fi
```

### 1-2. set -u (nounset)

미정의 변수 접근을 오류로 처리한다.

```bash
set -u

echo "$UNDEFINED_VAR"
# bash: UNDEFINED_VAR: unbound variable → 종료
```

#### 빈 배열과 set -u 의 함정

Bash 4.2 이하에서 빈 배열을 `"${arr[@]}"` 로 확장하면
`-u` 가 오류를 발생시킨다.
Bash 4.3 이상에서는 수정되어 이 문제가 없다.

```bash
set -u

arr=()

# Bash 4.2 이하 또는 스칼라 방식 — 오류 발생
echo $arr         # bash: arr: unbound variable

# Bash 4.3+: "arr[@]" 형태는 안전
echo "${arr[@]}"  # 오류 없음 (Bash 4.3+)

# 이식성이 필요하거나 Bash 4.2 이하도 지원해야 한다면
# + 연산자로 기본값 제공
echo "${arr[@]+"${arr[@]}"}"
```

기본값 연산자도 적극 활용한다.

```bash
# 변수가 없거나 빈 경우 기본값
NAME="${1:-default_name}"

# 변수가 없는 경우만 기본값 (빈 문자열은 유지)
NAME="${1-default_name}"

# 변수가 없으면 오류 메시지와 함께 종료
: "${REQUIRED_VAR:?REQUIRED_VAR must be set}"
```

### 1-3. pipefail과 PIPESTATUS

기본 셸에서는 파이프 마지막 명령의 반환값만 사용한다.

```bash
# pipefail 없음 — 성공으로 보임
cat nonexistent.txt | grep "pattern"
echo $?  # 0 (grep의 반환값)

# pipefail 있음 — 실패 감지
set -o pipefail
cat nonexistent.txt | grep "pattern"
echo $?  # 1 (cat의 실패 전파)
```

파이프 각 단계의 종료 코드가 필요하면 `PIPESTATUS` 를 쓴다.

```bash
set -o pipefail

producer | transformer | consumer
pipe_statuses=("${PIPESTATUS[@]}")

echo "producer:     ${pipe_statuses[0]}"
echo "transformer:  ${pipe_statuses[1]}"
echo "consumer:     ${pipe_statuses[2]}"

if [[ ${pipe_statuses[0]} -ne 0 ]]; then
  echo "ERROR: producer 단계 실패" >&2
  exit 1
fi
```

`PIPESTATUS` 는 **다음 명령 실행 즉시 덮어써진다**.
배열에 복사하여 보존해야 한다.

### 1-4. set -x (xtrace) — 디버그 모드

각 명령 실행 전 확장된 내용을 stderr에 출력한다.

```bash
# 스크립트 전체 디버그
set -x

# 특정 구간만 디버그
set -x
some_complex_logic
set +x  # xtrace 비활성화

# 환경 변수로 제어
TRACE="${TRACE:-0}"
[[ "$TRACE" -eq 1 ]] && set -x
```

출력 형식을 커스터마이징하면 가독성이 높아진다.

```bash
# PS4: xtrace 프롬프트 (기본값: "+ ")
export PS4='+(${BASH_SOURCE}:${LINENO}): ${FUNCNAME[0]:+${FUNCNAME[0]}(): }'
set -x
```

---

## 2. ShellCheck 정적 분석

ShellCheck은 셸 스크립트의 버그·안티패턴을 정적으로
찾아주는 도구다. 코드 리뷰 전에 반드시 통과해야 한다.

### 설치

```bash
# Ubuntu / Debian
apt-get install shellcheck

# macOS
brew install shellcheck

# RHEL / CentOS / Fedora
dnf install ShellCheck

# 직접 바이너리 설치
VERSION="v0.11.0"
curl -sSL "https://github.com/koalaman/shellcheck/releases/download\
/${VERSION}/shellcheck-${VERSION}.linux.x86_64.tar.xz" \
  | tar -xJ --strip-components=1 -C /usr/local/bin shellcheck-${VERSION}/shellcheck
```

### 주요 경고 해석

```bash
# SC2086: 변수를 따옴표로 감싸지 않음
echo $FILE  # SC2086

# SC2046: 명령 치환 결과를 따옴표로 감싸지 않음
rm $(find . -name "*.tmp")  # SC2046

# SC2006: backtick 대신 $() 사용 권고
OUTPUT=`command`  # SC2006 → OUTPUT=$(command)

# SC2164: cd 실패 감지 안 함
cd /some/dir  # SC2164
rm -rf *

# SC2034: 선언했지만 사용하지 않는 변수
UNUSED_VAR="value"  # SC2034

# SC2155: 선언과 할당 분리 권고
local VAR=$(command)  # SC2155
# → local VAR; VAR=$(command)
```

### 실행 방법

```bash
# 단일 파일
shellcheck script.sh

# 심각도 필터 (error, warning, info, style)
shellcheck --severity=warning script.sh

# 특정 경고 무시
shellcheck --exclude=SC2086 script.sh

# JSON 출력 (파싱용)
shellcheck --format=json script.sh

# 인라인 비활성화 (불가피한 경우에만)
# shellcheck disable=SC2086
echo $FILE
```

### CI 통합

#### GitHub Actions

```yaml
# .github/workflows/shellcheck.yml
name: ShellCheck

on: [push, pull_request]

jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run ShellCheck
        uses: ludeeus/action-shellcheck@master
        with:
          severity: warning
          scandir: './scripts'
```

#### GitLab CI

```yaml
shellcheck:
  image: koalaman/shellcheck-alpine:stable
  stage: lint
  script:
    - find . -name "*.sh" -print0 |
        xargs -0 shellcheck --severity=warning
```

#### pre-commit hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/shellcheck-py/shellcheck-py
    rev: v0.11.0.1
    hooks:
      - id: shellcheck
        args: [--severity=warning]
```

---

## 3. 스크립트 구조 템플릿

모든 프로덕션 셸 스크립트는 아래 구조를 따른다.

```bash
#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# ==============================================================================
# 스크립트 이름: deploy.sh
# 설명:         애플리케이션 배포 스크립트
# 작성자:       DevOps Team
# 버전:         1.0.0
# 사용법:       ./deploy.sh [OPTIONS] <environment>
# ==============================================================================

set -euo pipefail

# ── 상수 ──────────────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
readonly LOG_FILE="/var/log/deploy_${TIMESTAMP}.log"

# ── 기본값 ────────────────────────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
DRY_RUN=false
VERBOSE=false

# ── 함수 ──────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
사용법: ${SCRIPT_NAME} [OPTIONS] <environment>

OPTIONS:
  -n, --dry-run    실제 변경 없이 실행 계획만 출력
  -v, --verbose    상세 출력 활성화
  -h, --help       도움말 출력

ENVIRONMENT: production | staging | development
EOF
}

main() {
  parse_args "$@"
  validate_env
  deploy
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -n|--dry-run)   DRY_RUN=true  ;;
      -v|--verbose)   VERBOSE=true  ;;
      -h|--help)      usage; exit 0 ;;
      -*)
        log_error "알 수 없는 옵션: $1"
        usage >&2
        exit 1
        ;;
      *)
        ENVIRONMENT="$1"
        ;;
    esac
    shift
  done
}

# ── 진입점 ────────────────────────────────────────────────────────────────────
main "$@"
```

### shebang 선택 기준

```bash
#!/bin/bash       # 경로가 고정. 이식성 낮음
#!/usr/bin/env bash  # PATH에서 bash 탐색. 권장

# bash 최소 버전 강제
if [[ "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  echo "ERROR: Bash 4.0 이상 필요 (현재: ${BASH_VERSION})" >&2
  exit 1
fi
```

---

## 4. 변수와 따옴표 규칙

### 따옴표 규칙 요약

| 상황 | 올바른 방법 | 잘못된 방법 |
|------|-----------|-----------|
| 변수 참조 | `"$VAR"` | `$VAR` |
| 명령 치환 | `"$(cmd)"` | `$(cmd)` |
| 경로 인자 | `"$path"` | `$path` |
| 의도적 word split | `$var` (주석 필요) | — |

따옴표가 없으면 공백·특수문자가 포함된 값에서
word splitting과 glob 확장이 일어난다.

```bash
FILE="my file.txt"

# 잘못된 방법 — 공백으로 두 인자로 분리됨
cp $FILE /backup/

# 올바른 방법
cp "$FILE" /backup/
```

### 배열 확장

```bash
# 배열 선언
files=("file1.txt" "file 2.txt" "file3.txt")

# 올바른 전체 확장: 각 원소를 개별 인자로
cp "${files[@]}" /backup/

# 잘못된 확장: 하나의 문자열로 합쳐짐
cp "${files[*]}" /backup/

# 배열 길이
echo "${#files[@]}"

# 배열 슬라이싱
echo "${files[@]:1:2}"  # 인덱스 1부터 2개

# 배열 반복
for f in "${files[@]}"; do
  process "$f"
done
```

### 파라미터 확장 패턴

```bash
PATH_VAR="/usr/local/bin/script.sh"

# 파일명만 추출 (basename 대체)
echo "${PATH_VAR##*/}"     # script.sh

# 디렉토리만 추출 (dirname 대체)
echo "${PATH_VAR%/*}"      # /usr/local/bin

# 확장자 제거
echo "${PATH_VAR%.*}"      # /usr/local/bin/script

# 확장자만 추출
echo "${PATH_VAR##*.}"     # sh

# 문자열 치환 (첫 번째 매치)
echo "${PATH_VAR/local/opt}"

# 문자열 치환 (모든 매치)
echo "${PATH_VAR//\//─}"

# 대소문자 변환 (Bash 4.0+)
STR="Hello World"
echo "${STR,,}"   # hello world
echo "${STR^^}"   # HELLO WORLD
```

---

## 5. 오류 처리 패턴

### trap을 활용한 오류 처리

```bash
set -euo pipefail

# 정리 함수 — 반드시 EXIT trap에 등록
cleanup() {
  local exit_code=$?

  # 임시 파일 제거
  [[ -n "${TMPDIR:-}" ]] && rm -rf "$TMPDIR"

  # 로그에 종료 상태 기록
  if [[ $exit_code -ne 0 ]]; then
    log_error "스크립트가 종료 코드 ${exit_code}로 실패했습니다"
  fi

  exit "$exit_code"
}

# 오류 위치 출력
err_handler() {
  local exit_code=$?
  local line_no="${BASH_LINENO[0]}"
  local func="${FUNCNAME[1]:-main}"

  log_error "오류 발생: line ${line_no}, func ${func}, code ${exit_code}"
}

# trap 등록 — 스크립트 최상단에 위치
trap cleanup EXIT
trap err_handler ERR
```

### trap 신호 종류

| 신호 | 트리거 시점 |
|------|-----------|
| `EXIT` | 스크립트 종료 시 (정상·비정상 모두) |
| `ERR` | 명령 실패 시 (`set -e` 유사) |
| `INT` | Ctrl+C (SIGINT) |
| `TERM` | SIGTERM 수신 시 |
| `HUP` | SIGHUP 수신 시 |
| `DEBUG` | 각 명령 실행 전 |

```bash
# SIGTERM/SIGINT 처리 예시
handle_signal() {
  log_warn "신호 수신 — 정리 후 종료합니다"
  # cleanup은 EXIT trap이 처리
  exit 130
}

trap handle_signal INT TERM
```

---

## 6. 임시 파일 안전하게 다루기

임시 파일을 `/tmp/hardcoded.tmp` 처럼 쓰면
병렬 실행 시 충돌하고 보안 취약점(symlink attack)이 생긴다.

```bash
set -euo pipefail

# mktemp으로 유일한 임시 파일/디렉토리 생성
TMPFILE=$(mktemp)
TMPDIR=$(mktemp -d)

# 템플릿 지정 (진단에 유리)
TMPFILE=$(mktemp /tmp/deploy.XXXXXX)
TMPDIR=$(mktemp -d /tmp/deploy_work.XXXXXX)

# EXIT trap으로 자동 정리 — 실패해도 동작
cleanup() {
  rm -f  "$TMPFILE"
  rm -rf "$TMPDIR"
}
trap cleanup EXIT

# 이제 안전하게 사용
process_data > "$TMPFILE"
cp "$TMPFILE" /output/result.txt
```

보안이 중요한 경우 임시 디렉토리 권한을 좁힌다.

```bash
TMPDIR=$(mktemp -d)
chmod 700 "$TMPDIR"
```

---

## 7. 입력 검증과 방어적 프로그래밍

### 인자 검증 템플릿

```bash
validate_env() {
  # 필수 인자 확인
  if [[ -z "${ENVIRONMENT:-}" ]]; then
    log_error "환경(environment) 인자가 필요합니다"
    usage >&2
    exit 1
  fi

  # 허용된 값 검증
  case "$ENVIRONMENT" in
    production|staging|development)
      ;;
    *)
      log_error "잘못된 환경: ${ENVIRONMENT}"
      log_error "허용 값: production, staging, development"
      exit 1
      ;;
  esac

  # 필수 명령어 존재 확인
  local required_cmds=(kubectl helm jq curl)
  for cmd in "${required_cmds[@]}"; do
    if ! command -v "$cmd" &>/dev/null; then
      log_error "필수 명령어가 없습니다: $cmd"
      exit 1
    fi
  done

  # 필수 환경 변수 확인
  : "${KUBECONFIG:?KUBECONFIG 환경 변수가 필요합니다}"
  : "${APP_VERSION:?APP_VERSION 환경 변수가 필요합니다}"
}
```

### 숫자 및 형식 검증

```bash
# 정수 검증
is_integer() {
  [[ "$1" =~ ^-?[0-9]+$ ]]
}

# 양의 정수 검증
is_positive_int() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

# IP 주소 형식 검증 (간단)
is_ip() {
  [[ "$1" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]
}

# 사용 예시
PORT="${PORT:-8080}"
if ! is_positive_int "$PORT"; then
  log_error "PORT는 양의 정수여야 합니다: $PORT"
  exit 1
fi
```

### 경로 주입 방지

```bash
# 사용자 입력을 경로에 사용할 때
sanitize_path() {
  local input="$1"
  local base_dir="$2"

  # 절대 경로로 변환
  local resolved
  resolved=$(realpath -m "$base_dir/$input" 2>/dev/null) || {
    log_error "경로 해석 실패: $input"
    return 1
  }

  # base_dir 외부 접근 차단 (path traversal 방지)
  if [[ "$resolved" != "$base_dir"* ]]; then
    log_error "허용되지 않은 경로: $input"
    return 1
  fi

  echo "$resolved"
}
```

---

## 8. 로그 함수 패턴

### 색상 + 레벨 + 타임스탬프 로거

```bash
# ── 색상 코드 ─────────────────────────────────────────────────────────────────
if [[ -t 2 ]]; then  # stderr가 터미널인 경우만 색상 적용
  readonly RED='\033[0;31m'
  readonly YELLOW='\033[0;33m'
  readonly GREEN='\033[0;32m'
  readonly BLUE='\033[0;34m'
  readonly GRAY='\033[0;90m'
  readonly RESET='\033[0m'
else
  readonly RED='' YELLOW='' GREEN='' BLUE='' GRAY='' RESET=''
fi

# ── 로그 레벨 ─────────────────────────────────────────────────────────────────
LOG_LEVEL="${LOG_LEVEL:-INFO}"

_log() {
  local level="$1"
  local color="$2"
  shift 2
  local ts
  ts="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  printf "${color}[%s] [%-5s] %s${RESET}\n" \
    "$ts" "$level" "$*" >&2
}

log_debug() {
  [[ "$LOG_LEVEL" == "DEBUG" ]] && _log "DEBUG" "$GRAY" "$@"
}
log_info()  { _log "INFO"  "$GREEN"  "$@" ; }
log_warn()  { _log "WARN"  "$YELLOW" "$@" ; }
log_error() { _log "ERROR" "$RED"    "$@" ; }

# 사용 예시
log_info  "배포 시작: ${ENVIRONMENT}"
log_warn  "기존 리소스가 교체됩니다"
log_error "접속 실패: ${HOST}"
log_debug "응답 바디: $(cat response.json)"
```

### 출력과 로그 동시 기록

```bash
# tee를 활용한 stdout/파일 동시 기록
exec > >(tee -a "$LOG_FILE")
exec 2>&1

# 이후 모든 출력이 LOG_FILE에도 기록됨
log_info "이 메시지는 화면과 파일에 모두 저장됩니다"
```

---

## 9. 락 파일로 중복 실행 방지

배치 작업, 배포 스크립트에서 동시 실행은
데이터 손상이나 상태 불일치를 유발한다.

### flock 방식 (권장)

```bash
LOCKFILE="/var/run/${SCRIPT_NAME}.lock"

acquire_lock() {
  # fd 200에 락 파일 연결
  exec 200>"$LOCKFILE"

  # 비블로킹 락 시도 (-n: non-blocking)
  if ! flock -n 200; then
    log_error "다른 인스턴스가 실행 중입니다 (lockfile: $LOCKFILE)"
    exit 1
  fi

  # PID 기록
  echo $$ >&200
  log_info "락 획득 (PID: $$)"
}

release_lock() {
  flock -u 200
  rm -f "$LOCKFILE"
}

trap release_lock EXIT
acquire_lock
```

### mkdir 방식 (원자적)

```bash
LOCKDIR="/tmp/${SCRIPT_NAME}.lock"

acquire_lock() {
  if mkdir "$LOCKDIR" 2>/dev/null; then
    echo $$ > "${LOCKDIR}/pid"
    trap 'rm -rf "$LOCKDIR"' EXIT
    log_info "락 획득"
  else
    local pid
    pid=$(cat "${LOCKDIR}/pid" 2>/dev/null || echo "unknown")
    log_error "이미 실행 중입니다 (PID: ${pid})"
    exit 1
  fi
}

acquire_lock
```

| 방식 | 장점 | 단점 |
|------|------|------|
| `flock` | 프로세스 종료 시 자동 해제 | Linux 전용 |
| `mkdir` | POSIX 호환, 원자적 생성 | 비정상 종료 시 수동 정리 필요 |
| PID 파일 | 단순 | 경쟁 조건(race condition) 가능성 |

---

## 10. 스크립트 성능 최적화

셸 스크립트의 병목은 대부분 **외부 프로세스 fork**다.
불필요한 fork를 줄이는 것이 핵심이다.

### fork 최소화 — 내장 명령(built-in) 우선

```bash
# ── 문자열 처리 ───────────────────────────────────────────────────────────────

# 나쁜 예: 외부 프로세스 fork
LENGTH=$(echo -n "$STR" | wc -c)
UPPER=$(echo "$STR" | tr '[:lower:]' '[:upper:]')
TRIMMED=$(echo "$STR" | sed 's/^ *//; s/ *$//')

# 좋은 예: 파라미터 확장 (fork 없음)
LENGTH="${#STR}"
UPPER="${STR^^}"
TRIMMED="${STR#"${STR%%[![:space:]]*}"}"

# ── 파일 처리 ─────────────────────────────────────────────────────────────────

# 나쁜 예: 루프 안에서 반복 fork
while IFS= read -r line; do
  RESULT=$(echo "$line" | sed 's/old/new/g')
  echo "$RESULT"
done < input.txt

# 좋은 예: sed 한 번 실행
sed 's/old/new/g' input.txt
```

### 서브셸 최소화

```bash
# 나쁜 예: 불필요한 서브셸
FILES=$(ls -1 /tmp/*.log)
for f in $FILES; do process "$f"; done

# 좋은 예: glob 직접 사용 (서브셸 없음)
for f in /tmp/*.log; do
  [[ -f "$f" ]] && process "$f"
done

# ❌ 나쁜 예: 파이프 — 서브셸이므로 배열이 부모 셸에 반영되지 않음
some_command | mapfile -t LINES   # 배열이 비어있음

# ✅ 올바른 방법 1: process substitution (서브셸 없음, Bash 4.0+)
mapfile -t LINES < <(some_command)

# ✅ 올바른 방법 2: 파일에서 직접 읽기
mapfile -t LINES < file.txt
```

### 반복 호출 캐싱

```bash
# 나쁜 예: 루프 안에서 반복 호출
for item in "${items[@]}"; do
  HOSTNAME=$(hostname)
  log_info "${HOSTNAME}: ${item}"
done

# 좋은 예: 루프 밖에서 한 번만
HOSTNAME=$(hostname)
for item in "${items[@]}"; do
  log_info "${HOSTNAME}: ${item}"
done
```

### 성능 비교 (참고용, 환경마다 다름)

> 아래 수치는 문자열 길이·반복 횟수·시스템에 따라 크게 달라진다.
> 절대값이 아닌 "built-in이 외부 명령보다 빠르다"는 방향성만 참고한다.

| 작업 | built-in / glob | 외부 명령 | 방향성 |
|------|-----------------|----------|--------|
| 문자열 길이 | `${#str}` | `wc -c` | 수십~수백× 빠름  |
| 대소문자 변환 | `${str^^}` | `tr` | 수십× 빠름 |
| 문자열 치환 | `${str//old/new}` | `sed` | 수십× 빠름 |
| 파일 목록 | glob `*.log` | `ls` | 수~수십× 빠름 |

---

## 11. 단위 테스트: bats-core

[bats-core](https://github.com/bats-core/bats-core)는 Bash
Automated Testing System으로, 셸 스크립트에 단위 테스트를
작성할 수 있게 한다.

### 설치

```bash
# npm (모든 플랫폼)
npm install -g bats

# Homebrew
brew install bats-core

# 소스에서 설치
git clone https://github.com/bats-core/bats-core.git
cd bats-core && ./install.sh /usr/local
```

### 테스트 작성

```bash
# tests/validate.bats
#!/usr/bin/env bats

# 테스트 대상 스크립트 로드
setup() {
  # 테스트마다 실행되는 초기화
  source "${BATS_TEST_DIRNAME}/../lib/validate.sh"
  TEST_TMPDIR="$(mktemp -d)"
}

teardown() {
  # 테스트마다 실행되는 정리
  rm -rf "$TEST_TMPDIR"
}

# ── 기본 테스트 구조: @test "설명" { ... } ───────────────────────────────────

@test "is_integer: 정수 반환 성공" {
  run is_integer "42"
  [ "$status" -eq 0 ]
}

@test "is_integer: 문자열 반환 실패" {
  run is_integer "abc"
  [ "$status" -ne 0 ]
}

@test "is_integer: 음수 허용" {
  run is_integer "-5"
  [ "$status" -eq 0 ]
}

@test "sanitize_path: traversal 차단" {
  run sanitize_path "../../etc/passwd" "/safe/base"
  [ "$status" -ne 0 ]
  [[ "$output" == *"허용되지 않은"* ]]
}

@test "임시 파일이 EXIT 시 삭제됨" {
  TMPFILE=$(mktemp)
  [ -f "$TMPFILE" ]

  # trap EXIT 등록
  trap "rm -f $TMPFILE" EXIT

  # 파일 존재 확인
  run ls "$TMPFILE"
  [ "$status" -eq 0 ]
}
```

### 실행 방법

```bash
# 단일 파일 실행
bats tests/validate.bats

# 디렉토리 전체 실행
bats tests/

# TAP 형식 출력 (CI용)
bats --tap tests/

# 병렬 실행 (bats-core 1.7+)
bats --jobs 4 tests/
```

### CI 통합

```yaml
# GitHub Actions
- name: Run bats tests
  run: |
    npm install -g bats
    bats --tap tests/
```

### bats 헬퍼 라이브러리

| 라이브러리 | 용도 |
|-----------|------|
| `bats-support` | 공통 헬퍼 함수 |
| `bats-assert` | `assert_output`, `assert_failure` 등 |
| `bats-file` | 파일 존재·내용 검증 |

```bash
# bats-assert 사용 예
load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'

@test "오류 메시지 확인" {
  run validate_env ""
  assert_failure
  assert_output --partial "environment 인자가 필요합니다"
}
```

---

## 종합 템플릿

위 모든 패턴을 통합한 프로덕션용 템플릿이다.

```bash
#!/usr/bin/env bash
# -*- coding: utf-8 -*-
# 설명: 배포 스크립트 — 프로덕션 베스트 프랙티스 적용
set -euo pipefail

# ── 상수 ──────────────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_FILE="/var/log/${SCRIPT_NAME%.*}_$(date +%Y%m%d).log"
readonly LOCKFILE="/var/run/${SCRIPT_NAME}.lock"

# ── 색상 ──────────────────────────────────────────────────────────────────────
[[ -t 2 ]] && {
  RED='\033[0;31m'; YELLOW='\033[0;33m'
  GREEN='\033[0;32m'; RESET='\033[0m'
} || {
  RED=''; YELLOW=''; GREEN=''; RESET=''
}

# ── 로거 ──────────────────────────────────────────────────────────────────────
log_info()  {
  printf "${GREEN}[%s] INFO  %s${RESET}\n" "$(date +%T)" "$*" >&2
}
log_warn()  {
  printf "${YELLOW}[%s] WARN  %s${RESET}\n" "$(date +%T)" "$*" >&2
}
log_error() {
  printf "${RED}[%s] ERROR %s${RESET}\n" "$(date +%T)" "$*" >&2
}

# ── 정리 함수 ─────────────────────────────────────────────────────────────────
TMPDIR_WORK=""

cleanup() {
  local ec=$?
  [[ -n "$TMPDIR_WORK" ]] && rm -rf "$TMPDIR_WORK"
  exec 200>&- 2>/dev/null || true
  rm -f "$LOCKFILE"
  [[ $ec -ne 0 ]] && log_error "비정상 종료 (code: $ec)"
  exit "$ec"
}

trap cleanup EXIT
trap 'log_error "오류: line ${LINENO}"' ERR

# ── 락 획득 ───────────────────────────────────────────────────────────────────
exec 200>"$LOCKFILE"
flock -n 200 || { log_error "이미 실행 중"; exit 1; }

# ── 임시 디렉토리 ─────────────────────────────────────────────────────────────
TMPDIR_WORK="$(mktemp -d /tmp/${SCRIPT_NAME%.*}.XXXXXX)"

# ── 검증 ──────────────────────────────────────────────────────────────────────
validate() {
  : "${1:?환경 인자 필요}"
  case "$1" in
    production|staging|development) ;;
    *) log_error "잘못된 환경: $1"; exit 1 ;;
  esac
  command -v kubectl &>/dev/null || {
    log_error "kubectl 없음"; exit 1
  }
}

# ── 메인 ──────────────────────────────────────────────────────────────────────
main() {
  local env="${1:-}"
  validate "$env"

  log_info "배포 시작: $env"
  # ... 실제 배포 로직
  log_info "배포 완료"
}

main "$@"
```

---

## 참고 자료

- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
  — 확인: 2026-04-17
- [ShellCheck 공식 문서 및 경고 목록](https://www.shellcheck.net/wiki/)
  — 확인: 2026-04-17
- [bats-core 공식 저장소](https://github.com/bats-core/bats-core)
  — 확인: 2026-04-17
- [Bash Reference Manual — Special Parameters](https://www.gnu.org/software/bash/manual/bash.html)
  — 확인: 2026-04-17
- [Bash Pitfalls (Greg's Wiki)](https://mywiki.wooledge.org/BashPitfalls)
  — 확인: 2026-04-17
- [Use the Unofficial Bash Strict Mode](http://redsymbol.net/articles/unofficial-bash-strict-mode/)
  — 확인: 2026-04-17
- [pure bash bible](https://github.com/dylanaraps/pure-bash-bible)
  — 확인: 2026-04-17
