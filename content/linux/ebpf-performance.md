---
title: "eBPF 기반 성능 분석 입문"
date: 2026-04-13
tags:
  - linux
  - ebpf
  - bcc
  - bpftrace
  - performance
  - observability
sidebar_label: "eBPF 분석"
---

# eBPF 기반 성능 분석 입문

## 1. eBPF란

eBPF(extended Berkeley Packet Filter)는 커널 모듈 없이
커널 내부에서 안전하게 프로그램을 실행할 수 있는 기술이다.

```
사용자 코드 작성 (C / bpftrace)
    ↓ 컴파일 (LLVM/Clang)
바이트코드 생성
    ↓ 커널 Verifier 검증 (안전성 보장)
JIT 컴파일 → 네이티브 코드
    ↓ 커널 Attach 지점에 로드
이벤트 발생 시 실행 → 결과를 맵(Map)으로 사용자 공간 전달
```

### Attach 지점 비교

| 유형 | 대상 | 활용 |
|------|------|------|
| `tracepoint` | 커널 정적 계측 지점 | 안정적, 호환성 높음 |
| `kprobe` | 커널 함수 진입/리턴 | 동적, 모든 함수 가능 |
| `uprobe` | 유저스페이스 함수 | 앱 프로파일링 |
| `fentry/fexit` | BTF 기반 kprobe 대체 | **최신 권장** |
| `perf_event` | PMU 하드웨어 카운터 | CPU 프로파일링 |
| `XDP` | NIC 드라이버 수준 | 고성능 패킷 처리 |
| `LSM` | 보안 훅 | 런타임 보안 정책 |

### 커널 버전별 주요 기능

| 커널 | 추가된 기능 |
|------|-----------|
| 4.1 | kprobe, perf_event |
| 4.7 | tracepoint |
| 4.9 | cgroup eBPF |
| 5.2 | BTF (BPF Type Format) |
| 5.5 | fentry/fexit |
| 5.8 | ringbuf (perf buffer 대체) |
| 6.9 | BPF Token (권한 위임) |
| 6.12 | sched_ext (커스텀 스케줄러) |

---

## 2. BCC Tools

### 설치

```bash
# Ubuntu/Debian
apt install bpfcc-tools linux-headers-$(uname -r)

# RHEL/Rocky/AlmaLinux
dnf install bcc-tools kernel-devel

# 도구 위치
ls /usr/share/bcc/tools/
# biolatency  execsnoop  opensnoop  profile  runqlat ...
```

### 핵심 도구 모음

#### execsnoop — 프로세스 실행 추적

```bash
sudo execsnoop

# 출력 예시
# PCOMM   PID   PPID RET ARGS
# bash    12345  1234  0  /bin/bash
# curl    12346  12345 0  curl http://example.com
```

단명(short-lived) 프로세스를 잡을 때 유용하다.
`ps`로는 포착되지 않는 실행 이벤트를 모두 기록한다.

#### opensnoop — 파일 열기 추적

```bash
sudo opensnoop -p 1234    # 특정 프로세스만
sudo opensnoop -e         # 오류 발생 케이스만

# 출력 예시
# PID    COMM     FD ERR PATH
# 1234   nginx    23   0 /etc/nginx/nginx.conf
# 1234   nginx    -1   2 /tmp/missing.conf  ← ENOENT
```

#### biolatency — 디스크 I/O 지연 분포

```bash
# 30초간 블록 I/O 지연 히스토그램
sudo biolatency -m 30

# 출력 예시
# Tracing block device I/O... Hit Ctrl-C to end.
# msecs    : count    distribution
#  0 -> 1  : 8423   |********************|
#  2 -> 3  : 1234   |***                 |
#  4 -> 7  :  234   |                    |
# 16 -> 31 :   12   |                    |  ← 지연 스파이크
```

분포 꼬리(tail latency)가 두꺼우면 I/O 문제다.

#### runqlat — CPU 런큐 대기 지연

```bash
# 10초간 CPU 스케줄링 지연 분포
sudo runqlat 10 1

# usecs    : count    distribution
#  0 -> 1  : 45234  |********************|
#  2 -> 3  :  3421  |*                   |
# 64 -> 127:   123  |                    |  ← 스케줄링 지연
```

값이 수백 μs 이상이면 CPU 포화 또는 스케줄링 이슈다.

#### profile — CPU 샘플링 프로파일러

```bash
# 99Hz로 30초간 샘플링 후 Flame Graph 생성
sudo profile -F 99 -af 30 > out.stacks
git clone https://github.com/brendangregg/FlameGraph
./FlameGraph/flamegraph.pl out.stacks > cpu-flame.svg
```

#### tcpretrans — TCP 재전송 추적

```bash
sudo tcpretrans

# 출력 예시
# TIME     PID    IP LADDR:LPORT     T> RADDR:RPORT    STATE
# 10:23:45 0      4  10.0.0.1:80     R> 10.0.0.2:54321 ESTABLISHED
```

재전송이 특정 목적지로 집중되면 네트워크 경로 문제다.

#### tcplife — TCP 연결 수명 추적

```bash
sudo tcplife

# PID   COMM    LADDR        LPORT  RADDR        RPORT TX_KB RX_KB MS
# 1234  nginx   10.0.0.1     80     10.0.0.2     52134  0.1   2.5   23
```

연결별 전송량과 지속 시간을 한 줄로 확인할 수 있다.

#### ext4slower / xfsslower — 파일시스템 지연

```bash
# 10ms 이상 걸리는 ext4 작업 추적
sudo ext4slower 10

# TIME     COMM     PID   T  BYTES  OFF_KB  LAT(ms) FILENAME
# 10:23:45 mysqld   1234  R  4096   1024     15.3   ibdata1
```

#### syscount — 시스템콜 분포

```bash
# 프로세스별 시스템콜 Top 10
sudo syscount -P -i 5

# PID    COMM         COUNT
# 1234   nginx        45231
# 5678   mysqld       23451
```

---

## 3. bpftrace

### BCC vs bpftrace

| 항목 | BCC | bpftrace |
|------|-----|---------|
| 인터페이스 | Python/C | 스크립트 언어 |
| 학습 곡선 | 높음 | **낮음** |
| 즉석 분석 | 불편 | **one-liner 가능** |
| 복잡한 로직 | 가능 | 제한적 |
| 용도 | 프로덕션 도구 | **탐색/분석** |

### 설치

```bash
# Ubuntu
apt install bpftrace

# RHEL/Rocky
dnf install bpftrace
```

### 문법 기본 구조

```
probe /filter/ { action }
```

```bash
# 사용 가능한 프로브 목록
bpftrace -l 'tracepoint:syscalls:*'
bpftrace -l 'kprobe:tcp_*'
```

### 실무 One-liner

```bash
# 프로세스별 read() 시스템콜 횟수
bpftrace -e 'tracepoint:syscalls:sys_enter_read
  { @[comm] = count() }'

# 파일 열기 추적 (오류 포함)
bpftrace -e 'tracepoint:syscalls:sys_exit_openat
  /retval < 0/ { printf("%s: %s\n", comm, str(args->filename)) }'

# read() 지연 히스토그램 (μs 단위)
bpftrace -e '
  tracepoint:syscalls:sys_enter_read { @start[tid] = nsecs; }
  tracepoint:syscalls:sys_exit_read
  /@start[tid]/
  {
    @usecs = hist((nsecs - @start[tid]) / 1000);
    delete(@start[tid]);
  }'

# TCP 연결 시도 추적
bpftrace -e 'kprobe:tcp_connect
  { printf("%s → %s\n", comm, ntop(((struct sock*)arg0)->__sk_common.skc_daddr)) }'

# 10ms 이상 걸리는 디스크 I/O
bpftrace -e '
  tracepoint:block:block_rq_issue { @start[args->dev, args->sector] = nsecs; }
  tracepoint:block:block_rq_complete
  /@start[args->dev, args->sector]/
  {
    $ms = (nsecs - @start[args->dev, args->sector]) / 1000000;
    if ($ms > 10) { printf("I/O %dms\n", $ms); }
    delete(@start[args->dev, args->sector]);
  }'
```

---

## 4. Kubernetes 환경에서 eBPF

### Cilium — eBPF 기반 CNI

Cilium은 iptables를 eBPF로 대체하여
성능과 관찰성을 동시에 제공한다.

```bash
# Cilium 설치 (Helm)
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium --namespace kube-system \
  --set kubeProxyReplacement=true

# 상태 확인
cilium status
cilium connectivity test
```

### Hubble — Cilium 관찰성

```bash
# Hubble CLI 설치 후 네트워크 흐름 확인
hubble observe --last 100
hubble observe --namespace default --verdict DROPPED

# L7 HTTP 트래픽 관찰
hubble observe --protocol http
```

### kubectl-trace

```bash
# 설치
kubectl krew install trace

# 특정 Pod에서 bpftrace 실행
kubectl trace run pod/<pod-name> -e \
  'tracepoint:syscalls:sys_enter_read { @[comm] = count() }'
```

### 컨테이너 환경 제약사항

```yaml
# eBPF 사용을 위한 권한 설정
securityContext:
  capabilities:
    add:
      - BPF          # Linux 5.8+, eBPF 로드 전용
      - PERFMON      # Linux 5.8+, perf 이벤트 전용
      - SYS_ADMIN    # 레거시 방식 (과도한 권한)
```

| 방식 | 커널 요구사항 | 권한 | 권장 |
|------|-------------|------|------|
| `CAP_BPF + CAP_PERFMON` | 5.8+ | 최소 권한 | **권장** |
| `CAP_SYS_ADMIN` | 4.4+ | 과도한 권한 | 레거시 |
| privileged: true | - | 전체 권한 | 지양 |

---

## 5. 실무 시나리오

### CPU 병목 분석

```bash
# 1. 어떤 함수가 CPU를 소비하는지 샘플링
sudo profile -F 99 -af 30 > out.stacks

# 2. Flame Graph 생성
./FlameGraph/flamegraph.pl out.stacks > flame.svg

# 3. 브라우저에서 flame.svg 열기
# → 너비가 넓은 스택이 핫스팟
```

### 디스크 I/O 지연 분석

```bash
# 지연 분포 확인
sudo biolatency -m 30

# 느린 I/O 파일 특정
sudo biosnoop | awk '$5 > 10'  # 10ms 이상

# 파일시스템 레벨 확인
sudo ext4slower 5   # 5ms 이상
```

### 네트워크 지연 분석

```bash
# 재전송 실시간 추적
sudo tcpretrans

# 연결별 수명과 전송량
sudo tcplife

# 특정 포트 연결 추적
sudo tcpconnect -P 80,443
```

---

## 6. BTF / CO-RE (최신 개발 방식)

BTF(BPF Type Format)와 CO-RE(Compile Once - Run Everywhere)는
커널 버전마다 다시 컴파일 없이 eBPF 프로그램을 배포할 수 있게 한다.

```bash
# BTF 지원 여부 확인
ls /sys/kernel/btf/vmlinux   # 존재하면 BTF 지원 (5.2+)

# bpftool로 BTF 덤프
bpftool btf dump file /sys/kernel/btf/vmlinux format c \
  > vmlinux.h
```

| 방식 | 커널별 재컴파일 | 배포 용이성 |
|------|---------------|-----------|
| BCC (구방식) | 필요 | 어려움 |
| libbpf + CO-RE | **불필요** | **쉬움** |

---

## 7. 빠른 참조

```bash
# 무슨 시스템콜이 많은가?
sudo syscount -i 5

# 무슨 프로세스가 파일을 여는가?
sudo opensnoop

# CPU 어디서 쓰는가?
sudo profile -F 99 30 | head -20

# 디스크 어디서 느린가?
sudo biolatency -m 10

# CPU 런큐 대기 얼마나?
sudo runqlat 10 1

# TCP 재전송 어디로?
sudo tcpretrans

# 프로세스 실행 추적
sudo execsnoop
```

---

## 참고 문서

- [ebpf.io - 공식 eBPF 포털](https://ebpf.io/)
- [BCC Tools GitHub](https://github.com/iovisor/bcc)
- [bpftrace GitHub](https://github.com/iovisor/bpftrace)
- [Brendan Gregg - eBPF](https://www.brendangregg.com/ebpf.html)
- [Brendan Gregg - BCC Tutorial](https://github.com/iovisor/bcc/blob/master/docs/tutorial.md)
- [Cilium Docs](https://docs.cilium.io/en/stable/)
- [Kernel Docs - BPF](https://www.kernel.org/doc/html/latest/bpf/)
