---
title: "Bash 고급 문법 (배열, 함수, 파라미터 확장)"
sidebar_label: "Bash 고급 문법"
sidebar_position: 1
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - bash
  - shell
  - scripting
---

# Bash 고급 문법 (배열, 함수, 파라미터 확장)

스크립트가 복잡해질수록 Bash 내장 기능을 얼마나 잘 쓰느냐가  
유지보수성과 성능을 결정한다.  
이 글은 실무에서 자주 쓰이는 고급 문법을 체계적으로 정리한다.

---

## 1. 배열

### 인덱스 배열 (Indexed Array)

```bash
# 선언 방법 세 가지
fruits=("apple" "banana" "cherry")   # 직접 초기화
declare -a nums                        # 빈 배열 선언
nums[0]=10; nums[1]=20; nums[2]=30    # 인덱스 직접 할당

# 접근
echo "${fruits[0]}"       # apple
echo "${fruits[-1]}"      # cherry (Bash 4.3+, 마지막 원소)
echo "${fruits[@]}"       # 전체 원소 (각각 별도 단어)
echo "${fruits[*]}"       # 전체 원소 (하나의 문자열)
echo "${#fruits[@]}"      # 원소 개수: 3
echo "${!fruits[@]}"      # 인덱스 목록: 0 1 2

# 슬라이싱: ${array[@]:offset:length}
echo "${fruits[@]:1:2}"   # banana cherry
```

```bash
# 순회
for fruit in "${fruits[@]}"; do
  echo "$fruit"
done

# 인덱스와 값 함께
for i in "${!fruits[@]}"; do
  echo "$i: ${fruits[$i]}"
done
```

```bash
# 추가 / 삭제
fruits+=("date")          # 뒤에 추가
unset 'fruits[1]'         # 특정 인덱스 삭제 (빈 자리 유지)
fruits=("${fruits[@]}")   # 인덱스 재정렬 (빈 자리 제거)
unset fruits              # 배열 전체 삭제
```

### 연관 배열 (Associative Array) — Bash 4.0+

```bash
declare -A user
user[name]="alice"
user[uid]=1001
user[shell]="/bin/bash"

# 접근
echo "${user[name]}"      # alice
echo "${!user[@]}"        # 키 목록 (순서 비보장)
echo "${user[@]}"         # 값 목록

# 순회
for key in "${!user[@]}"; do
  printf "%-8s = %s\n" "$key" "${user[$key]}"
done

# 키 존재 확인
if [[ -v user[name] ]]; then
  echo "name 키 존재"
fi
```

| 구분 | 인덱스 배열 | 연관 배열 |
|------|------------|----------|
| 선언 | `arr=()` 또는 `declare -a` | `declare -A` 필수 |
| 키 타입 | 정수 (0부터) | 문자열 |
| 순서 보장 | O | X |
| Bash 버전 | 2+ | 4.0+ |
| 음수 인덱스 | 4.3+ 지원 | 해당 없음 |

---

## 2. 파라미터 확장 (Parameter Expansion)

### 기본값 / 대입 / 에러 처리

```bash
name=""
host="prod-server"

# ${var:-default}  : 미설정·빈값이면 default 반환 (var 변경 안 함)
echo "${name:-guest}"       # guest

# ${var:=default}  : 미설정·빈값이면 default를 var에 대입 후 반환
echo "${name:=guest}"       # guest  (name="guest" 로 설정됨)

# ${var:?message}  : 미설정·빈값이면 message 출력 후 스크립트 종료
: "${DB_HOST:?'DB_HOST is required'}"

# ${var:+value}    : 설정된 경우에만 value 반환 (var 변경 안 함)
echo "${host:+--host $host}"  # --host prod-server
```

### 문자열 길이 / 부분 문자열

```bash
path="/usr/local/bin/bash"

echo "${#path}"             # 문자열 길이: 20
echo "${path:5}"            # local/bin/bash  (offset 5부터)
echo "${path:5:5}"          # local           (offset 5, 길이 5)
echo "${path: -4}"          # bash            (끝에서 4자; 공백 필수)
echo "${path: -4:3}"        # bas
```

### 접두사 / 접미사 제거

```bash
file="archive.tar.gz"
path="/var/log/nginx/access.log"

# # : 최소 일치 (앞에서)
echo "${file#*.}"           # tar.gz

# ## : 최대 일치 (앞에서)
echo "${file##*.}"          # gz

# % : 최소 일치 (뒤에서)
echo "${file%.*}"           # archive.tar

# %% : 최대 일치 (뒤에서)
echo "${file%%.*}"          # archive

# 경로 추출 (dirname / basename 대체)
echo "${path%/*}"           # /var/log/nginx   (dirname)
echo "${path##*/}"          # access.log       (basename)
```

### 문자열 치환

```bash
text="hello world hello"

# ${var/pattern/replace}   : 첫 번째 일치만 치환
echo "${text/hello/hi}"    # hi world hello

# ${var//pattern/replace}  : 전체 일치 치환
echo "${text//hello/hi}"   # hi world hi

# ${var/#pattern/replace}  : 접두사 일치 치환
echo "${text/#hello/hi}"   # hi world hello

# ${var/%pattern/replace}  : 접미사 일치 치환
echo "${text/%hello/hi}"   # hello world hi

# 삭제: replace 생략
echo "${text//hello/}"     # " world "
```

### 대소문자 변환 — Bash 4.0+

```bash
str="Hello World"

echo "${str^}"    # Hello World (첫 글자 대문자)
echo "${str^^}"   # HELLO WORLD (전체 대문자)
echo "${str,}"    # hello World (첫 글자 소문자)
echo "${str,,}"   # hello world (전체 소문자)
```

### 파라미터 확장 전체 요약

| 구문 | 동작 |
|------|------|
| `${var:-val}` | 미설정/빈값 → val 반환 |
| `${var:=val}` | 미설정/빈값 → val 대입 후 반환 |
| `${var:?msg}` | 미설정/빈값 → msg 출력 후 exit |
| `${var:+val}` | 설정된 경우에만 val 반환 |
| `${#var}` | 문자열 길이 |
| `${var:n}` | offset n부터 끝까지 |
| `${var:n:m}` | offset n부터 m개 |
| `${var#pat}` | 접두사 최소 제거 |
| `${var##pat}` | 접두사 최대 제거 |
| `${var%pat}` | 접미사 최소 제거 |
| `${var%%pat}` | 접미사 최대 제거 |
| `${var/p/r}` | 첫 번째 p → r 치환 |
| `${var//p/r}` | 모든 p → r 치환 |
| `${var/#p/r}` | 접두사 p → r 치환 |
| `${var/%p/r}` | 접미사 p → r 치환 |
| `${var^}` | 첫 글자 대문자 |
| `${var^^}` | 전체 대문자 |
| `${var,}` | 첫 글자 소문자 |
| `${var,,}` | 전체 소문자 |

---

## 3. 함수

### 기본 정의와 지역 변수

```bash
# 두 가지 선언 방식 (기능 동일)
greet() { echo "Hello, $1"; }
function greet { echo "Hello, $1"; }

# local : 함수 스코프 한정
counter=0

increment() {
  local step="${1:-1}"   # 기본값 적용
  counter=$(( counter + step ))
  echo "counter=$counter"
}

increment 5    # counter=5
increment      # counter=6
```

### 반환값 처리

Bash 함수는 `return`으로 종료 상태(0–255)만 반환한다.  
실제 값을 돌려받으려면 아래 세 가지 패턴을 사용한다.

```bash
# 패턴 1: 명령 치환 (가장 일반적)
get_date() {
  date +%Y-%m-%d
}
today=$(get_date)

# 패턴 2: 전역 변수 (부작용 있음, 비권장)
parse_ip() {
  RESULT_IP="${1%%/*}"
}
parse_ip "192.168.1.1/24"
echo "$RESULT_IP"   # 192.168.1.1

# 패턴 3: nameref (Bash 4.3+, 가장 깔끔)
double() {
  local -n _ref="$1"   # nameref: _ref는 호출자 변수의 별칭
  _ref=$(( _ref * 2 ))
}
value=21
double value
echo "$value"   # 42
```

### 오류 처리와 early return

```bash
require_root() {
  if (( EUID != 0 )); then
    echo "ERROR: root 권한 필요" >&2
    return 1
  fi
}

deploy() {
  require_root || return 1

  local target="${1:?'배포 대상 필수'}"
  echo "Deploying to $target..."
}
```

### 재귀 함수

```bash
factorial() {
  local n="$1"
  if (( n <= 1 )); then
    echo 1
  else
    local sub
    sub=$(factorial $(( n - 1 )))
    echo $(( n * sub ))
  fi
}
echo "5! = $(factorial 5)"   # 5! = 120
```

---

## 4. 프로세스 치환 (Process Substitution)

`<(cmd)` 와 `>(cmd)` 는 명령의 출력·입력을 임시 파일처럼 다룬다.  
파이프와 달리 **서브셸을 공유하지 않아** 변수 변경이 상위 셸에 유지된다.

```bash
# <(cmd) : 명령 출력을 파일처럼 읽기
diff <(sort file1.txt) <(sort file2.txt)

# 두 명령 출력 동시 비교
comm -23 <(sort /etc/group | cut -d: -f1) \
         <(getent group   | cut -d: -f1)

# >(cmd) : 명령에 파일처럼 쓰기
tee >(gzip > access.log.gz) >(wc -l > count.txt) > /dev/null

# while 루프에서 변수 보존 (pipe는 서브셸이라 변수 소멸)
count=0
while IFS= read -r line; do
  (( count++ ))
done < <(grep "ERROR" /var/log/syslog)
echo "에러 수: $count"   # pipe 방식이면 0이 출력됨
```

| 방식 | 변수 보존 | 병렬 실행 | 임시 파일 |
|------|----------|----------|----------|
| 파이프 `\|` | X (서브셸) | O | X |
| 프로세스 치환 `<()` | O | O | /dev/fd/N |
| 임시 파일 | O | X | 수동 관리 |

---

## 5. 명령 그룹핑: `{}` vs `()`

```bash
# {} : 현재 셸에서 실행 (서브셸 아님)
#      마지막 명령 뒤 세미콜론 필수, 중괄호 내부 공백 필수
{
  cd /tmp
  touch test_file
  echo "pwd=$(pwd)"   # /tmp
}
echo "현재 디렉토리: $(pwd)"   # /tmp (cd 효과가 현재 셸에 반영됨)

# () : 서브셸에서 실행 (변수, 디렉토리 변경 격리)
(
  cd /tmp
  export TEMP_VAR="hello"
  echo "pwd=$(pwd)"    # /tmp
)
echo "현재 디렉토리: $(pwd)"   # 원래 디렉토리 유지
echo "${TEMP_VAR:-없음}"      # 없음 (서브셸 변수 소멸)
```

| 구분 | `{ }` | `( )` |
|------|-------|-------|
| 실행 환경 | 현재 셸 | 서브셸 (fork) |
| 변수 변경 | 상위에 영향 | 격리 |
| `cd` 효과 | 상위에 영향 | 격리 |
| 성능 | 빠름 | fork 비용 |
| 주 용도 | 리다이렉션 묶음 | 격리 실행, 병렬 |

```bash
# 실전: 그룹 리다이렉션
{
  echo "=== 시스템 정보 ==="
  uname -a
  uptime
  free -h
} > /tmp/report.txt 2>&1

# 실전: 백그라운드 병렬 실행
(sleep 2; echo "job1 done") &
(sleep 1; echo "job2 done") &
wait
echo "모든 작업 완료"
```

---

## 6. 리다이렉션 심화

### 파일 디스크립터 기본

```
0 = stdin   1 = stdout   2 = stderr
```

```bash
# 2>&1  : stderr를 stdout과 같은 곳으로
command > out.txt 2>&1     # stdout+stderr → out.txt
command 2>&1 | grep ERROR  # stderr를 pipe로 (순서 중요!)

# &>    : stdout+stderr를 한 번에 (Bash 전용)
command &> out.txt         # 위와 동일한 효과

# 1>&2  : stdout을 stderr로 (에러 메시지 출력에 활용)
echo "ERROR: 파일 없음" >&2

# /dev/null  : 출력 버림
command > /dev/null 2>&1
```

### tee — 표준 출력 분기

```bash
# 화면 출력하면서 파일에도 저장
make 2>&1 | tee build.log

# 여러 파일에 동시 저장
echo "log entry" | tee -a file1.log file2.log > /dev/null

# 프로세스 치환과 조합
command | tee >(grep ERROR > errors.log) \
             >(grep WARN  > warns.log)  \
             > full.log
```

### Here-doc (히어 도큐먼트)

```bash
# 기본: 변수 치환 O
cat <<EOF
Host: $(hostname)
Date: $(date)
User: $USER
EOF

# 인용: <<'EOF' — 변수 치환 없이 리터럴
cat <<'EOF'
echo $PATH    # 그대로 출력됨
EOF

# 인덴트 제거: <<- (탭 앞부분 제거, 스페이스는 제거 안 됨)
if true; then
  cat <<-EOF
    indent removed
    EOF
fi

# 파일 생성 실전 패턴
cat > /etc/myapp/config.ini <<EOF
[database]
host = ${DB_HOST:-localhost}
port = ${DB_PORT:-5432}
EOF
```

### Here-string

```bash
# <<< "string" : 단일 문자열을 stdin으로
read -r first last <<< "Alice Smith"
echo "$first"   # Alice

# 명령 입력으로 활용
grep "^root" <<< "$(cat /etc/passwd)"

# bc로 계산
result=$(bc <<< "scale=4; 355/113")
echo "$result"  # 3.1415
```

---

## 7. 배열 활용 실전 패턴

### mapfile / readarray

```bash
# 파일 한 줄씩 배열로
mapfile -t lines < /etc/hosts
echo "총 ${#lines[@]}줄"

# 명령 출력 → 배열
mapfile -t pids < <(pgrep nginx)

# 구분자 지정 (-d)
mapfile -td $'\n' entries < <(printf "a\nb\nc\n")
```

### 스택 (Stack)

```bash
stack=()

# push
stack+=("item1")
stack+=("item2")
stack+=("item3")

# pop
pop() {
  local -n _s="$1"
  local last_idx=$(( ${#_s[@]} - 1 ))
  local val="${_s[$last_idx]}"
  unset '_s[$last_idx]'
  echo "$val"
}

echo "$(pop stack)"   # item3
echo "peek: ${stack[-1]}"  # item2
```

### 큐 (Queue)

```bash
queue=()

enqueue() { queue+=("$1"); }
dequeue() {
  echo "${queue[0]}"
  queue=("${queue[@]:1}")   # 첫 원소 제거 후 재구성
}

enqueue "task1"
enqueue "task2"
dequeue   # task1
dequeue   # task2
```

---

## 8. 산술 확장

### `(( ))` vs `$(( ))` vs `let`

```bash
x=10; y=3

# $(( )) : 값을 반환 (변수 대입, echo에 사용)
echo $(( x + y ))          # 13
result=$(( x ** y ))       # 거듭제곱
echo $result               # 1000

# (( )) : 조건/부작용 평가 (반환값은 0/1 exit code)
(( x > y )) && echo "x가 크다"
(( x++ ))                  # 후위 증가
(( ++x ))                  # 전위 증가

# let : 오래된 방식, 피해도 됨
let "result = x * y"
```

### 산술 연산자 요약

| 연산자 | 의미 | 예시 |
|-------|------|------|
| `+` `-` `*` `/` | 사칙연산 | `$(( 10/3 ))` → 3 |
| `%` | 나머지 | `$(( 10%3 ))` → 1 |
| `**` | 거듭제곱 | `$(( 2**10 ))` → 1024 |
| `<<` `>>` | 비트 시프트 | `$(( 1<<3 ))` → 8 |
| `&` `\|` `^` `~` | 비트 연산 | `$(( 0xFF & 0x0F ))` → 15 |
| `++` `--` | 증감 (전위/후위) | `(( i++ ))` |
| `+=` `-=` `*=` | 복합 대입 | `(( x += 5 ))` |
| `?:` | 삼항 연산자 | `$(( x>0 ? x : -x ))` |

```bash
# 실수 계산: bash는 정수만 지원, bc/awk 활용
pi=$(echo "scale=10; 4*a(1)" | bc -l)
avg=$(awk "BEGIN {printf \"%.2f\", ($x+$y)/2}")
```

---

## 9. 조건문 심화: `[[ ]]` vs `[ ]`

### 핵심 차이

| 기능 | `[ ]` (test) | `[[ ]]` (Bash 확장) |
|------|-------------|-------------------|
| 표준 | POSIX | Bash/Zsh 전용 |
| 단어 분리 | 변수 인용 필수 | 불필요 |
| 패턴 매칭 | X | `=` / `!=` 로 glob 지원 |
| 정규식 매칭 | X | `=~` 지원 |
| `&&` / `\|\|` | `-a` / `-o` 사용 | `&&` / `\|\|` 직접 사용 |
| `<` `>` 문자열 비교 | `\<` 이스케이프 필요 | 그대로 사용 |

```bash
file="/var/log/access.log"
name="alice"

# 파일 조건
[[ -f "$file" ]] && echo "파일 존재"
[[ -d "/tmp" ]]  && echo "디렉토리"
[[ -r "$file" ]] && echo "읽기 가능"
[[ -s "$file" ]] && echo "비어있지 않음"
[[ -L "$file" ]] && echo "심볼릭 링크"

# 문자열 조건
[[ -z "$name" ]] && echo "빈 문자열"
[[ -n "$name" ]] && echo "비어있지 않음"
[[ "$name" == "alice" ]] && echo "일치"
[[ "$name" != "bob"   ]] && echo "불일치"
[[ "$name" < "bob"    ]] && echo "사전 앞"
```

### 패턴 매칭 (Glob)

```bash
filename="report-2026-04.csv"

# == 우측은 인용 없이 패턴으로 해석
if [[ "$filename" == *.csv ]]; then
  echo "CSV 파일"
fi

if [[ "$filename" == report-* ]]; then
  echo "리포트 파일"
fi

# case문과 동일한 패턴 사용 가능
case "$filename" in
  *.csv)  echo "CSV"  ;;
  *.log)  echo "LOG"  ;;
  *.json) echo "JSON" ;;
  *)      echo "기타"  ;;
esac
```

### 정규표현식 매칭 `=~`

```bash
line="2026-04-17 ERROR nginx: connection refused"

# =~ 우측은 ERE (Extended Regular Expression)
if [[ "$line" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2}) ]]; then
  echo "날짜: ${BASH_REMATCH[1]}"   # 2026-04-17
fi

# 캡처 그룹은 BASH_REMATCH 배열에 저장
#   BASH_REMATCH[0] : 전체 매칭
#   BASH_REMATCH[1] : 첫 번째 캡처 그룹
#   ...

# IPv4 검증
validate_ip() {
  local ip="$1"
  local octet='(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)'
  local pattern="^${octet}\\.${octet}\\.${octet}\\.${octet}$"
  [[ "$ip" =~ $pattern ]]
}

validate_ip "192.168.1.1"  && echo "유효"  # 유효
validate_ip "999.0.0.1"   && echo "유효"  # 출력 없음
```

---

## 10. 실전 예제

### IP 주소 추출

```bash
#!/usr/bin/env bash
# 인터페이스에서 IPv4 주소 추출

get_ip() {
  local iface="${1:-eth0}"
  local ip

  # ip 명령 사용 (현대적)
  # ⚠ ${$(...)} 중첩은 Bash에서 bad substitution — 임시 변수를 사용한다
  local _raw
  _raw=$(ip -4 addr show "$iface" 2>/dev/null \
         | awk '/inet / {print $2}' \
         | cut -d/ -f1)
  ip="${_raw:-}"

  # fallback: hostname
  if [[ -z "$ip" ]]; then
    ip=$(hostname -I | awk '{print $1}')
  fi

  echo "${ip:-unknown}"
}

# 로그에서 IP 주소 목록 추출 (중복 제거, 정렬)
extract_ips() {
  local file="$1"
  grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' "$file" |
    sort -u
}

# CIDR에서 넷마스크 계산
cidr_to_mask() {
  local -n _result="$1"
  local cidr="${2##*/}"
  local mask=0
  for (( i=0; i<cidr; i++ )); do
    (( mask |= 1 << (31-i) ))
  done
  _result=$(printf "%d.%d.%d.%d" \
    $(( (mask>>24)&0xFF )) \
    $(( (mask>>16)&0xFF )) \
    $(( (mask>>8)&0xFF  )) \
    $(( mask&0xFF       )))
}

netmask=""
cidr_to_mask netmask "192.168.1.0/24"
echo "$netmask"   # 255.255.255.0
```

### CSV 파싱

```bash
#!/usr/bin/env bash
# CSV 파일 파싱 (인용 필드 처리 포함)

parse_csv_line() {
  local line="$1"
  local -n _fields="$2"
  _fields=()

  local field=""
  local in_quote=0   # 0=false, 1=true (정수 플래그)
  local char

  for (( i=0; i<${#line}; i++ )); do
    char="${line:$i:1}"
    if [[ "$char" == '"' ]]; then
      if (( in_quote )) && [[ "${line:$((i+1)):1}" == '"' ]]; then
        field+='"'     # 이스케이프된 큰따옴표
        (( i++ ))
      else
        # 정수 플래그로 토글 (문자열 boolean은 명령 실행 오버헤드 + 버그 위험)
        (( in_quote = !in_quote ))
      fi
    elif [[ "$char" == "," ]] && (( !in_quote )); then
      _fields+=("$field")
      field=""
    else
      field+="$char"
    fi
  done
  _fields+=("$field")
}

# 간단한 CSV 처리 (인용 없는 경우)
process_simple_csv() {
  local file="$1"
  local -A totals=()

  while IFS=',' read -r name dept salary; do
    [[ "$name" == "name" ]] && continue   # 헤더 스킵
    totals[$dept]=$(( ${totals[$dept]:-0} + salary ))
  done < "$file"

  echo "=== 부서별 급여 합계 ==="
  for dept in $(echo "${!totals[@]}" | tr ' ' '\n' | sort); do
    printf "%-15s %'d\n" "$dept" "${totals[$dept]}"
  done
}
```

### 날짜 계산

```bash
#!/usr/bin/env bash
# 날짜 계산 유틸리티

# epoch 변환 (GNU date)
to_epoch() { date -d "$1" +%s 2>/dev/null; }
# macOS: date -j -f "%Y-%m-%d" "$1" +%s

# 두 날짜 간 일수 차이
days_between() {
  local d1 d2 e1 e2
  d1="$1"; d2="$2"
  e1=$(to_epoch "$d1")
  e2=$(to_epoch "$d2")
  echo $(( (e2 - e1) / 86400 ))
}

# N일 후 날짜
date_after() {
  local base="${1:-today}"
  local days="$2"
  date -d "$base + $days days" +%Y-%m-%d
}

# 주말 여부 확인
is_weekend() {
  local dow
  dow=$(date -d "$1" +%u)   # 1=Mon ... 7=Sun
  (( dow >= 6 ))
}

# 비즈니스 데이 N일 후
next_business_day() {
  local start="${1:-today}"
  local n="${2:-1}"
  local current="$start"
  local count=0

  while (( count < n )); do
    current=$(date_after "$current" 1)
    if ! is_weekend "$current"; then
      (( count++ ))
    fi
  done
  echo "$current"
}

# 사용 예시
echo "오늘부터 5 영업일 후: $(next_business_day today 5)"
echo "2026-01-01 ~ 오늘까지: $(days_between 2026-01-01 today)일"

# 로그 파일 90일 이상된 것 찾기
find_old_logs() {
  local log_dir="${1:-/var/log}"
  local days="${2:-90}"
  find "$log_dir" -name "*.log" -mtime +"$days" -type f
}
```

### 복합 예제: 서비스 헬스 체크 스크립트

```bash
#!/usr/bin/env bash
set -euo pipefail

declare -A SERVICES=(
  [nginx]="80"
  [redis]="6379"
  [postgres]="5432"
)
declare -A RESULTS=()

check_port() {
  local host="${1:-localhost}"
  local port="$2"
  timeout 3 bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null
}

run_checks() {
  local host="${1:-localhost}"
  local all_ok=true

  for svc in "${!SERVICES[@]}"; do
    local port="${SERVICES[$svc]}"
    if check_port "$host" "$port"; then
      RESULTS[$svc]="UP"
    else
      RESULTS[$svc]="DOWN"
      all_ok=false
    fi
  done

  $all_ok
}

print_report() {
  echo "=== 서비스 상태 보고 ($(date +%Y-%m-%dT%H:%M:%S)) ==="
  printf "%-15s %-8s\n" "SERVICE" "STATUS"
  printf "%-15s %-8s\n" "-------" "------"
  for svc in $(echo "${!RESULTS[@]}" | tr ' ' '\n' | sort); do
    local status="${RESULTS[$svc]}"
    local color
    [[ "$status" == "UP" ]] && color="\e[32m" || color="\e[31m"
    printf "${color}%-15s %-8s\e[0m\n" "$svc" "$status"
  done
}

if run_checks "${1:-localhost}"; then
  print_report
  exit 0
else
  print_report >&2
  exit 1
fi
```

---

## 참고 자료

| 제목 | URL | 확인 날짜 |
|------|-----|----------|
| Bash Reference Manual (GNU) | https://www.gnu.org/software/bash/manual/bash.html | 2026-04-17 |
| Advanced Bash-Scripting Guide | https://tldp.org/LDP/abs/html/ | 2026-04-17 |
| Bash Hackers Wiki — Parameter Expansion | https://wiki.bash-hackers.org/syntax/pe | 2026-04-17 |
| Google Shell Style Guide | https://google.github.io/styleguide/shellguide.html | 2026-04-17 |
| Bash Pitfalls (Greg's Wiki) | https://mywiki.wooledge.org/BashPitfalls | 2026-04-17 |
| ShellCheck — 정적 분석 도구 | https://www.shellcheck.net | 2026-04-17 |
