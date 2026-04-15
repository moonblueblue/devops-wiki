---
title: "CPU 성능 분석 도구와 튜닝"
date: 2026-04-13
tags:
  - linux
  - cpu
  - performance
  - perf
  - tuning
  - container
  - devops
sidebar_label: "CPU 성능"
---

# CPU 성능 분석 도구와 튜닝

## 1. CPU 메트릭 이해

`/proc/stat`은 부팅 이후 누적된 CPU 시간을
jiffy 단위로 기록한다.
각 필드의 의미는 다음과 같다.

| 메트릭 | 설명 | 주의사항 |
|--------|------|----------|
| `user` | 유저 스페이스 실행 시간 | nice 0 기준 |
| `nice` | nice 우선순위 조정된 유저 프로세스 | nice > 0 |
| `system` | 커널 모드 실행 시간 | syscall 포함 |
| `idle` | 유휴 상태 (대기 I/O 없음) | 여유 용량 지표 |
| `iowait` | I/O 완료 대기 중 유휴 | CPU 문제 아님 |
| `irq` | 하드웨어 인터럽트 처리 | NIC 등 |
| `softirq` | 소프트웨어 인터럽트 처리 | 네트워크 스택 |
| `steal` | 하이퍼바이저가 빼앗은 시간 | VM 환경 |

### /proc/stat 활용률 계산

두 시점의 값을 비교하여 사용률을 계산한다.

```bash
# T1, T2 두 시점의 /proc/stat 읽기
cat /proc/stat | head -1
# cpu  12345 0 6789 98765 234 0 56 0 0 0

# 계산: delta_metric / delta_total * 100
# total = user+nice+system+idle+iowait+irq+softirq+steal
```

### /proc/loadavg 해석

```bash
cat /proc/loadavg
# 2.15 1.89 1.45 3/412 28956
# 1분  5분  15분 실행중/전체 마지막PID
```

Load Average는 R(실행) + D(비인터럽트 대기) 상태의
프로세스 수를 지수 감쇠 평균한 값이다.
Linux는 다른 Unix와 달리 D 상태도 포함한다.

| 조건 | 의미 |
|------|------|
| load < CPU 수 | 여유 용량 있음 |
| load = CPU 수 | 완전 활용 |
| load > CPU 수 | 과부하, 대기열 발생 |

---

## 2. 분석 도구

### top / htop

실시간 프로세스 모니터링 도구다.
상단에 CPU 상태 요약이 표시된다.

```bash
# top 상단 CPU 라인 해석
# %Cpu(s): 25.0 us, 5.0 sy, 0.0 ni, 65.0 id,
#           3.0 wa, 0.0 hi, 1.0 si, 1.0 st

# htop: 트리 뷰, 마우스 지원, 컬러 바
htop -t          # 트리 모드
htop -p 1234     # 특정 PID만 모니터링
```

### mpstat (코어별 분석)

sysstat 패키지에 포함되며
개별 코어의 사용률을 확인할 수 있다.

```bash
# 전체 CPU 코어별 1초 간격
mpstat -P ALL 1

# 출력 예시
# CPU  %usr  %sys  %iowait  %irq  %soft  %steal  %idle
#  0   45.0   5.0     2.0    0.5    1.0     0.0   46.5
#  1    2.0   1.0     0.0    0.0    0.0     0.0   97.0
```

특정 코어만 높은 사용률을 보이면
스레드 확장성 문제를 의심해야 한다.

### vmstat (시스템 전반)

CPU, 메모리, I/O를 한눈에 볼 수 있다.

```bash
vmstat 1 10

# 주요 컬럼
# r : 실행 대기 프로세스 수 (run queue)
# b : 비인터럽트 대기 프로세스 수
# us: user, sy: system, id: idle
# wa: iowait, st: steal
```

| 조건 | 진단 |
|------|------|
| `r` > CPU 수 | CPU 포화 |
| `b` 높음 | I/O 병목 |
| `wa` 높음 | 디스크 대기 |
| `st` 높음 | VM 자원 부족 |

### pidstat (프로세스별 분석)

프로세스 단위로 CPU 사용과
컨텍스트 스위칭을 분석한다.

```bash
# 프로세스별 CPU 사용률
pidstat -u 1

# 프로세스별 컨텍스트 스위칭
pidstat -w 1
# cswch/s: 자발적, nvcswch/s: 비자발적

# 스레드 단위 분석
pidstat -t -u 1
```

### sar (이력 데이터)

sadc가 수집한 이력 데이터를 조회한다.
과거 시점의 성능을 분석할 때 유용하다.

```bash
sar -u 1 10      # CPU 사용률
sar -q 1 10      # 로드 평균, 런 큐
sar -w 1 10      # 컨텍스트 스위칭, 프로세스 생성

# 과거 데이터 조회 (어제)
sar -u -f /var/log/sa/sa$(date -d yesterday +%d)
```

---

## 3. Load Average 해석

Load Average를 올바르게 해석하려면
CPU 수 대비 상대값으로 판단해야 한다.

```bash
# CPU 수 확인
nproc
# 또는
grep -c ^processor /proc/cpuinfo
```

### 진단 시나리오

| 시나리오 | Load Avg | CPU 수 | 분석 |
|----------|----------|--------|------|
| 정상 | 2.0 | 8 | 25% 활용 |
| 포화 | 8.5 | 8 | 프로세스 대기 발생 |
| I/O 대기 | 12.0 | 4 | D 상태 확인 필요 |
| 스파이크 | 1분>15분 | - | 최근 부하 급증 |

### Load Average가 높을 때 점검 순서

```bash
# 1단계: CPU vs I/O 구분
vmstat 1 5
# us+sy 높으면 → CPU 바운드
# wa 높으면    → I/O 바운드

# 2단계: D 상태 프로세스 확인
ps aux | awk '$8 ~ /D/'

# 3단계: 어떤 프로세스가 CPU 소비하는지
pidstat -u 1 5
```

---

## 4. 컨텍스트 스위칭

### 자발적 vs 비자발적

| 유형 | 원인 | 의미 |
|------|------|------|
| 자발적 (voluntary) | I/O, 락, sleep 대기 | I/O 병목 가능 |
| 비자발적 (involuntary) | 타임 슬라이스 만료 | CPU 경합 |

컨텍스트 스위칭 1회당 1~10 마이크로초 소요되며
TLB, L1/L2 캐시 무효화를 동반한다.

### 모니터링 방법

```bash
# 시스템 전체 (vmstat cs 컬럼)
vmstat 1

# 프로세스별
pidstat -w 1
# UID  PID  cswch/s  nvcswch/s  Command
#   0  1234   150.00      5.00  nginx

# 특정 프로세스 누적값
grep ctxt /proc/<PID>/status
# voluntary_ctxt_switches:    45230
# nonvoluntary_ctxt_switches:  1520

# perf로 측정
perf stat -e context-switches,cpu-migrations \
  -a sleep 10
```

### 진단 기준

| 지표 | 상황 | 대응 |
|------|------|------|
| cswch/s 높음 | I/O 대기, 락 경합 | I/O 최적화 |
| nvcswch/s 높음 | 스레드 과다 | 스레드 수 조정 |
| cpu-migrations 높음 | 코어 간 이동 잦음 | CPU 친화성 설정 |

---

## 5. 컨테이너 CPU 제한과 쓰로틀링

### CFS 대역폭 제어

Linux CFS(Completely Fair Scheduler)는 cgroup을 통해
CPU 시간을 quota/period 방식으로 제한한다.

```bash
# cgroup v1
cat /sys/fs/cgroup/cpu/<group>/cpu.cfs_quota_us
# -1 = 무제한, 100000 = 1 CPU

cat /sys/fs/cgroup/cpu/<group>/cpu.cfs_period_us
# 기본값: 100000 (100ms)

# cgroup v2
cat /sys/fs/cgroup/<group>/cpu.max
# "100000 100000"  → quota period 형식
```

### Kubernetes CPU 매핑

| K8s 설정 | cgroup v1 파라미터 | cgroup v2 파라미터 | 동작 |
|----------|--------------------|---------------------|------|
| `requests.cpu: 500m` | `cpu.shares: 512` | `cpu.weight: 20` | 비례 배분 (소프트) |
| `limits.cpu: 1` | `quota: 100000` | `cpu.max: 100000 100000` | 하드 캡 |
| `limits.cpu: 500m` | `quota: 50000` | `cpu.max: 50000 100000` | period당 50ms |
| `limits.cpu: 2` | `quota: 200000` | `cpu.max: 200000 100000` | period당 200ms |

> K8s 1.25+에서 cgroup v2가 기본이다.
> `cpu.shares`(v1)와 `cpu.weight`(v2)는 스케일이 다르다.

### 쓰로틀링 모니터링

quota가 소진되면 해당 그룹의 모든 스레드가
다음 period까지 실행을 멈춘다.

```bash
# 쓰로틀링 통계 확인
# cgroup v2 경로: /sys/fs/cgroup/<group>/cpu.stat
# cgroup v1 경로: /sys/fs/cgroup/cpu/<group>/cpu.stat
cat /sys/fs/cgroup/<group>/cpu.stat
# nr_periods 12345        # 총 기간 수
# nr_throttled 234        # 쓰로틀링 발생 횟수
# throttled_usec 5678000  # 총 쓰로틀링 시간 (us, cgroup v2)
# throttled_time 5678000  # 총 쓰로틀링 시간 (ns, cgroup v1)

# 쓰로틀링 비율 계산
# throttle_ratio = nr_throttled / nr_periods
# 5% 이상이면 limit 상향 검토
```

### 쓰로틀링 문제와 대응

| 문제 | 원인 | 대응 |
|------|------|------|
| 버스트 워크로드 | 짧은 CPU 스파이크 | limit 상향 |
| 멀티스레드 앱 | 스레드별 quota 소진 | period 조정 |
| 레이턴시 증가 | quota 소진 후 대기 | limit 제거, request만 사용 |

```bash
# bandwidth slice 조정 (기본 5ms)
cat /proc/sys/kernel/sched_cfs_bandwidth_slice_us
# 값을 늘리면 per-CPU 할당 단위 증가
```

---

## 6. perf와 Flame Graph

### perf stat: 하드웨어 카운터

CPU의 하드웨어 성능 카운터를 수집한다.
IPC(Instructions Per Cycle)로 효율을 판단한다.

```bash
# 기본 카운터
perf stat ./my_app
# 출력:
# 1,234,567  instructions  # 0.85 IPC
#   456,789  cache-misses
#    12,345  branch-misses

# 상세 모드
perf stat -d ./my_app

# 시스템 전체 5초간
perf stat -a sleep 5

# 특정 이벤트
perf stat -e context-switches,cpu-migrations,\
page-faults -a sleep 10
```

| IPC 값 | 의미 |
|---------|------|
| < 1.0 | 메모리/캐시 바운드 가능성 |
| 1.0~2.0 | 일반적 범위 |
| > 2.0 | 연산 집약적, 효율적 |

### perf top: 실시간 프로파일링

```bash
# 실시간 함수별 CPU 사용
perf top

# 샘플링 주파수와 출력 형식 지정
perf top -F 49 -ns comm,dso
```

### perf record / report: 기록 분석

```bash
# 30초간 전체 CPU 스택 기록 (99Hz)
perf record -F 99 -a -g -- sleep 30

# 결과 분석 (TUI)
perf report

# 텍스트 출력
perf report --stdio

# 원시 이벤트 덤프
perf script
```

### Flame Graph 생성

perf 데이터를 시각화하여
CPU 핫스팟을 직관적으로 파악한다.

```bash
# 1. 데이터 수집
perf record -F 99 -a -g -- sleep 60

# 2. 스택 변환 및 SVG 생성
git clone https://github.com/brendangregg/FlameGraph
perf script | ./FlameGraph/stackcollapse-perf.pl \
  | ./FlameGraph/flamegraph.pl > cpu-flame.svg
```

| 축 | 의미 |
|----|------|
| X축 (너비) | 샘플 비율 (넓을수록 CPU 시간 많음) |
| Y축 (높이) | 콜 스택 깊이 |
| 색상 | 무작위 (특별한 의미 없음) |

SVG를 브라우저에서 열면 클릭으로
특정 함수 하위 스택을 확대할 수 있다.

---

## 7. CPU 튜닝

### CPU Governor 설정

```bash
# 현재 거버너 확인
cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor

# 사용 가능한 거버너
cat /sys/devices/system/cpu/cpu0/cpufreq/\
scaling_available_governors
# performance powersave ondemand conservative schedutil
```

| 거버너 | 동작 | 용도 |
|--------|------|------|
| `performance` | 항상 최대 주파수 | 서버, 레이턴시 민감 |
| `powersave` | 항상 최저 주파수 | 전력 절약 |
| `schedutil` | 스케줄러 기반 동적 조절 | 최신 커널 기본값 |

```bash
# 모든 CPU를 performance로 설정
echo performance | sudo tee \
  /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### IRQ Affinity

네트워크 카드 등의 인터럽트를
특정 CPU에 고정하여 캐시 효율을 높인다.

```bash
# IRQ 번호 확인
cat /proc/interrupts | grep eth0

# IRQ를 CPU 0,1에 고정 (비트마스크 0x3, root 권한 필요)
echo 3 | sudo tee /proc/irq/<irq>/smp_affinity

# CPU 리스트로 설정
echo 0,1 > /proc/irq/<irq>/smp_affinity_list

# irqbalance 자동 분산 (기본 활성화)
systemctl status irqbalance
# 수동 튜닝 시 비활성화
systemctl stop irqbalance
```

### isolcpus (CPU 격리)

커널 스케줄러에서 특정 CPU를 제외하여
전용 워크로드에 할당한다.

```bash
# GRUB 설정
GRUB_CMDLINE_LINUX="isolcpus=2,3"
# Debian/Ubuntu: update-grub 후 재부팅
# RHEL/CentOS:   grub2-mkconfig -o /boot/grub2/grub.cfg
# ※ isolcpus 대신 cpuset cgroup 방식이 더 유연함 (Linux 5.x+)

# 격리된 CPU에 프로세스 고정
taskset -c 2,3 ./latency_critical_app

# 현재 프로세스 CPU 친화성 확인/변경
taskset -p <pid>
taskset -p -c 2,3 <pid>
```

### NUMA 최적화

NUMA 노드를 인식하여 메모리 접근 지연을 줄인다.
CPU와 메모리를 같은 노드에 배치하는 것이 핵심이다.

```bash
# NUMA 토폴로지 확인
numactl --hardware
# node 0 cpus: 0 1 2 3
# node 1 cpus: 4 5 6 7

# 특정 NUMA 노드에서 실행
numactl --cpunodebind=0 --membind=0 ./my_app

# NUMA 통계 확인
numastat
numastat -p <pid>
```

| 항목 | 설명 |
|------|------|
| `numa_hit` | 로컬 노드 할당 성공 |
| `numa_miss` | 원격 노드 할당 (느림) |
| `numa_foreign` | 다른 노드 요청이 이 노드에 할당 |

### 튜닝 체크리스트

```text
[ ] CPU governor → performance (서버 환경)
[ ] irqbalance 설정 또는 수동 IRQ 고정
[ ] NUMA 토폴로지 확인 및 노드 바인딩
[ ] 레이턴시 민감 워크로드 → isolcpus + taskset
[ ] 컨테이너 CPU limit → 쓰로틀링 모니터링
[ ] perf stat으로 IPC, 캐시 미스 확인
[ ] Flame Graph로 핫스팟 식별
```

---

## 참고 문서

- [Brendan Gregg - perf Examples](https://www.brendangregg.com/perf.html)
- [Brendan Gregg - CPU Flame Graphs](https://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html)
- [Brendan Gregg - Linux Load Averages](https://www.brendangregg.com/blog/2017-08-08/linux-load-averages.html)
- [Kernel Docs - CFS Bandwidth Control](https://docs.kernel.org/scheduler/sched-bwc.html)
- [Kernel Docs - CPU Load](https://docs.kernel.org/admin-guide/cpu-load.html)
- [Dan Luu - The Container Throttling Problem](https://danluu.com/cgroup-throttling/)
- [Red Hat - IRQ Balancing (RHEL 10)](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/network_troubleshooting_and_performance_tuning/tuning-irq-balancing)
