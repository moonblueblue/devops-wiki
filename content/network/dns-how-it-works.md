---
title: "DNS 동작 원리"
date: 2026-04-13
tags:
  - network
  - dns
  - fundamentals
  - kubernetes
sidebar_label: "DNS 동작 원리"
---

# DNS 동작 원리

## 1. DNS 계층 구조

```
루트 DNS (.)
    ├── .com TLD
    │     └── example.com (Authoritative NS)
    ├── .io TLD
    └── .kr TLD
```

| 서버 유형 | 역할 | 예시 |
|----------|------|------|
| 루트 네임서버 | TLD 서버 위치 알림 | a.root-servers.net |
| TLD 네임서버 | 권한 서버 위치 알림 | a.gtld-servers.net |
| 권한 네임서버 | 최종 IP 응답 | NS 레코드에 명시된 서버 |
| 재귀 리졸버 | 클라이언트 대신 쿼리 수행 | ISP DNS, 8.8.8.8 |

---

## 2. DNS 쿼리 흐름

```
클라이언트
    ↓ 1. example.com 쿼리
재귀 리졸버 (캐시 확인)
    ↓ 2. 루트 서버에 질의
루트 서버 → ".com TLD 서버 주소" 응답
    ↓ 3. TLD 서버에 질의
TLD 서버 → "example.com 권한 서버 주소" 응답
    ↓ 4. 권한 서버에 질의
권한 서버 → "93.184.216.34" 응답
    ↓ 5. 결과 캐시 후 클라이언트 전달
```

```bash
# 전체 DNS 쿼리 경로 추적
dig +trace example.com

# 특정 DNS 서버에 직접 질의
dig @8.8.8.8 example.com

# 짧은 출력
dig +short example.com
```

---

## 3. DNS 레코드 타입

| 타입 | 용도 | 예시 |
|------|------|------|
| `A` | 도메인 → IPv4 | `example.com. A 93.184.216.34` |
| `AAAA` | 도메인 → IPv6 | `example.com. AAAA 2606:2800::1` |
| `CNAME` | 도메인 → 도메인 별칭 | `www → example.com` |
| `MX` | 메일 서버 | `mail.example.com` (우선순위 포함) |
| `TXT` | 텍스트 (SPF, DKIM 등) | `"v=spf1 include:..."` |
| `NS` | 권한 네임서버 지정 | `ns1.example.com` |
| `PTR` | IP → 도메인 (역방향) | `34.216.184.93.in-addr.arpa` |
| `SRV` | 서비스 위치 | `_http._tcp.example.com` |

```bash
# 레코드 타입별 조회
dig example.com A
dig example.com MX
dig example.com TXT
dig -x 93.184.216.34   # PTR (역방향)
```

---

## 4. TTL과 캐싱

```
TTL (Time To Live)
  → 레코드를 캐시에 보관할 시간 (초 단위)
  → 낮을수록: 변경 빠름, DNS 쿼리 많음
  → 높을수록: 빠른 응답, 변경 반영 느림
```

| TTL 값 | 용도 |
|--------|------|
| 60~300초 | 자주 변경되는 서비스 (배포 전 낮춤) |
| 3600초 (1시간) | 일반적 설정 |
| 86400초 (1일) | 잘 변경되지 않는 설정 |

```bash
# TTL 확인
dig example.com | grep -E "^example|IN"
# example.com.    300  IN  A  93.184.216.34
#                 ↑
#                 TTL=300초
```

---

## 5. DNS 트러블슈팅

```bash
# 기본 조회
dig example.com
nslookup example.com

# 권한 서버에서 직접 확인 (캐시 무시)
dig @ns1.example.com example.com

# 전파 확인 (변경 후)
dig +short example.com @8.8.8.8      # Google DNS
dig +short example.com @1.1.1.1      # Cloudflare DNS
dig +short example.com @208.67.222.222  # OpenDNS

# 로컬 DNS 캐시 확인 (Linux)
systemd-resolve --statistics
# Cache: 45 current entries
```

### 자주 보는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| NXDOMAIN | 레코드 없음 | 레코드 생성 확인 |
| SERVFAIL | 권한 서버 응답 없음 | NS 레코드 확인 |
| 오래된 IP 반환 | TTL 캐시 | TTL 만료 대기 또는 낮춤 |
| 내부/외부 응답 다름 | Split-horizon DNS | 각 서버 설정 확인 |

---

## 6. DNS over HTTPS / TLS

| 방식 | 포트 | 특징 |
|------|------|------|
| 기본 DNS | UDP/53, TCP/53 | 평문, 감청 가능 |
| DoT (DNS over TLS) | TCP/853 | TLS 암호화 |
| DoH (DNS over HTTPS) | TCP/443 | HTTPS로 위장, 방화벽 우회 |

---

## 7. Kubernetes CoreDNS

쿠버네티스는 CoreDNS가 클러스터 내부 DNS를 담당한다.

```bash
# CoreDNS 상태 확인
kubectl get pods -n kube-system -l k8s-app=kube-dns

# CoreDNS 설정 확인
kubectl get configmap coredns -n kube-system -o yaml
```

### Pod DNS 쿼리 순서

```
Pod 내부에서 "myservice" 쿼리 시:
  1. myservice.default.svc.cluster.local
  2. myservice.svc.cluster.local
  3. myservice.cluster.local
  4. myservice (외부)
```

```yaml
# ndots 설정으로 외부 DNS 쿼리 성능 개선
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"   # 기본값 5 → 점 2개 미만이면 바로 외부 쿼리
```

> `ndots: 5` 기본값은 외부 도메인 쿼리 시 불필요한 내부 쿼리를 5번 먼저 시도한다.
> 외부 API를 많이 호출하는 서비스는 `ndots: 2`로 낮추면 레이턴시가 개선된다.

---

## 참고 문서

- [Cloudflare - DNS란](https://www.cloudflare.com/learning/dns/what-is-dns/)
- [RFC 1034 - DNS Concepts](https://www.rfc-editor.org/rfc/rfc1034)
- [Kubernetes - DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [CoreDNS 공식 문서](https://coredns.io/manual/toc/)
