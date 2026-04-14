---
title: "Ingress Controller 비교"
date: 2026-04-14
tags:
  - kubernetes
  - ingress
  - nginx
  - traefik
  - gateway-api
sidebar_label: "Ingress Controller"
---

# Ingress Controller 비교

## 1. 2026년 현황

> **중요**: ingress-nginx는 2026년 3월 공식 지원 종료(EOF)되었다.
> 쿠버네티스 커뮤니티는 **Gateway API**로 마이그레이션을 권장한다.

```
Ingress API (레거시, 계속 지원)
     ↓
Gateway API (GA, 새 표준)
```

---

## 2. Ingress Controller 비교

| 컨트롤러 | 설정 방식 | 성능 (req/s) | 특징 |
|---------|---------|------------|------|
| NGINX (OSS) | Annotation | 11,700 | 안정적, 범용 |
| Traefik | CRD | 19,000 | 자동 TLS, 마이크로서비스 |
| HAProxy | Annotation | 42,000 | 최고 성능, 낮은 지연 |
| Kong | CRD (플러그인) | - | API 게이트웨이, 70+ 플러그인 |
| Envoy Gateway | Gateway API | 18,500 | CNCF, L7 필터 |

---

## 3. NGINX Ingress

Annotation 기반 설정. 범용적이며 문서가 풍부하다.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nginx-example
  annotations:
    # 레이트 리밋
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-connections: "10"
    # Canary (10% 트래픽)
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
    # 경로 재작성
    nginx.ingress.kubernetes.io/rewrite-target: "/$2"
spec:
  ingressClassName: nginx
  tls:
  - hosts: [api.example.com]
    secretName: api-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /v1(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: api-v1
            port:
              number: 8080
```

---

## 4. Traefik

CRD(IngressRoute) 기반. Let's Encrypt 자동 TLS를 지원한다.

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: api-route
spec:
  entryPoints: [websecure]
  routes:
  - match: Host(`api.example.com`) && PathPrefix(`/v1`)
    kind: Rule
    services:
    - name: api-v1
      port: 8080
      weight: 90    # Canary: 90%
    - name: api-canary
      port: 8080
      weight: 10    # Canary: 10%
  tls:
    certResolver: letsencrypt  # 자동 인증서
---
# Rate Limiting Middleware
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: rate-limit
spec:
  rateLimit:
    average: 100
    burst: 50
    period: 1s
```

---

## 5. Kong

API Gateway 수준의 기능. 플러그인 시스템이 강점이다.

```yaml
# 레이트 리밋 플러그인
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit
config:
  minute: 100
  policy: redis   # local / cluster / redis
---
# JWT 인증 플러그인
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: jwt-auth
plugin: jwt
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  annotations:
    konghq.com/plugins: rate-limit, jwt-auth
spec:
  ingressClassName: kong
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-backend
            port:
              number: 8080
```

---

## 6. Gateway API (신규 표준)

K8s 1.31에서 GA. 역할별 리소스로 권한을 분리한다.

```
GatewayClass   → 인프라 팀 관리 (어떤 구현체 사용)
Gateway        → 클러스터 운영자 관리 (포트, TLS)
HTTPRoute      → 개발팀 관리 (라우팅 규칙)
```

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main-gateway
spec:
  gatewayClassName: envoy
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
      - name: api-tls
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
spec:
  parentRefs:
  - name: main-gateway
  hostnames: ["api.example.com"]
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v1
    backendRefs:
    - name: api-v1
      port: 8080
      weight: 90
    - name: api-canary
      port: 8080
      weight: 10
    timeouts:
      request: 30s
    retries:
      attempts: 3
      backoffPolicy: Exponential
```

---

## 7. Ingress → Gateway API 마이그레이션

`ingress2gateway` 도구(2026년 1.0 출시)로 자동 변환한다.

```bash
# ingress2gateway 설치
go install sigs.k8s.io/ingress2gateway@latest

# 변환
ingress2gateway convert \
  --input-file ingress.yaml \
  --output-file gateway.yaml

# 또는 클러스터에서 직접 변환
ingress2gateway print
```

변환 전 (Ingress):
```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: "/$2"
```

변환 후 (HTTPRoute):
```yaml
rules:
- filters:
  - type: URLRewrite
    urlRewrite:
      path:
        type: ReplacePrefixMatch
        replacePrefixMatch: "/"
```

---

## 8. 선택 가이드

```
단순 HTTP 라우팅, 소규모
  → NGINX (익숙하고 문서 풍부)

마이크로서비스, 자동 TLS
  → Traefik

최고 성능이 필요한 경우
  → HAProxy

API 게이트웨이 기능 필요
  → Kong

신규 클러스터, 미래 지향
  → Gateway API + Envoy/Istio
```

---

## 참고 문서

- [Gateway API](https://gateway-api.sigs.k8s.io/)
- [ingress-nginx 지원 종료 공지](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
- [ingress2gateway](https://github.com/kubernetes-sigs/ingress2gateway)
