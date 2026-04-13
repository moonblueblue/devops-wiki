---
title: "쿠버네티스 Service와 Ingress"
date: 2026-04-13
tags:
  - kubernetes
  - network
  - service
  - ingress
  - gateway-api
sidebar_label: "Service·Ingress"
---

# 쿠버네티스 Service와 Ingress

## 1. Service 타입

Service는 Pod의 동적 IP를 추상화하여 안정적인 접근점을 제공한다.

| 타입 | 접근 범위 | 용도 |
|------|---------|------|
| `ClusterIP` | 클러스터 내부만 | 서비스 간 통신 (기본값) |
| `NodePort` | 클러스터 외부 (노드 IP:포트) | 개발/테스트 |
| `LoadBalancer` | 외부 (클라우드 LB) | 운영 환경 외부 노출 |
| `ExternalName` | DNS CNAME 매핑 | 외부 서비스 추상화 |

```yaml
# ClusterIP (기본)
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
    - port: 80        # ClusterIP 포트
      targetPort: 8080 # Pod 포트
```

```yaml
# LoadBalancer (클라우드 환경)
spec:
  type: LoadBalancer
  ports:
    - port: 443
      targetPort: 8443
```

---

## 2. Headless Service

ClusterIP 없이 Pod IP를 직접 DNS로 반환한다.
StatefulSet과 함께 개별 Pod 접근에 사용한다.

```yaml
spec:
  clusterIP: None   # Headless 설정
  selector:
    app: my-db
```

```bash
# StatefulSet Pod DNS 주소 형식
# <pod-name>.<service-name>.<namespace>.svc.cluster.local
# 예: db-0.db-svc.default.svc.cluster.local
```

---

## 3. kube-proxy 모드

| 모드 | 구현 | 성능 | 권장 상황 |
|------|------|------|---------|
| iptables | DNAT 규칙 | O(n) | Service 1,000개 미만 |
| IPVS | 커널 해시 테이블 | **O(1)** | **Service 1,000개 이상** |
| nftables | nft 테이블 | O(1) | Linux 6.x+ (차세대) |

```bash
# 현재 kube-proxy 모드 확인
kubectl get configmap kube-proxy -n kube-system -o yaml \
  | grep mode

# IPVS 규칙 확인
ipvsadm -Ln | grep -A3 <cluster-ip>
```

---

## 4. Ingress

클러스터 외부 HTTP/HTTPS 트래픽을
내부 Service로 라우팅하는 규칙이다.

```
인터넷
    ↓
Ingress Controller (Nginx, Traefik 등)
    ↓ 규칙 매핑
Service A (app.example.com/api)
Service B (app.example.com/web)
```

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: app-tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
```

### Ingress Controller 비교

| Controller | 특징 | 권장 상황 |
|-----------|------|---------|
| Nginx Ingress | 성숙도 높음, 풍부한 어노테이션 | 일반 운영 |
| Traefik | 자동 TLS (Let's Encrypt), 동적 설정 | 소규모, 개발 |
| HAProxy Ingress | 고성능 | 고트래픽 |
| Cilium | eBPF 기반, Gateway API 내장 | Cilium CNI 환경 |

> **주의:** Ingress-NGINX는 2026년 3월 공식 지원 종료 예정.
> **Gateway API로 마이그레이션을 권장한다.**

---

## 5. Gateway API (차세대 표준)

Ingress의 한계를 극복한 차세대 API다. 2024년 GA.

```
GatewayClass (인프라 제공자 정의)
    └── Gateway (클러스터 운영자 설정)
              └── HTTPRoute (앱 개발자 설정)
```

```yaml
# HTTPRoute 예시
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
spec:
  parentRefs:
    - name: my-gateway
  hostnames:
    - app.example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api-service
          port: 8080
    - matches:
        - headers:
            - name: X-User-Type
              value: premium
      backendRefs:
        - name: premium-service
          port: 8080
```

| 항목 | Ingress | Gateway API |
|------|---------|------------|
| 역할 분리 | 단일 리소스 | GatewayClass/Gateway/Route 분리 |
| 헤더 기반 라우팅 | 어노테이션 의존 | **표준 스펙** |
| gRPC 지원 | 없음 | **GRPCRoute** |
| TLS 설정 | 제한적 | **세밀한 제어** |
| 표준화 | Ingress는 최소 스펙 | **확장 가능한 표준** |

---

## 6. 실무 팁

```bash
# Service 엔드포인트 확인
kubectl get endpoints my-service
kubectl describe endpoints my-service

# Service → Pod 연결 확인
kubectl get pods -l app=my-app -o wide
kubectl get svc my-service

# Ingress 상태 확인
kubectl describe ingress app-ingress
kubectl get ingress -o wide

# Gateway API 상태
kubectl get gateway,httproute -A
```

---

## 참고 문서

- [Kubernetes Service 문서](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Ingress 문서](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Gateway API 공식 문서](https://gateway-api.sigs.k8s.io/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
