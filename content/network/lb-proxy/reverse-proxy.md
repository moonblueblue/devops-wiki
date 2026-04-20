---
title: "리버스 프록시 (Nginx · HAProxy · Envoy · Traefik 비교)"
sidebar_label: "리버스 프록시"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-20
tags:
  - network
  - nginx
  - haproxy
  - envoy
  - traefik
  - reverse-proxy
---

# 리버스 프록시 (Nginx · HAProxy · Envoy · Traefik 비교)

리버스 프록시는 "HTTP 요청을 받아 백엔드로 전달하는 중개자"로,
현대 인프라에서 가장 많이 배포되는 컴포넌트 중 하나다.

4대 주력 선택지는 **Nginx, HAProxy, Envoy, Traefik**이다.
각자 **설계 철학·성능 특성·관측 모델·동적 설정 방식**이 다르며,
잘못 고르면 운영 복잡도가 수년간 누적된다.

> L4·L7 공통 개념·알고리즘은 [L4·L7 기본](./l4-l7-basics.md) 참고.
> CDN·엣지 관점은 [CDN·Edge](./cdn-edge.md).

---

## 1. 한눈에 비교

| 항목 | Nginx | HAProxy | Envoy | Traefik |
|---|---|---|---|---|
| 최초 릴리스 | 2004 | 2000 | 2016 | 2015 |
| 언어 | C | C | **C++** | Go |
| 설계 초점 | 웹서버 + 프록시 | 성능 L4·L7 LB | 서비스 메시·동적 제어 | 동적 디스커버리 (K8s·Docker) |
| HTTP/3 (downstream) | 1.25+ (초기 안정) | **2.6+ (2022-05)** | **GA** | 3.0+ |
| HTTP/3 (upstream) | — | 3.3+ 실험 | **alpha** | — |
| gRPC | 지원 | 지원 | **네이티브**, Mesh 표준 | 지원 |
| 설정 방식 | 선언적 파일 + reload | 선언적 파일 + reload | **xDS API** (동적) | **provider 감시** (동적) |
| 핫 리로드 | SIGHUP | SIGUSR2 (무중단 바이너리 교체) | xDS로 무중단 갱신 | 자동 |
| 라이선스 | BSD (Open Source) + 상용 | GPLv2 + 상용 | Apache 2.0 | MIT |
| CNCF | — | — | **Graduated** | — |
| 주 사용처 | 웹 엣지, API GW | TCP/HTTP LB, DC 프론트 | 서비스 메시, K8s Ingress | K8s Ingress·Docker |

---

## 2. Nginx

### 2-1. 철학

- "작고 빠른 웹서버" → 리버스 프록시로 확장
- **Worker 프로세스 + 이벤트 루프** 모델 — C10K 시대의 기준 구현
- 설정은 선언적 `nginx.conf`, 변경 시 `nginx -s reload`

### 2-2. 장점

- 압도적인 **정적 파일 서빙** 성능
- 풍부한 모듈, 메모리 효율, 성숙도
- `ssl_*`, `limit_req`, `cache` 등 **엣지 기능이 내장**
- OpenResty(LuaJIT)로 **스크립트 확장** 가능

### 2-3. 한계

- **동적 디스커버리 기본 없음** — 업스트림 IP가 바뀌면 reload 필요
- xDS 같은 표준 동적 API 부재 (OpenResty·상용 Plus는 별도)
- 복잡한 L7 라우팅·카나리는 설정 파일이 길어짐
- HTTP/3·QUIC은 1.25+에서 정식 병합되었지만 **여전히 초기 안정화 단계** —
  2024년 maintainer 갈등으로 **freenginx** 포크가 생긴 배경도 HTTP/3 보안 처리 정책 충돌

### 2-4. 대표 설정 예시

```nginx
upstream backend {
    least_conn;
    server app1.internal:8080 max_fails=3 fail_timeout=5s;
    server app2.internal:8080 backup;
}

server {
    # Nginx 1.25.1+ 부터 http2/http3은 별도 지시어
    listen 443 ssl;
    listen 443 quic reuseport;
    http2 on;
    http3 on;
    server_name api.example.com;
    add_header Alt-Svc 'h3=":443"; ma=86400' always;

    location /api {
        proxy_pass http://backend;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 2s;
        proxy_read_timeout 30s;
    }
}
```

---

## 3. HAProxy

### 3-1. 철학

- "초고성능 L4·L7 로드밸런서"에 집중
- **단일 바이너리**, 단일 이벤트 루프 모델
- 가장 낮은 CPU·메모리 오버헤드와 뛰어난 꼬리 지연

### 3-2. 장점

- **TCP·HTTP 모두 1급 시민** — Nginx는 HTTP가 기본, HAProxy는 혼용이 자연스러움
- 고급 **헬스체크**와 **스틱 세션** 기능
- Runtime API로 서버 추가·제거·drain 무중단
- 관측용 기본 **HTML/CSV stats 페이지**가 유용

### 3-3. 한계

- 정적 파일 서빙은 부적합 (Nginx에 맡겨야)
- L7 설정 언어가 강력하지만 익숙하지 않으면 진입장벽
- gRPC 지원은 되지만 메시 생태계에서는 Envoy가 더 주류

### 3-4. 대표 설정 예시

```
global
    log stdout format raw local0 info
    nbthread 4
    tune.ssl.default-dh-param 2048

defaults
    timeout client  30s
    timeout server  30s
    timeout connect 5s
    option http-server-close

frontend fe_https
    bind *:443 ssl crt /etc/ssl/cert.pem alpn h2,http/1.1
    default_backend be_app

backend be_app
    balance leastconn
    option httpchk GET /healthz
    server app1 10.0.0.11:8080 check inter 2s fall 3 rise 2
    server app2 10.0.0.12:8080 check inter 2s fall 3 rise 2
```

---

## 4. Envoy

### 4-1. 철학

- "서비스 메시와 현대 네트워크의 범용 데이터 플레인"
- **xDS API**로 컨트롤 플레인과 완전 분리 — 런타임 동적 갱신
- **필터 체인** 모델 — `listener filter → network filter → HTTP filter`의 3단 구조.
  `http_connection_manager`가 network filter이고, 그 안에 HTTP filter(router, ext_authz 등)가 들어간다

### 4-2. 장점

- **완전 동적 설정** — 서비스 추가·제거가 재시작 없이 반영
- gRPC, HTTP/3, mTLS, 고급 L7 라우팅이 **1급 시민**
- CNCF **Graduated**, Istio·Linkerd(부분)·Kuma·Consul Service Mesh의 기반
- **Observability 내장** — stats, tracing, access log가 정교

### 4-3. 한계

- **설정 복잡도**가 가장 높음 — YAML이 길고 개념(cluster, route, filter) 학습 필요
- 작은 엣지 배포에는 과함 — Nginx·Traefik이 더 가볍다
- 메모리 사용량이 다른 프록시보다 큼

### 4-4. 대표 설정 예시

```yaml
static_resources:
  listeners:
  - address:
      socket_address: { address: 0.0.0.0, port_value: 443 }
    filter_chains:
    - transport_socket:
        name: envoy.transport_sockets.tls
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
          common_tls_context:
            tls_certificates:
              - certificate_chain: { filename: /etc/ssl/cert.pem }
                private_key: { filename: /etc/ssl/key.pem }
      filters:
      - name: envoy.filters.network.http_connection_manager
        typed_config:
          "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
          codec_type: AUTO
          route_config:
            virtual_hosts:
            - name: api
              domains: ["api.example.com"]
              routes:
              - match: { prefix: "/api" }
                route: { cluster: backend }
          http_filters:
          - name: envoy.filters.http.router
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
  clusters:
  - name: backend
    connect_timeout: 2s
    type: STRICT_DNS
    lb_policy: LEAST_REQUEST
    load_assignment:
      cluster_name: backend
      endpoints:
      - lb_endpoints:
        - endpoint:
            address:
              socket_address: { address: app, port_value: 8080 }
```

---

## 5. Traefik

### 5-1. 철학

- "컨테이너·클라우드 시대를 위해 설계된 리버스 프록시"
- **Provider** (Docker, K8s, Consul 등)를 감시해 **설정을 자동 생성**
- 기본 설정 파일을 거의 쓰지 않음

### 5-2. 장점

- Docker/K8s 환경에서 **설정 없이 바로 동작**
- Let's Encrypt 인증서 **자동 발급·순환 내장**
- 대시보드·관측 기능이 기본 탑재
- 작은 팀·Dev 환경에 생산성 높음

### 5-3. 한계

- 대규모 성능·튜닝은 Nginx/HAProxy/Envoy보다 불리
- 고급 L7 기능은 **별도 플러그인** 필요
- 엔터프라이즈 급 버그·CVE 대응 속도는 상대적으로 느림
- Go 런타임 특성상 **메모리 사용량**이 큼

### 5-4. 대표 설정 (K8s IngressRoute)

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: api
spec:
  entryPoints: [websecure]
  routes:
  - match: Host(`api.example.com`) && PathPrefix(`/api`)
    kind: Rule
    services:
    - name: api-service
      port: 8080
  tls:
    certResolver: letsencrypt
```

---

## 6. 선택 기준

### 6-1. 시나리오별 추천

| 시나리오 | 1순위 | 대안 |
|---|---|---|
| 웹 엣지 (정적 + 프록시) | Nginx | HAProxy |
| 초고성능 TCP/HTTP LB | HAProxy | Envoy |
| K8s Ingress (레거시 Ingress API) | Nginx Ingress, Traefik, Contour | HAProxy Ingress |
| K8s Gateway API (차세대) | Istio, Contour, Kong, Traefik (Envoy·Nginx 기반 구현 다수) | — |
| 서비스 메시 데이터 플레인 | **Envoy** (Istio, Kuma), linkerd-proxy | — |
| Dev/Docker Compose | Traefik | Nginx |
| API Gateway | Envoy (+ 컨트롤 플레인) | Kong, Nginx |
| gRPC 멀티플렉싱 | Envoy | HAProxy |
| 모바일 엣지 (QUIC) | Envoy, Nginx 1.25+ | — |

### 6-2. 운영 복잡도

| 운영 복잡도 | 도구 |
|---|---|
| 낮음 | Traefik |
| 중간 | Nginx, HAProxy |
| 높음 | Envoy (xDS 컨트롤 플레인 필요) |

Envoy는 **Istio·Kuma·Contour**처럼 **컨트롤 플레인을 수반**하면
동적 설정이 장점이지만, 단독 사용은 매우 까다롭다.

---

## 7. 공통 운영 지점

### 7-1. 타임아웃 설계

| 타임아웃 | 의미 | 권장 |
|---|---|---|
| connect | 백엔드 TCP 연결 | 2~5s |
| read | 백엔드 응답 첫 바이트 | 30~60s |
| idle (keep-alive) | 유휴 연결 유지 | 60~90s |
| client header | 클라이언트 헤더 수신 | 10~30s |
| total request | 전체 요청 수명 | 30s~5min |

**규칙**: 백엔드 < 프록시 < 클라이언트 순으로 타임아웃이 증가해야 한다.
그래야 **안쪽에서 먼저 포기**하고 바깥이 재시도할 수 있다.

### 7-2. 재시도

| 설정 | 주의 |
|---|---|
| **Idempotent 메서드만** (GET, HEAD, PUT) | POST 기본 재시도 금지 |
| 재시도 횟수는 **2~3 이하** | 경로별 상한일 뿐, 그 자체로 retry storm 막지 못함 |
| **Retry budget (우선)** | 전체 요청 대비 재시도 비율 상한 — 실제 retry storm 방지의 핵심 |
| Jittered exponential backoff | 동기화된 재시도 방지 |

> Envoy·Linkerd의 권장 패턴은 **per-route 최대 재시도는 상한으로만 두고,
> 실제 제어는 retry budget(기본 20%)으로 한다**. 횟수만 제한하면 장애 시
> 전체 트래픽이 재시도에 몰려 업스트림이 더 빨리 죽는다.

### 7-3. 백프레셔와 서킷 브레이커

| 개념 | 내용 |
|---|---|
| Connection pool 한도 | 업스트림별 최대 커넥션 수 |
| Outstanding request 한도 | 동시 진행 요청 수 |
| 서킷 브레이커 | 실패율이 임계를 넘으면 잠시 차단 |
| Outlier ejection | 불량 호스트 자동 제외 |

Envoy·Istio는 이 패턴을 기본 제공. Nginx·HAProxy는 일부만 내장.

### 7-4. Observability

| 지점 | Nginx | HAProxy | Envoy | Traefik |
|---|---|---|---|---|
| 액세스 로그 | 포맷 자유 | 자체 포맷 | JSON·gRPC·OTLP | JSON |
| Prometheus | exporter 또는 Plus | `haproxy_exporter`·빌트인 | 네이티브 `/stats/prometheus` | 네이티브 |
| OpenTelemetry | 모듈 | 3.0+ OTLP 내장(실험적) | 네이티브 | 네이티브 |
| 헬스 엔드포인트 | 직접 구성 | stats | admin | ping |

---

## 8. K8s Ingress · Gateway API 관점

Kubernetes 리소스는 이 글 범위가 아니지만(kubernetes/에서 다룸),
리버스 프록시 선택과 직결되므로 요약만 한다.

| Ingress Class (레거시 Ingress API) | 기반 프록시 | 비고 |
|---|---|---|
| `nginx` | Nginx | 가장 오래된 기본 선택 |
| `contour` | Envoy | 단독 Envoy 기반 Ingress 구현 |
| `traefik` | Traefik | 개발자 친화적 |
| `haproxy` | HAProxy | HAProxy Ingress 컨트롤러 |

**Gateway API (차세대 표준)**는 K8s SIG-Network의 `GatewayClass`·`Gateway`·`HTTPRoute`
리소스 체계로, Istio·Contour·Kong·Traefik·Envoy Gateway 등이 각자
GatewayClass로 구현한다. Istio는 이제 Ingress 대신 **Gateway API 기반**으로
트래픽을 받는 것이 권장 방식이다.

---

## 9. 보안 기본

| 항목 | 권장 |
|---|---|
| TLS 버전 | 1.2+, 권장 1.3 |
| Cipher Suite | Mozilla Intermediate 프로파일 |
| HTTP 헤더 | HSTS, CSP, X-Content-Type-Options |
| `Server` 헤더 | 제품·버전 노출 제거 |
| Rate limiting | 엣지에서 적용 |
| WAF 연계 | ModSecurity, Coraza, 상용 WAF |
| 인증서 자동화 | cert-manager·ACME |
| CVE 대응 | 배포 루틴에 프록시 업데이트 포함 |

---

## 10. 자주 만나는 장애

| 증상 | 원인·확인 |
|---|---|
| 502 Bad Gateway | 백엔드 5xx, 연결 거부, 타임아웃 |
| 504 Gateway Timeout | 백엔드 응답 지연, read 타임아웃 초과 |
| WebSocket 끊김 | idle timeout < 커넥션 수명, `Upgrade`/`Connection` hop-by-hop 헤더 전달 실패, `proxy_buffering`로 인한 스트리밍 차단 |
| 헬스체크는 통과하는데 5xx | 헬스체크 경로와 실제 경로의 의존성 차이 |
| TLS 인증서 에러 | 체인 누락, SAN 불일치, 시간 오차 |
| 업스트림 편향 | DNS 캐시, keep-alive로 고정된 연결 |
| 메모리 급증 (Envoy) | Access log 버퍼, 큰 요청 body |

---

## 11. 언급 가치 있는 대안 — Pingora

- Cloudflare가 2024년 **Apache 2.0**으로 오픈소스화한 Rust 기반 프록시 프레임워크
- Cloudflare 엣지 트래픽의 상당 부분을 이미 처리
- 단, **완제품 프록시가 아니라 프레임워크**다 — 애플리케이션 코드를 Rust로 작성
- Envoy 대안으로 고려할 수 있으나 **프로덕션 채택은 Rust 팀·역량이 전제**
- 2026-04 현재 Kubernetes Gateway·Ingress 구현은 초기 단계

---

## 12. 요약

| 제품 | 한 줄 요약 |
|---|---|
| Nginx | 웹서버 출신, 정적 서빙·엣지 강함, 동적은 약함 |
| HAProxy | 최고 L4·L7 성능, TCP 프록시의 기준 |
| Envoy | 서비스 메시·동적 제어의 데이터 플레인, CNCF Graduated |
| Traefik | 컨테이너 환경의 자동화, 개발자 친화 |
| 핵심 선택 | **엣지·정적 = Nginx, 성능 LB = HAProxy, 메시·동적 = Envoy, K8s/Docker 편의 = Traefik** |

---

## 참고 자료

- [Nginx docs](https://nginx.org/en/docs/) — 확인: 2026-04-20
- [HAProxy docs](https://docs.haproxy.org/) — 확인: 2026-04-20
- [Envoy docs](https://www.envoyproxy.io/docs/envoy/latest/) — 확인: 2026-04-20
- [Traefik docs](https://doc.traefik.io/traefik/) — 확인: 2026-04-20
- [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/) — 확인: 2026-04-20
- [Envoy — xDS REST and gRPC protocol](https://www.envoyproxy.io/docs/envoy/latest/api-docs/xds_protocol) — 확인: 2026-04-20
- [NGINX Open Source vs NGINX Plus](https://www.nginx.com/products/nginx/) — 확인: 2026-04-20
- [Istio Ingress Gateway](https://istio.io/latest/docs/tasks/traffic-management/ingress/ingress-control/) — 확인: 2026-04-20
- [Cloudflare Blog — Pingora](https://blog.cloudflare.com/pingora-open-source/) — 확인: 2026-04-20
