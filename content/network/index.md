---
title: "Network"
sidebar_label: "Network"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - network
  - index
---

# Network

> **티어**: 서브 (기반) — **작성 원칙**: 필수만
>
> 장애 원인의 절반은 네트워크다.
> Kubernetes · Observability · Security 학습의 선행 지식.

---

## 학습 경로

```
기본기       OSI · TCP/IP · 패킷 분석
주소·라우팅  IP · BGP · VLAN
이름·보안    DNS · TLS · mTLS
애플리케이션 HTTP/2/3 · LB · Proxy
현대         CNI · Service Mesh · Post-Quantum
호스트 도구   iproute2 · firewall · SSH · DNS 설정
```

---

## 목차

### 기본기

- [x] [OSI·TCP/IP](basics/osi-tcp-ip.md) — OSI 7 layer, TCP/IP 4 layer, 실무 매핑
- [x] [패킷 분석](basics/packet-analysis.md) — tcpdump, Wireshark, tshark 실전
- [x] [MTU·MSS](basics/mtu-mss.md) — Path MTU Discovery, 오버레이에서의 MTU 함정

### IP·라우팅

- [x] [라우팅 기본](ip-routing/routing-basics.md) — 라우팅 테이블, ECMP, 기본 게이트웨이
- [x] [BGP 기본](ip-routing/bgp-basics.md) — AS, peering, route reflector, BGP in DC

### DNS

- [x] [DNS 아키텍처](dns/dns-architecture.md) — Authoritative vs Recursive, DNSSEC
- [x] [DNS 운영](dns/dns-operations.md) — TTL, SRV, 클러스터 DNS 동작
- [x] [DNS 설정](dns/dns-config.md) — Linux 리졸버, systemd-resolved, resolv.conf

### TLS·PKI (기본)

- [x] [TLS 기본](tls-pki/tls-basics.md) — 핸드셰이크, 인증서 체인, SNI, ALPN
- [x] [mTLS 기본](tls-pki/mtls-basics.md) — 상호 인증, 인증서 발급 흐름
- [x] [포스트 양자 TLS](tls-pki/post-quantum-tls.md) — ML-KEM (Kyber), X25519Kyber768, 전환 전략

### HTTP 프로토콜

- [x] [HTTP 버전](http/http-versions.md) — HTTP/1.1 · HTTP/2 · HTTP/3 비교
- [x] [HTTP/3·QUIC](http/http3-quic.md) — QUIC, 0-RTT, UDP 차단·NAT 함정

### 로드밸런서·프록시

- [x] [L4·L7 기본](lb-proxy/l4-l7-basics.md) — L4 vs L7, 알고리즘, 세션 유지
- [x] [리버스 프록시](lb-proxy/reverse-proxy.md) — Nginx·HAProxy·Envoy·Traefik 비교
- [x] [CDN·Edge](lb-proxy/cdn-edge.md) — CDN 계층, origin shielding, edge compute

### VPC·VPN

- [x] [VPC 설계](vpc-vpn/vpc-design.md) — 서브넷, NAT, VPC peering, Transit Gateway 개념
- [x] [VPN·WireGuard](vpc-vpn/vpn-wireguard.md) — IPsec vs WireGuard, mesh VPN

### 컨테이너·K8s 네트워크

- [ ] CNI 비교 — Calico · Cilium · Flannel · AWS VPC CNI
- [ ] Service Mesh — Istio · Linkerd · Cilium Mesh · Ambient Mode

### 호스트 네트워크 도구 (Linux)

- [x] [iproute2](host-tools/iproute2.md) — ip, ss, tc 명령어 실전
- [x] [방화벽](host-tools/firewall.md) — iptables, nftables, firewalld, ufw
- [x] [SSH 설정](host-tools/ssh.md) — 키 관리, 터널, 포트 포워딩, 보안

### 트러블슈팅

- [ ] 네트워크 트러블슈팅 — mtr, ss, iperf3, eBPF 기반 진단

---

## 이 카테고리의 경계

- K8s Network Policy·Service 리소스는 `kubernetes/`에 맡긴다
- 네트워크 보안 **전략**은 `security/`로 (mTLS 전략, Zero Trust)
- eBPF 네트워크 응용은 여기, 커널 측면은 `linux/`

---

## 참고 표준

- RFC (해당 프로토콜별)
- Cloudflare Blog (네트워크 심층)
- Cilium·Calico 공식 문서
