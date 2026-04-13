---
title: "CNI 플러그인 비교 (Calico, Cilium, Flannel)"
date: 2026-04-13
tags:
  - network
  - kubernetes
  - cni
  - calico
  - cilium
  - flannel
sidebar_label: "CNI 비교"
---

# CNI 플러그인 비교 (Calico, Cilium, Flannel)

## 1. CNI란

CNI(Container Network Interface)는 Kubernetes가
Pod 네트워크를 구성할 때 사용하는 표준 인터페이스다.

```
Pod 생성
    ↓
kubelet → CNI 플러그인 호출
    ↓
veth pair 생성, IP 할당, 라우팅 설정
    ↓
Pod 간 통신 가능
```

---

## 2. 주요 CNI 비교

| 항목 | Flannel | Calico | Cilium |
|------|---------|--------|--------|
| 데이터플레인 | VXLAN (overlay) | BGP (native L3) | **eBPF** |
| 성능 | 보통 | 높음 | **최고** |
| NetworkPolicy | **미지원** (별도 필요) | **지원** | **지원 + L7** |
| 관찰성 | 낮음 | 보통 | **Hubble (내장)** |
| 설치 복잡도 | **쉬움** | 보통 | 보통 |
| 적합 규모 | 소규모 | 중~대규모 | 중~대규모 |
| 암호화 | 없음 (WireGuard 추가) | WireGuard 옵션 | WireGuard 옵션 |

---

## 3. Flannel

VXLAN overlay로 Pod 간 통신을 구현한다.
설정이 단순하여 학습/소규모 환경에 적합하다.

```
Pod A → veth → flannel.1 (VXLAN 터널) → flannel.1 → veth → Pod B
                ↑ UDP 캡슐화 (오버헤드 발생)
```

```bash
# Flannel 설치
kubectl apply -f \
  https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# VXLAN 인터페이스 확인
ip link show flannel.1
```

---

## 4. Calico

BGP 기반 L3 네이티브 라우팅으로 overlay 오버헤드 없이
고성능을 달성한다. NetworkPolicy를 기본 지원한다.

```
Pod A → veth → 라우팅 테이블 (BGP) → Pod B
        ↑ 캡슐화 없음 (동일 노드 L3 라우팅)
```

```bash
# Calico 설치 (Tigera Operator)
kubectl create -f \
  https://raw.githubusercontent.com/projectcalico/calico/v3.31.0/manifests/tigera-operator.yaml

# 상태 확인
kubectl get tigerastatus

# BGP 피어 확인
calicoctl node status
```

### NetworkPolicy 예시

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-only
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: api
      ports:
        - port: 5432
```

---

## 5. Cilium

eBPF 기반으로 iptables를 우회하여 최고 성능을 달성한다.
L7 NetworkPolicy와 내장 관찰성(Hubble)을 제공한다.

```
Pod A → eBPF 프로그램 (커널 내 처리) → Pod B
        ↑ iptables 완전 우회
```

```bash
# Cilium 설치 (Helm)
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set kubeProxyReplacement=true

# 상태 확인
cilium status
cilium connectivity test
```

### L7 NetworkPolicy (Cilium 전용)

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: allow-get-only
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
          rules:
            http:
              - method: GET    # GET만 허용, POST 차단
```

### Hubble (관찰성)

```bash
# Hubble UI 접근
cilium hubble ui

# CLI로 네트워크 흐름 확인
hubble observe --last 50
hubble observe --verdict DROPPED
```

---

## 6. 성능 비교

1,000개 NetworkPolicy 규칙 적용 시:

| CNI | 정책 평가 시간 | 방식 |
|-----|------------|------|
| Flannel (없음) | - | NetworkPolicy 미지원 |
| Calico (iptables) | O(n) | 선형 검색 |
| Calico (eBPF) | **O(1)** | 해시맵 |
| Cilium (eBPF) | **O(1)** | 해시맵 |

eBPF 기반은 iptables 대비 **15~22배 빠르다** (1,000개 규칙 기준).

---

## 7. CNI 선택 기준

```
소규모 학습/개발 환경
    → Flannel (단순, 빠른 설치)

운영 환경, NetworkPolicy 필요
    → Calico (성숙도 높음, BGP 라우팅)

고성능, L7 정책, 관찰성 필요
    → Cilium (eBPF, Hubble, Service Mesh)

멀티 클러스터 연결 필요
    → Cilium (Cluster Mesh)
```

---

## 참고 문서

- [Kubernetes CNI 문서](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)
- [Calico 공식 문서](https://docs.tigera.io/calico/latest/about/)
- [Cilium 공식 문서](https://docs.cilium.io/en/stable/)
- [Flannel GitHub](https://github.com/flannel-io/flannel)
