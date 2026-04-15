---
title: "서비스 메시 개념 (Istio, Linkerd)"
date: 2026-04-13
tags:
  - network
  - kubernetes
  - service-mesh
  - istio
  - linkerd
  - mtls
sidebar_label: "서비스 메시"
---

# 서비스 메시 개념 (Istio, Linkerd)

## 1. 서비스 메시란

마이크로서비스 간 통신을 애플리케이션 코드 수정 없이
인프라 레벨에서 제어하는 전용 네트워크 레이어다.

```
서비스 메시 없음:
  Service A ──직접 연결──> Service B
  (재시도, 타임아웃, mTLS를 앱이 직접 구현)

서비스 메시 있음:
  Service A → [Proxy] ──── [Proxy] → Service B
              ↑                ↑
              사이드카          사이드카
              (재시도, 타임아웃, mTLS 자동 처리)
```

### 주요 기능

| 기능 | 설명 |
|------|------|
| **mTLS** | 서비스 간 자동 암호화 + 인증 |
| **트래픽 관리** | 카나리 배포, A/B 테스트, 서킷 브레이커 |
| **관찰성** | 분산 트레이싱, 메트릭, 로그 자동 수집 |
| **정책** | 레이트 리밋, 접근 제어 |

---

## 2. 아키텍처: 데이터 플레인 vs 컨트롤 플레인

```
컨트롤 플레인
    └── 정책 설정, 인증서 발급, 설정 배포

데이터 플레인 (각 Pod 옆)
    └── 사이드카 프록시 → 실제 트래픽 처리
```

| 구성요소 | Istio | Linkerd |
|---------|-------|---------|
| 데이터 플레인 | Envoy (C++) | linkerd-proxy (Rust) |
| 컨트롤 플레인 | istiod | linkerd-control-plane |
| 프로토콜 | HTTP/1.1, HTTP/2, gRPC, TCP | HTTP/1.1, HTTP/2, gRPC |

---

## 3. Istio vs Linkerd

| 항목 | Istio | Linkerd |
|------|-------|---------|
| 프록시 | Envoy (범용, 풍부한 기능) | 전용 경량 프록시 (Rust) |
| 메모리 (컨트롤 플레인) | 1 GB+ | **200~300 MB** |
| 학습 곡선 | 높음 | **낮음** |
| L7 정책 | **풍부** | 기본적 |
| 트래픽 관리 | **정교함** | 단순 |
| 자동 mTLS | 있음 | **기본 활성화** |
| 설치 복잡도 | 높음 | **쉬움** |
| 생태계 | 넓음 | 좁음 |

**2025 벤치마크 (2000 RPS 기준):**

| 솔루션 | Linkerd 대비 p99 추가 레이턴시 |
|--------|---------------------------|
| Linkerd | 기준 (0ms) |
| Istio Ambient | **+11.2ms** |
| Istio Sidecar | **+163ms** |

> 출처: Linkerd 공식 벤치마크 (2025-04-24, linkerd.io).
> Linkerd가 주체인 벤치마크임을 감안할 것.

---

## 4. Istio 핵심 기능

### 트래픽 관리

```yaml
# 카나리 배포 (90% → v1, 10% → v2)
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: my-service
spec:
  hosts:
    - my-service
  http:
    - route:
        - destination:
            host: my-service
            subset: v1
          weight: 90
        - destination:
            host: my-service
            subset: v2
          weight: 10
```

```yaml
# 서킷 브레이커
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: my-service
spec:
  host: my-service
  trafficPolicy:
    outlierDetection:
      consecutive5xxErrors: 5      # 5회 연속 5xx
      interval: 30s                # 30초 내
      baseEjectionTime: 30s        # 30초 제외
```

### 자동 mTLS

```bash
# mTLS 상태 확인
# x = experimental, 출력 형식이 버전마다 다를 수 있음
istioctl x check-inject -n default
kubectl exec <pod> -c istio-proxy -- \
  curl -s localhost:15000/clusters | grep "tls_context"
```

---

## 5. Istio Ambient Mesh (2024 GA)

사이드카 없이 서비스 메시를 구현하는 방식.
Istio 1.24(2024-11)에서 Stable GA 달성.

```
사이드카 모드:
  Pod → [Envoy 사이드카] → 네트워크

Ambient 모드:
  Pod → [ztunnel (노드 DaemonSet)] → 네트워크
        선택적: [Waypoint Proxy (네임스페이스 단위)]
```

| 항목 | Sidecar | Ambient |
|------|---------|---------|
| 프록시 위치 | Pod 내 | 노드 레벨 |
| 리소스 오버헤드 | 높음 (Pod당) | **낮음** |
| 기존 Pod 변경 | 재시작 필요 | **불필요** |
| L7 기능 | 모든 Pod | Waypoint 설치 Pod만 |

```bash
# Ambient 모드 활성화
kubectl label namespace default istio.io/dataplane-mode=ambient
```

---

## 6. Linkerd 설치 및 사용

```bash
# CLI 설치 (프로덕션 환경에서는 스크립트를 먼저 내려받아 내용 확인 후 실행)
curl --proto '=https' --tlsv1.2 -sSfL \
  https://run.linkerd.io/install | sh

# 사전 확인
linkerd check --pre

# 설치
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -

# viz 확장 설치 (stat, top 명령에 필요)
linkerd viz install | kubectl apply -f -

# 상태 확인
linkerd check

# 네임스페이스에 메시 주입
kubectl annotate namespace default \
  linkerd.io/inject=enabled

# 트래픽 통계 확인
linkerd viz stat deploy
linkerd viz top deploy/my-app
```

---

## 7. 서비스 메시 도입 체크리스트

```text
[ ] 마이크로서비스 10개 이상 → 서비스 메시 검토 가치 있음
[ ] mTLS 필요 → 두 솔루션 모두 지원
[ ] 리소스 제약 → Linkerd 경량 프록시 선택
[ ] 정교한 트래픽 관리 → Istio
[ ] 운영 단순성 → Linkerd 또는 Istio Ambient
[ ] 기존 eBPF 환경 (Cilium) → Cilium Service Mesh 검토
```

---

## 참고 문서

- [Istio 공식 문서](https://istio.io/latest/docs/)
- [Linkerd 공식 문서](https://linkerd.io/2-latest/overview/)
- [Istio Ambient Mesh](https://istio.io/latest/docs/ambient/)
- [CNCF Service Mesh 비교](https://www.cncf.io/blog/2021/03/10/service-mesh-comparison/) (2021, 참고용)
