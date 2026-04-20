---
title: "MTU · MSS · Path MTU Discovery"
sidebar_label: "MTU·MSS"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-20
tags:
  - network
  - mtu
  - mss
  - pmtud
  - overlay
---

# MTU · MSS · Path MTU Discovery

네트워크가 "연결은 되는데 큰 요청만 타임아웃 난다"면
대부분의 범인은 **MTU 미스매치**다.

이 증상은 ping·짧은 HTTP GET에는 보이지 않고,
**큰 업로드, TLS 인증서 체인 교환, K8s 파드 간 대용량 응답**에서만
나타나기 때문에 원인을 찾기가 어렵다.

이 글은 MTU·MSS·PMTUD가 현대 인프라에서 어떻게 얽히는지,
그리고 오버레이 네트워크의 함정을 정리한다.

---

## 1. MTU · MSS 정의

| 약어 | 풀네임 | 계층 | 단위 |
|---|---|---|---|
| MTU | Maximum Transmission Unit | L2 (링크) | 바이트 |
| MSS | Maximum Segment Size | L4 (TCP) | 바이트 |

- **MTU**: 하나의 **프레임**에 담을 수 있는 **IP 패킷 최대 크기**
  (페이로드 + IP 헤더)
- **MSS**: 하나의 **TCP 세그먼트**에 담을 수 있는 **TCP 페이로드 최대 크기**
  (TCP 헤더 제외)

### 1-1. 관계식

```
IPv4: MSS = MTU − IP(20) − TCP(20) = MTU − 40
IPv6: MSS = MTU − IP(40) − TCP(20) = MTU − 60
```

| 링크 | MTU | IPv4 MSS |
|---|---|---|
| Ethernet 표준 | 1500 | 1460 |
| Ethernet 점보 프레임 | 9000 | 8960 |
| Wi-Fi 802.11 | 2304 (이론) / 보통 1500 | 1460 |
| PPPoE (옛 DSL) | 1492 | 1452 |
| IPv6 최소 | 1280 | 1220 |

> MSS는 **TCP 3-way handshake의 SYN에서 서로 통지**한다.
> 양쪽이 다르면 **작은 값**이 적용된다.

### 1-2. TCP 옵션까지 고려한 더 정확한 식

```
실제 송신 가능 payload
  = MTU − IP 헤더 − TCP 헤더 − TCP 옵션
  = 1500 − 20 − 20 − 12 (timestamp)
  = 1448 바이트
```

리눅스 기본은 TCP timestamp 옵션을 쓰기 때문에
Wireshark에서 **TCP payload 1448B**로 보이는 것이 정상이다.

---

## 2. 왜 MTU가 문제인가

### 2-1. 프래그멘테이션은 더 이상 "그냥 되는" 일이 아니다

IPv4에서는 중간 라우터가 큰 패킷을 쪼갤 수 있었다(프래그멘테이션).
그러나 현대 네트워크에서는 이것이 **거의 실용적이지 않다**:

| 이유 | 상세 |
|---|---|
| 성능 | 라우터 CPU 부하, 재조립 부담 |
| 보안 | 방화벽·IDS는 헤더만 붙은 조각을 보안 위협으로 차단 |
| 상호운용 | 로드밸런서·NAT·터널이 조각을 이해 못함 |
| IPv6 | **중간 라우터는 프래그멘테이션 불가** (송신자만 가능) |

실무에서는 **프래그멘테이션 없이 엔드-투-엔드로 맞는 크기**여야 한다.

### 2-2. DF 비트와 PMTUD

IPv4 헤더의 **Don't Fragment(DF) 비트**가 켜져 있으면 중간 라우터가
쪼갤 수 없다. 현대 OS는 **TCP 트래픽에 기본적으로 DF=1**을 설정한다.

```mermaid
graph LR
    S["송신 호스트"]
    R1["라우터 MTU 1500"]
    R2["링크 MTU 1400"]
    D["수신 호스트"]
    S --> R1
    R1 --> R2
    R2 -.ICMP Frag Needed.-> S
    R2 --> D
```

| 단계 | 동작 |
|---|---|
| 1 | 송신자가 DF=1, 1500B 패킷 전송 |
| 2 | MTU 1400 링크를 만난 라우터가 전달 불가 |
| 3 | 라우터가 **ICMP Type 3 Code 4** (Fragmentation Needed)로 응답 |
| 4 | 송신자가 경로의 MTU를 1400으로 기억하고 재전송 |

이 과정이 **Path MTU Discovery (PMTUD)**다.

### 2-3. PMTUD가 실패하는 이유

**방화벽이 ICMP를 차단**하면 PMTUD가 깨진다.
"ICMP는 보안상 위험하다"는 오해로 모든 ICMP를 차단하는 경우가 흔하지만,
**ICMP Type 3 Code 4는 허용**해야 한다.

증상:
- TCP 연결은 성립 (SYN/ACK는 작음)
- 작은 요청은 응답
- **큰 요청·응답에서만 무한 대기 후 타임아웃**

이것이 흔히 말하는 **"블랙홀 라우터"** 문제다.

### 2-4. PLPMTUD (RFC 4821) — ICMP에 의존하지 않는 대안

ICMP 차단 환경이 늘면서, TCP가 스스로 세그먼트 크기를 탐색하는
**Packetization Layer PMTUD**가 표준화되었다.

- 작은 크기부터 시작해 성공하면 점진적으로 늘린다
- 실패(재전송 누적)가 감지되면 줄인다
- 리눅스 sysctl `net.ipv4.tcp_mtu_probing = 1|2`로 활성화
- QUIC(HTTP/3)은 기본으로 PLPMTUD 동작
  - 초기 패킷은 **최소 1200B**를 보장(RFC 9000) — IPv6 최소 MTU 1280과 연결
- `net.ipv4.ip_no_pmtu_disc = 0` 유지 (1로 두면 PMTUD를 꺼버려 블랙홀 유발)

---

## 3. TCP MSS Clamping

PMTUD가 동작하지 않는 환경에서 우회 방법은
**MSS를 애초에 작게 광고**하는 것이다.

### 3-1. 리눅스 iptables / nftables

```bash
# 모든 SYN/SYN-ACK의 MSS를 경로에 맞게 조정
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN \
  -j TCPMSS --clamp-mss-to-pmtu

# 고정값으로 설정 (터널 MTU가 알려져 있을 때)
iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN \
  -j TCPMSS --set-mss 1360
```

```bash
# nftables 동등
nft add rule inet filter forward tcp flags syn \
  tcp option maxseg size set rt mtu
```

> `--tcp-flags SYN,RST SYN`은 **SYN과 SYN-ACK 모두를 매칭**하므로
> 단일 규칙으로 양방향이 커버된다. 비대칭 경로에서도 안전.

### 3-2. 언제 쓰는가

| 시나리오 | MSS 클램핑 필요 |
|---|---|
| IPsec VPN (50~80B 오버헤드) | 예 |
| GRE 터널 | 예 |
| WireGuard (60B) | 예 |
| VXLAN (50B) · Geneve (가변) | 예 (오버레이) |
| PPPoE (8B) | 예 (레거시 DSL) |
| 일반 Ethernet | 아니요 |

### 3-3. K8s에서

Cilium·Calico 같은 CNI는 기본적으로 **파드 인터페이스 MTU를 자동 계산**한다.
수동 설정은 CNI 설정 파일에서:

```yaml
# Calico 예시 (VXLAN 사용 시)
apiVersion: projectcalico.org/v3
kind: FelixConfiguration
metadata:
  name: default
spec:
  vxlanMTU: 1450   # 1500 - 50(VXLAN 오버헤드)
```

```bash
# Cilium Helm values 방식 (권장)
helm upgrade cilium cilium/cilium --namespace kube-system \
  --reuse-values --set MTU=1450
```

```yaml
# 또는 cilium-config ConfigMap 수정 후 cilium-agent 재시작
# kubectl -n kube-system edit cm cilium-config
data:
  mtu: "1450"
```

---

## 4. 오버레이 네트워크의 MTU 수학

현대 K8s·멀티클러스터·서비스 메시는 대부분 오버레이 위에서 동작한다.
각 프로토콜의 오버헤드를 **외워두는 것이 실무 감각**이다.

| 오버레이 | 오버헤드 (IPv4 / IPv6) | 실용 MTU (언더레이 1500) |
|---|---|---|
| VXLAN | 50 B / 70 B | 1450 / 1430 |
| Geneve (옵션 없음) | 50 B / 70 B | 1450 / 1430 |
| Geneve (옵션 최대) | 최대 310 B | 제품 기본 1400~1442 |
| GRE | 24 B / 44 B | 1476 / 1456 |
| IPsec ESP (tunnel) | 50~80 B (알고리즘별) | 1420~1450 |
| IPsec + NAT-T | +8 B UDP 추가 | 1412~1442 |
| WireGuard | 60 B / **80 B** | 1440 / 1420 |
| Geneve over IPsec | 100 B+ | 1400 이하 |

> **이중 프로토콜 환경**에서는 더 작은 쪽을 기준으로 잡는다.
> 듀얼스택 클러스터는 IPv6 오버헤드(+20B)를 반영해 MTU를 추가로 낮춰야 한다.

### 4-1. VXLAN · Geneve 오버헤드 내역

```
VXLAN (IPv4):  Outer Ethernet(14) + Outer IP(20) + UDP(8) + VXLAN(8) = 50 B
Geneve (기본): Outer Ethernet(14) + Outer IP(20) + UDP(8) + Geneve(8) = 50 B
Geneve (옵션): + TLV 옵션 0~260 B (RFC 8926) → 최대 총 310 B
```

- Geneve는 **가변 TLV 옵션**이 있어 최대 260B가 추가될 수 있다
- OpenShift의 OVN-Kubernetes는 보수적으로 Geneve를 100B 기준으로 잡아
  언더레이 1500일 때 파드 MTU 1400을 권장한다

### 4-2. 이중 캡슐화 주의

"Pod에서 보낸 패킷 → CNI VXLAN → 클라우드 VPC Overlay → IPsec VPN"
같은 다층 시나리오에서는 **오버헤드가 누적**된다.
이것이 **온프레-클라우드 하이브리드에서 대용량 전송만 실패**하는 전형 패턴이다.

### 4-3. GSO/TSO와의 관계

| 기능 | 위치 | 역할 |
|---|---|---|
| TSO (TCP Segmentation Offload) | NIC | 큰 버퍼(최대 64KB)를 NIC가 MSS 단위로 분할 |
| GSO (Generic Segmentation Offload) | 커널 소프트웨어 | NIC가 TSO 없을 때 소프트웨어로 분할 |
| GRO (Generic Receive Offload) | 수신 | 여러 세그먼트를 하나로 합쳐 스택에 전달 |

**함정**: TSO가 켜진 NIC가 **MTU를 잘못 인식**하면 잘못된 크기의 세그먼트를
내보내고 드롭된다. CNI 디버깅 시 `ethtool -K eth0 tso off gso off` 임시 적용 후
문제 재현 여부로 원인을 좁힌다.

---

## 5. 진단과 측정

### 5-1. 경로 MTU 확인

```bash
# Linux: DF 비트 설정 + 다양한 크기 ping
ping -M do -s 1472 example.com    # 1472 + 8(ICMP) + 20(IP) = 1500
ping -M do -s 1452 example.com    # 1480
# 응답이 오는 가장 큰 크기 + 28 = Path MTU

# macOS
ping -D -s 1472 example.com
```

```bash
# tracepath (ICMP 차단에도 일부 동작)
tracepath example.com
# 출력: pmtu 1500 / pmtu 1450 등 경로 구간별 MTU 변화

# mtr + TCP 모드
mtr -T -P 443 example.com
```

### 5-2. 커널이 기억하는 경로 MTU 캐시

```bash
# PMTUD 결과가 라우팅 캐시에 저장됨
ip route get 1.1.1.1

# 캐시된 MTU 초기화
ip route flush cache
```

### 5-3. 인터페이스 MTU 확인·변경

```bash
# 현재 MTU
ip link show eth0 | grep mtu

# 변경 (일시)
ip link set dev eth0 mtu 1450

# 영구 설정 (systemd-networkd / NetworkManager 계열 별도)
```

---

## 6. IPv6의 MTU

| 항목 | IPv4 | IPv6 |
|---|---|---|
| 중간 라우터 프래그멘테이션 | 가능 (DF=0일 때) | **불가** |
| 최소 MTU | 68 B | **1280 B** |
| PMTUD | DF 기반 | 기본 동작 (ICMPv6 Packet Too Big) |
| ICMP 차단 영향 | PMTUD만 깨짐 | **핵심 기능까지 망가짐** |

IPv6는 **PMTUD가 프로토콜의 전제**다.
`ICMPv6 Type 2 (Packet Too Big)`를 차단하면 IPv6 자체가 작동하지 않는다고 봐도 된다.

---

## 7. 실전 패턴

### 7-1. 점보 프레임

| 조건 | 점보(9000) 가치 |
|---|---|
| 같은 L2 네트워크 내부 (DC 내부 백엔드) | 유의미 (3~5% 대역·CPU 절감) |
| WAN / 인터넷 경유 | 무의미 (경로 어디선가 1500으로 줄어듦) |
| K8s 파드 간 (CNI 경유) | 지원 CNI·NIC 필요, 테스트 필수 |

**주의**: 점보 프레임은 **end-to-end 모두가 9000을 지원**할 때만 효과.
한 홉이라도 1500이면 **모두 프래그멘테이션 또는 MSS 협상으로 떨어진다**.

### 7-2. HTTPS가 "hang"될 때

```bash
# 현상: TLS 핸드셰이크 중 서버 Certificate 메시지에서 멈춤
curl -v https://example.com

# 확인: 경로 MTU가 1500이 아닌데 PMTUD가 안 되는 경우
ip route get $(dig +short example.com | head -1)

# 우회: MSS를 내려서 강제로 작은 세그먼트만 보내기
ip route add $(dig +short example.com | head -1)/32 via <gw> mtu 1400 advmss 1360
```

TLS Certificate 메시지는 보통 **여러 KB**여서 MTU 이슈에 가장 먼저 부딪힌다.

### 7-3. K8s 파드 간 8443 연결만 간헐적으로 끊김

```bash
# 1. 노드에서 경로 MTU 확인
kubectl debug node/<node> -it --image=nicolaka/netshoot -- \
  ping -M do -s 1472 <다른 노드 IP>

# 2. CNI MTU 설정 확인 (Calico)
kubectl get felixconfigurations default -o yaml | grep -i mtu

# 3. VXLAN 50B 고려하여 파드 MTU 1450인지 확인
kubectl exec <pod> -- ip link show eth0 | grep mtu
```

**기대값**: 언더레이 MTU = 1500이면 파드 MTU는 **1450**.
1500으로 설정되어 있으면 오버레이 오버헤드만큼 프래그멘테이션·드롭 발생.

### 7-4. AWS·GCP 점보 프레임 기본값

| 경로 | 최대 MTU | 비고 |
|---|---|---|
| AWS EC2 (같은 VPC·AZ) | 9001 | ENA 필요 |
| AWS VPC peering (같은 리전) | 9001 | 동일 리전만 |
| AWS Transit Gateway (VPC↔VPC) | 8500 | 2023년 PMTUD 기본 활성화 |
| AWS IGW (인터넷) · VPN | 1500 | 경계 지점 |
| GCP VPC (기본) | 1460 | 1300~8896에서 선택 가능 |
| Azure VM 기본 | 1500 | Accelerated Networking 지원 SKU에 따라 조정 |

**함정**: EC2 내부는 9001인데 **IGW·Site-to-Site VPN**을 거치면 1500으로 떨어진다.
TGW는 8500까지 지원하지만 혼합 경로에서는 PMTUD가 반드시 동작해야 블랙홀을 피한다.

---

## 8. 체크리스트

네트워크 설계·트러블슈팅 시 아래 항목을 확인한다.

| 영역 | 확인 |
|---|---|
| 방화벽 | ICMP Type 3 Code 4 (IPv4) · ICMPv6 Type 2 (IPv6) 허용 |
| 오버레이 | 파드·터널 MTU = 언더레이 MTU − 오버헤드 |
| VPN | IPsec·WireGuard 경로에 MSS 클램핑 또는 MTU 조정 |
| 점보 프레임 | end-to-end 일치 확인, NIC·스위치·클라우드 모두 지원 |
| TSO/GSO/GRO | 디버깅 중엔 꺼서 재현성 확보 |
| IPv6 | ICMPv6 차단 금지, 최소 MTU 1280 보장 |
| TCP 옵션 | `tcp_mtu_probing=1` (sysctl) 활성화 고려 |
| 클라우드 경계 | VPC peering·TGW·IGW·VPN 각 경로의 MTU·PMTUD 동작 확인 |
| 듀얼스택 | IPv6 오버헤드(+20B) 감안한 MTU 재계산 |

---

## 9. 요약

| 개념 | 한 줄 요약 |
|---|---|
| MTU | L2 한 번에 보낼 수 있는 최대 IP 패킷 |
| MSS | MTU에서 IP·TCP 헤더를 뺀 TCP 페이로드 한도 |
| DF | 중간 프래그멘테이션 금지 플래그 (TCP는 기본 1) |
| PMTUD | ICMP로 경로 MTU를 학습하는 과정 |
| PLPMTUD | ICMP 없이 TCP/QUIC이 스스로 탐색 (RFC 4821) |
| MSS Clamping | PMTUD가 안 될 때 SYN 단계에서 강제 축소 |
| 오버레이 함정 | 내부 MTU = 외부 MTU − 오버헤드, 이중 캡슐화는 누적 |
| IPv6 | PMTUD가 필수, ICMPv6 차단 금지 |

---

## 참고 자료

- [RFC 1191 — Path MTU Discovery](https://www.rfc-editor.org/rfc/rfc1191) — 확인: 2026-04-20
- [RFC 4821 — Packetization Layer Path MTU Discovery](https://www.rfc-editor.org/rfc/rfc4821) — 확인: 2026-04-20
- [RFC 8201 — Path MTU Discovery for IP version 6](https://www.rfc-editor.org/rfc/rfc8201) — 확인: 2026-04-20
- [RFC 8899 — PLPMTUD for Datagram Transports (QUIC 관련)](https://www.rfc-editor.org/rfc/rfc8899) — 확인: 2026-04-20
- [Cloudflare Blog — Path MTU discovery in practice](https://blog.cloudflare.com/path-mtu-discovery-in-practice/) — 확인: 2026-04-20
- [Linux kernel — ip-sysctl (tcp_mtu_probing)](https://www.kernel.org/doc/html/latest/networking/ip-sysctl.html) — 확인: 2026-04-20
- [Calico docs — MTU configuration](https://docs.tigera.io/calico/latest/networking/configuring/mtu) — 확인: 2026-04-20
- [Cilium docs — MTU](https://docs.cilium.io/en/stable/network/concepts/mtu/) — 확인: 2026-04-20
- [AWS — Jumbo frames on EC2](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/network_mtu.html) — 확인: 2026-04-20
