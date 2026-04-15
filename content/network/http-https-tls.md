---
title: "HTTP/HTTPS와 TLS"
date: 2026-04-13
tags:
  - network
  - http
  - https
  - tls
  - security
sidebar_label: "HTTP·TLS"
---

# HTTP/HTTPS와 TLS

## 1. HTTP 버전 비교

| 항목 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|---------|--------|--------|
| 전송 프로토콜 | TCP | TCP | **QUIC (UDP)** |
| 멀티플렉싱 | 없음 (파이프라이닝 한계) | **있음** | **있음** |
| 헤더 압축 | 없음 | **HPACK** | **QPACK** |
| HOL Blocking | 있음 (L7) | 있음 (L4 TCP) | **없음** |
| 연결 수립 | TCP(1.5-RTT)+TLS 1.2(2-RTT)=3.5-RTT | TCP(1.5)+TLS 1.3(1)=2.5-RTT | **1-RTT** (재연결 0-RTT) |
| 표준화 연도 | 1997/1999 (RFC 2068/2616) | 2015 | 2022 |

> **HOL Blocking (Head-of-Line)**: HTTP/2는 TCP 수준 패킷 손실 시
> 모든 스트림이 대기한다. HTTP/3의 QUIC은 스트림별로 독립적이라 이 문제가 없다.

```bash
# 서버의 HTTP 버전 확인
curl -sI --http2 https://example.com | head -1
# HTTP/2 200

curl -sI --http3 https://example.com | head -1
# HTTP/3 200
```

---

## 2. HTTPS와 TLS 핸드셰이크

### TLS 1.3 핸드셰이크 (현재 표준)

```
클라이언트                           서버
    |                                  |
    |--- ClientHello (키 교환 포함) -->|
    |<-- ServerHello + 인증서 + Fin ---|
    |--- Finished ------------------>  |
    |                                  |
    |<========= 암호화 통신 ==========>|
```

TLS 1.3은 **1-RTT** (왕복 1회)로 핸드셰이크 완료.
재연결 시 **0-RTT** 가능 (세션 재개).

> ⚠️ **0-RTT Replay Attack 주의**: 0-RTT 데이터는 Forward Secrecy가 없고
> 공격자가 재전송할 수 있다 (RFC 8446 §C.5).
> POST·DB 트랜잭션 등 멱등성 없는 요청에는 0-RTT를 사용하지 말아야 한다.

### TLS 1.2 vs TLS 1.3

| 항목 | TLS 1.2 | TLS 1.3 |
|------|---------|---------|
| 핸드셰이크 | 2-RTT (TLS만, TCP 포함 시 3.5-RTT) | **1-RTT** (TCP 포함 시 2.5-RTT) |
| 취약 암호화 | RC4, 3DES, SHA-1 허용 | **제거됨** |
| Perfect Forward Secrecy | 선택적 | **기본 필수** |
| 0-RTT 재개 | 없음 | **있음** |
| 현재 권장 | 하위 호환용 | **권장** |

```bash
# TLS 버전 및 인증서 정보 확인
openssl s_client -connect example.com:443 -brief

# TLS 1.3 강제 확인
openssl s_client -connect example.com:443 -tls1_3

# 인증서 만료일 확인
echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## 3. 인증서 체계

```
루트 CA (Root Certificate Authority)
    └── 중간 CA (Intermediate CA)
              └── 리프 인증서 (서버 인증서) ← 실제 배포
```

| 인증서 유형 | 검증 범위 | 발급 속도 | 비용 |
|-----------|---------|---------|------|
| DV (Domain Validation) | 도메인 소유만 | 수분 | 무료 (Let's Encrypt) |
| OV (Organization Validation) | 도메인 + 조직 | 수일 | 유료 |
| EV (Extended Validation) | 조직 신원 상세 검증 | 수주 | 고가 |

```bash
# Let's Encrypt 인증서 발급 (certbot standalone)
# ⚠️ standalone은 80포트를 직접 점유한다.
# 실행 중인 웹서버를 중단해야 하며,
# 프로덕션 무중단 갱신에는 --webroot 또는 DNS-01 챌린지를 권장한다.
certbot certonly --standalone -d example.com

# 자동 갱신 확인
certbot renew --dry-run
```

---

## 4. SNI (Server Name Indication)

하나의 IP에 여러 도메인을 운영할 때,
클라이언트가 TLS 핸드셰이크 시 대상 도메인을 평문으로 전송한다.

```bash
# SNI 포함 연결 확인
openssl s_client -connect 93.184.216.34:443 \
  -servername example.com
```

> SNI는 평문이라 감청 가능하다.
> **ECH (Encrypted Client Hello)**가 이를 암호화한다.
> ECH는 2026년 3월 **RFC 9849**로 정식 표준화되었다.

---

## 5. HSTS

브라우저가 해당 도메인을 항상 HTTPS로만 접근하도록 강제한다.

```
HTTP 응답 헤더:
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

| 옵션 | 의미 |
|------|------|
| `max-age` | HSTS 유효 기간 (초) |
| `includeSubDomains` | 서브도메인에도 적용 |
| `preload` | 브라우저 HSTS 목록에 사전 등록 |

---

## 6. mTLS (Mutual TLS)

일반 TLS는 서버 인증만 한다.
mTLS는 **클라이언트도 인증서로 인증**한다.

```
일반 TLS:  클라이언트 ←── 서버 인증서 검증 ──── 서버
mTLS:      클라이언트 ←── 서버 인증서 검증 ──── 서버
           클라이언트 ──── 클라이언트 인증서 → 서버
```

**활용 사례:**
- 서비스 메시 (Istio, Linkerd): Pod 간 통신 자동 mTLS
- API 서버 ↔ 클라이언트 인증
- Zero Trust 네트워크 아키텍처

```bash
# mTLS 연결 테스트
curl --cert client.crt --key client.key \
     --cacert ca.crt \
     https://api.example.com/endpoint
```

---

## 7. 실무 TLS 점검

```bash
# 지원 TLS 버전/암호화 수트 전체 확인
nmap --script ssl-enum-ciphers -p 443 example.com

# SSL Labs 등급 확인 (공개 서비스, v4 API - 이메일 등록 필요)
# v3는 2024년 1월 deprecated, v4 사용 권장
curl -s "https://api.ssllabs.com/api/v4/analyze?host=example.com" \
  | jq '.endpoints[0].grade'

# Nginx TLS 1.3 설정 예시
cat /etc/nginx/conf.d/ssl.conf
# ssl_protocols TLSv1.2 TLSv1.3;
# ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:...;
# ssl_prefer_server_ciphers off;  # TLS 1.3에서는 불필요
# add_header Strict-Transport-Security "max-age=31536000" always;
```

---

## 참고 문서

- [Cloudflare - TLS 핸드셰이크](https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/)
- [MDN - HTTP 개요](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)
- [RFC 8446 - TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [RFC 9114 - HTTP/3](https://www.rfc-editor.org/rfc/rfc9114)
- [RFC 9849 - TLS Encrypted Client Hello (ECH)](https://www.rfc-editor.org/rfc/rfc9849)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
