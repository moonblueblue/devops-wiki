---
title: "Bash 스크립트 기본 문법 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - bash
  - shell-script
  - devops
  - automation
sidebar_label: "Bash 스크립트"
---

# Bash 스크립트 기본 문법

## 1. Bash 스크립트 시작하기

### Shebang

스크립트 첫 줄에 인터프리터를 지정하는 선언이다.
`env`를 사용하면 PATH에서 bash를 자동으로 찾아
다양한 시스템에서 이식성을 확보할 수 있다.

| Shebang | 설명 |
|---------|------|
| `#!/bin/bash` | bash 절대 경로 직접 지정 |
| `#!/usr/bin/env bash` | PATH에서 bash 탐색 (권장) |

`#!/bin/bash`는 NixOS, FreeBSD 등
bash가 `/bin`에 없는 환경에서 실패할 수 있다.
`#!/usr/bin/env bash`를 기본으로 사용하자.

### 실행 권한 부여

```bash
chmod +x script.sh
./script.sh          # shebang에 따라 실행
bash script.sh       # 명시적 bash 실행 (shebang 무시)
```

### 기본 템플릿

```bash
#!/usr/bin/env bash
set -euo pipefail

main() {
    echo "Hello, World!"
}

main "$@"
```

`set -euo pipefail`은 이후 섹션 7에서 상세히 다룬다.
`main` 함수 패턴을 사용하면 코드 구조가 깔끔해진다.

---

## 2. 변수와 문자열

### 변수 선언

`=` 양옆에 **공백이 없어야** 한다.
변수 참조 시 `${VAR}` 형태를 권장한다.

```bash
NAME="world"              # 선언
echo "Hello, ${NAME}"     # 중괄호 확장 (권장)
readonly PI=3.14           # 읽기 전용 변수
```

### 기본값 (Parameter Expansion)

| 문법 | 동작 |
|------|------|
| `${VAR:-default}` | 미설정/빈값이면 default 반환 |
| `${VAR:=default}` | 미설정/빈값이면 default 대입 후 반환 |
| `${VAR:+alt}` | 설정되어 있으면 alt 반환 |
| `${VAR:?error}` | 미설정/빈값이면 에러 출력 후 종료 |

```bash
ENV="${ENV:-production}"
PORT="${PORT:=8080}"
DB_HOST="${DB_HOST:?DB_HOST 환경변수 필수}"
```

### 특수 변수

| 변수 | 설명 |
|------|------|
| `$0` | 스크립트 이름 |
| `$1`~`$9` | 위치 매개변수 |
| `$#` | 인자 개수 |
| `$@` | 모든 인자 (개별 단어로 확장) |
| `$?` | 마지막 명령의 종료 코드 |
| `$$` | 현재 셸 PID |
| `$!` | 마지막 백그라운드 프로세스 PID |

### 문자열 연산

```bash
STR="Hello World"
echo ${#STR}          # 길이: 11
echo ${STR:6}         # 부분 문자열: "World"
echo ${STR:0:5}       # 부분 문자열: "Hello"
```

### 패턴 제거와 치환

| 문법 | 설명 | 예시 결과 |
|------|------|-----------|
| `${VAR#pattern}` | 앞에서 최소 매칭 제거 | - |
| `${VAR##pattern}` | 앞에서 최대 매칭 제거 | - |
| `${VAR%pattern}` | 뒤에서 최소 매칭 제거 | - |
| `${VAR%%pattern}` | 뒤에서 최대 매칭 제거 | - |
| `${VAR/old/new}` | 첫 번째 매칭 치환 | - |
| `${VAR//old/new}` | 모든 매칭 치환 | - |

```bash
FILE="/home/user/deploy.sh"
echo ${FILE##*/}    # "deploy.sh"  (디렉토리 제거)
echo ${FILE%.*}     # "/home/user/deploy" (확장자 제거)

LOG="error:warn:error:info"
echo ${LOG//error/ERR}  # "ERR:warn:ERR:info"
```

### 배열

```bash
# 인덱스 배열
SERVERS=("web01" "web02" "db01")
echo ${SERVERS[0]}        # "web01"
echo ${SERVERS[@]}        # 모든 요소
echo ${#SERVERS[@]}       # 요소 개수: 3
SERVERS+=("db02")         # 요소 추가

# 연관 배열 (Bash 4+)
declare -A PORTS
PORTS[http]=80
PORTS[https]=443
echo ${PORTS[http]}       # 80
echo ${!PORTS[@]}         # 모든 키: http https
```

---

## 3. 조건문

### if / elif / else

```bash
if [[ -f "/etc/hosts" ]]; then
    echo "파일 존재"
elif [[ -d "/tmp" ]]; then
    echo "디렉토리 존재"
else
    echo "없음"
fi
```

### `[[ ]]` vs `[ ]`

| 항목 | `[ ]` (test) | `[[ ]]` (bash) |
|------|------------|----------------|
| 표준 | POSIX 호환 | Bash 전용 |
| 워드 스플리팅 | 발생 | 방지됨 |
| 패턴 매칭 | 불가 | `==` 글로브 지원 |
| 정규식 | 불가 | `=~` 지원 |
| 논리 연산 | `-a`, `-o` | `&&`, `\|\|` |

Bash 스크립트에서는 `[[ ]]`를 사용하는 것이 안전하다.
빈 변수로 인한 에러를 방지하고
정규식 매칭 등 확장 기능을 활용할 수 있다.

### 파일 테스트 연산자

| 연산자 | 설명 |
|--------|------|
| `-f` | 일반 파일 존재 |
| `-d` | 디렉토리 존재 |
| `-e` | 파일/디렉토리 존재 |
| `-r` | 읽기 권한 있음 |
| `-w` | 쓰기 권한 있음 |
| `-x` | 실행 권한 있음 |
| `-s` | 파일 크기가 0보다 큼 |
| `-L` | 심볼릭 링크 |

### 문자열 / 숫자 비교

```bash
# 문자열 비교
[[ -z "$VAR" ]]     # 빈 문자열인지
[[ -n "$VAR" ]]     # 비어있지 않은지
[[ "$A" == "$B" ]]  # 같은지
[[ "$A" != "$B" ]]  # 다른지
[[ "$A" =~ ^[0-9]+$ ]]  # 정규식 매칭

# 숫자 비교
[[ $X -eq $Y ]]     # 같음
[[ $X -ne $Y ]]     # 다름
[[ $X -gt $Y ]]     # 큼
[[ $X -lt $Y ]]     # 작음
[[ $X -ge $Y ]]     # 크거나 같음
[[ $X -le $Y ]]     # 작거나 같음
```

---

## 4. 반복문

### for 루프

```bash
# 리스트 순회
for item in apple banana cherry; do
    echo "$item"
done

# 배열 순회
HOSTS=("web01" "web02" "db01")
for host in "${HOSTS[@]}"; do
    echo "Checking ${host}..."
done

# C 스타일
for ((i=0; i<5; i++)); do
    echo "$i"
done

# 파일 순회
for file in /var/log/*.log; do
    echo "$(wc -l < "$file") lines: $file"
done
```

### while 루프

```bash
# 카운터
count=0
while [[ $count -lt 5 ]]; do
    echo "$count"
    ((count++))
done

# 파일 라인별 읽기
while IFS= read -r line; do
    echo "$line"
done < /etc/hosts

# 무한 루프 (모니터링 패턴)
while true; do
    check_health
    sleep 60
done
```

`while IFS= read -r line`은 파일을 한 줄씩
안전하게 읽는 표준 패턴이다.
`IFS=`는 앞뒤 공백 보존, `-r`은 역슬래시 해석 방지.

### until 루프

```bash
# 조건이 참이 될 때까지 반복
until [[ -f /tmp/ready ]]; do
    echo "대기 중..."
    sleep 1
done
```

---

## 5. 함수

### 선언과 호출

```bash
greet() {
    local name="${1:?Usage: greet <name>}"
    echo "Hello, ${name}!"
}

greet "DevOps"
```

`local`로 변수 스코프를 함수 내부로 제한한다.
함수 내 `local` 없이 선언하면 전역 변수가 된다.

### 반환값

```bash
# return은 0-255 정수만 가능 (종료 코드)
is_root() {
    [[ $(id -u) -eq 0 ]]
}

if is_root; then
    echo "root 사용자"
fi

# 문자열 반환은 echo + 명령 치환
get_ip() {
    hostname -I | awk '{print $1}'
}
MY_IP=$(get_ip)
echo "IP: ${MY_IP}"
```

| 반환 방식 | 용도 |
|-----------|------|
| `return N` | 종료 코드 (0=성공, 1-255=실패) |
| `echo` + `$()` | 문자열/데이터 반환 |
| 전역 변수 | 비권장, 부작용 위험 |

---

## 6. 입출력과 리다이렉션

### read

```bash
read -p "이름: " name
read -s -p "비밀번호: " password     # 입력 숨김
read -t 10 -p "10초 안에 입력: " val  # 타임아웃
```

### echo vs printf

```bash
echo "간단한 출력"

# printf는 포맷 지정 가능 (이식성 높음)
printf "%-10s %5d\n" "nginx" 80
printf "%-10s %5d\n" "ssh" 22
printf "%-10s %5d\n" "redis" 6379
```

출력 결과:

```text
nginx         80
ssh           22
redis       6379
```

포맷이 중요한 경우 `printf`를 권장한다.
`echo -e`는 일부 시스템에서 다르게 동작할 수 있다.

### Heredoc

```bash
# 변수 치환 가능
cat <<EOF
서버: ${HOSTNAME}
날짜: $(date +%Y-%m-%d)
EOF

# 변수 치환 없이 (따옴표로 감싸기)
cat <<'EOF'
그대로 출력: ${HOSTNAME}
EOF
```

### 리다이렉션

| 문법 | 설명 |
|------|------|
| `>` | stdout을 파일에 덮어쓰기 |
| `>>` | stdout을 파일에 추가 |
| `2>` | stderr를 파일에 쓰기 |
| `2>&1` | stderr를 stdout으로 합치기 |
| `&>` | stdout + stderr를 파일에 (bash) |
| `\|` | 파이프: 출력을 다음 명령 입력으로 |
| `\| tee file` | 화면 + 파일에 동시 출력 |

```bash
# 에러만 로그에 기록
./deploy.sh 2>> /var/log/deploy-error.log

# 전체 출력을 로그에 + 화면에
./deploy.sh 2>&1 | tee /var/log/deploy.log
```

### 명령 치환

```bash
# $() 방식 (권장)
TODAY=$(date +%Y-%m-%d)
FILE_COUNT=$(find /tmp -type f | wc -l)

# 중첩 가능
# readlink -f는 macOS(BSD)에서 미지원 → 이식성 필요 시 아래 사용
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
```

백틱(`` ` ``)은 중첩이 어렵고 가독성이 떨어지므로
`$()` 방식을 사용하자.

---

## 7. 에러 처리

### set -euo pipefail (Strict Mode)

프로덕션 스크립트에는 반드시 적용해야 하는 옵션이다.
예상치 못한 에러가 무시되는 것을 방지한다.

| 옵션 | 플래그 | 동작 |
|------|--------|------|
| `set -e` | errexit | 명령 실패 시 즉시 종료 |
| `set -u` | nounset | 미정의 변수 참조 시 에러 |
| `set -o pipefail` | pipefail | 파이프 중 하나라도 실패 시 실패 |
| `set -x` | xtrace | 디버그: 실행 명령 출력 |

```bash
#!/usr/bin/env bash
set -euo pipefail
```

### 종료 코드

| 코드 | 의미 |
|------|------|
| `0` | 성공 |
| `1` | 일반 에러 |
| `2` | 사용법 에러 |
| `126` | 실행 권한 없음 |
| `127` | 명령어 없음 |
| `128+N` | 시그널 N에 의한 종료 |

```bash
# 직접 종료 코드 설정
if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <arg>" >&2
    exit 2
fi
```

### trap

`trap`은 시그널이나 스크립트 종료 시
정리 작업을 보장하는 메커니즘이다.

```bash
cleanup() {
    rm -f /tmp/lockfile
    echo "정리 완료" >&2
}
trap cleanup EXIT

# 에러 위치 추적
trap 'echo "Error: line $LINENO: $BASH_COMMAND" >&2' ERR
```

| 시그널 | 트리거 |
|--------|--------|
| `EXIT` | 스크립트 종료 시 (항상 실행) |
| `ERR` | 명령 실패 시 |
| `SIGINT` | Ctrl+C |
| `SIGTERM` | kill 명령 |

### ShellCheck 활용

[ShellCheck](https://github.com/koalaman/shellcheck)는
Bash 스크립트의 정적 분석 도구다.
CI/CD 파이프라인에 통합하여 품질을 보장할 수 있다.

```bash
# 설치
brew install shellcheck        # macOS
apt install shellcheck         # Debian/Ubuntu

# 실행
shellcheck script.sh

# CI에서 경고 이상만 검사 (-S 또는 --severity 공백 구분)
shellcheck -S warning scripts/*.sh
```

---

## 8. 실전 패턴

### 서비스 헬스 체크

```bash
#!/usr/bin/env bash
set -euo pipefail

SERVICES=("nginx" "postgresql" "redis")
FAILED=0

for svc in "${SERVICES[@]}"; do
    if systemctl is-active --quiet "$svc"; then
        printf "%-15s [\033[32mOK\033[0m]\n" "$svc"
    else
        printf "%-15s [\033[31mFAIL\033[0m]\n" \
            "$svc" >&2
        FAILED=1
    fi
done

exit $FAILED
```

### 로그 에러 요약

```bash
#!/usr/bin/env bash
set -euo pipefail

LOG="${1:?Usage: $0 <logfile>}"

[[ -f "$LOG" ]] || {
    echo "파일 없음: $LOG" >&2; exit 1
}

TOTAL=$(grep -c "ERROR" "$LOG" || true)
echo "=== 에러 총 ${TOTAL}건 ==="

echo ""
echo "=== 상위 5개 에러 패턴 ==="
grep "ERROR" "$LOG" \
    | awk -F'ERROR' '{print $2}' \
    | sort | uniq -c | sort -rn \
    | head -5
```

### 배포 스크립트 뼈대

```bash
#!/usr/bin/env bash
set -euo pipefail

APP="${1:?Usage: $0 <app> <version>}"
VERSION="${2:?Usage: $0 <app> <version>}"
DEPLOY_DIR="/opt/${APP}"
BACKUP_DIR="/opt/backup/${APP}"
TS=$(date +%Y%m%d_%H%M%S)
LOG="/var/log/${APP}-deploy.log"

log() { printf "[%s] %s\n" "$(date +%T)" "$1"; }

cleanup() { log "정리 작업 수행"; }
trap cleanup EXIT

# 로그 파일 쓰기 가능 여부 사전 검증
touch "$LOG" 2>/dev/null || LOG="/tmp/${APP}-deploy.log"

log "배포 시작: ${APP} v${VERSION}" | tee -a "$LOG"

# 1) 백업
mkdir -p "${BACKUP_DIR}"
cp -a "${DEPLOY_DIR}" "${BACKUP_DIR}/${TS}"
log "백업 완료: ${BACKUP_DIR}/${TS}"

# 2) 배포
# docker pull "${APP}:${VERSION}"
# docker-compose up -d
log "배포 완료"

# 3) 헬스 체크
RETRY=0
until curl -sf http://localhost:8080/health \
    > /dev/null; do
    ((RETRY++))
    if [[ $RETRY -ge 5 ]]; then
        log "헬스 체크 실패, 롤백 시작" >&2
        cp -a "${BACKUP_DIR}/${TS}" "${DEPLOY_DIR}"
        exit 1
    fi
    sleep 2
done

log "헬스 체크 통과, 배포 성공"
```

---

> 참고:
> [GNU Bash Reference Manual](https://www.gnu.org/software/bash/manual/)
> | [ShellCheck](https://github.com/koalaman/shellcheck)
> | [Greg's Wiki](https://mywiki.wooledge.org/BashGuide)
> | [Best Practices](https://sharats.me/posts/shell-script-best-practices/)
