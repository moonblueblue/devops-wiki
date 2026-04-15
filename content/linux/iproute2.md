---
title: "iproute2 명령어 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - network
  - iproute2
  - devops
  - troubleshooting
sidebar_label: "iproute2"
---

# iproute2 명령어

## 1. net-tools에서 iproute2로

net-tools는 2001년 이후 개발이 중단되었다.
RHEL 7+, Arch Linux, Ubuntu 등 주요 배포판에서
net-tools를 deprecated 처리했다.

iproute2는 netlink 소켓으로 커널과 통신하며
net-tools의 ioctl/proc 방식보다 빠르고 기능이 많다.
최신 버전은 **iproute2 6.19.0** (2026-02)이다.

### 명령어 대응표

| net-tools | iproute2 | 용도 |
|-----------|----------|------|
| `ifconfig` | `ip addr`, `ip link` | IP/인터페이스 |
| `route` | `ip route` | 라우팅 테이블 |
| `arp` | `ip neigh` | ARP 캐시 |
| `netstat` | `ss` | 소켓 통계 |
| `netstat -r` | `ip route` | 라우팅 표시 |
| `netstat -i` | `ip -s link` | 인터페이스 통계 |
| `brctl` | `ip link` / `bridge` | 브리지 관리 |
| `iptunnel` | `ip tunnel` | 터널 관리 |
| `nameif` | `ip link set name` | 이름 변경 |

> net-tools 패키지가 설치되지 않은 환경이 많다.
> 신규 스크립트는 반드시 iproute2를 사용하자.

---

## 2. ip addr - IP 주소 관리

`ip addr`은 인터페이스의 IP 주소를 조회/추가/삭제한다.
하나의 인터페이스에 여러 IP를 할당할 수 있다.

### 주요 명령

```bash
# 전체 IP 표시
ip addr show

# 특정 인터페이스만
ip addr show dev eth0

# IPv4만 / IPv6만
ip -4 addr show
ip -6 addr show

# IP 추가
ip addr add 192.168.1.10/24 dev eth0

# 보조 IP 추가 (label 지정)
ip addr add 192.168.1.11/24 dev eth0 label eth0:1

# IP 삭제
ip addr del 192.168.1.10/24 dev eth0

# 인터페이스의 모든 IP 제거
ip addr flush dev eth0
```

### 자주 쓰는 옵션

| 옵션 | 설명 |
|------|------|
| `-4` / `-6` | IPv4 / IPv6 필터 |
| `-br` | 간결한 출력 (brief) |
| `scope global` | 글로벌 주소만 표시 |
| `scope link` | 링크-로컬 주소만 표시 |

```bash
# 간결한 출력 (인터페이스별 한 줄)
ip -br addr show
```

---

## 3. ip link - 인터페이스 관리

`ip link`는 네트워크 인터페이스의 상태를 관리한다.
VLAN, 브리지, 본딩, veth 등 가상 인터페이스도
이 명령으로 생성한다.

### 기본 조작

```bash
# 전체 인터페이스 표시
ip link show

# 인터페이스 UP / DOWN
ip link set eth0 up
ip link set eth0 down

# MTU 변경
ip link set eth0 mtu 9000

# 이름 변경 (DOWN 상태에서만)
ip link set eth0 down
ip link set eth0 name lan0

# 통계 포함 표시
ip -s link show eth0
```

### VLAN 생성

```bash
# eth0 위에 VLAN ID 100 생성
ip link add link eth0 name eth0.100 type vlan id 100
ip addr add 192.168.100.10/24 dev eth0.100
ip link set eth0.100 up

# VLAN 삭제
ip link del eth0.100
```

### 브리지 생성

```bash
# 브리지 생성 및 포트 추가
ip link add name br0 type bridge
ip link set eth0 master br0
ip link set eth1 master br0
ip link set br0 up

# 포트 제거
ip link set eth0 nomaster
```

### 본딩 생성

```bash
# active-backup 본딩 (커널 3.x+, iproute2 3.x+ 에서 인라인 파라미터 지원)
ip link add bond0 type bond
ip link set bond0 type bond miimon 100 mode active-backup
ip link set eth0 down
ip link set eth0 master bond0
ip link set eth1 down
ip link set eth1 master bond0
ip link set bond0 up
```

### veth 페어 생성

```bash
# 가상 이더넷 페어 (컨테이너/네임스페이스용)
ip link add veth0 type veth peer name veth1
```

---

## 4. ip route - 라우팅

`ip route`로 라우팅 테이블을 조회하고 관리한다.
정책 기반 라우팅(PBR)도 지원한다.

### 기본 조작

```bash
# 라우팅 테이블 표시
ip route show

# 특정 목적지의 경로 확인
ip route get 8.8.8.8

# 정적 라우트 추가
ip route add 10.0.0.0/8 via 192.168.1.1

# 기본 게이트웨이 설정
ip route add default via 192.168.1.1

# 기본 경로 교체 (없으면 추가)
ip route replace default via 192.168.1.254

# 라우트 삭제
ip route del 10.0.0.0/8

# 메트릭 지정
ip route add 10.0.0.0/8 via 192.168.1.1 metric 100
```

### 정책 기반 라우팅 (PBR)

출발지 IP에 따라 다른 게이트웨이를 사용할 수 있다.
멀티 ISP 환경에서 유용하다.

```bash
# 1) 커스텀 라우팅 테이블 등록
echo "100 isp1" >> /etc/iproute2/rt_tables

# 2) 테이블에 기본 경로 추가
ip route add default via 203.0.113.1 \
  dev eth1 table isp1

# 3) 정책 규칙 추가
ip rule add from 192.168.1.0/24 \
  lookup isp1 priority 100

# 규칙 확인 / 삭제
ip rule show
ip rule del priority 100
```

---

## 5. ip neigh - ARP 테이블

`ip neigh`는 ARP(IPv4) 및 NDP(IPv6) 캐시를 관리한다.
`arp` 명령을 대체한다.

```bash
# ARP 테이블 표시
ip neigh show

# 특정 인터페이스만
ip neigh show dev eth0

# 정적 ARP 항목 추가
ip neigh add 192.168.1.1 \
  lladdr aa:bb:cc:dd:ee:ff dev eth0

# 항목 삭제
ip neigh del 192.168.1.1 dev eth0

# 특정 인터페이스의 ARP 캐시 비우기
ip neigh flush dev eth0
```

### 상태 값

| 상태 | 설명 |
|------|------|
| `REACHABLE` | 정상 도달 가능 |
| `STALE` | 유효하지만 확인 필요 |
| `DELAY` | 재확인 대기 중 |
| `FAILED` | 해석 실패 |
| `PERMANENT` | 수동 등록 (정적) |

---

## 6. ss - 소켓 상태 확인

`ss`는 `netstat`의 대체 도구다.
netlink를 사용해 커널에서 직접 소켓 정보를 가져오므로
netstat보다 훨씬 빠르다.

### 주요 옵션

| 옵션 | 설명 |
|------|------|
| `-t` | TCP 소켓 |
| `-u` | UDP 소켓 |
| `-l` | 리스닝 소켓만 |
| `-n` | 숫자 표시 (이름 해석 안 함) |
| `-p` | 프로세스 정보 포함 |
| `-s` | 요약 통계 |
| `-o` | 타이머 정보 |
| `-m` | 메모리 사용량 |
| `-e` | 확장 정보 (UID 등) |

### 실전 예제

```bash
# 가장 많이 쓰는 조합: 리스닝 포트 + 프로세스
ss -tulpn

# TCP 요약 통계
ss -s

# ESTABLISHED 상태만
ss -t state established

# 특정 포트 필터 (필터 표현식은 따옴표로 감쌀 것)
ss -tlnp 'sport = :443'

# 목적지 필터
ss dst 192.168.1.0/24

# 특정 포트의 연결 수 확인
ss -t state established dport = :80 | wc -l

# CLOSE-WAIT 상태 확인 (연결 누수 진단)
ss -t state close-wait
```

### netstat 대응표

| netstat | ss |
|---------|----|
| `netstat -tlnp` | `ss -tlnp` |
| `netstat -ulnp` | `ss -ulnp` |
| `netstat -an` | `ss -an` |
| `netstat -s` | `ss -s` |
| `netstat -i` | `ip -s link` |

---

## 7. ip netns - 네트워크 네임스페이스

네트워크 네임스페이스는 독립된 네트워크 스택을
제공한다.
컨테이너 기술의 핵심 기반이며,
테스트/디버깅 환경 격리에도 유용하다.

### 기본 조작

```bash
# 네임스페이스 생성 / 목록 / 삭제
ip netns add ns1
ip netns list
ip netns del ns1

# 네임스페이스 내에서 명령 실행
ip netns exec ns1 ip addr show
ip netns exec ns1 bash   # 쉘 진입
```

### 두 네임스페이스 연결

```bash
# 1) 네임스페이스 생성
ip netns add ns1
ip netns add ns2

# 2) veth 페어 생성 및 할당
ip link add veth-ns1 type veth peer name veth-ns2
ip link set veth-ns1 netns ns1
ip link set veth-ns2 netns ns2

# 3) IP 할당 및 활성화
ip netns exec ns1 ip addr add 10.0.0.1/24 dev veth-ns1
ip netns exec ns2 ip addr add 10.0.0.2/24 dev veth-ns2
ip netns exec ns1 ip link set veth-ns1 up
ip netns exec ns2 ip link set veth-ns2 up
ip netns exec ns1 ip link set lo up
ip netns exec ns2 ip link set lo up

# 4) 통신 테스트
ip netns exec ns1 ping -c 3 10.0.0.2
```

### 네임스페이스 DNS 설정

```bash
# /etc/netns/<NAME>/resolv.conf 파일로 설정
mkdir -p /etc/netns/ns1
echo "nameserver 8.8.8.8" > /etc/netns/ns1/resolv.conf
```

### 컨테이너 네임스페이스 확인

```bash
# 컨테이너의 PID로 네임스페이스 진입
PID=$(docker inspect -f '{{.State.Pid}}' <container>)
nsenter -t $PID -n ip addr show
```

---

## 8. 실전 트러블슈팅 워크플로우

네트워크 문제 발생 시 아래 순서로 점검한다.

### 점검 순서

```text
[1] 인터페이스 상태 (ip link)
       ↓
[2] IP 할당 확인 (ip addr)
       ↓
[3] 라우팅 확인 (ip route get)
       ↓
[4] ARP 확인 (ip neigh)
       ↓
[5] 포트 리스닝 (ss -tulpn)
       ↓
[6] 네임스페이스 (ip netns list / nsenter)
```

### 단계별 명령

```bash
# 1단계: 인터페이스 UP 여부 확인
ip -br link show
# eth0  UP  aa:bb:cc:dd:ee:ff

# 2단계: IP 할당 확인
ip -br addr show
# eth0  UP  192.168.1.10/24

# 3단계: 대상까지 경로 확인
ip route get 10.0.0.1
# 10.0.0.1 via 192.168.1.1 dev eth0 src 192.168.1.10

# 4단계: 게이트웨이 ARP 확인
ip neigh show dev eth0

# 5단계: 서비스 포트 확인
ss -tlnp | grep :8080

# 6단계: (컨테이너 환경) 네임스페이스 확인
ip netns identify $$
```

### 자주 쓰는 시나리오

```bash
# 시나리오 1: 보조 IP 추가 (서비스 VIP)
ip addr add 10.0.0.100/32 dev lo

# 시나리오 2: 기본 게이트웨이 변경
ip route replace default via 192.168.1.254

# 시나리오 3: 특정 대역 블랙홀 처리
ip route add blackhole 10.99.0.0/16

# 시나리오 4: 인터페이스 통계로 에러 확인
# -s -s (이중)로 상세 에러 통계 출력
ip -s -s link show eth0 | grep -A1 -E "RX:|TX:"

# 시나리오 5: 연결 상태별 카운트
ss -t state established | wc -l
ss -t state close-wait | wc -l
ss -t state time-wait | wc -l
```

---

## 참고 링크

- [iproute2 공식 저장소](https://github.com/iproute2/iproute2)
- [Task-centered iproute2 가이드](https://baturin.org/docs/iproute2/)
- [ip(8) man page](https://man7.org/linux/man-pages/man8/ip.8.html)
- [ss(8) man page](https://man7.org/linux/man-pages/man8/ss.8.html)
- [ip-rule(8) man page](https://man7.org/linux/man-pages/man8/ip-rule.8.html)
- [ip-netns(8) man page](https://man7.org/linux/man-pages/man8/ip-netns.8.html)
