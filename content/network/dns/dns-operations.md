---
title: "DNS 운영 (TTL · SRV · 클러스터 DNS 동작)"
sidebar_label: "DNS 운영"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-20
tags:
  - network
  - dns
  - ttl
  - srv
  - coredns
  - kubernetes
---

# DNS 운영 (TTL · SRV · 클러스터 DNS 동작)

DNS 아키텍처를 배우는 것과 **운영하는 것**은 다른 문제다.
이 글은 DevOps 엔지니어가 반복적으로 마주치는
**TTL 설계 · SRV 활용 · Kubernetes 클러스터 DNS 동작과 튜닝**을 다룬다.

> 아키텍처·DNSSEC·암호화 전송은 [DNS 아키텍처](./dns-architecture.md),
> 리눅스 호스트 리졸버 설정은 [DNS 설정](./dns-config.md) 참고.

---

## 1. TTL 설계

### 1-1. TTL이 의미하는 것

- **권한 서버가 응답에 넣은 TTL** = 캐시할 수 있는 최대 시간
- **재귀 리졸버는 자기 캐시 cap과 비교해 더 작은 값으로 저장**
- **클라이언트(브라우저·앱)는 자기 캐시 정책이 또 있음**

TTL을 바꿔도 **실제 반영은 기존 캐시가 모두 만료될 때까지** 기다려야 한다.

### 1-2. TTL 설계 기준

| 레코드 유형 | 권장 TTL |
|---|---|
| 회사 대표 A/AAAA | 3600 ~ 86400 |
| 이메일 MX | 3600 ~ 86400 |
| 자주 바뀌는 배포 레코드 | 60 ~ 300 |
| 장애 전환용(DR failover) | 30 ~ 60 |
| CDN edge | 벤더 기본 (대부분 60~300) |
| DNSSEC DNSKEY | 3600 ~ 86400 |

### 1-3. 전환 직전·직후 운영

```mermaid
graph TB
    T1["D-7 TTL 축소"]
    T2["D-1 마지막 확인"]
    T3["D-0 실제 전환"]
    T4["D+1 검증 완료"]
    T5["D+7 TTL 복원"]
    T1 --> T2
    T2 --> T3
    T3 --> T4
    T4 --> T5
```

| 시점 | 해야 할 일 |
|---|---|
| D-7 | TTL을 평소 3600 → 60으로 미리 축소. 전 세계 캐시 워밍업 |
| D-0 | 레코드 변경 실행 |
| D+1 | 오래된 캐시 흔적 확인(`dig @1.1.1.1`, `dig @8.8.8.8`) |
| D+7 | 안정화 확인 후 TTL 복원 |

**함정**: 일부 ISP·기업 리졸버가 TTL을 무시하고 고정값으로 캐시하는 경우가 있다.
주요 공용 리졸버(1.1.1.1, 8.8.8.8, 9.9.9.9)로 여러 관점에서 확인한다.

### 1-4. Negative TTL

RFC 2308은 NXDOMAIN(또는 NODATA) 응답의 캐시 시간을
**`min(SOA.minimum, SOA 레코드 자체의 TTL)`**로 정한다.
대부분의 재귀 리졸버는 여기에 **자체 cap**을 추가로 적용한다 (예: 3600s).

| SOA 필드 | 용도 | 권장 범위 (RIPE-203/RFC 1912) |
|---|---|---|
| refresh | 슬레이브 재동기 주기 | 10800~86400 |
| retry | 재시도 주기 | 3600~7200 |
| expire | 슬레이브 존 만료 | 1209600~2419200 (2~4주) |
| minimum | negative TTL 기준값 | 300~3600 |

**주의**: minimum을 너무 크게 잡으면 오타로 잘못 질의한 이름이
그 시간 동안 전 세계 리졸버에 "없음"으로 캐싱된다.

---

## 2. 레코드 실전 사용

### 2-1. SRV 레코드

`_service._proto.name → priority weight port target` 형태.
원래 목적은 **서비스 포트·가중치의 동적 발견**.

```
_sip._tcp.example.com. 3600 IN SRV 10 60 5060 sip1.example.com.
_sip._tcp.example.com. 3600 IN SRV 10 40 5060 sip2.example.com.
_sip._tcp.example.com. 3600 IN SRV 20 100 5060 sip3.example.com.
```

| 필드 | 의미 |
|---|---|
| priority | 낮을수록 우선. 같은 값이면 weight 기반 선택 |
| weight | 같은 priority 안에서 **가중치 기반 랜덤 선택** (RFC 2782 알고리즘) |
| port | 실제 포트 (HTTP/DNS 같은 고정 포트 서비스엔 불필요) |
| target | 대상 호스트명 |

> RFC 2782의 선택 알고리즘은 단순 round-robin이 아니라
> **weighted random selection** — 같은 priority 안에서
> `weight` 값에 비례한 확률로 타겟을 고른다. `weight=0`은 최후 선택 후보.

**실무 사용처**:
- SIP, XMPP, Kerberos, LDAP
- **Kubernetes Headless Service** (Pod별 A 레코드 + SRV)
- **MongoDB SRV URI** (`mongodb+srv://`) — DNS에서 샤드 주소 자동 발견

### 2-2. TXT 레코드의 숨은 역할

단순 텍스트처럼 보이지만 실제로는 **여러 표준 메타데이터의 이름표**다.

| 용도 | 예시 |
|---|---|
| SPF (메일) | `v=spf1 include:_spf.google.com ~all` |
| DKIM | `v=DKIM1; k=rsa; p=MIG...` |
| DMARC | `v=DMARC1; p=reject; rua=mailto:dmarc@example.com` |
| 도메인 소유권 검증 | `google-site-verification=...` |
| ACME-DNS-01 | `_acme-challenge.example.com TXT "<token>"` |

### 2-3. CAA — 인증서 발급 통제

```
example.com. IN CAA 0 issue "letsencrypt.org"
example.com. IN CAA 0 issuewild ";"
example.com. IN CAA 0 iodef "mailto:security@example.com"
```

| 태그 | 의미 |
|---|---|
| `issue` | 지정 CA만 인증서 발급 허용 |
| `issuewild` | 와일드카드 인증서 발급 허용 CA |
| `iodef` | 위반 시 알림 수신 주소 |

CAA는 **모든 CA가 발급 전 반드시 확인**하도록 CA/Browser Forum 규약.
설정 안 하면 "누구나 발급 가능"이 기본값 — 많은 기업이 간과.

---

## 3. Kubernetes 클러스터 DNS

### 3-1. 전체 흐름

```mermaid
graph TB
    POD["Pod"]
    NSCACHE["NodeLocal Cache"]
    COREDNS["CoreDNS"]
    UP["업스트림 리졸버"]
    POD --> NSCACHE
    NSCACHE --> COREDNS
    COREDNS --> UP
```

- **CoreDNS**: 클러스터 DNS 표준 (kube-dns 대체, CNCF Graduated)
- **NodeLocal DNSCache**: DaemonSet으로 각 노드에 캐시 배치
- kubelet이 Pod의 `/etc/resolv.conf`에 자동으로 **CoreDNS ClusterIP**를 주입

### 3-2. Pod `resolv.conf`의 기본

```
search <namespace>.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

| 항목 | 의미 |
|---|---|
| search | 짧은 이름 조회 시 순차 붙여서 시도 |
| nameserver | 클러스터 DNS ClusterIP |
| ndots:5 | 점이 5개 미만이면 search 경로 먼저 시도 |

### 3-3. CoreDNS가 만드는 이름

| 리소스 | 이름 형식 |
|---|---|
| Service | `<svc>.<ns>.svc.cluster.local` |
| Headless Service | Pod 개별 A 레코드 + SRV |
| ExternalName Service | CNAME |
| Pod (hostname 설정 시) | `<pod>.<svc>.<ns>.svc.cluster.local` |
| StatefulSet | `<pod-N>.<svc>.<ns>.svc.cluster.local` (순차 ID) |

### 3-4. `ndots: 5` 함정

```
# 짧은 이름 쿼리: 
api → api.<ns>.svc.cluster.local
    → api.svc.cluster.local
    → api.cluster.local
    → api.<host의 search>  (예: api.ec2.internal)
    → api  (최종)
```

외부 도메인(예: `google.com`)조차 `ndots: 5` 때문에
**5~6회 쿼리가 증폭**된다 → CoreDNS CPU 병목의 주요 원인.

**완화 방법**:

| 방법 | 내용 |
|---|---|
| FQDN 사용 | `google.com.` 뒤에 점 붙이기 |
| `dnsConfig.options` | Pod spec에서 `ndots: 2`로 낮춤 |
| NodeLocal DNSCache | 반복 쿼리를 노드에서 흡수 |
| Stub domain | 특정 존만 별도 업스트림 |

```yaml
# Pod spec 예시
dnsConfig:
  options:
    - name: ndots
      value: "2"
```

### 3-5. CoreDNS 주요 플러그인

| 플러그인 | 역할 |
|---|---|
| `kubernetes` | K8s API 감시 → 서비스·파드 레코드 생성 |
| `forward` | 업스트림 위임 (TLS 암호화 업스트림은 `tls://` 지정) |
| `cache` | 내부 캐싱. 플러그인 상한 기본 NOERROR 3600s / NXDOMAIN 1800s. K8s Corefile 관례는 `cache 30` |
| `prometheus` | `/metrics` 노출 (기본 `:9153`) |
| `log` | 질의 로그 |
| `loop` | 무한 루프 감지 |
| `ready` | readiness (기본 `:8181`) — 미설정 시 Service 미등록 |
| `health` | liveness (기본 `:8080`) — `lameduck 5s`로 graceful 종료 |
| `rewrite` | 이름 재작성 |
| `template` | 동적 응답 |

**RFC 8767 서빙 stale 활용**: 업스트림 장애 시에도 응답을 유지하려면
`cache { serve_stale 1h }`로 만료된 레코드를 최대 1시간 재사용 가능.

### 3-6. NodeLocal DNSCache

```mermaid
graph TB
    POD["Pod eth0"]
    LINK["link-local IP"]
    CACHE["node-local-dns"]
    COREDNS["CoreDNS Service"]
    POD --> LINK
    LINK --> CACHE
    CACHE --> COREDNS
```

- 기본 링크로컬 IP는 `169.254.20.10`이며 manifest에서 변경 가능
- **`interceptAll` + iptables NOTRACK 규칙**으로 CoreDNS ClusterIP 트래픽도
  동일 노드에서 가로채므로 **Pod `resolv.conf`는 변경하지 않아도 된다**

| 효과 | 내용 |
|---|---|
| 지연 감소 | 같은 노드 내 조회 → 수 마이크로초 |
| kube-proxy 부담 감소 | iptables/IPVS conntrack 부담 감소 |
| TCP 연결 재사용 | 업스트림과 keep-alive |
| 장애 내성 | CoreDNS 일시 장애 시에도 캐시 응답 |

**도입 권장**: 50노드 이상 또는 DNS 쿼리 많은 워크로드.
**스케일링**: NodeLocal 미사용 시 CoreDNS 레플리카는
`cluster-proportional-autoscaler` 또는 HPA로 노드 수에 맞춰 조정.

---

## 4. 서비스 디스커버리로서의 DNS

DNS는 현대 서비스 메시 시대에도 여전히 **기본 디스커버리 메커니즘**이다.

| 패턴 | 특징 |
|---|---|
| A 레코드 다중 응답 | 모든 IP 반환 → 클라이언트 LB |
| 헤드리스 서비스 | Pod마다 레코드 → 클라이언트가 직접 선택 |
| SRV | priority·weight·port 정보 |
| ExternalName | 외부 호스트명을 CNAME으로 |
| Consul·Eureka | DNS + HTTP API 하이브리드 |

### 4-1. gRPC와 DNS

- gRPC DNS resolver(`dns:///`)는 **A 레코드 전부를 반환**한다
- 다만 기본 **load balancing policy가 `pick_first`**라 첫 주소만 사용 → 변경 반영이 느려 보임
- 해결: 채널 설정에서 `loadBalancingPolicy: round_robin` 사용,
  또는 xDS/Service Mesh 기반 디스커버리로 전환
- Kubernetes에서 gRPC를 쓸 때는 **Headless Service + `round_robin`** 권장

### 4-2. MongoDB `mongodb+srv://`

```
mongodb+srv://user:pass@cluster.example.com/app
```

- 클라이언트가 **`_mongodb._tcp.cluster.example.com` SRV**를 조회해 샤드·레플리카 주소 수집
- 동일 호스트의 **TXT 레코드에서 `replicaSet`/`authSource`/`loadBalanced` 옵션**도 함께 가져온다
- TLS 기본 on (연결 문자열에 `tls=false`로 끌 수는 있지만 운영 환경 권장 아님)
- **TXT가 복수 존재하면 드라이버 오류** — 레코드 하나에 모든 파라미터를 넣어야 한다

---

## 5. DNS 관측·SLO

### 5-1. 핵심 메트릭

| 메트릭 | 의미 |
|---|---|
| `coredns_dns_requests_total` | 총 요청 수 |
| `coredns_dns_request_duration_seconds` | 응답 지연 분포 |
| `coredns_dns_responses_total{rcode}` | 응답 코드별 분포 |
| `coredns_cache_hits_total` | 캐시 적중 |
| `coredns_forward_requests_total` | 업스트림 전달 |
| `coredns_plugin_enabled` | 활성 플러그인 |

### 5-2. 권장 SLO

| 지표 | 목표 |
|---|---|
| p99 응답 지연 | < 100ms |
| 에러율 (SERVFAIL) | < 0.1% |
| 캐시 적중률 | > 70% |
| 업스트림 타임아웃 | < 0.01% |

### 5-3. 알림 예시

```yaml
# PromQL 예시
- alert: CoreDNSHighErrorRate
  expr: |
    sum(rate(coredns_dns_responses_total{rcode!~"NOERROR|NXDOMAIN"}[5m]))
      / sum(rate(coredns_dns_responses_total[5m])) > 0.01
  for: 5m

- alert: CoreDNSHighLatency
  expr: |
    histogram_quantile(0.99,
      sum by(le) (rate(coredns_dns_request_duration_seconds_bucket[5m]))
    ) > 0.1
  for: 10m
```

---

## 6. DNS 운영 자동화 — ExternalDNS

Kubernetes Ingress·Service 리소스와 **DNS 레코드를 자동 동기화**.

| 지원 Provider | AWS Route 53, GCP Cloud DNS, Azure DNS, Cloudflare 등 |
|---|---|
| Trigger | Ingress/Service annotation |
| 소유권 표시 | TXT 레코드로 관리 주체 기록 |

```yaml
# Ingress 예시
metadata:
  annotations:
    external-dns.alpha.kubernetes.io/hostname: api.example.com
    external-dns.alpha.kubernetes.io/ttl: "60"
```

**주의**: `--policy=sync`로 설정하면 K8s 리소스 삭제 시 **DNS 레코드도 삭제**.
실수 방지를 위해 처음엔 `upsert-only`로 시작.
`sync`로 전환할 때는:

- **TXT registry 소유권 레코드** 존재 여부 확인 (다른 툴이 관리하는 레코드 보호)
- `--domain-filter`, `--zone-id-filter`로 **관리 범위를 좁힘**
- 롤링 업데이트·재배포 중 전체 레코드 삭제 사고 사례가 있어
  프로덕션 존은 별도 인스턴스에 `--registry=txt --txt-owner-id=<cluster>` 권장

---

## 7. DR·Failover 설계

### 7-1. 헬스체크 기반 DNS Failover

| CSP | 기능 |
|---|---|
| AWS | Route 53 Health Checks + Failover routing |
| GCP | Cloud DNS Routing Policies |
| Azure | Traffic Manager |
| Cloudflare | Load Balancing |

- 헬스체크가 **실패하면 다른 레코드를 반환**
- TTL이 짧아야 전환이 빠름 (30~60s)
- **DNS만으로는 분 단위 RTO가 한계** → 짧은 RTO에는 Anycast·LB가 필수

### 7-2. Geolocation·Latency 라우팅

| 정책 (Route 53 기준) | 기준 |
|---|---|
| Simple | 단일 값 반환 (기본) |
| Failover | 주 리소스 헬스체크 실패 시 대체로 전환 |
| Weighted | 가중치 기반 분산 (카나리 배포) |
| Latency | Measurements — 가장 빠른 endpoint |
| Geolocation | 클라이언트 위치(대륙·국가·주) |
| Geoproximity | 지역별 bias 값으로 점진 이동 (Traffic Flow) |
| Multivalue | 여러 값을 랜덤 반환 + 헬스체크 |
| IP-based | 클라이언트 CIDR 매칭 |

### 7-3. EDNS Client Subnet (ECS)

- 재귀 리졸버가 **클라이언트 /24 대역**을 권한 서버에 전달
- CDN·GeoDNS가 정확한 edge를 선택하도록 도움
- **프라이버시 트레이드오프**: Cloudflare(1.1.1.1)는 기본 송신 안 함

---

## 8. 흔한 장애 유형

| 증상 | 원인 | 확인 |
|---|---|---|
| `SERVFAIL` 지속 | 상위 위임 끊김, DNSSEC 실패 | `dig +trace`, `delv` |
| 특정 리졸버만 실패 | 그 리졸버 캐시 오염 | `dig @<resolver>`, `rndc flush` |
| 간헐적 응답 없음 | UDP 드롭, MTU, 오버사이즈 | `dig +tcp`, EDNS0 크기 |
| 갱신 후 반영 안 됨 | TTL 미만료, 리졸버 캐시 | 여러 공용 리졸버로 확인 |
| CoreDNS CPU 급증 | `ndots:5`로 쿼리 증폭 | 로그에서 search 순회 확인 |
| K8s 파드에서 외부 느림 | 같은 원인 + 업스트림 경유 | NodeLocal DNSCache 도입 |
| 롤백 후에도 잘못된 IP | 브라우저 캐시 | 시크릿 창·다른 브라우저 테스트 |

---

## 9. 운영 체크리스트

| 영역 | 점검 |
|---|---|
| TTL | 자주 바뀌는 레코드의 TTL이 합리적인가 |
| 모니터링 | CoreDNS 메트릭·SLO 알림 설정 |
| 용량 | CoreDNS 레플리카 수, HPA, NodeLocal DNSCache 유무 |
| 보안 | DNSSEC 서명 유효, CAA 레코드 설정 |
| 자동화 | ExternalDNS 연결·TXT 소유권 표시 |
| 문서화 | 변경 절차 (TTL 축소 → 전환 → 복원) |
| 훈련 | DNS 장애 대응 런북·모의 훈련 |

---

## 10. 요약

| 주제 | 한 줄 요약 |
|---|---|
| TTL 설계 | 변화 가능성에 맞춰, 전환 전 미리 축소 |
| Negative TTL | SOA minimum이 NXDOMAIN 캐시 시간 |
| SRV | priority·weight·port까지 DNS로 |
| CAA | 인증서 발급 제어 — 보안 기본 |
| CoreDNS | K8s DNS의 표준, 플러그인 조합 |
| NodeLocal DNSCache | 50노드 이상에서 필수 |
| ndots:5 | 외부 도메인 쿼리 증폭의 주범 |
| ExternalDNS | K8s 리소스 ↔ DNS 레코드 자동 동기화 |
| DR Failover | DNS만으로는 분 단위 RTO 한계 |
| SLO | p99 100ms, 에러율 0.1%, 캐시 70% |

---

## 참고 자료

- [RFC 2308 — Negative Caching of DNS Queries](https://www.rfc-editor.org/rfc/rfc2308) — 확인: 2026-04-20
- [RFC 2782 — SRV Records](https://www.rfc-editor.org/rfc/rfc2782) — 확인: 2026-04-20
- [RFC 8659 — CAA (base spec)](https://www.rfc-editor.org/rfc/rfc8659) — 확인: 2026-04-20
- [RFC 8657 — CAA Extensions (accounturi, validationmethods)](https://www.rfc-editor.org/rfc/rfc8657) — 확인: 2026-04-20
- [RFC 8767 — Serving Stale Data](https://www.rfc-editor.org/rfc/rfc8767) — 확인: 2026-04-20
- [RFC 1912 — Common DNS Operational and Configuration Errors](https://www.rfc-editor.org/rfc/rfc1912) — 확인: 2026-04-20
- [CoreDNS docs](https://coredns.io/manual/toc/) — 확인: 2026-04-20
- [Kubernetes DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) — 확인: 2026-04-20
- [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/) — 확인: 2026-04-20
- [ExternalDNS](https://kubernetes-sigs.github.io/external-dns/) — 확인: 2026-04-20
- [Cloudflare — How to use CAA records](https://developers.cloudflare.com/ssl/edge-certificates/caa-records/) — 확인: 2026-04-20
- [AWS Route 53 routing policies](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html) — 확인: 2026-04-20
