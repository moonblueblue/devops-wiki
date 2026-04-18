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

- [ ] osi-tcp-ip — OSI 7 layer, TCP/IP 4 layer, 실무 매핑
- [ ] packet-analysis — tcpdump, Wireshark, tshark 실전
- [ ] mtu-mss — Path MTU Discovery, 오버레이에서의 MTU 함정

### IP & Routing

- [ ] routing-basics — 라우팅 테이블, ECMP, 기본 게이트웨이
- [ ] bgp-basics — AS, peering, route reflector, BGP in DC

### DNS

- [ ] dns-architecture — Authoritative vs Recursive, DNSSEC
- [ ] dns-operations — TTL, SRV, 클러스터 DNS 동작
- [ ] [dns-config](dns-config.md) — Linux 리졸버, systemd-resolved, resolv.conf

### TLS & PKI (기본)

- [ ] tls-basics — 핸드셰이크, 인증서 체인, SNI, ALPN
- [ ] mtls-basics — 상호 인증, 인증서 발급 흐름
- [ ] post-quantum-tls — ML-KEM (Kyber), X25519Kyber768, 전환 전략

### HTTP 프로토콜

- [ ] http-versions — HTTP/1.1 · HTTP/2 · HTTP/3 비교
- [ ] http3-quic — QUIC, 0-RTT, UDP 차단·NAT 함정

### Load Balancer & Proxy

- [ ] l4-l7-basics — L4 vs L7, 알고리즘, 세션 유지
- [ ] reverse-proxy — Nginx·HAProxy·Envoy 비교
- [ ] cdn-edge — CDN 계층, origin shielding, edge compute

### VPC & VPN

- [ ] vpc-design — 서브넷, NAT, VPC peering, Transit Gateway 개념
- [ ] vpn-wireguard — IPsec vs WireGuard, mesh VPN

### Container/K8s Network

- [ ] cni-comparison — Calico · Cilium · Flannel · AWS VPC CNI
- [ ] service-mesh — Istio · Linkerd · Cilium Mesh · Ambient Mode

### 호스트 네트워크 도구 (Linux)

- [ ] [iproute2](iproute2.md) — ip, ss, tc 명령어 실전
- [ ] [firewall](firewall.md) — iptables, nftables, firewalld, ufw
- [ ] [ssh](ssh.md) — 키 관리, 터널, 포트 포워딩, 보안

### 트러블슈팅

- [ ] network-troubleshooting — mtr, ss, iperf3, eBPF 기반 진단

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
