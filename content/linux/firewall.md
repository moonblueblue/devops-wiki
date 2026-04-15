---
title: "리눅스 방화벽 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - firewall
  - iptables
  - nftables
  - firewalld
  - security
  - devops
  - kubernetes
sidebar_label: "방화벽"
---

# 리눅스 방화벽

## 1. 리눅스 방화벽 개요

### netfilter 프레임워크

리눅스 방화벽은 커널의 **netfilter** 프레임워크 위에서
동작한다. iptables, nftables, firewalld 모두
netfilter의 훅(hook)을 사용해 패킷을 필터링한다.

netfilter는 5개의 훅 포인트를 제공한다.
패킷이 커널 네트워크 스택을 통과할 때
각 훅에서 등록된 규칙이 평가된다.

```text
[네트워크] → PREROUTING → 라우팅 결정
                            ├→ INPUT → [로컬 프로세스]
                            └→ FORWARD → POSTROUTING → [네트워크]
             [로컬 프로세스] → OUTPUT → POSTROUTING → [네트워크]
```

| 훅 | 시점 | 용도 |
|-----|------|------|
| `PREROUTING` | 패킷 수신 직후 | DNAT, 연결 추적 |
| `INPUT` | 로컬 프로세스 전달 전 | 호스트 방화벽 |
| `FORWARD` | 다른 인터페이스로 전달 | 라우터/게이트웨이 |
| `OUTPUT` | 로컬 프로세스 발신 | 송신 필터링 |
| `POSTROUTING` | 패킷 송신 직전 | SNAT, 마스커레이딩 |

### 연결 추적 (conntrack)

conntrack은 netfilter의 상태 추적 엔진이다.
모든 네트워크 연결 상태를 `nf_conntrack` 테이블에 기록하며
상태 기반(stateful) 방화벽의 핵심이다.

| 상태 | 설명 |
|------|------|
| `NEW` | 새로운 연결의 첫 패킷 |
| `ESTABLISHED` | 양방향 패킷이 확인된 연결 |
| `RELATED` | 기존 연결과 관련된 새 연결 |
| `INVALID` | 어떤 연결에도 속하지 않는 패킷 |

```bash
# 현재 연결 추적 테이블 조회
conntrack -L

# 추적 중인 연결 수 확인
conntrack -C

# 최대 연결 수 확인/설정
sysctl net.netfilter.nf_conntrack_max
sysctl -w net.netfilter.nf_conntrack_max=262144
```

> 고부하 환경에서 `nf_conntrack: table full` 오류가
> 발생하면 `nf_conntrack_max` 값을 늘려야 한다.
> DDoS 방어 시 conntrack 테이블 모니터링이 필수다.

---

## 2. iptables 기초

iptables는 20년 넘게 사용된 리눅스 표준 방화벽 도구다.
현재는 **legacy maintenance mode**이지만
여전히 많은 시스템에서 사용 중이다.

### 테이블과 체인

iptables는 테이블 안에 체인을, 체인 안에 규칙을 정의한다.
패킷은 해당 테이블의 체인을 순서대로 통과하며
첫 번째 매치되는 규칙이 적용된다 (first match wins).

| 테이블 | 용도 | 주요 체인 |
|--------|------|----------|
| `filter` | 패킷 허용/차단 (기본) | INPUT, FORWARD, OUTPUT |
| `nat` | 주소 변환 | PREROUTING, POSTROUTING |
| `mangle` | 패킷 헤더 수정 | 전체 5개 체인 |
| `raw` | conntrack 제외 | PREROUTING, OUTPUT |

### 주요 명령어

```bash
# 규칙 추가 (-A: append)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 규칙 삽입 (-I: insert, 1번 위치)
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT

# 규칙 삭제 (-D: delete)
iptables -D INPUT 3

# 규칙 목록 (-L: list, -n: 숫자 표시, -v: 상세)
iptables -L -n -v --line-numbers

# 체인 기본 정책 설정
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT
```

### 규칙 영속화

iptables 규칙은 재부팅하면 사라진다.
영구 저장하려면 별도 저장/복원이 필요하다.

```bash
# 규칙 저장
iptables-save > /etc/iptables/rules.v4

# 규칙 복원
iptables-restore < /etc/iptables/rules.v4

# Debian/Ubuntu: iptables-persistent 패키지 사용
apt install iptables-persistent
netfilter-persistent save
```

### 타겟 (Target)

| 타겟 | 동작 |
|------|------|
| `ACCEPT` | 패킷 허용 |
| `DROP` | 패킷 폐기 (응답 없음) |
| `REJECT` | 패킷 거부 (ICMP 응답) |
| `LOG` | 패킷 로깅 후 다음 규칙 |
| `MASQUERADE` | 동적 SNAT (NAT 테이블) |
| `DNAT` | 목적지 주소 변환 |
| `SNAT` | 소스 주소 변환 |

> **현재 상태**: 대부분의 현대 배포판에서 `iptables`
> 명령은 실제로 `iptables-nft`(호환 레이어)를 실행한다.
> 신규 시스템에서는 nftables 직접 사용을 권장한다.

---

## 3. nftables (iptables 후속)

nftables는 커널 4.x(2014)부터 포함된
iptables의 공식 후속 프레임워크다.
2026년 현재 모든 주요 배포판이 nftables를 채택했다.

### iptables와의 핵심 차이

| 항목 | iptables | nftables |
|------|----------|----------|
| IPv4/IPv6 | `iptables`/`ip6tables` 별도 | `inet` 패밀리로 통합 |
| 기본 테이블 | filter, nat 등 사전정의 | 사용자 직접 생성 |
| 규칙 적용 | 규칙별 개별 적용 | 원자적 일괄 적용 |
| 데이터 구조 | 단순 리스트 | sets, maps 지원 |
| 내부 구조 | 프로토콜별 코드 중복 | 바이트코드 VM |
| 성능 | 규칙 수에 비례 저하 | 대규모 규칙셋 효율적 |

### 기본 사용법

```bash
# 전체 규칙셋 확인
nft list ruleset

# 테이블 생성 (inet = IPv4 + IPv6)
nft add table inet myfilter

# 체인 생성
nft add chain inet myfilter input \
  { type filter hook input priority 0 \; \
    policy drop \; }

# 규칙 추가
nft add rule inet myfilter input \
  tcp dport 22 accept

# 여러 포트 한번에 허용
nft add rule inet myfilter input \
  tcp dport { 80, 443, 8080 } accept

# 상태 기반 규칙
nft add rule inet myfilter input \
  ct state established,related accept
```

### Sets와 Maps

nftables의 강력한 기능으로 IP 목록이나
포트 매핑을 효율적으로 관리할 수 있다.

```bash
# IP 차단 목록 (set) - CIDR 포함 시 flags interval 필수
nft add set inet myfilter blocklist \
  { type ipv4_addr \; flags timeout,interval \; auto-merge \; }

# IP 추가 (24시간 자동 만료)
nft add element inet myfilter blocklist \
  { 192.168.1.100 timeout 24h }
# CIDR 추가 (flags interval 없으면 오류: value type mismatch)
nft add element inet myfilter blocklist \
  { 10.0.0.0/8 }

# set을 규칙에서 참조
nft add rule inet myfilter input \
  ip saddr @blocklist drop
```

### 설정 파일

```bash title="/etc/nftables.conf"
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
  set blocklist {
    type ipv4_addr
    flags timeout, interval
    auto-merge
  }

  chain input {
    type filter hook input priority 0; policy drop;

    # loopback 허용
    iif lo accept

    # 상태 기반 허용
    ct state established,related accept
    ct state invalid drop

    # ICMP 허용
    ip protocol icmp accept
    ip6 nexthdr icmpv6 accept

    # SSH, HTTP, HTTPS
    tcp dport { 22, 80, 443 } accept

    # 차단 목록
    ip saddr @blocklist drop
  }

  chain forward {
    type filter hook forward priority 0; policy drop;
  }

  chain output {
    type filter hook output priority 0; policy accept;
  }
}
```

```bash
# 설정 파일 적용
nft -f /etc/nftables.conf

# 서비스로 활성화
systemctl enable --now nftables
```

### 마이그레이션 도구

```bash
# iptables 규칙을 nftables로 변환
iptables-translate \
  -A INPUT -p tcp --dport 22 -j ACCEPT
# 출력: nft add rule ip filter INPUT \
#       tcp dport 22 counter accept

# 전체 규칙셋 변환
iptables-save | iptables-restore-translate
```

> 참고:
> [nftables wiki](https://wiki.nftables.org),
> [Arch Wiki - nftables](https://wiki.archlinux.org/title/Nftables)

---

## 4. firewalld (zone 기반 관리)

firewalld는 D-Bus 인터페이스 기반의 동적 방화벽 관리자다.
RHEL, CentOS, Fedora의 기본 방화벽이며
백엔드로 nftables(RHEL 8+)를 사용한다.

### Zone (영역) 개념

firewalld는 네트워크를 신뢰도에 따라 영역으로 분류한다.
인터페이스나 소스를 영역에 할당하면
해당 영역의 규칙이 적용된다.

| Zone | 신뢰도 | 설명 |
|------|--------|------|
| `drop` | 최저 | 수신 전부 폐기, 응답 없음 |
| `block` | 낮음 | 수신 거부 (ICMP 응답) |
| `public` | 낮음 | 기본 영역, 신뢰하지 않는 네트워크 |
| `external` | 낮음 | NAT 마스커레이딩 용도 |
| `dmz` | 중간 | DMZ 서버용 |
| `work` | 중간 | 업무 네트워크 |
| `home` | 높음 | 가정 네트워크 |
| `internal` | 높음 | 내부 네트워크 |
| `trusted` | 최고 | 모든 트래픽 허용 |

### 기본 명령어

```bash
# 상태 확인
firewall-cmd --state

# 활성 영역 확인
firewall-cmd --get-active-zones

# 현재 영역 규칙 전체 표시
firewall-cmd --list-all

# 특정 영역 규칙 표시
firewall-cmd --zone=public --list-all
```

### 서비스와 포트 관리

```bash
# 사전 정의된 서비스 목록
firewall-cmd --get-services

# 서비스 허용 (--permanent 없으면 임시)
firewall-cmd --add-service=http --permanent
firewall-cmd --add-service=https --permanent

# 포트 직접 허용
firewall-cmd --add-port=8080/tcp --permanent
firewall-cmd --add-port=9090-9099/tcp --permanent

# 변경사항 적용
firewall-cmd --reload

# 서비스 제거
firewall-cmd --remove-service=http --permanent
```

### Rich Rules (고급 규칙)

```bash
# 특정 IP에서 SSH 허용
firewall-cmd --add-rich-rule=\
  'rule family="ipv4"
   source address="10.0.0.0/8"
   service name="ssh" accept' --permanent

# 특정 IP 차단 + 로깅
firewall-cmd --add-rich-rule=\
  'rule family="ipv4"
   source address="192.168.1.100"
   log prefix="BLOCKED: " level="warning"
   drop' --permanent

# 포트 포워딩
firewall-cmd --add-rich-rule=\
  'rule family="ipv4"
   forward-port port="8080"
   protocol="tcp"
   to-port="80"' --permanent

# 규칙 적용
firewall-cmd --reload
```

### 영역에 인터페이스 할당

```bash
# 인터페이스를 영역에 할당
firewall-cmd --zone=internal \
  --change-interface=eth1 --permanent

# 소스 IP를 영역에 할당
firewall-cmd --zone=trusted \
  --add-source=10.0.0.0/8 --permanent
```

> 참고:
> [Red Hat firewalld 문서](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_firewalls_and_packet_filters/using-and-configuring-firewalld_firewall-packet-filters),
> [firewalld.org](https://firewalld.org/)

---

## 5. 도구 비교 표

### iptables vs nftables vs firewalld vs UFW

| 항목 | iptables | nftables | firewalld | UFW |
|------|----------|----------|-----------|-----|
| **수준** | 로우레벨 | 로우레벨 | 하이레벨 | 하이레벨 |
| **백엔드** | netfilter | netfilter | nftables | iptables/nft |
| **IPv4/IPv6** | 별도 명령 | 통합 | 통합 | 통합 |
| **원자적 적용** | 불가 | 가능 | 가능 | 불가 |
| **주요 배포판** | 레거시 | Debian계열 | RHEL계열 | Ubuntu |
| **상태** | deprecated | 권장 | 권장 | 권장 |
| **학습 곡선** | 높음 | 중간 | 낮음 | 매우 낮음 |
| **동적 갱신** | 불가 | 가능 | 가능 | 불가 |
| **Zone 지원** | 없음 | 없음 | 있음 | 없음 |
| **설정 방식** | CLI 직접 | CLI/파일 | CLI/GUI | CLI |

### 배포판별 기본 도구 (2026)

| 배포판 | 프론트엔드 | 백엔드 |
|--------|-----------|--------|
| RHEL 9+ | firewalld | nftables |
| CentOS Stream 9 | firewalld | nftables |
| Fedora 35+ | firewalld | nftables |
| Ubuntu 22.04+ | UFW | nftables |
| Debian 11+ | (없음) | nftables |
| SUSE 15+ | firewalld | nftables |
| Arch Linux | (없음) | nftables |

> 모든 주요 배포판이 백엔드로 nftables를 사용한다.
> 프론트엔드 선택은 배포판과 운영 환경에 따라 다르다.

---

## 6. 실전 패턴

### SSH 접근 제한

```bash
# nftables: 특정 IP에서만 SSH 허용
nft add rule inet filter input \
  ip saddr 10.0.0.0/8 tcp dport 22 accept

# firewalld: 특정 IP에서만 SSH 허용
firewall-cmd --add-rich-rule=\
  'rule family="ipv4"
   source address="10.0.0.0/8"
   service name="ssh" accept' --permanent

# UFW: 특정 서브넷에서만 SSH 허용
ufw allow from 10.0.0.0/8 to any port 22
```

### 웹 서버 (HTTP/HTTPS)

```bash
# nftables
nft add rule inet filter input \
  tcp dport { 80, 443 } accept

# firewalld
firewall-cmd --add-service=http --permanent
firewall-cmd --add-service=https --permanent

# UFW
ufw allow 'Nginx Full'  # 또는 ufw allow 80,443/tcp
```

### 특정 IP 차단

```bash
# nftables (set 활용)
nft add element inet filter blocklist \
  { 203.0.113.50 }

# iptables
iptables -I INPUT -s 203.0.113.50 -j DROP

# firewalld
firewall-cmd --add-rich-rule=\
  'rule family="ipv4"
   source address="203.0.113.50"
   drop' --permanent

# UFW
ufw deny from 203.0.113.50
```

### 포트 포워딩

외부 8080 포트를 내부 80 포트로 전달하는 예시다.

```bash
# nftables
nft add table ip nat
nft add chain ip nat prerouting \
  { type nat hook prerouting priority -100 \; }
nft add rule ip nat prerouting \
  tcp dport 8080 redirect to :80

# iptables
iptables -t nat -A PREROUTING \
  -p tcp --dport 8080 -j REDIRECT --to-port 80

# firewalld
firewall-cmd --add-forward-port=\
  port=8080:proto=tcp:toport=80 --permanent
```

### NAT / 마스커레이딩

사설 네트워크의 인터넷 접근을 위한 NAT 설정이다.

```bash
# 커널 IP 포워딩 활성화 (재부팅 후 초기화됨)
sysctl -w net.ipv4.ip_forward=1
# 영구 적용은 sysctl.d에 설정
echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.d/99-ip-forward.conf && sysctl -p

# nftables
nft add table ip nat
nft add chain ip nat postrouting \
  { type nat hook postrouting priority 100 \; }
nft add rule ip nat postrouting \
  oifname "eth0" masquerade

# iptables
iptables -t nat -A POSTROUTING \
  -o eth0 -j MASQUERADE

# firewalld
firewall-cmd --zone=external \
  --add-masquerade --permanent
```

### Rate Limiting (브루트포스 방어)

```bash
# nftables: SSH 접속 속도 제한
nft add rule inet filter input \
  tcp dport 22 ct state new \
  limit rate 3/minute accept

# iptables: SSH 접속 속도 제한
iptables -A INPUT -p tcp --dport 22 \
  -m conntrack --ctstate NEW \
  -m limit --limit 3/min --limit-burst 3 \
  -j ACCEPT
```

---

## 7. 쿠버네티스와 방화벽

### kube-proxy 모드

kube-proxy는 Service의 ClusterIP/NodePort를
실제 Pod IP로 전달하는 역할을 한다.
방화벽 규칙을 직접 생성하므로 충돌에 주의해야 한다.

| 모드 | 백엔드 | 상태 (K8s 1.33) |
|------|--------|-----------------|
| `iptables` | iptables | **기본값**, 안정 |
| `ipvs` | IPVS (L4 LB) | 안정 |
| `nftables` | nftables | GA (1.33+, 커널 5.13+ 필요) |

> nftables GA 이후에도 호환성 유지를 위해
> `iptables`가 기본값으로 유지된다.
> nftables 모드로 전환하려면 명시적으로 설정해야 한다.

nftables 모드는 iptables와 IPVS 모두를 대체하는 것이 목표다.
30,000개 Service 클러스터에서 nftables의 p99 지연이
iptables의 p01 지연보다 빠른 성능을 보인다.
단, **커널 5.13 미만** 환경에서는 비활성 폴백이 발생하므로
커널 버전을 반드시 확인할 것.

```yaml
# kube-proxy 설정 (ConfigMap)
apiVersion: kubeproxy.config.k8s.io/v1alpha1
kind: KubeProxyConfiguration
mode: "nftables"  # 또는 "iptables", "ipvs"
```

### 호스트 방화벽과의 공존

쿠버네티스 노드에서 호스트 방화벽 사용 시
다음 포트를 반드시 허용해야 한다.

| 포트 | 용도 | 대상 |
|------|------|------|
| 6443 | API Server | 컨트롤 플레인 |
| 2379-2380 | etcd | 컨트롤 플레인 |
| 10250 | kubelet API | 모든 노드 |
| 10256 | kube-proxy health | 모든 노드 |
| 30000-32767 | NodePort | 워커 노드 |

```bash
# firewalld 예시: 워커 노드 설정
firewall-cmd --add-port=10250/tcp --permanent
firewall-cmd --add-port=10256/tcp --permanent
firewall-cmd --add-port=30000-32767/tcp --permanent
firewall-cmd --reload
```

> **주의**: CNI 플러그인(Calico, Cilium 등)도 자체적으로
> iptables/nftables 규칙을 생성한다. 호스트 방화벽 규칙이
> CNI 규칙과 충돌하지 않도록 주의해야 한다.

> 참고:
> [kube-proxy nftables 모드](https://kubernetes.io/blog/2025/02/28/nftables-kube-proxy/),
> [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)

---

## 8. 클라우드 보안 그룹과의 관계

### 클라우드 보안 그룹

AWS Security Group, Azure NSG, GCP VPC Firewall 등은
**VPC/인스턴스 레벨**에서 트래픽을 제어한다.
관리 콘솔이나 API/IaC로 관리하며 호스트와 독립적이다.

### 호스트 방화벽과의 비교

| 항목 | 클라우드 보안 그룹 | 호스트 방화벽 |
|------|-------------------|--------------|
| **동작 위치** | 하이퍼바이저/SDN | OS 커널 (netfilter) |
| **관리 방법** | 콘솔/API/IaC | CLI/설정 파일 |
| **적용 범위** | 인스턴스/서브넷 | 단일 호스트 |
| **상태 추적** | stateful | stateful |
| **로깅** | Flow Logs | iptables LOG/nft log |
| **세밀한 제어** | 제한적 | 매우 세밀 |

### Defense-in-Depth (심층 방어)

보안 그룹만으로 충분하다고 생각하기 쉽지만
설정 오류가 발생할 수 있다.
호스트 방화벽을 추가 방어층으로 운영하는 것이 권장된다.

```text
[인터넷]
  └→ 클라우드 보안 그룹 (1차 필터)
       └→ 호스트 방화벽 (2차 필터)
            └→ 애플리케이션
```

호스트 방화벽은 Ansible, Puppet 등 설정 관리 도구로
자동화할 수 있다.

```yaml
# Ansible 예시: firewalld 설정
- name: Allow HTTP/HTTPS
  ansible.posix.firewalld:
    service: "{{ item }}"
    state: enabled
    permanent: true
    immediate: true
  loop:
    - http
    - https
```

> 클라우드 환경에서도 호스트 방화벽을 함께 운영하면
> 보안 그룹 설정 오류로 인한 노출을 방지할 수 있다.

---

## 참고 자료

- [netfilter.org](https://www.netfilter.org/)
- [nftables wiki](https://wiki.nftables.org/)
- [iptables - Arch Wiki](https://wiki.archlinux.org/title/Iptables)
- [nftables - Arch Wiki](https://wiki.archlinux.org/title/Nftables)
- [Red Hat firewalld 문서](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_firewalls_and_packet_filters/using-and-configuring-firewalld_firewall-packet-filters)
- [K8s kube-proxy nftables](https://kubernetes.io/blog/2025/02/28/nftables-kube-proxy/)
- [conntrack-tools](https://conntrack-tools.netfilter.org/)
