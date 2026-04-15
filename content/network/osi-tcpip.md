---
title: "OSI 7계층과 TCP/IP 모델"
date: 2026-04-13
tags:
  - network
  - osi
  - tcpip
  - fundamentals
sidebar_label: "OSI·TCP/IP"
---

# OSI 7계층과 TCP/IP 모델

## 1. OSI 7계층

```
7  Application   HTTP, FTP, DNS, SMTP         ← 사용자가 직접 다루는 계층
6  Presentation  TLS/SSL, JPEG, JSON 인코딩   ← 암호화, 압축, 형식 변환
5  Session       RPC, NetBIOS                  ← 세션 수립/유지/종료
4  Transport     TCP, UDP                      ← 포트, 흐름 제어, 신뢰성
3  Network       IP, ICMP, BGP, OSPF           ← 라우팅, 논리 주소
2  Data Link     Ethernet, ARP/NDP, VLAN       ← MAC 주소, 프레임 전송
1  Physical      케이블, 광섬유, 무선 신호     ← 비트 전송
```

### 계층별 PDU (Protocol Data Unit)

| 계층 | PDU 이름 | 주소 체계 |
|------|---------|----------|
| 7~5 | 메시지 (Message) | - |
| 4 Transport | 세그먼트(TCP) / 데이터그램(UDP) | 포트 번호 |
| 3 Network | 패킷 (Packet) | IP 주소 |
| 2 Data Link | 프레임 (Frame) | MAC 주소 |
| 1 Physical | 비트 (Bit) | - |

---

## 2. TCP/IP 4계층 모델

실제 인터넷은 TCP/IP 4계층으로 구현된다.

| TCP/IP | OSI 대응 | 주요 프로토콜 |
|--------|---------|-------------|
| Application | 5, 6, 7 | HTTP, DNS, SSH, SMTP |
| Transport | 4 | TCP, UDP |
| Internet | 3 | IP, ICMP |
| Link | 1, 2 | Ethernet, Wi-Fi, ARP (IPv6: NDP) |

OSI는 **개념 모델** (트러블슈팅, 교육용),
TCP/IP는 **구현 모델** (실제 동작)이다.

---

## 3. 데이터 캡슐화

송신 시 각 계층이 헤더를 추가하고,
수신 시 역순으로 헤더를 제거한다.

```
Application   [HTTP 데이터]
Transport     [TCP 헤더 | HTTP 데이터]
Network       [IP 헤더 | TCP 헤더 | HTTP 데이터]
Data Link     [Eth 헤더 | IP 헤더 | TCP 헤더 | HTTP 데이터 | Eth FCS]
Physical      01101010... (비트열)
```

---

## 4. 실무 관점: 계층별 트러블슈팅

OSI 모델의 실제 가치는 **장애 원인을 계층별로 좁히는 것**이다.

```
증상: 서비스 접속 불가
    ↓
L1 물리: 케이블 연결? NIC 링크?
  → ip link show | grep "state UP"
    ↓
L2 데이터링크: ARP 테이블?
  → arp -n / ip neigh
    ↓
L3 네트워크: 라우팅? IP 도달 가능?
  → ping, traceroute, ip route
    ↓
L4 트랜스포트: 포트 열려있음? 방화벽?
  → ss -tnlp, telnet, nc
    ↓
L7 애플리케이션: 앱 응답? HTTP 상태코드?
  → curl -v, wget
```

---

## 5. L2 / L3 / L4 / L7 장비

| 계층 | 장비/기술 | 동작 기준 |
|------|---------|----------|
| L2 | 스위치, VLAN | MAC 주소 |
| L3 | 라우터, L3 스위치 | IP 주소 |
| L4 | L4 로드밸런서 | IP + 포트 |
| L7 | L7 로드밸런서, WAF | HTTP 헤더, URL, 쿠키 |

### L4 vs L7 로드밸런서

| 항목 | L4 LB | L7 LB |
|------|-------|-------|
| 동작 계층 | Transport | Application |
| 라우팅 기준 | IP + 포트 | URL, 헤더, 쿠키 |
| TLS 처리 | 없음 (pass-through, 단 TLS 종료 지원 제품 존재 예: AWS NLB TLS listener) | TLS 종료 가능 |
| 속도 | **빠름** | 상대적으로 느림 |
| 지능형 라우팅 | 불가 | **가능** |
| 예시 | AWS NLB, HAProxy TCP | AWS ALB, Nginx, Envoy |

---

## 6. ARP 동작

같은 네트워크(L2)에서 IP → MAC 주소 변환을 담당한다.

```bash
# ARP 테이블 확인
ip neigh show
# 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE

# ARP 캐시 강제 삭제
ip neigh flush all
```

---

## 참고 문서

- [Cloudflare - OSI Model](https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/)
- [MDN - HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
- [RFC 9293 - TCP (RFC 793 obsoletes)](https://www.rfc-editor.org/rfc/rfc9293)
