---
title: "TCP vs UDP"
date: 2026-04-13
tags:
  - network
  - tcp
  - udp
  - quic
  - fundamentals
sidebar_label: "TCP vs UDP"
---

# TCP vs UDP

## 1. 핵심 차이

| 항목 | TCP | UDP |
|------|-----|-----|
| 연결 | 연결 지향 (3-way handshake) | 비연결 |
| 신뢰성 | **보장** (재전송, 순서 보장) | 없음 |
| 흐름 제어 | **있음** (슬라이딩 윈도우) | 없음 |
| 혼잡 제어 | **있음** (CUBIC, BBR) | 없음 |
| 오버헤드 | 높음 (20바이트 헤더) | **낮음** (8바이트 헤더) |
| 속도 | 상대적으로 느림 | **빠름** |
| 주요 사례 | HTTP, SSH, DB | DNS, 스트리밍, QUIC |

---

## 2. TCP 3-way Handshake

```
클라이언트           서버
    |                  |
    |--- SYN ---------->|  (seq=x)
    |<-- SYN+ACK -------|  (seq=y, ack=x+1)
    |--- ACK ---------->|  (ack=y+1)
    |                  |
    |<== 데이터 전송 ==>|
```

```bash
# TCP 연결 상태 확인
ss -tn state established
ss -tn state syn-sent
ss -tn state time-wait | wc -l   # TIME_WAIT 수
```

## 3. TCP 4-way Teardown

```
클라이언트           서버
    |--- FIN ---------->|
    |<-- ACK -----------|
    |<-- FIN -----------|
    |--- ACK ---------->|
    |                   |
  TIME_WAIT (2×MSL 대기)
```

`TIME_WAIT` 상태는 최대 2분간 유지된다 (기본 MSL=60초).
`tcp_fin_timeout`으로 조정 가능하다.

---

## 4. TCP 주요 상태

```
CLOSED → LISTEN → SYN_RECEIVED → ESTABLISHED
                                      ↓
                              FIN_WAIT_1 → FIN_WAIT_2
                                              ↓
                                         TIME_WAIT → CLOSED
```

| 상태 | 의미 |
|------|------|
| `LISTEN` | 연결 대기 중 (서버) |
| `SYN_SENT` | 연결 요청 보냄 (클라이언트) |
| `ESTABLISHED` | 연결 완료, 데이터 전송 중 |
| `TIME_WAIT` | 연결 종료 후 대기 (2×MSL) |
| `CLOSE_WAIT` | 상대방이 종료, 내 쪽 아직 열림 |

```bash
# 상태별 소켓 수
ss -tan | awk 'NR>1 {print $1}' | sort | uniq -c | sort -rn
```

---

## 5. TCP 흐름 제어와 혼잡 제어

### 슬라이딩 윈도우 (흐름 제어)

수신측이 처리할 수 있는 만큼만 데이터를 보내도록 제어한다.

```
수신 윈도우 크기 → /proc/sys/net/ipv4/tcp_rmem 설정
```

### 혼잡 제어

| 알고리즘 | 방식 | 특징 |
|---------|------|------|
| CUBIC | 패킷 손실 기반 | Linux 기본값 |
| BBR | 대역폭+RTT 기반 | 고대역폭·고RTT 환경 유리 |

```bash
# 현재 혼잡 제어 알고리즘
sysctl net.ipv4.tcp_congestion_control
```

---

## 6. UDP

신뢰성보다 **속도**가 중요한 경우에 사용한다.

```
UDP 사용 사례:
  DNS          → 빠른 응답 우선, 실패 시 재시도
  DHCP         → 브로드캐스트 필요
  NTP          → 정밀한 타임스탬프, 낮은 오버헤드
  VoIP/영상통화 → 낮은 레이턴시 우선, 약간의 손실 허용
  게임         → 실시간 위치 정보
  QUIC (HTTP/3) → UDP 위에서 신뢰성을 직접 구현
```

---

## 7. QUIC / HTTP/3

QUIC은 UDP 기반으로 TCP의 신뢰성을 직접 구현한 프로토콜이다.

```
TCP + TLS:      TCP handshake (1-RTT) + TLS handshake (1-RTT) = 2-RTT
QUIC:           단일 핸드셰이크 (1-RTT), 재연결 시 0-RTT
```

| 항목 | TCP + TLS | QUIC |
|------|---------|------|
| HOL Blocking | 있음 | **없음** (스트림 독립) |
| 연결 이동 | 재연결 필요 | **Connection ID로 유지** (Wi-Fi → LTE) |
| 핸드셰이크 | 2-RTT | **1-RTT** (재연결 0-RTT) |
| 헤더 압축 | HPACK | **QPACK** |

```bash
# HTTP/3 지원 서버 확인
curl -sI --http3 https://cloudflare.com | head -1

# QUIC 연결 상태 확인
ss -u state established
```

---

## 8. 프로토콜 선택 기준

```
데이터 손실 허용 불가 (파일 전송, DB, API)?
    → TCP

실시간성 중요, 약간의 손실 허용 (스트리밍, 게임)?
    → UDP

낮은 레이턴시 + 신뢰성 모두 필요 (HTTP/3)?
    → QUIC (UDP 기반)

브로드캐스트/멀티캐스트 필요?
    → UDP
```

---

## 참고 문서

- [RFC 793 - TCP](https://www.rfc-editor.org/rfc/rfc793)
- [RFC 768 - UDP](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 9000 - QUIC](https://www.rfc-editor.org/rfc/rfc9000)
- [Cloudflare - TCP vs UDP](https://www.cloudflare.com/learning/ddos/glossary/user-datagram-protocol-udp/)
- [APNIC - Comparing TCP and QUIC](https://blog.apnic.net/2022/11/03/comparing-tcp-and-quic/)
