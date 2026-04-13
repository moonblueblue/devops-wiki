---
title: "네트워크 성능 튜닝 파라미터"
date: 2026-04-13
tags:
  - network
  - performance
  - tuning
  - sysctl
  - kubernetes
sidebar_label: "네트워크 튜닝"
---

# 네트워크 성능 튜닝 파라미터

## 1. NIC 멀티큐 설정

현대 NIC는 여러 큐를 지원하여 CPU 코어별로 트래픽을 분산한다.

```bash
# NIC 큐 수 확인
ethtool -l eth0
# Pre-set maximums: Combined: 8
# Current hardware settings: Combined: 2  ← 늘릴 수 있음

# 큐 수를 CPU 코어 수에 맞게 설정
ethtool -L eth0 combined $(nproc)
```

### RSS / RPS / RFS / XPS

| 기술 | 계층 | 동작 |
|------|------|------|
| RSS (Receive Side Scaling) | 하드웨어 | NIC가 패킷을 여러 큐에 분산 |
| RPS (Receive Packet Steering) | 소프트웨어 | 소프트웨어로 RSS 에뮬레이션 |
| RFS (Receive Flow Steering) | 소프트웨어 | 패킷을 처리 앱과 같은 CPU로 |
| XPS (Transmit Packet Steering) | 소프트웨어 | 송신 큐를 CPU에 매핑 |

```bash
# RPS 활성화 (모든 CPU 비트마스크)
# 4코어 = 0xf, 8코어 = 0xff
echo "ff" > /sys/class/net/eth0/queues/rx-0/rps_cpus

# RFS 활성화
echo 32768 > /proc/sys/net/core/rps_sock_flow_entries
echo 2048 > /sys/class/net/eth0/queues/rx-0/rps_flow_cnt
```

---

## 2. IRQ Affinity (NUMA 최적화)

```bash
# NIC IRQ 번호 확인
cat /proc/interrupts | grep eth0

# IRQ를 특정 CPU에 고정 (NUMA 로컬 CPU 권장)
echo "ff" > /proc/irq/<IRQ_NUMBER>/smp_affinity

# irqbalance 자동 분산 (수동 설정 시 비활성화)
systemctl stop irqbalance
```

```bash
# NUMA 노드 확인
numactl --hardware
# node 0 cpus: 0 1 2 3    ← eth0가 연결된 PCIe와 같은 노드 권장
# node 1 cpus: 4 5 6 7

# NIC의 NUMA 노드 확인
cat /sys/class/net/eth0/device/numa_node
```

---

## 3. Ring Buffer 크기

```bash
# 현재 설정 확인
ethtool -g eth0
# Pre-set maximums: RX: 4096  TX: 4096
# Current hardware settings: RX: 512   TX: 512  ← 늘리기

# 최대값으로 설정 (패킷 드롭 방지)
ethtool -G eth0 rx 4096 tx 4096
```

---

## 4. MTU 최적화

```bash
# 현재 MTU 확인
ip link show eth0 | grep mtu
# mtu 1500

# Jumbo Frame 설정 (스위치/네트워크가 지원해야 함)
ip link set eth0 mtu 9000

# MTU 9000 검증
ping -M do -s 8972 <대상IP>
# 8972 = 9000 - 20(IP) - 8(ICMP)
```

### 컨테이너/VXLAN 환경 MTU

```
VXLAN 오버헤드: 50 bytes
물리 MTU 1500 → Pod MTU 1450으로 설정 필요

Calico/Cilium은 자동으로 MTU를 감지하고 설정함
수동 확인:
  kubectl get configmap cilium-config -n kube-system \
    -o jsonpath='{.data.mtu}'
```

---

## 5. 핵심 sysctl 파라미터

```bash
cat /etc/sysctl.d/99-network-perf.conf
```

```ini
# ===== 연결 백로그 =====
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.netdev_max_backlog = 250000

# ===== TCP 버퍼 =====
# BDP = 대역폭 × RTT 기반으로 설정
net.ipv4.tcp_rmem = 4096 87380 134217728  # min default max
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728

# ===== TIME_WAIT 관리 =====
net.ipv4.tcp_tw_reuse = 1       # 아웃바운드 TIME_WAIT 재사용
net.ipv4.tcp_fin_timeout = 15   # 기본 60초 → 단축
net.ipv4.ip_local_port_range = 1024 65535  # 로컬 포트 범위 확장

# ===== BBR 혼잡 제어 (Linux 4.9+) =====
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# ===== conntrack =====
net.netfilter.nf_conntrack_max = 524288   # 대규모 트래픽 시 증가

# ===== 패킷 처리 =====
net.core.rps_sock_flow_entries = 32768
```

```bash
# 적용
sysctl -p /etc/sysctl.d/99-network-perf.conf

# 확인
sysctl net.ipv4.tcp_congestion_control
sysctl net.core.somaxconn
```

---

## 6. Kubernetes 환경 네트워크 최적화

### Pod 레벨 sysctl

```yaml
# Namespaced sysctl은 Pod에서 직접 설정 가능
apiVersion: v1
kind: Pod
spec:
  securityContext:
    sysctls:
      - name: net.ipv4.tcp_fin_timeout
        value: "15"
      - name: net.ipv4.tcp_tw_reuse
        value: "1"
      - name: net.core.somaxconn
        value: "65535"
```

### 노드 레벨 sysctl (DaemonSet)

```yaml
# 노드 레벨 파라미터는 DaemonSet으로 설정
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-sysctl
spec:
  template:
    spec:
      initContainers:
        - name: sysctl
          image: busybox
          command:
            - sh
            - -c
            - |
              sysctl -w net.core.somaxconn=65535
              sysctl -w net.ipv4.tcp_tw_reuse=1
          securityContext:
            privileged: true
      containers:
        - name: pause
          image: gcr.io/google_containers/pause:3.1
```

---

## 7. NIC Offload 설정

```bash
# 현재 offload 기능 확인
ethtool -k eth0

# 고성능 서버 권장 설정
ethtool -K eth0 \
  gro on \       # Generic Receive Offload
  tso on \       # TCP Segmentation Offload
  gso on \       # Generic Segmentation Offload
  rx-checksumming on \
  tx-checksumming on
```

---

## 8. 성능 튜닝 체크리스트

```text
NIC:
  [ ] 멀티큐 설정: ethtool -L (CPU 수만큼)
  [ ] Ring Buffer 최대화: ethtool -G
  [ ] Offload 활성화: ethtool -K (gro, tso)

IRQ/NUMA:
  [ ] IRQ affinity: NIC와 같은 NUMA 노드 CPU에 고정
  [ ] numactl로 NUMA 경계 확인

MTU:
  [ ] 인프라 지원 시 Jumbo Frame (9000) 적용
  [ ] VXLAN 환경: Pod MTU 1450으로 설정

sysctl:
  [ ] somaxconn = 65535
  [ ] TCP 버퍼: BDP 기준으로 설정
  [ ] tcp_tw_reuse = 1, fin_timeout = 15
  [ ] BBR + fq (고대역폭 환경)
  [ ] nf_conntrack_max 증가 (대규모 트래픽)

K8s:
  [ ] Pod 레벨 sysctl: securityContext.sysctls
  [ ] 노드 레벨: DaemonSet + privileged
```

---

## 참고 문서

- [Kernel Docs - Networking](https://www.kernel.org/doc/html/latest/networking/)
- [Kernel Docs - Scaling](https://www.kernel.org/doc/html/latest/networking/scaling.html)
- [Brendan Gregg - Linux Network Performance](https://www.brendangregg.com/linuxperf.html)
- [Kubernetes - sysctl 설정](https://kubernetes.io/docs/tasks/administer-cluster/sysctl-cluster/)
