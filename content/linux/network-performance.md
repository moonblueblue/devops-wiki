---
title: "Linux 네트워크 성능 분석"
date: 2026-04-13
tags:
  - linux
  - network
  - performance
  - tcp
  - tuning
  - kubernetes
sidebar_label: "네트워크 성능"
---

# Linux 네트워크 성능 분석

## 1. 네트워크 성능 지표

### 핵심 지표 정의

| 지표 | 설명 | 측정 도구 |
|------|------|----------|
| **Bandwidth** | 링크의 최대 전송 용량 (물리적 한계) | ethtool |
| **Throughput** | 실제 전송 데이터량 (MB/s) | iperf3, sar |
| **Latency** | 왕복 지연 시간 (ms) | ping, mtr |
| **Packet Loss** | 손실된 패킷 비율 (%) | ping -c, mtr |
| **Retransmit** | TCP 재전송 횟수 | ss -ti, /proc/net/snmp |

### /proc/net/dev 필드

```bash
cat /proc/net/dev
# Inter-|   Receive                               |  Transmit
#  face |bytes packets errs drop fifo frame multi  |bytes packets errs drop
#   eth0: 123456  1234    0    2    0     0     0    654321   4321    0    0
```

| 필드 | 방향 | 의미 |
|------|------|------|
| `bytes` | RX/TX | 누적 바이트 수 |
| `packets` | RX/TX | 누적 패킷 수 |
| `errs` | RX/TX | 오류 패킷 수 |
| `drop` | RX/TX | **드롭된 패킷 수** (0이어야 정상) |
| `fifo` | RX/TX | FIFO 버퍼 오류 수 |

```bash
# 인터페이스별 통계 (1초 간격)
ip -s link show eth0

# sar로 이력 데이터
sar -n DEV 1 10
# rxpck/s  txpck/s  rxkB/s  txkB/s  rxdrop/s  txdrop/s
```

---

## 2. 분석 도구

### ss (소켓 통계)

```bash
# TCP 소켓 전체 (프로세스 포함)
ss -tnp

# 연결 상태별 요약
ss -s
# Total: 1234, TCP: 456 (estab 200, closed 100, ...)

# 확장 정보 (재전송, RTT 포함)
ss -ti
# cubic wscale:7,7 rto:204 rtt:0.8/0.4
# retrans:0/2  lost:0  rcv_space:65536

# Recv-Q / Send-Q 확인 (헤더 제외, Recv-Q=$3 Send-Q=$4)
ss -tn | awk 'NR>1 && ($3 > 0 || $4 > 0)'
```

| 컬럼 | 의미 | 주의 기준 |
|------|------|----------|
| `Recv-Q` | 수신됐으나 앱이 읽지 않은 바이트 | 지속적으로 높으면 앱 처리 지연 |
| `Send-Q` | 송신됐으나 ACK 안 받은 바이트 | 높으면 네트워크 혼잡 또는 수신측 느림 |

### iperf3 (대역폭 측정)

```bash
# 서버 측
iperf3 -s

# 클라이언트 측 (TCP, 10초)
iperf3 -c <server-ip> -t 10

# UDP 대역폭 + 패킷 손실
iperf3 -c <server-ip> -u -b 1G

# 역방향 (서버→클라이언트)
iperf3 -c <server-ip> -R

# 병렬 스트림 (멀티 코어 활용)
iperf3 -c <server-ip> -P 4
```

**출력 해석:**

```
[ ID] Interval       Transfer    Bitrate         Retr
[  5]  0.00-10.00s   1.09 GBytes  938 Mbits/sec    3  sender
[  5]  0.00-10.00s   1.09 GBytes  936 Mbits/sec       receiver

# Retr=3 → TCP 재전송 3회 발생, 네트워크 품질 확인 필요
```

### mtr (경로 분석)

```bash
# 경로별 패킷 손실/지연 분석
mtr --report --report-cycles 100 8.8.8.8

# 출력 예시
# Host              Loss%  Snt  Last  Avg  Best  Wrst  StDev
# 1. 192.168.1.1    0.0%   100  0.5  0.6   0.4   1.2   0.1
# 2. 10.0.0.1       0.0%   100  2.1  2.3   1.9   5.4   0.4
# 3. 203.0.113.1   12.0%   100  8.5  9.2   7.8  45.2   3.1
```

`Loss%` 가 특정 홉부터 시작하면 그 구간이 병목이다.

### tcpdump (패킷 캡처)

```bash
# 특정 호스트와의 TCP 트래픽
tcpdump -i eth0 -nn host 10.0.0.1

# 포트 필터링
tcpdump -i eth0 -nn port 443

# pcap 파일로 저장 후 Wireshark 분석
tcpdump -i eth0 -w capture.pcap -c 10000

# SYN 패킷만 (연결 시도)
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# RST 패킷 (연결 강제 종료)
tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0'
```

---

## 3. TCP 성능 튜닝

### 버퍼 크기

TCP 버퍼는 BDP(Bandwidth-Delay Product)를 기준으로 설정한다.

```
BDP = 대역폭(bps) × RTT(s)
예: 10Gbps × 0.001s = 10Mb = 1.25MB
```

```bash
# 현재 설정 확인
sysctl net.ipv4.tcp_rmem net.ipv4.tcp_wmem
sysctl net.core.rmem_max net.core.wmem_max

# 고성능 서버 권장 설정
cat >> /etc/sysctl.d/99-network.conf << 'EOF'
# TCP 버퍼 (min default max)
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.core.netdev_max_backlog = 250000
EOF
sysctl -p /etc/sysctl.d/99-network.conf
```

### TCP Congestion Control

```bash
# 현재 설정 확인
sysctl net.ipv4.tcp_congestion_control

# 사용 가능한 알고리즘
sysctl net.ipv4.tcp_available_congestion_control
```

| 알고리즘 | 특징 | 권장 환경 |
|---------|------|----------|
| `cubic` | 기본값, 손실 기반 | 일반 서버 |
| `bbr` | 대역폭+RTT 기반, 높은 처리량 | **고대역폭, 고RTT 환경** |

```bash
# BBR 활성화 (Linux 4.9+)
echo "net.core.default_qdisc = fq" >> /etc/sysctl.d/99-network.conf
echo "net.ipv4.tcp_congestion_control = bbr" >> /etc/sysctl.d/99-network.conf
sysctl -p /etc/sysctl.d/99-network.conf

# 적용 확인
sysctl net.ipv4.tcp_congestion_control
```

### 연결 백로그 및 TIME_WAIT

```bash
# Listen 백로그 (Linux 5.4+: 기본값 4096, 이전: 128)
sysctl net.core.somaxconn
sysctl net.ipv4.tcp_max_syn_backlog

# TIME_WAIT 소켓 재사용 (Linux 4.12에서 tcp_tw_recycle 제거됨)
sysctl net.ipv4.tcp_tw_reuse     # 1 권장 (아웃바운드만)
sysctl net.ipv4.tcp_fin_timeout  # 기본 60초 → 15~30으로 줄이기
```

| 파라미터 | 기본값 | 권장값 | 효과 |
|---------|--------|--------|------|
| `somaxconn` | 4096 (5.4+) | 65535 | 연결 대기열 확장 |
| `tcp_fin_timeout` | 60 | 15 | TIME_WAIT 단축 |
| `tcp_tw_reuse` | 2 (4.12+, loopback only) | 1 (아웃바운드 전체, NAT 환경 주의) | TIME_WAIT 소켓 재사용 |

---

## 4. 컨테이너/Kubernetes 네트워크

### 오버헤드 구조

```
Pod A → veth → bridge → veth → Pod B  (동일 노드)
Pod A → veth → bridge → eth0 → 물리망 → Pod B  (다른 노드)
Pod A → veth → overlay(VXLAN) → Pod B  (오버레이 CNI)
```

| 통신 경로 | 오버헤드 | 비고 |
|----------|---------|------|
| 동일 Pod 내 컨테이너 | 없음 (loopback) | |
| 동일 노드 Pod 간 | 낮음 (veth+bridge) | |
| 다른 노드 Pod 간 (native) | 낮음 (L3 라우팅) | Calico BGP 등 |
| 다른 노드 Pod 간 (overlay) | 중간 (VXLAN encap) | Flannel, Weave |

### CNI별 성능 특성

| CNI | 방식 | 성능 | 특징 |
|-----|------|------|------|
| Flannel | VXLAN overlay | 보통 | 단순, 소규모 적합 |
| Calico | BGP (native L3) | **높음** | 확장성 우수, NetworkPolicy |
| Cilium | eBPF | **최고** | iptables 우회, 관찰성 |
| Weave | overlay | 보통 | ⚠️ 2023년 이후 사실상 유지보수 중단, 신규 사용 비권장 |

### iptables vs IPVS

Kubernetes Service는 kube-proxy가 iptables 또는 IPVS로 구현한다.
K8s 1.29+에서는 nftables 모드(GA: 1.33+)가 더 나은 대안으로 권장된다.

| 항목 | iptables | IPVS |
|------|---------|------|
| 규칙 조회 | O(n) 순차 | **O(1)** 해시 |
| Service 5,000개 | 느려짐 | 영향 없음 |
| 로드밸런싱 알고리즘 | round-robin만 | rr, lc, sh 등 |
| 전환 기준 | Service < 1,000 | **Service ≥ 1,000 권장** (K8s 1.35부터 deprecated) |

```bash
# IPVS 모드 확인
kubectl get configmap kube-proxy -n kube-system -o yaml \
  | grep mode

# IPVS 규칙 확인
ipvsadm -Ln
```

---

## 5. 네트워크 문제 진단

### 진단 흐름

```
성능 저하 감지
    ↓
ip -s link → RX/TX drop 확인
    ↓ drop 없음
ss -s → 연결 상태 확인 (TIME_WAIT 과다?)
    ↓
ss -ti → 재전송(retrans) 확인
    ↓ 재전송 있음
mtr → 경로별 패킷 손실 위치 확인
    ↓
tcpdump → 패킷 레벨 원인 분석
```

### 패킷 드롭 위치별 원인

```bash
# NIC 레벨 드롭 (링 버퍼 부족)
ip -s link show eth0 | grep -A2 RX
# RX: bytes packets errors dropped overrun mcast

# 소프트웨어 레벨 드롭
cat /proc/net/softnet_stat
# 컬럼 3(dropped): 값 증가 시 net.core.netdev_max_backlog 늘리기
```

### TIME_WAIT 과다

```bash
# TIME_WAIT 소켓 수 확인
ss -s | grep TIME-WAIT

# 많을 때 조치
sysctl -w net.ipv4.tcp_tw_reuse=1
sysctl -w net.ipv4.tcp_fin_timeout=15
```

### TCP 재전송 확인

```bash
# 인터페이스별 재전송 통계
cat /proc/net/snmp | grep Tcp
# RetransSegs: 누적 재전송 수

# 소켓별 재전송 실시간
ss -ti | grep retrans
# retrans:0/5 → 현재 활성 재전송 0회, 누적 재전송 5회
```

---

## 6. NIC 하드웨어 튜닝

### Ring Buffer 조정

```bash
# 현재 링 버퍼 크기 확인
ethtool -g eth0
# Pre-set maximums: RX: 4096  TX: 4096
# Current hardware settings: RX: 256  TX: 256

# 최대값으로 설정 (패킷 드롭 감소)
ethtool -G eth0 rx 4096 tx 4096
```

### NIC Offload 설정

```bash
# 현재 오프로드 기능 확인
ethtool -k eth0

# 주요 오프로드 기능
# tx-checksumming: TX 체크섬 계산을 NIC에 위임
# scatter-gather: 분산된 메모리를 하나의 패킷으로 조합
# tcp-segmentation-offload (TSO): TCP 세그멘테이션을 NIC에 위임
# generic-receive-offload (GRO): 수신 패킷 합산 처리

# 성능 튜닝 (고속 서버)
ethtool -K eth0 gro on tso on gso on
```

### Jumbo Frame (고대역폭 환경)

```bash
# MTU 9000 설정 (경로 전체가 지원해야 함)
ip link set eth0 mtu 9000

# 영구 설정 (NetworkManager)
nmcli connection modify eth0 802-3-ethernet.mtu 9000

# MTU 검증
ping -M do -s 8972 <대상 IP>
# 8972 = 9000 - 28 (IP 20 + ICMP 8)
```

---

## 7. 고성능 서버 sysctl 설정

```bash
cat /etc/sysctl.d/99-network-performance.conf
```

```ini
# 연결 백로그
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 250000

# TCP 버퍼
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728

# TIME_WAIT 관리
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_max_tw_buckets = 1440000

# BBR (Linux 4.9+)
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# 로컬 포트 범위 확장 (서비스 포트와 겹치지 않도록 조정)
# 기본값: 32768 60999, well-known port(0~1023) 충돌 주의
net.ipv4.ip_local_port_range = 10240 65535
```

---

## 8. 진단 체크리스트

```text
[ ] ip -s link: RX/TX drop 확인 (0이어야 정상)
[ ] ss -s: TIME_WAIT 과다 여부 확인
[ ] ss -ti: retrans 값 확인
[ ] iperf3: 실제 대역폭 vs 예상 대역폭 비교
[ ] mtr: 경로별 패킷 손실 위치 파악
[ ] ethtool -g: 링 버퍼 최대값 미설정 여부 확인
[ ] K8s Service 1000개+: IPVS 모드 전환 검토
[ ] CNI 선택: 고성능 필요 시 Calico(BGP) 또는 Cilium(eBPF)
[ ] BBR 활성화: 고대역폭/고RTT 환경
[ ] somaxconn: Linux 5.4 미만이면 128이 기본값 (확인 필수)
```

---

## 참고 문서

- [Kernel Docs - Networking](https://www.kernel.org/doc/html/latest/networking/)
- [Kernel Docs - /proc/net/dev](https://man7.org/linux/man-pages/man5/proc_net_dev.5.html)
- [Brendan Gregg - Linux Network Performance](https://www.brendangregg.com/linuxperf.html)
- [iperf3 Documentation](https://iperf.fr/iperf-doc.php)
- [Kubernetes - kube-proxy IPVS](https://kubernetes.io/docs/concepts/services-networking/service/#proxy-mode-ipvs)
- [Cilium - eBPF Networking](https://docs.cilium.io/en/stable/overview/intro/)
