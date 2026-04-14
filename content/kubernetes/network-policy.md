---
title: "네트워크 폴리시"
date: 2026-04-14
tags:
  - kubernetes
  - network-policy
  - security
  - calico
  - cilium
sidebar_label: "네트워크 폴리시"
---

# 네트워크 폴리시

## 1. 기본 동작 원리

NetworkPolicy가 없으면 모든 Pod 간 통신이 허용된다.
NetworkPolicy를 적용하면 **명시적으로 허용되지 않은 트래픽은 차단**된다.

```
기본: Pod A → Pod B (허용)
NetworkPolicy 적용 후: 명시적 허용 규칙 없으면 차단
```

> CNI 플러그인이 NetworkPolicy를 지원해야 한다.
> Calico, Cilium, Weave 등이 지원한다. Flannel 기본 설정은 미지원.

---

## 2. 기본 구조

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: example-policy
  namespace: production
spec:
  # 이 정책이 적용될 Pod 선택
  podSelector:
    matchLabels:
      app: backend

  # 적용할 트래픽 방향
  policyTypes:
  - Ingress   # 인바운드
  - Egress    # 아웃바운드

  # 허용할 인바운드 트래픽
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080

  # 허용할 아웃바운드 트래픽
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
```

---

## 3. 셀렉터 종류

### podSelector (같은 네임스페이스)

```yaml
ingress:
- from:
  - podSelector:
      matchLabels:
        app: frontend  # 같은 ns의 frontend Pod만
```

### namespaceSelector (다른 네임스페이스)

```yaml
ingress:
- from:
  - namespaceSelector:
      matchLabels:
        env: production  # 이 라벨이 붙은 ns의 모든 Pod
```

```bash
# 네임스페이스에 라벨 추가
kubectl label namespace production env=production
```

### ipBlock (외부 IP 대역)

```yaml
ingress:
- from:
  - ipBlock:
      cidr: 203.0.113.0/24
      except:
      - 203.0.113.5/32   # 이 IP는 제외
```

### AND vs OR 조합

```yaml
# OR: 별도 from 항목 (둘 중 하나 허용)
ingress:
- from:
  - podSelector:
      matchLabels:
        app: frontend
  - namespaceSelector:
      matchLabels:
        env: testing

# AND: 같은 from 항목 (두 조건 모두 만족)
ingress:
- from:
  - podSelector:
      matchLabels:
        app: frontend
    namespaceSelector:
      matchLabels:
        env: production   # production ns의 frontend Pod만
```

---

## 4. Default Deny 패턴

보안을 위한 권장 패턴. 먼저 전체 차단 후 필요한 것만 허용한다.

```yaml
# 1단계: 모든 트래픽 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {}   # 모든 Pod에 적용
  policyTypes:
  - Ingress
  - Egress
---
# 2단계: DNS만 허용 (없으면 아무것도 안 됨)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
  namespace: production
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
    ports:
    - protocol: UDP
      port: 53
```

---

## 5. 3-티어 아키텍처 예시

Frontend → Backend → Database 격리 구성.

```yaml
# Backend: frontend에서만 인바운드 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
---
# Backend: database로만 아웃바운드 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
---
# Database: backend에서만 인바운드 허용
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-ingress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: database
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: backend
    ports:
    - protocol: TCP
      port: 5432
```

---

## 6. Calico vs Cilium

표준 NetworkPolicy 외에 각 CNI는 확장 기능을 제공한다.

| 항목 | Calico | Cilium |
|-----|--------|--------|
| 데이터플레인 | iptables / eBPF 선택 | eBPF 전용 |
| L7 정책 | 미지원 | HTTP, DNS, gRPC 지원 |
| 글로벌 정책 | GlobalNetworkPolicy | ClusterwideCiliumNetworkPolicy |
| 성능 (pps) | 3.1 Mpps | 14.2 Mpps (약 4.5배) |
| 가시성 | 제한적 | Hubble (플로우 모니터링) |
| Windows 지원 | ✓ | 제한적 |

### Cilium L7 정책 예시

```yaml
# HTTP 경로/메서드 수준 제어 (Cilium 전용)
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: l7-http-policy
spec:
  endpointSelector:
    matchLabels:
      app: api
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: frontend
    toPorts:
    - ports:
      - port: "8080"
        protocol: TCP
      rules:
        http:
        - method: GET
          path: "^/api/users$"
        - method: POST
          path: "^/api/orders$"
```

---

## 7. 정책 확인 및 디버깅

```bash
# 적용된 정책 목록
kubectl get networkpolicies -n production

# 정책 상세 확인
kubectl describe networkpolicy backend-ingress -n production

# 테스트 Pod으로 연결 테스트
kubectl run test \
  --image=nicolaka/netshoot:latest \
  --rm -it \
  --labels="app=frontend" \
  -- curl http://backend-svc:8080

# Cilium 플로우 확인 (Hubble)
hubble observe --namespace production
```

---

## 참고 문서

- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Calico NetworkPolicy](https://docs.tigera.io/calico/latest/network-policy/)
- [Cilium NetworkPolicy](https://docs.cilium.io/en/stable/network/kubernetes/policy/)
