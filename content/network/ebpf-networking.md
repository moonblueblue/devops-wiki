---
title: "eBPF 기반 네트워킹 (Cilium)"
date: 2026-04-13
tags:
  - network
  - ebpf
  - cilium
  - kubernetes
  - xdp
sidebar_label: "eBPF 네트워킹"
---

# eBPF 기반 네트워킹 (Cilium)

## 1. eBPF가 네트워크에서 하는 일

eBPF 프로그램은 커널의 네트워크 스택 여러 지점에
Attach되어 패킷을 처리한다.

```
NIC (하드웨어)
    ↓
XDP Hook          ← 최하단, NIC 드라이버 수준
    ↓
TC (Traffic Control) Hook  ← 커널 네트워크 스택
    ↓
소켓 레이어
    ↓
애플리케이션
```

| Hook | 위치 | 특징 |
|------|------|------|
| XDP | NIC 드라이버 | **최고 성능**, DDoS 방어, LB |
| TC ingress/egress | 커널 네트워크 스택 | 유연, NAT/라우팅 대체 |
| Socket | 소켓 레이어 | 프로세스별 정책 |

---

## 2. Cilium의 eBPF 데이터플레인

Cilium은 iptables/netfilter를 완전히 eBPF로 대체한다.

```
기존 방식 (iptables):
  패킷 → iptables 규칙 체인 순차 탐색 → O(n)

Cilium eBPF:
  패킷 → eBPF Hash Map 조회 → O(1)
```

### iptables vs eBPF 성능

| 규칙 수 | iptables | eBPF |
|--------|---------|------|
| 100개 | ~1μs | ~0.1μs |
| 1,000개 | ~10μs | ~0.1μs |
| 10,000개 | ~100μs | ~0.1μs |

> eBPF는 규칙 수에 무관하게 O(1) 조회다.
> 수치는 규칙 수 증가에 따른 상대적 경향을 나타내며,
> 실제 환경에 따라 다를 수 있다. ([Cilium 공식 벤치마크](https://docs.cilium.io/en/stable/operations/performance/benchmark/) 참조)

---

## 3. kube-proxy 대체

```bash
# kube-proxy 없이 Cilium 설치
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=<API_SERVER_IP> \
  --set k8sServicePort=6443

# kube-proxy 대체 상태 확인
cilium status | grep KubeProxyReplacement
```

Cilium이 Service → Pod IP 변환, NodePort, LoadBalancer를
eBPF로 직접 처리하므로 kube-proxy가 불필요하다.

---

## 4. Hubble (네트워크 관찰성)

eBPF로 커널 레벨에서 네트워크 흐름을 수집한다.
애플리케이션 코드나 사이드카 없이 L3~L7까지 관찰 가능하다.

```bash
# Hubble 활성화
helm upgrade cilium cilium/cilium \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true

# CLI로 실시간 흐름 확인
hubble observe --last 100
hubble observe --namespace production --verdict DROPPED
hubble observe --protocol http --http-status 500

# UI 접근
cilium hubble ui
```

```
Hubble 출력 예시:
TIMESTAMP  SOURCE          DESTINATION      TYPE   VERDICT
10:23:45   default/web-1   default/api-1    HTTP   FORWARDED
           GET /api/users → 200 OK
10:23:46   default/api-1   10.0.0.53:53    DNS    FORWARDED
           db.default.svc.cluster.local → 10.100.0.5
10:23:47   default/api-1   default/db-0    TCP    DROPPED
           NetworkPolicy에 의해 차단
```

---

## 5. Tetragon (런타임 보안)

eBPF 기반 런타임 보안 감사 및 정책 집행 도구다.

```bash
# 설치
helm install tetragon cilium/tetragon -n kube-system

# 모든 실행 이벤트 모니터링
kubectl exec -n kube-system ds/tetragon -c tetragon -- \
  tetra getevents -o compact | grep exec

# 파일 접근 이벤트
kubectl exec -n kube-system ds/tetragon -c tetragon -- \
  tetra getevents -o compact | grep open
```

---

## 6. XDP (eXpress Data Path)

NIC 드라이버 수준에서 패킷을 처리하여 최고 성능을 달성한다.

```
XDP 액션:
  XDP_DROP    → 패킷 즉시 드롭 (DDoS 방어)
  XDP_PASS    → 커널 네트워크 스택으로 전달
  XDP_TX      → 같은 NIC로 재전송 (LB)
  XDP_REDIRECT → 다른 NIC/CPU로 리다이렉션
```

**XDP 활용 사례:**

| 용도 | 방식 |
|------|------|
| DDoS 방어 | 소스 IP 블랙리스트 → XDP_DROP |
| 로드밸런서 | 패킷 DSR 처리 → XDP_TX/REDIRECT |
| 방화벽 | 허용 목록 외 → XDP_DROP |

---

## 7. Cilium Cluster Mesh

여러 Kubernetes 클러스터를 하나의 네트워크로 연결한다.

```bash
# Cluster Mesh 활성화
cilium clustermesh enable --context cluster1
cilium clustermesh enable --context cluster2

# 클러스터 간 연결
cilium clustermesh connect \
  --context cluster1 \
  --destination-context cluster2

# 상태 확인
cilium clustermesh status
```

```yaml
# 글로벌 서비스 (두 클러스터에 걸쳐 로드밸런싱)
apiVersion: v1
kind: Service
metadata:
  name: my-service
  annotations:
    service.cilium.io/global: "true"
```

---

## 8. 성능 비교 요약

| 솔루션 | 처리 방식 | Service 처리 | L7 정책 |
|--------|---------|------------|---------|
| kube-proxy (iptables) | O(n) | 느림 (규모 증가 시) | 없음 |
| kube-proxy (IPVS) | O(1) | 빠름 | 없음 |
| kube-proxy (nftables) | O(1) | 빠름 | 없음 |
| Cilium (eBPF) | **O(1)** | **최고** | **있음** |

> ⚠️ IPVS는 K8s 1.35 deprecated, 1.36 제거 예정. 대안: nftables 또는 Cilium

---

## 참고 문서

- [Cilium 공식 문서](https://docs.cilium.io/en/stable/)
- [Hubble 문서](https://docs.cilium.io/en/stable/observability/hubble/)
- [Tetragon 문서](https://tetragon.io/docs/)
- [ebpf.io - XDP](https://ebpf.io/applications/#xdp)
- [Cilium 최신 릴리즈 노트](https://github.com/cilium/cilium/releases)
