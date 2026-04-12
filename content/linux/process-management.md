---
title: "Linux 프로세스 관리 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - process
  - signals
  - monitoring
  - devops
  - troubleshooting
sidebar_label: "프로세스 관리"
---
format: md

# Linux 프로세스 관리

## 1. 프로세스 기본 개념

### PID와 프로세스 트리

커널은 모든 프로세스에 고유한 **PID**를 부여한다.
PID 1은 항상 init(systemd)이며
모든 프로세스의 최상위 부모다.

`fork()` 시스템 콜로 자식 프로세스가 생성되며,
부모의 PID가 자식의 **PPID**가 된다.

```bash
# 현재 셸의 PID/PPID 확인
echo "PID: $$, PPID: $PPID"

# 프로세스 트리 확인
pstree -p 1
```

### 프로세스 상태

`ps`의 STAT 컬럼에 표시되는 프로세스 상태:

| 상태 | 코드 | 설명 |
|------|------|------|
| Running | `R` | CPU 실행 중 또는 실행 대기 |
| Sleeping | `S` | I/O·시그널 대기 (인터럽트 가능) |
| Uninterruptible | `D` | 디스크 I/O 대기 (kill -9 불가) |
| Stopped | `T` | SIGSTOP으로 일시 중지 |
| Zombie | `Z` | 종료됐지만 부모가 wait() 안 함 |

**STAT 추가 문자:**

| 문자 | 의미 |
|------|------|
| `s` | 세션 리더 |
| `l` | 멀티스레드 |
| `+` | 포그라운드 프로세스 그룹 |
| `<` | 높은 우선순위 (nice < 0) |
| `N` | 낮은 우선순위 (nice > 0) |

```bash
# D 상태 프로세스 찾기 (I/O 병목 진단)
ps aux | awk '$8 ~ /D/ {print}'

# 좀비 프로세스 찾기
ps aux | awk '$8 ~ /Z/ {print}'
```

---

## 2. ps 명령어

### 주요 옵션

| 명령어 | 용도 |
|--------|------|
| `ps aux` | BSD 스타일, 전체 프로세스 |
| `ps -ef` | SysV 스타일, PPID 포함 |
| `ps -eLf` | 스레드 표시 |
| `ps -eo pid,...` | 커스텀 포맷 |
| `ps -p <PID> -o ...` | 특정 PID 상세 |

### 커스텀 포맷 예시

```bash
# 메모리 사용량 상위 20개
ps -eo pid,ppid,user,%cpu,%mem,stat,comm \
  --sort=-%mem | head -20

# CPU 사용량 기준 + nice 값 포함
ps -eo pid,ni,pri,%cpu,%mem,stat,comm \
  --sort=-%cpu | head -20

# 프로세스 실행 시간 확인
ps -eo pid,comm,etime --sort=-etime | head -20
```

### ps 출력 핵심 필드

| 필드 | 설명 |
|------|------|
| VSZ | 가상 메모리 크기 (할당 전체) |
| RSS | 실제 물리 메모리 (Resident Set) |
| TIME | 누적 CPU 시간 |
| STAT | 상태 코드 조합 |

---

## 3. top/htop 실시간 모니터링

### top 주요 단축키

| 키 | 동작 |
|----|------|
| `1` | CPU별 사용률 분리 표시 |
| `M` | 메모리 기준 정렬 |
| `P` | CPU 기준 정렬 |
| `c` | 커맨드 풀 경로 토글 |
| `H` | 스레드 표시 토글 |
| `k` | 프로세스 kill |
| `r` | renice (우선순위 변경) |
| `o` | 필터 추가 (예: COMMAND=java) |
| `W` | 설정 저장 (~/.toprc) |

```bash
# 배치 모드 (스크립트/자동화용)
top -bn1 | head -30

# 메모리 기준 정렬, 1회 실행
top -bn1 -o %MEM | head -20

# 특정 사용자/PID만 모니터링
top -u nginx
top -p 1234,5678
```

### htop

htop은 컬러 출력, 마우스 지원, 트리 뷰를 제공한다.
`F5`로 프로세스 계층을 시각화하고
`F9`으로 시그널을 직접 전송할 수 있다.

```bash
# 설치
sudo apt install htop    # Debian/Ubuntu
sudo dnf install htop    # RHEL/Fedora
```

---

## 4. 시그널과 프로세스 종료

### 주요 시그널

| 시그널 | 번호 | 용도 | 잡기 |
|--------|------|------|------|
| SIGTERM | 15 | Graceful shutdown | O |
| SIGKILL | 9 | 강제 종료 (정리 불가) | X |
| SIGHUP | 1 | 설정 리로드 (nginx 등) | O |
| SIGUSR1 | 10 | 앱 정의 동작 (로그 재오픈) | O |
| SIGSTOP | 19 | 프로세스 일시 중지 | X |
| SIGCONT | 18 | 중지된 프로세스 재개 | O |
| SIGINT | 2 | Ctrl+C 인터랙티브 종료 | O |
| SIGQUIT | 3 | 코어 덤프 생성 | O |
| SIGCHLD | 17 | 자식 종료 시 부모에 전달 | O |

### Graceful shutdown 패턴

```bash
# 항상 이 순서로 종료
kill <PID>           # 1단계: SIGTERM
sleep 10             # 2단계: 정리 대기
kill -9 <PID>        # 3단계: 응답 없으면 SIGKILL
```

### 실무 시그널 활용

```bash
# Nginx 설정 리로드 (무중단)
kill -HUP $(cat /var/run/nginx.pid)

# Nginx 로그 재오픈 (logrotate 후)
kill -USR1 $(cat /var/run/nginx.pid)

# Java thread dump 생성
kill -3 <JAVA_PID>

# 프로세스 일시 중지/재개 (디버깅)
kill -STOP <PID>
kill -CONT <PID>
```

### kill, killall, pkill

| 명령어 | 특징 | 예시 |
|--------|------|------|
| `kill` | PID 기준 | `kill -9 1234` |
| `killall` | 이름 정확 매칭 | `killall nginx` |
| `pkill` | 패턴 매칭 (가장 유연) | `pkill -f "python app"` |
| `pgrep` | pkill 문법으로 PID 조회 | `pgrep -la nginx` |

```bash
# pkill 주요 옵션
pkill -f "python app.py"   # 커맨드 전체 패턴
pkill -u deploy             # 특정 사용자
pkill -P 1234               # 특정 PPID의 자식

# pgrep으로 먼저 확인 후 kill (안전)
pgrep -la nginx
pkill nginx
```

> **주의**: `pkill -f`는 의도치 않은 프로세스도
> 매칭될 수 있다.
> 반드시 `pgrep -f`로 먼저 확인하라.

---

## 5. 프로세스 우선순위

### nice (CPU 스케줄링)

nice 값은 -20(최고) ~ 19(최저), 기본값 0이다.
일반 사용자는 0~19만 설정 가능하고
음수값은 root 권한이 필요하다.

```bash
# 낮은 우선순위로 실행 (백업, 빌드)
nice -n 19 tar czf backup.tar.gz /data
nice -n 10 make -j$(nproc)

# 실행 중인 프로세스 우선순위 변경
renice -n 15 -p <PID>
renice -n -5 -p $(pgrep mysqld)  # root

# 현재 nice 값 확인
ps -eo pid,ni,comm | grep nginx
```

### ionice (I/O 스케줄링)

| 클래스 | 번호 | 설명 |
|--------|------|------|
| Realtime | 1 | 최우선 I/O (신중히 사용) |
| Best-effort | 2 | 기본값, 우선순위 0-7 |
| Idle | 3 | 다른 I/O 없을 때만 실행 |

```bash
# I/O 부하 작업을 idle 클래스로
ionice -c 3 rsync -a /source/ /backup/

# CPU + I/O 모두 낮은 우선순위 (백업 최적)
nice -n 19 ionice -c 3 /usr/local/bin/backup.sh
```

### systemd에서 우선순위 설정

```ini
# /etc/systemd/system/backup.service
[Service]
Nice=19
IOSchedulingClass=idle
IOSchedulingPriority=7
CPUSchedulingPolicy=batch
```

---

## 6. 백그라운드 실행

### 기본 제어

```bash
./long-task.sh &        # 백그라운드 실행
jobs -l                  # 작업 목록 (PID 포함)

# 포그라운드/백그라운드 전환
Ctrl+Z                  # 현재 프로세스 중지
bg %1                   # 백그라운드에서 재개
fg %1                   # 포그라운드로 전환
```

### nohup: 로그아웃 후에도 실행

```bash
# 기본 사용 (출력 -> nohup.out)
nohup ./deploy.sh &

# 출력 리다이렉트 + PID 기록
nohup ./worker.sh > /var/log/worker.log 2>&1 &
echo $! > /var/run/worker.pid
```

### disown: 실행 중인 프로세스 분리

```bash
./long-task.sh
Ctrl+Z                  # 중지
bg                      # 백그라운드 재개
disown %1               # 셸에서 분리 (SIGHUP 면역)
```

### 도구 선택 기준

| 상황 | 추천 도구 |
|------|----------|
| 일회성 백그라운드 작업 | `nohup cmd &` |
| 이미 실행 중인 것 분리 | `disown` |
| 재접속 필요한 세션 | `tmux` / `screen` |
| 항상 실행 서비스 | `systemd` |
| 자동 재시작 필요 | `systemd (Restart=always)` |

### tmux/screen

```bash
# tmux
tmux new -s deploy      # 세션 생성
# 작업 수행 후...
Ctrl+B, D               # 세션 분리 (detach)
tmux attach -t deploy   # 재접속

# screen
screen -S deploy        # 세션 생성
Ctrl+A, D               # 분리
screen -r deploy        # 재접속
```

---

## 7. /proc 파일시스템

### 프로세스별 핵심 파일

| 경로 | 내용 |
|------|------|
| `/proc/<PID>/status` | 상태 요약 (이름, 메모리, 스레드) |
| `/proc/<PID>/fd/` | 열린 파일 디스크립터 |
| `/proc/<PID>/cmdline` | 실행 커맨드 라인 |
| `/proc/<PID>/environ` | 환경변수 |
| `/proc/<PID>/maps` | 가상 메모리 매핑 |
| `/proc/<PID>/limits` | 리소스 제한 |
| `/proc/<PID>/cwd` | 현재 작업 디렉토리 (심링크) |
| `/proc/<PID>/exe` | 실행 파일 경로 (심링크) |

```bash
PID=12345

# 주요 필드 빠르게 확인
grep -E "^(Name|State|VmRSS|VmSwap|Threads)" \
  /proc/$PID/status

# 열린 FD 개수
ls /proc/$PID/fd | wc -l

# 커맨드 라인 확인
cat /proc/$PID/cmdline | tr '\0' ' ' && echo

# 실제 메모리 사용량 (PSS)
awk '/^Pss:/ {sum+=$2} END {print sum " kB"}' \
  /proc/$PID/smaps
```

### 시스템 전체 정보

```bash
cat /proc/loadavg     # 로드 평균
cat /proc/meminfo     # 메모리 정보
cat /proc/uptime      # 가동 시간
```

### 실무 디버깅

```bash
# FD leak 감시 (개수가 계속 증가하면 leak)
watch -n 1 "ls /proc/$PID/fd | wc -l"

# 삭제된 파일 잡고 있는 FD 확인
ls -la /proc/$PID/fd | grep deleted
```

> 참고: [proc(5) 매뉴얼](https://man7.org/linux/man-pages/man5/proc.5.html)

---

## 8. 프로세스 제한 (ulimit, limits.conf)

### ulimit 명령어

| 옵션 | 항목 |
|------|------|
| `-n` | 열린 파일 수 (open files) |
| `-u` | 최대 프로세스 수 |
| `-v` | 가상 메모리 |
| `-c` | 코어 덤프 크기 |
| `-a` | 전체 소프트 제한 |
| `-aH` | 전체 하드 제한 |

```bash
# 현재 제한 확인
ulimit -a

# 임시 변경 (현재 셸만)
ulimit -n 65535
ulimit -c unlimited
```

### /etc/security/limits.conf (영구 설정)

```bash
# <domain>  <type>  <item>  <value>
nginx     soft    nofile    65535
nginx     hard    nofile    65535
*         soft    nproc     4096
*         hard    nproc     8192
@deploy   soft    nofile    65535
```

> **주의**: systemd 서비스는 limits.conf가 적용되지 않는다.
> 유닛 파일에서 직접 설정해야 한다.

```ini
# /etc/systemd/system/myapp.service
[Service]
LimitNOFILE=65535
LimitNPROC=4096
LimitCORE=infinity
```

### 시스템 전역 FD 제한

```bash
# 조회
cat /proc/sys/fs/file-max
cat /proc/sys/fs/file-nr   # 현재 사용량

# 영구 설정: /etc/sysctl.d/99-custom.conf
# fs.file-max = 2097152
# 적용: sudo sysctl -p
```

> 참고:
> [limits.conf(5)](https://man7.org/linux/man-pages/man5/limits.conf.5.html)

---

## 9. 좀비/고아 프로세스

### 좀비 프로세스 (Zombie, Z)

자식이 종료됐지만 부모가 `wait()`를 호출하지 않으면
프로세스 테이블에 PID와 종료 상태만 남는다.
누적되면 PID 고갈 위험이 있다 (기본 최대: 32768).

```bash
# 좀비 찾기
ps aux | awk '$8=="Z" || $8=="Z+"'

# 좀비의 부모 확인
ps -eo pid,ppid,stat,comm | awk '$3~/Z/'

# 좀비 개수
ps aux | awk '$8~/Z/' | wc -l
```

### 좀비 제거 방법

| 방법 | 명령어 |
|------|--------|
| 부모에 SIGCHLD 전송 | `kill -SIGCHLD <PPID>` |
| 부모 프로세스 종료 | `kill <PPID>` -> init가 입양 후 정리 |
| 근본 원인 수정 | 코드에서 SIGCHLD 핸들러 구현 |

### 고아 프로세스

부모가 먼저 종료된 프로세스는 init(PID 1)이 입양한다.
init가 주기적으로 `wait()`를 호출하므로
보통 문제가 되지 않는다.

### 컨테이너 환경 주의사항

컨테이너의 PID 1이 좀비를 수거하지 않으면 누적된다.
`tini` 또는 `dumb-init`을 PID 1로 사용하라.

```dockerfile
# tini 사용
RUN apt-get install -y tini
ENTRYPOINT ["tini", "--"]
CMD ["./myapp"]

# Docker 내장 init
# docker run --init myimage
```

---

## 10. 디버깅 도구 (strace, lsof)

### strace: 시스템 콜 추적

| 옵션 | 용도 |
|------|------|
| `-p <PID>` | 실행 중인 프로세스에 attach |
| `-f` | 자식 프로세스 포함 |
| `-e trace=network` | 네트워크 시스템 콜만 |
| `-e trace=file` | 파일 관련 시스템 콜만 |
| `-c` | 시스템 콜 통계 요약 |
| `-T` | 각 시스템 콜 소요 시간 |
| `-o <file>` | 파일에 기록 |

```bash
# 프로세스가 어디서 블록되는지 확인
strace -p <PID>

# 어떤 설정 파일을 읽는지
strace -e trace=open,openat -f ./myapp 2>&1 \
  | grep -E "\.conf|\.cfg|\.yaml"

# 시스템 콜 통계
strace -c -p <PID>
```

> **주의**: strace는 성능에 영향을 준다.
> 프로덕션에서는 짧게 사용하라.

### lsof: 열린 파일 조회

| 명령어 | 용도 |
|--------|------|
| `lsof -p <PID>` | 프로세스의 열린 파일 |
| `lsof -i :80` | 포트 사용 프로세스 |
| `lsof -i -P -n` | 모든 네트워크 연결 |
| `lsof +L1` | 삭제됐지만 FD 잡힌 파일 |
| `lsof +D /dir/` | 디렉토리 아래 열린 파일 |
| `lsof -u <user>` | 특정 사용자 파일 |

### 실무 조합

```bash
# 디스크 꽉 찼는데 du로 안 보일 때
# (삭제된 파일이 FD를 잡고 있음)
lsof +L1 | grep deleted | sort -k7 -rn | head

# 프로세스 네트워크 연결 상태
lsof -i -a -p <PID> -P -n

# 특정 포트 사용 확인
lsof -i TCP:443
```

> 참고:
> [strace(1)](https://man7.org/linux/man-pages/man1/strace.1.html),
> [lsof(8)](https://man7.org/linux/man-pages/man8/lsof.8.html)

---

## 11. OOM Killer

### 동작 원리

메모리 + swap이 고갈되면 커널의 OOM Killer가 활성화된다.
각 프로세스의 `oom_score`(0~1000)를 계산하고
가장 높은 점수의 프로세스를 SIGKILL로 종료한다.

```bash
# OOM kill 로그 확인
dmesg | grep -i "oom\|killed process"
journalctl -k | grep -i oom

# 프로세스별 oom_score 순위
for pid in /proc/[0-9]*/; do
  p=$(basename $pid)
  score=$(cat $pid/oom_score 2>/dev/null)
  name=$(cat $pid/comm 2>/dev/null)
  [ -n "$score" ] && echo "$score $p $name"
done | sort -rn | head -20
```

### oom_score_adj 조정

| 값 | 의미 |
|----|------|
| -1000 | OOM Killer 면제 |
| 0 | 기본값 |
| 1000 | 최우선 kill 대상 |

```bash
# 중요 프로세스 보호
echo -1000 > /proc/<PID>/oom_score_adj

# systemd 서비스에서 설정
# [Service]
# OOMScoreAdjust=-1000
```

### Kubernetes와 OOM

Kubernetes는 QoS 클래스에 따라 `oom_score_adj`를
자동 설정한다.

| QoS 클래스 | oom_score_adj | 조건 |
|-----------|---------------|------|
| Guaranteed | -997 | requests == limits (전부) |
| BestEffort | 1000 | requests/limits 미설정 |
| Burstable | 2~999 | requests < limits |

```bash
# Pod OOM kill 확인
kubectl describe pod <name> | grep -A5 "Last State"

# 노드 메모리 압박 확인
kubectl describe node <name> \
  | grep -A5 "Conditions"
```

### OOM 예방 전략

| 전략 | 설명 |
|------|------|
| 메모리 모니터링 | Prometheus + node_exporter |
| swap 설정 | K8s 환경은 비활성화 일반적 |
| 리소스 제한 | cgroup / systemd / K8s limits |
| overcommit 설정 | `vm.overcommit_memory` 조정 |

```bash
# overcommit 설정 확인
cat /proc/sys/vm/overcommit_memory
# 0: 휴리스틱(기본), 1: 항상 허용, 2: 제한

# OOM 시 재부팅 (클러스터 노드 빠른 복구)
# vm.panic_on_oom=1
# kernel.panic=10
```

> 참고:
> [proc(5) - oom_score](https://man7.org/linux/man-pages/man5/proc.5.html),
> [K8s Node Pressure Eviction][k8s-eviction]

[k8s-eviction]: https://kubernetes.io/docs/concepts/scheduling-eviction/node-pressure-eviction/
