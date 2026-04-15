---
title: "Service, Ingress, Gateway API"
date: 2026-04-14
tags:
  - kubernetes
  - service
  - ingress
  - gateway-api
  - networking
sidebar_label: "Service·Ingress"
---

# Service, Ingress, Gateway API

## 1. Service

Pod에 안정적인 네트워크 엔드포인트를 제공한다.
Pod IP는 재시작마다 바뀌지만 Service IP는 고정된다.

### Service 유형

| 유형 | 접근 범위 | 사용 시점 |
|-----|---------|---------|
| `ClusterIP` | 클러스터 내부 | 내부 서비스 통신 (기본값) |
| `NodePort` | 외부 (Node IP + 포트) | 개발/테스트 |
| `LoadBalancer` | 외부 (CSP LB) | 클라우드 프로덕션 |
| `ExternalName` | 외부 DNS | 외부 DB 등 접근 |

```yaml
# ClusterIP (내부)
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  type: ClusterIP
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
---
# LoadBalancer (외부, 클라우드)
apiVersion: v1
kind: Service
metadata:
  name: myapp-lb
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
---
# NodePort (개발/테스트)
apiVersion: v1
kind: Service
metadata:
  name: myapp-np
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080   # 30000-32767 범위
```

```bash
# Service 확인
kubectl get svc
kubectl describe svc myapp

# 연결된 Pod 목록 (K8s 1.33+ 권장)
kubectl get endpointslices -l kubernetes.io/service-name=myapp

# Service 테스트
kubectl run -it --rm test --image=busybox --restart=Never \
  -- wget -O- http://myapp:80
```

---

## 2. Ingress

하나의 진입점에서 host/path 기반으로 여러 Service에 라우팅한다.
Ingress Controller가 필요하다 (nginx-ingress, Traefik 등).

```
외부 → Ingress → /api → api-service
               → /    → web-service
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - myapp.example.com
    secretName: myapp-tls
  rules:
  - host: myapp.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-svc
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-svc
            port:
              number: 80
```

```bash
# Ingress 확인
kubectl get ingress
kubectl describe ingress myapp-ingress
```

---

## 3. Gateway API (v1.0 GA 2023-10, K8s 버전 독립)

Ingress의 후속 표준. 더 강력한 라우팅과 역할 분리를 제공한다.

```
GatewayClass   → 구현체 정의 (nginx, istio 등)
    ↓
Gateway        → 리스너 정의 (포트, 프로토콜, TLS)
    ↓
HTTPRoute      → 라우팅 규칙 (host, path, 가중치)
```

```yaml
# GatewayClass (인프라 팀 관리)
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx
spec:
  controllerName: k8s.nginx.org/nginx-gateway-controller
---
# Gateway (인프라 팀 관리)
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
spec:
  gatewayClassName: nginx
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: wildcard-cert
    allowedRoutes:
      namespaces:
        from: All
---
# HTTPRoute (앱 팀 관리)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: myapp-route
spec:
  parentRefs:
  - name: prod-gateway
    namespace: infra
  hostnames:
  - myapp.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api-svc
      port: 8080
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: web-svc
      port: 80
```

### 트래픽 가중치 (카나리 배포)

```yaml
rules:
- backendRefs:
  - name: myapp-stable
    port: 80
    weight: 90     # 90% 트래픽
  - name: myapp-canary
    port: 80
    weight: 10     # 10% 트래픽
```

---

## 4. Ingress vs Gateway API

| 항목 | Ingress | Gateway API |
|-----|---------|------------|
| K8s 버전 | Stable | GA (K8s 1.24+ 설치 가능) |
| 라우팅 | host/path | host/path + 헤더/가중치 |
| 프로토콜 | HTTP/S | HTTP, HTTPS, TCP, UDP |
| 역할 분리 | 불가 | GatewayClass/Gateway/Route 분리 |
| 카나리 배포 | 구현체 별 annotation | 표준 지원 |

---

## 참고 문서

- [Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Gateway API](https://gateway-api.sigs.k8s.io/)
