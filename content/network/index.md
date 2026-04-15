---
title: "Network"
date: 2026-04-16
tags:
  - network
  - roadmap
sidebar_label: "Network"
---

# 02. Network

트러블슈팅의 절반은 네트워크다.
HTTP, DNS, TLS, 라우팅 같은 기본기와 현대 프로토콜(HTTP/3, gRPC),
SDN, eBPF 네트워킹까지 글로벌 스탠다드 DevOps 엔지니어의 필수 역량.

## 목차

### 기초 이론

- [ ] [OSI 7계층과 TCP/IP 모델](osi-tcpip.md)
- [ ] [이더넷, ARP, MAC과 IP의 관계](ethernet-arp.md)
- [ ] [TCP vs UDP (3-way handshake, 흐름제어, 혼잡제어)](tcp-vs-udp.md)
- [ ] [소켓 프로그래밍 개념](socket-basics.md)

### DNS

- [ ] [DNS 동작 원리와 쿼리 흐름](dns-how-it-works.md)
- [ ] [DNS 레코드 타입 (A, AAAA, CNAME, MX, TXT, SRV)](dns-records.md)
- [ ] [DNS 보안 (DNSSEC, DoH, DoT)](dns-security.md)
- [ ] [DNS 트러블슈팅 (dig, nslookup, drill)](dns-troubleshooting.md)

### HTTP와 현대 웹 프로토콜

- [ ] [HTTP/1.1, HTTP/2, HTTP/3 (QUIC) 차이](http-versions.md)
- [ ] [REST와 HTTP API 설계](rest-api.md)
- [ ] [gRPC와 Protocol Buffers](grpc.md)
- [ ] [WebSocket, Server-Sent Events, WebRTC](websocket-sse-webrtc.md)

### TLS와 PKI

- [ ] [TLS 1.2/1.3 핸드셰이크](tls-handshake.md)
- [ ] [PKI 구조와 인증서 체인](pki-certificate.md)
- [ ] [Let's Encrypt와 ACME 프로토콜](letsencrypt-acme.md)
- [ ] [cert-manager 기초 (K8s)](cert-manager.md)
- [ ] [mTLS 개념](mtls-basics.md)

### IP 주소와 라우팅

- [ ] [IPv4와 IPv6](ipv4-ipv6.md)
- [ ] [CIDR와 서브넷](subnet-cidr.md)
- [ ] [NAT (SNAT, DNAT, PAT)](nat.md)
- [ ] [라우팅 기초와 라우팅 테이블](routing-basics.md)
- [ ] [BGP 기초 (MetalLB, 클라우드 라우팅)](bgp.md)
- [ ] [Anycast와 Multicast](anycast-multicast.md)

### VPC와 VPN

- [ ] [VPC 설계 원칙 (클라우드/온프레미스)](vpc-design.md)
- [ ] [Transit Gateway와 피어링](transit-gateway.md)
- [ ] [VPN 개념과 WireGuard](wireguard-vpn.md)
- [ ] [IPsec과 OpenVPN](ipsec-openvpn.md)
- [ ] [Zero Trust Network 개요](zero-trust-network.md)

### 로드밸런서와 프록시

- [ ] [L4 vs L7 로드밸런서](load-balancer-l4-l7.md)
- [ ] [로드밸런싱 알고리즘 (RR, LC, hash)](lb-algorithms.md)
- [ ] [Health Check 설계](health-check.md)
- [ ] [Nginx 리버스 프록시](nginx-reverse-proxy.md)
- [ ] [HAProxy](haproxy.md)
- [ ] [Envoy 프록시](envoy.md)

### 컨테이너·쿠버네티스 네트워킹

- [ ] [CNI 플러그인 비교 (Calico, Cilium, Flannel, Weave)](cni-comparison.md)
- [ ] [kube-proxy 모드 (iptables, IPVS, nftables)](kube-proxy-modes.md)
- [ ] [Pod-to-Pod 통신 원리](pod-networking.md)
- [ ] [Service 메시 (Istio, Linkerd, Consul Connect)](service-mesh.md)

### 고성능 네트워킹

- [ ] [eBPF 기반 네트워킹 (Cilium, XDP)](ebpf-networking.md)
- [ ] [Kernel Bypass (DPDK, SR-IOV)](kernel-bypass.md)
- [ ] [TCP 튜닝 (BBR, CUBIC, window scaling)](tcp-tuning.md)
- [ ] [NIC 튜닝 (RSS, RPS, GRO)](nic-tuning.md)

### CDN과 엣지

- [ ] [CDN 개념과 동작 원리](cdn-basics.md)
- [ ] [엣지 컴퓨팅 (Cloudflare Workers, Fastly)](edge-computing.md)

### 트러블슈팅

- [ ] [tcpdump와 Wireshark 실전](packet-capture.md)
- [ ] [mtr, traceroute, ping](path-diagnostics.md)
- [ ] [연결 디버깅 (nc, telnet, curl -v)](connection-debug.md)
- [ ] [nmap 포트 스캐닝](nmap.md)
- [ ] [네트워크 성능 벤치마크 (iperf3, netperf)](network-benchmark.md)

---

## 참고 레퍼런스

- [Cloudflare Learning Center](https://www.cloudflare.com/learning/)
- [High Performance Browser Networking (Ilya Grigorik)](https://hpbn.co/)
- [RFC 공식 문서](https://www.rfc-editor.org/)
- [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/)
