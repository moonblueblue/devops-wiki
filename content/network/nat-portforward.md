---
title: "NAT와 포트포워딩"
date: 2026-04-13
tags:
  - network
  - nat
  - iptables
  - portforward
  - kubernetes
sidebar_label: "NAT·포트포워딩"
---

# NAT와 포트포워딩

## 1. NAT 동작 원리

NAT(Network Address Translation)는 패킷의
소스/목적지 IP를 변환한다.

```
프라이빗 서버 (10.0.0.5)
    ↓ 목적지: 8.8.8.8
NAT 장비
    ↓ 소스 IP를 203.0.113.1(공인 IP)로 변환
인터넷
    ↓ 응답: 203.0.113.1로
NAT 장비 (커넥션 테이블 조회)
    ↓ 10.0.0.5로 역변환
프라이빗 서버
```

---

## 2. NAT 유형

| 유형 | 변환 대상 | 용도 |
|------|---------|------|
| **SNAT** | 소스 IP 변환 | 프라이빗→인터넷 아웃바운드 |
| **DNAT** | 목적지 IP 변환 | 포트포워딩, 인바운드 |
| **Masquerade** | SNAT의 동적 버전 | IP가 동적으로 바뀌는 환경 |
| **PAT (NAPT)** | IP + 포트 동시 변환 | 하나의 공인 IP로 다수 서버 |

### SNAT vs Masquerade

```bash
# SNAT: 소스 IP를 고정 IP로 변환 (성능 우수)
iptables -t nat -A POSTROUTING \
  -s 10.0.0.0/24 -o eth0 \
  -j SNAT --to-source 203.0.113.1

# Masquerade: 아웃바운드 인터페이스 IP 자동 사용 (DHCP 환경)
iptables -t nat -A POSTROUTING \
  -s 10.0.0.0/24 -o eth0 \
  -j MASQUERADE
```

---

## 3. 포트포워딩 (DNAT)

외부에서 들어오는 특정 포트를 내부 서버로 전달한다.

```bash
# 80 포트를 내부 서버 10.0.0.5:8080으로 포워딩
iptables -t nat -A PREROUTING \
  -p tcp --dport 80 \
  -j DNAT --to-destination 10.0.0.5:8080

# 포워딩 활성화
echo 1 > /proc/sys/net/ipv4/ip_forward
sysctl -w net.ipv4.ip_forward=1
```

```bash
# NAT 테이블 확인
iptables -t nat -L -n -v

# 연결 추적 테이블 확인
conntrack -L
conntrack -L | grep 10.0.0.5
```

---

## 4. iptables NAT 체인 흐름

```
인바운드 패킷
    ↓
PREROUTING (DNAT 적용)
    ↓
라우팅 결정
    ↓
FORWARD
    ↓
POSTROUTING (SNAT/Masquerade 적용)
    ↓
아웃바운드
```

```bash
# 영구 설정 저장
iptables-save > /etc/iptables/rules.v4

# 복원
iptables-restore < /etc/iptables/rules.v4
```

---

## 5. Kubernetes에서의 NAT

Kubernetes는 Service → Pod IP 변환을 NAT로 구현한다.

### kube-proxy 모드별 구현

| 모드 | 구현 방식 | 성능 | 비고 |
|------|---------|------|------|
| iptables | DNAT 규칙 체인 | O(n) | 기본값 |
| IPVS | 커널 해시 테이블 | **O(1)** | Service 1000개+ 권장 |
| nftables | nft 테이블 | O(1) | Linux 6.x+, 차세대 |

```bash
# ClusterIP → Pod IP 변환 확인
iptables -t nat -L KUBE-SERVICES -n | grep <service-name>

# IPVS 모드에서 확인
ipvsadm -Ln | grep <cluster-ip>
```

### Pod 네트워크 NAT 흐름

```
외부 트래픽
    ↓
NodePort: iptables DNAT (NodeIP:NodePort → PodIP:Port)
    ↓
ClusterIP: iptables DNAT (ClusterIP → PodIP)
    ↓
Pod
```

```bash
# NodePort 규칙 확인
iptables -t nat -L KUBE-NODEPORTS -n -v

# Service IP → Pod IP 매핑
iptables -t nat -L KUBE-SVC-XXXX -n
```

---

## 6. Docker에서의 NAT

```bash
# Docker 컨테이너 포트 매핑
docker run -p 8080:80 nginx
# 호스트 8080 → 컨테이너 80 (DNAT)

# Docker NAT 규칙 확인
iptables -t nat -L DOCKER -n

# 사용자 정의 규칙은 DOCKER-USER 체인에 삽입
iptables -I DOCKER-USER -s 10.0.0.0/8 -j RETURN
iptables -I DOCKER-USER -j DROP
```

> Docker는 `iptables` 규칙을 자동 관리한다.
> 직접 `DOCKER` 체인을 수정하지 말고 `DOCKER-USER` 체인을 사용하라.

---

## 7. NAT 한계

| 한계 | 내용 |
|------|------|
| P2P 연결 | NAT 뒤 장치끼리 직접 통신 어려움 |
| 특정 프로토콜 | FTP, SIP 등 페이로드에 IP 포함 시 문제 |
| 연결 추적 메모리 | 대규모 트래픽 시 conntrack 테이블 고갈 |
| 포트 소진 | 단일 공인 IP + 대규모 아웃바운드 |

```bash
# conntrack 테이블 크기 확인
sysctl net.netfilter.nf_conntrack_max
cat /proc/sys/net/netfilter/nf_conntrack_count

# 크기 증가 (메모리 충분한 경우)
sysctl -w net.netfilter.nf_conntrack_max=524288
```

---

## 참고 문서

- [iptables man page](https://man7.org/linux/man-pages/man8/iptables.8.html)
- [Kernel Docs - Netfilter](https://www.netfilter.org/documentation/)
- [Kubernetes - Service Virtual IPs](https://kubernetes.io/docs/reference/networking/virtual-ips/)
- [RFC 3022 - NAT](https://www.rfc-editor.org/rfc/rfc3022)
