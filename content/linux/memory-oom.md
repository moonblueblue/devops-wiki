---
title: "Linux 메모리 관리와 OOM Killer"
date: 2026-04-13
tags:
  - linux
  - memory
  - oom
  - cgroup
  - performance
  - kubernetes
sidebar_label: "메모리·OOM"
---

# Linux 메모리 관리와 OOM Killer

## 1. 메모리 구조 이해

### /proc/meminfo 핵심 필드

```bash
cat /proc/meminfo
```

| 필드 | 설명 | 실무 활용 |
|------|------|----------|
| `MemTotal` | 전체 물리 RAM (커널 예약 제외) | 기준값 |
| `MemFree` | 미사용 메모리 | 낮아도 정상 |
| `MemAvailable` | 실제 가용 메모리 추정값 | **가용량 판단 기준** |
| `Buffers` | 블록 I/O 버퍼 | 통상 20MB 이내 |
| `Cached` | 파일 페이지 캐시 | 재사용 가능 |
| `SReclaimable` | 회수 가능한 슬랩 캐시 | 회수 가능 |
| `CommitLimit` | 할당 허용 총량 | overcommit=2 시 사용 |
| `Committed_AS` | 현재 예약된 총량 | CommitLimit 초과 시 위험 |

> `MemFree`가 낮아도 `MemAvailable`이 충분하면 정상이다.
> 캐시는 필요 시 즉시 반환된다.

### free 명령어 해석

```bash
free -h
#               total   used   free  shared  buff/cache  available
# Mem:           15Gi   4.2Gi  1.1Gi   512Mi      9.7Gi      10Gi
# Swap:         2.0Gi   256Mi  1.7Gi
```

| 컬럼 | 계산 | 의미 |
|------|------|------|
| `used` | total - available | 실제 사용 중인 메모리 |
| `buff/cache` | Buffers + Cached + SReclaimable | 재사용 가능, 정상 |
| `available` | MemAvailable | **여유 판단의 기준** |

### RSS / VSZ / PSS / USS

| 지표 | 전체 명칭 | 특징 | 활용 |
|------|-----------|------|------|
| VSZ | Virtual Set Size | 가상 주소 전체, 과대 표현 | 참고만 |
| RSS | Resident Set Size | 물리 메모리 사용량, 공유 중복 포함 | 빠른 확인 |
| PSS | Proportional Set Size | 공유를 프로세스 수로 비례 배분 | **공정한 측정** |
| USS | Unique Set Size | 프로세스 고유 메모리만 | **메모리 릭 탐지** |

```bash
# RSS 빠른 확인
ps aux --sort=-%mem | head -10

# PSS/USS 정밀 측정 (smaps)
cat /proc/<PID>/smaps | grep -E "^(Pss|Private)"

# smem 도구 (별도 설치)
smem -r -k | head -10
```

---

## 2. 메모리 분석 도구

### vmstat (메모리 흐름)

```bash
vmstat 1 10
# procs  memory          swap  io     system  cpu
# r  b   swpd  free  buff cache  si  so  bi  bo  in  cs  us sy id wa
# 1  0  25600  1024  2048 8192    0   2   5  10  500 800  5  2 90  3
```

| 컬럼 | 주의 기준 |
|------|----------|
| `swpd` | 0 이상 + si/so > 0이면 현재 메모리 압박 (swpd만으로는 과거 스왑 사용 여부만 알 수 있음) |
| `si/so` | 0 이상이면 스왑 활성화, 성능 저하 |
| `b` | D 상태 프로세스, I/O 병목 |

### /proc/PID/status (프로세스별)

```bash
grep -E "^Vm|^Rss" /proc/<PID>/status
# VmRSS:   524288 kB    ← RSS (공유 포함)
# RssAnon:  409600 kB   ← 익명 페이지 (힙/스택)
# RssFile:  114688 kB   ← 파일 매핑 (라이브러리)
```

### pmap (메모리 매핑 상세)

```bash
# 확장 모드 - 매핑별 RSS 확인
pmap -x <PID>
# Address       Kbytes     RSS   Dirty Mode  Mapping
# 00007f8b3c000  102400   98304   4096 r--p  libc.so.6

# 합계만 확인
pmap -x <PID> | tail -1
```

### PSI (Pressure Stall Information)

```bash
cat /proc/pressure/memory
# some avg10=2.34 avg60=1.12 avg300=0.45 total=123456
# full avg10=0.12 avg60=0.05 avg300=0.02 total=5678
```

| 지표 | 의미 | 위험 신호 |
|------|------|----------|
| `some` | 일부 태스크가 메모리 대기 | avg60 > 10% |
| `full` | **모든 태스크가 동시 대기** | avg60 > 1% |

`full` 값이 높으면 실질적인 처리량 손실이 발생 중이다.

---

## 3. OOM Killer

### 동작 원리

```
메모리 할당 요청
    ↓
여유 메모리 부족
    ↓
페이지 회수 시도 (캐시 반환)
    ↓
회수 실패 → OOM Killer 발동
    ↓
oom_score가 가장 높은 프로세스 종료
```

### oom_score / oom_score_adj

```bash
# 프로세스의 OOM 점수 확인
cat /proc/<PID>/oom_score        # 0~2000, 높을수록 먼저 종료
cat /proc/<PID>/oom_score_adj    # -1000~+1000, 수동 조정

# 중요 프로세스 보호 (재부팅 전까지)
echo -1000 > /proc/<PID>/oom_score_adj
```

| oom_score_adj 값 | 효과 |
|-----------------|------|
| `-1000` | OOM killer로부터 **완전 보호** |
| `0` | 기본값 (메모리 사용량 기준) |
| `+1000` | 메모리 부족 시 **최우선 종료** |

### 영구 설정 (systemd 서비스)

```ini
# /etc/systemd/system/myapp.service
[Service]
OOMScoreAdjust=-500
```

### overcommit 정책

```bash
# 현재 설정 확인
cat /proc/sys/vm/overcommit_memory
cat /proc/sys/vm/overcommit_ratio
```

| overcommit_memory | 동작 | 용도 |
|------------------|------|------|
| `0` (기본) | 휴리스틱 검사 | 일반 서버 |
| `1` | 항상 허용 | HPC, 연구용 |
| `2` | 엄격 제한 | 금융, 안정성 최우선 |

```
# mode=2일 때 CommitLimit 계산
CommitLimit = Swap + RAM × (overcommit_ratio / 100)
# 기본: Swap + RAM × 50%
```

### OOM 발생 로그 확인

```bash
# 실시간 OOM 이벤트 확인
dmesg -T | grep -i "oom\|killed"

# 로그 예시
# [Mon Apr 13 10:23:45 2026] Out of memory: Kill process 1234
# (nginx) score 876 or sacrifice child
# [Mon Apr 13 10:23:45 2026] Killed process 1234 (nginx)
# total-vm:512kB, anon-rss:384kB, file-rss:0kB

# journald에서 확인
journalctl -k | grep -i oom
```

### OOM 방지 전략

```text
1. requests/limits 명확히 설정 (K8s 환경)
2. 중요 프로세스 oom_score_adj 낮추기
3. 메모리 릭 모니터링 (USS 추이 관찰)
4. swap 확보 (완충 역할)
5. PSI 알림으로 OOM 전에 감지
```

---

## 4. Swap와 메모리 압력

### vm.swappiness 튜닝

```bash
# 현재 값 확인
cat /proc/sys/vm/swappiness   # 기본값: 60

# 런타임 변경
sysctl -w vm.swappiness=10

# 영구 설정
echo "vm.swappiness=10" >> /etc/sysctl.d/99-memory.conf
sysctl -p /etc/sysctl.d/99-memory.conf
```

| swappiness | 동작 | 권장 환경 |
|-----------|------|----------|
| `0` | 극도로 스왑 억제 | 레이턴시 민감 |
| `10~20` | 스왑 최소화 | 데이터베이스 서버 |
| `60` | 기본값 | 일반 서버 |
| `100` | 적극적 스왑 | 메모리 절약 필요 |

### 페이지 폴트 모니터링

```bash
# 시스템 전체 page fault 추이 (/proc/vmstat 직접 확인 권장)
# vmstat의 10, 11번 컬럼은 in(인터럽트)/cs(컨텍스트 스위치)임 — page fault가 아님
grep -E "pgfault|pgmajfault" /proc/vmstat

# 특정 프로세스
ps -o min_flt,maj_flt -p <PID>

# /proc/vmstat에서 직접 확인
grep -E "pgfault|pgmajfault" /proc/vmstat
```

| 폴트 유형 | 설명 | 성능 영향 |
|----------|------|----------|
| Minor fault | 페이지 테이블 미매핑 (I/O 없음) | 경미 |
| Major fault | 디스크에서 페이지 로드 필요 | **심각** |

---

## 5. 컨테이너 메모리 관리

### cgroup v2 메모리 컨트롤러

```bash
# 현재 사용량
cat /sys/fs/cgroup/<group>/memory.current

# 한도 설정
cat /sys/fs/cgroup/<group>/memory.max     # 하드 한도 (OOM 발생)
cat /sys/fs/cgroup/<group>/memory.high    # 소프트 한도 (스로틀링)
cat /sys/fs/cgroup/<group>/memory.min     # 보호 메모리
```

| 파일 | 동작 | v1 대응 |
|------|------|--------|
| `memory.max` | 초과 시 OOM kill | `memory.limit_in_bytes` |
| `memory.high` | 초과 시 스로틀링 (OOM 없음) | `memory.soft_limit_in_bytes` |
| `memory.min` | 회수 불가 보호 영역 | 없음 |
| `memory.low` | 회수 우선순위 낮춤 | 없음 |

```bash
# OOM 이벤트 카운터
cat /sys/fs/cgroup/<group>/memory.events
# low 0
# high 3        ← high 초과 횟수
# max 1         ← max 초과 횟수
# oom 1         ← OOM killer 발동 횟수
# oom_kill 1
```

### Kubernetes 메모리 매핑

| K8s 설정 | cgroup 파라미터 | 동작 |
|---------|----------------|------|
| `requests.memory` | `memory.low` (v2, MemoryQoS alpha 활성 시) | 소프트 보호 |
| `limits.memory` | `memory.max` (v2) | 하드 한도 |

> `memory.low` 매핑은 MemoryQoS feature gate 활성화 필요
> (K8s 1.36 기준 alpha, 기본 비활성).
> 기본 상태에서 `requests.memory`는 스케줄링 기준으로만 사용된다.

```yaml
resources:
  requests:
    memory: "256Mi"   # 스케줄링 기준 + 소프트 보호
  limits:
    memory: "512Mi"   # 이 이상 사용 시 OOMKilled
```

### QoS 클래스와 축출 우선순위

| QoS 클래스 | 조건 | 노드 압박 시 축출 순서 |
|-----------|------|-------------------|
| `Guaranteed` | requests == limits (CPU+메모리 모두) | 마지막 |
| `Burstable` | requests < limits 또는 일부만 설정 | 중간 |
| `BestEffort` | requests/limits 없음 | **가장 먼저** |

### 컨테이너 OOM vs 노드 OOM

```
컨테이너 OOM:
  cgroup memory.max 초과
  → 컨테이너 내 프로세스만 kill
  → Pod 재시작 (OOMKilled)
  → kubectl describe pod에서 확인

노드 OOM:
  노드 전체 메모리 고갈
  → 커널 OOM killer가 oom_score 기반으로 선택
  → 예측 불가, 노드 불안정 가능
```

```bash
# 컨테이너 OOM 확인
kubectl describe pod <pod-name>
# Containers:
#   app:
#     Last State: Terminated
#       Reason: OOMKilled
```

---

## 6. Transparent Huge Pages

### THP 설정

```bash
# 현재 설정 확인
cat /sys/kernel/mm/transparent_hugepage/enabled
# [always] madvise never

# 변경 (런타임)
echo madvise > /sys/kernel/mm/transparent_hugepage/enabled
```

| 설정 | 동작 | 권장 환경 |
|------|------|----------|
| `always` | 전체 자동 적용 | 주의 (지연 스파이크) |
| `madvise` | 명시적 요청 영역만 | **일반 서버 권장** |
| `never` | 비활성화 | Redis, MongoDB |

```bash
# defrag 설정 (defer+madvise 권장)
echo defer+madvise > \
  /sys/kernel/mm/transparent_hugepage/defrag

# THP 사용량 모니터링
grep AnonHugePages /proc/meminfo
grep "^thp_" /proc/vmstat
```

---

## 7. 메모리 튜닝 체크리스트

```text
[ ] free -h로 MemAvailable 기준으로 여유 확인
[ ] si/so > 0 → 스왑 활성, 메모리 확보 필요
[ ] PSI full avg60 > 1% → 즉각 조치 필요
[ ] OOM 발생 시 dmesg로 score/프로세스 확인
[ ] 중요 서비스 oom_score_adj 낮추기 (-500 ~ -1000)
[ ] DB 서버 vm.swappiness=10 설정
[ ] THP → madvise 또는 never (DB 환경)
[ ] K8s Pod → Guaranteed QoS 클래스 우선 확보
[ ] 컨테이너 OOMKilled → limits 상향 또는 릭 조사
```

---

## 참고 문서

- [Kernel Docs - /proc/meminfo](https://man7.org/linux/man-pages/man5/proc_meminfo.5.html)
- [Kernel Docs - cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)
- [Kernel Docs - PSI](https://www.kernel.org/doc/html/latest/accounting/psi.html)
- [Kernel Docs - Transparent Hugepage](https://www.kernel.org/doc/html/latest/admin-guide/mm/transhuge.html)
- [Kernel Docs - sysctl vm](https://www.kernel.org/doc/Documentation/sysctl/vm.txt)
- [Kubernetes - 리소스 관리](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Brendan Gregg - Linux Performance](https://www.brendangregg.com/linuxperf.html)
