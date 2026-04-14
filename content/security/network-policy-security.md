---
title: "네트워크 폴리시"
date: 2026-04-14
tags:
  - kubernetes
  - network-policy
  - security
sidebar_label: "네트워크 폴리시"
---

# 네트워크 폴리시

## 1. 개요

Kubernetes NetworkPolicy는 Pod 간 트래픽을 L3/L4 수준에서 제어한다.
기본적으로 모든 Pod 간 통신이 허용되므로
NetworkPolicy로 명시적으로 허용할 트래픽만 정의한다.

---

## 2. 기본 원칙 (Default Deny)

```yaml
# 네임스페이스 내 모든 인바운드 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}         # 네임스페이스 전체 선택
  policyTypes:
  - Ingress               # 인바운드 차단

# 아웃바운드도 차단
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

---

## 3. 필요한 통신만 허용

```yaml
# payment 서비스: api-gateway에서만 인바운드 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment
  policyTypes:
  - Ingress
  ingress:
  - from:
    # 같은 네임스페이스의 api-gateway만 허용
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 8080

  # 다른 네임스페이스에서도 허용
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: monitoring
      podSelector:
        matchLabels:
          app: prometheus
    ports:
    - port: 9090
```

---

## 4. DNS + 외부 접근 허용

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  # DNS 허용 (필수)
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53

  # 특정 외부 IP 허용
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 10.0.0.0/8
        - 172.16.0.0/12
        - 192.168.0.0/16
    ports:
    - port: 443
```

---

## 5. 실전 패턴: 3티어 앱

```yaml
# Tier 1: Web (Ingress Controller에서만 인바운드)
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: web-policy
spec:
  podSelector:
    matchLabels:
      tier: web
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx

# Tier 2: App (Web에서만)
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: app-policy
spec:
  podSelector:
    matchLabels:
      tier: app
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: web

# Tier 3: DB (App에서만)
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-policy
spec:
  podSelector:
    matchLabels:
      tier: db
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: app
    ports:
    - port: 5432
```

---

## 6. CNI 지원 확인

NetworkPolicy는 CNI 플러그인이 지원해야 동작한다.

| CNI | NetworkPolicy 지원 |
|-----|-----------------|
| Calico | 지원 (CiliumNetworkPolicy도) |
| Cilium | 지원 (L7 정책도 가능) |
| Weave Net | 지원 |
| Flannel | **미지원** (별도 CNI 추가 필요) |

---

## 참고 문서

- [Kubernetes NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [NetworkPolicy 에디터](https://editor.networkpolicy.io/)
- [Cilium Network Policy](https://docs.cilium.io/en/stable/network/kubernetes/policy/)
