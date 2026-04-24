---
title: "멀티테넌시 개요"
sidebar_label: "멀티테넌시"
sidebar_position: 1
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - kubernetes
  - multi-tenancy
  - isolation
  - rbac
---

# 멀티테넌시 개요

> 여러 테넌트(팀·고객·워크로드 그룹)가 하나의 쿠버네티스 인프라를 공유하면서도
> 서로의 API·네트워크·데이터·리소스·정체성을 침범하지 못하도록 격리하는 설계 분야.

쿠버네티스는 "혼자 쓰는 클러스터"를 전제로 설계된 시스템이 아니다.
API server·etcd·kubelet은 모두 **전역 리소스**를 그대로 노출하고,
기본 상태에서 어떤 Pod이든 같은 네트워크에서 서로를 호출할 수 있다.
따라서 멀티테넌시는 "한 클러스터에 사람 여럿이 들어온다"는 순간부터
**격리 계층을 의도적으로 쌓아야 하는 운영 과제**가 된다.

---

## 1. 왜 멀티테넌시인가

하나의 클러스터에 테넌트를 몰아넣는 이유는 단순하다.

| 동기 | 설명 |
|------|------|
| 비용 | 노드·컨트롤 플레인·애드온(Prometheus, Cilium, Vault 등) 공유로 고정비 분담 |
| 운영 일원화 | 업그레이드·백업·CVE 패치를 한 곳에서 처리 |
| 리소스 효율 | bin-packing으로 과도한 overprovision 회피 |
| 빠른 온보딩 | 팀 추가 시 클러스터 신설 없이 네임스페이스·테넌트 리소스만 생성 |

반대 비용은 **blast radius(장애·침해 전파 범위)** 증가다.
테넌트 A의 리소스 폭주가 B의 스케줄링을 막고,
A의 침해가 B의 Secret까지 노출될 수 있다.
이 tradeoff의 "어느 지점에 설계를 놓을지"가 멀티테넌시의 본질이다.

---

## 2. Hard vs Soft — 이분법이 아니라 스펙트럼

공식 문서(kubernetes.io/docs/concepts/security/multi-tenancy)도
**단일 정의를 거부**한다.

> "hardness" or "softness" is better understood as a broad spectrum,
> with many different techniques that can be used to maintain different
> types of isolation in your clusters, based on your requirements.

현장에서 통용되는 개략적 구분:

| 구분 | 신뢰 모델 | 격리 목표 | 전형적 구현 |
|------|----------|----------|------------|
| Soft | 테넌트 상호 신뢰(내부 팀) | 실수 방지·공정 분배 | Namespace + RBAC + Quota + NetworkPolicy |
| Hard | 상호 불신(외부 고객, 규제) | 악의적 공격·데이터 유출 차단 | Virtual Cluster, 전용 클러스터, Sandbox 런타임, 노드 격리 |

핵심은 **"몇 개의 격리 축을 어느 강도로 쌓느냐"** 이다.
단일 Hard/Soft 레이블보다, 아래 7개 축을 **독립 체크리스트**로 두고
테넌트 등급에 따라 각 축의 강도를 다르게 조합하는 편이 실무에 맞다.

| 축 | 목적 | 수단 |
|----|------|------|
| API | 다른 테넌트 리소스 조회·수정 차단 | Namespace, RBAC, Admission |
| Identity | SA 토큰·imagePullSecret·OIDC 매핑 탈취 차단 | ServiceAccount projection, Workload Identity, bound token |
| 네트워크 | 횡적 이동·도청 차단 | NetworkPolicy, L7 정책, mTLS, ReferenceGrant |
| 리소스 | Noisy Neighbor 차단 | ResourceQuota, LimitRange, PriorityClass |
| 스토리지 | PV·Secret 월경 차단 | StorageClass 분리, etcd 암호화, RBAC on Secret |
| 커널 | 컨테이너 탈출 방어 | seccomp, AppArmor, gVisor·Kata·UserNamespace |
| 노드 | 물리 자원 공유 차단 | Taint·Toleration, NodeSelector, 전용 풀 |

Identity 축을 별도로 두는 이유는 실제 공격이 자주 들어오는 벡터이기 때문이다.
예: 한 테넌트가 다른 네임스페이스의 `ServiceAccount` 토큰을 자신의 Pod에 마운트하거나,
공유 imagePullSecret을 탈취해 사설 레지스트리 자격을 얻는 시나리오.
Kubernetes SIG Multi-Tenancy의 벤치마크도 Identity를 독립 카테고리로 둔다.

---

## 3. 세 가지 테넌시 모델 (CNCF 표준 분류)

Kubernetes Multi-Tenancy WG가 2021년 정리한 분류는 지금도 유효하다.

### 3.1 Namespace-as-a-Service (NaaS)

**한 클러스터 · 한 컨트롤 플레인 · 네임스페이스로 테넌트 구분.**

- 테넌트는 네임스페이스 집합 하나를 받아 워크로드만 올린다.
- CRD·ClusterRole·ValidatingWebhookConfiguration 같은 **클러스터 스코프 리소스는 플랫폼 팀만** 다룬다.
- 격리는 RBAC·NetworkPolicy·ResourceQuota·PSA 조합으로 만든다.

| 장점 | 단점 |
|------|------|
| 가장 저렴, 리소스 효율 최상 | CRD 충돌·버전 차이 테넌트가 결정 불가 |
| 운영 단순(한 개 etcd, 한 개 API server) | CoreDNS·메트릭·감사 로그가 공통 → 측면 채널 존재 |
| 온보딩 즉시 가능 | 커널 공유 → 컨테이너 탈출 시 전 클러스터 위협 |

**적합:** 내부 팀 공유, dev/staging 공용, 팀 간 신뢰 존재, 비용 최우선.
**대표 도구:** Capsule(Tenant CRD로 네임스페이스 묶음을 테넌트 단위 정책으로 관리).
상세는 [vCluster·Capsule](./vcluster-capsule.md) 글로.

> ⚠️ HNC(Hierarchical Namespace Controller)는 2025-04-17에 `kubernetes-retired/hierarchical-namespaces`로 아카이브되어 read-only 상태이므로 신규 채택 비권장.
> 대안으로 Capsule의 tenant-owner 위임 또는 외부 IDP + RBAC 자동화를 권장.

### 3.2 Virtual Cluster — Control-Plane-as-a-Service (CPaaS)

**한 클러스터 · 테넌트별 "가상 컨트롤 플레인"(경량 API server + 데이터 스토어) · 워커 노드 공유.**

- 테넌트는 자기 전용 API server를 받아 **자기만의 `kubectl get nodes` 세계**를 본다.
- 내부적으로는 sync controller가 테넌트 API server의 Pod을 호스트 네임스페이스 Pod으로 번역.
- **대표 도구:** vCluster(vCluster Labs, 오픈소스). 내부 구조·운영은 다음 글에서 심화.

| 장점 | 단점 |
|------|------|
| CRD·API 확장을 테넌트가 자유롭게 설치 | 호스트 노드 커널은 공유 → 커널 격리 별도 필요 |
| API server 이슈가 호스트로 번지지 않음 | 디버깅 경로가 길어짐(테넌트 → sync → 호스트) |
| 테넌트에게 "관리자" 경험 제공 | 호스트 API server와 동일한 SLO 달성은 운영 난이도 상승 |

**적합:** 개발자 셀프서비스 플랫폼, PR preview 환경, 내부 PaaS, SaaS의 제어 평면.

### 3.3 Cluster-as-a-Service (CaaS)

**테넌트별 물리(또는 관리형) 클러스터 전체 할당.**

- 컨트롤 플레인부터 데이터 플레인까지 완전 분리.
- 대표 도구: **Cluster API(CAPI)**, Rancher, Karmada의 클러스터 프로비저닝 레이어.

| 장점 | 단점 |
|------|------|
| 최강 격리(blast radius = 한 클러스터) | 가장 비싸고, 업그레이드·CVE 대응 N배 |
| 버전·네트워크 정책·노드 풀 완전 독립 | 클러스터 수만큼 플랫폼 팀 toil 증가 |

**적합:** 논리적 격리로는 증명 비용이 폭발하는 규제 환경, M&A로 구조가 다른 조직 수용, 에어갭.

> 규제(PCI-DSS 4.0, HIPAA, GDPR 등) 자체가 CaaS를 강제하지는 않는다.
> 대부분의 표준은 **논리적 격리 + 증명**을 허용한다.
> 다만 감사·증명 비용이 테넌트 수에 비례해 기하급수로 늘면 CaaS가 오히려 저렴해진다.
> 비용/격리 교차점을 직접 측정한 뒤 결정.

### 3.4 세 모델 비교

| 항목 | NaaS | Virtual Cluster(CPaaS) | CaaS |
|------|------|------------------------|------|
| 컨트롤 플레인 | 공유 | 테넌트별 가상 | 테넌트별 실제 |
| 워커 노드 | 공유 | 공유(노드 풀 분리 가능) | 전용 |
| CRD·Admission 자유도 | 플랫폼만 | 테넌트별 자유 | 테넌트별 자유 |
| 격리 강도 | 낮음~중 | 중~높음 | 최상 |
| 테넌트당 고정비 | 최저 | 중 | 최고 |
| 업그레이드 부담 | 1회 | 1회(호스트) + N회(가상) | N회 |
| 전형 use case | 내부 팀 공유 | 개발 플랫폼, PaaS | 고객 격리, 규제 |

**하이브리드가 실무 기본값이다.**
한 조직이 내부 팀에는 NaaS, 개발자 샌드박스는 vCluster,
외부 엔터프라이즈 고객은 CaaS를 동시에 운영하는 구성이 흔하다.

---

## 4. Control Plane 격리 — API·RBAC·Admission

### 4.1 RBAC 최소 권한과 Identity 격리

테넌트에게 주는 Role은 **네임스페이스 범위**로만 잘라야 한다.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: tenant-a
  name: tenant-developer
rules:
  - apiGroups: ["", "apps", "batch"]
    resources: ["pods", "deployments", "jobs", "configmaps"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]     # create/update 금지 — ESO/Vault 경유 강제
```

주의:

- **ClusterRole + RoleBinding** 패턴으로 권한 묶음을 재사용하되,
  `ClusterRole`에 `cluster-scoped` 리소스 verb를 넣지 않는다.
- `impersonate`, `bind`, `escalate` verb는 테넌트에 절대 부여하지 않는다.
- `Secret`의 **list/watch** 권한은 ServiceAccount 토큰까지 노출되므로 엄격히 통제.
- 테넌트 Pod은 `automountServiceAccountToken: false` 기본 + 필요한 곳만 projected token으로 명시 마운트.
- imagePullSecret은 **테넌트 네임스페이스에만 존재**하도록 하고, 플랫폼 공용 secret을 복제하지 않는다.

### 4.2 네임스페이스가 만드는 경계와 한계

네임스페이스가 격리하는 것 — 대부분의 REST 리소스, Event, Role/RoleBinding.
네임스페이스가 **격리하지 못하는 것**:

- Node, PersistentVolume, StorageClass, IngressClass, GatewayClass, PriorityClass.
- CRD 정의 자체(스키마는 전역), CustomResource 인스턴스는 네임스페이스 스코프 가능.
- ClusterRole, ValidatingWebhookConfiguration, MutatingWebhookConfiguration.
- **다른 네임스페이스의 존재 자체**(`list namespaces` 권한이 있으면 전체 목록 조회).

이 한계 때문에 "테넌트가 DNS로 다른 네임스페이스 서비스를 찾을 수 있다"는 고전적 문제가 생긴다
(다음 6절 CoreDNS 항목 참조).

### 4.3 Admission — Pod Security·Validating Policy

테넌트 네임스페이스에는 Pod Security Admission(PSA) 레이블을 강제.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-a
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.32
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

- `restricted`는 runAsNonRoot·seccomp RuntimeDefault·hostPath 금지 등을 강제.
- PSA로 부족한 규칙(예: 레지스트리 allowlist, sidecar 강제 주입)은 **ValidatingAdmissionPolicy(CEL)** 나 Kyverno·Gatekeeper로 보완.

---

## 5. Data Plane 격리 — 네트워크·스토리지·커널

### 5.1 네트워크

기본 "default-deny" 한 장은 필수다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: tenant-a
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
```

- Cilium·Calico는 네임스페이스 간 L3/L4 차단을 기본 제공.
- L7·SNI·mTLS 계층 격리가 필요하면 **Service Mesh(Istio·Linkerd·Cilium ClusterMesh)** 로 보완.
- **Gateway API**의 `ReferenceGrant`는 네임스페이스 경계를 넘는 라우팅·TLS 참조를
  **명시적 동의 기반**으로만 허용한다. 기존 Ingress가 암묵 허용이던 구조를 뒤집는 변화이므로
  멀티테넌시에서는 사실상 기본값으로 사용한다.

### 5.2 스토리지

- StorageClass에 `reclaimPolicy: Delete`를 쓸 때 **테넌트가 StorageClass 생성 권한을 못 갖도록** ClusterRole 분리.
- 공유 분산 스토리지(Rook-Ceph 등)는 **RBD pool·CephFS subvolume group을 테넌트별 분리**하여 IO blast radius를 줄임.
- Secret은 etcd 암호화(KMS provider) + ExternalSecrets Operator로 중앙 관리.

### 5.3 커널·런타임

- `restricted` PSA + seccomp `RuntimeDefault`는 최소선.
- 불신 워크로드는 **RuntimeClass**로 gVisor·Kata·User Namespace를 지정.
- **User Namespace(`hostUsers: false`)**: v1.30 Beta(opt-in) → **v1.33에서 기본 활성화**.
  컨테이너 내 root를 호스트 non-root로 매핑해 탈출 시 피해 범위를 크게 줄인다.
  1.33 이전 클러스터에서는 feature gate와 런타임(runc 1.2+, containerd 2.0+) 지원을 함께 확인.

---

## 6. 자주 빠지는 함정

### 6.1 CoreDNS 와일드 쿼리

기본 CoreDNS 구성은 **어느 테넌트든 `svc.cluster.local` 전체를 조회**할 수 있다.
해결 옵션과 트레이드오프:

| 접근 | 효과 | 비용 |
|------|------|------|
| CoreDNS `kubernetes` 플러그인 `namespaces` 필터 + 테넌트별 CoreDNS 분리 | 완전 격리 | CoreDNS 인스턴스 수 증가·운영 부담 |
| 공용 CoreDNS 유지 + NetworkPolicy로 UDP/TCP 53 egress를 테넌트 전용 resolver로만 허용 | 구현 단순, 대부분 케이스에 충분 | resolver 뒤편 캐시는 여전히 공용 |
| NodeLocal DNSCache를 테넌트별 pool에 배치 + 조회 대상 네임스페이스 제한 | 성능 + 격리 균형 | 네임스페이스 필터링은 별도 정책 필요 |

어느 쪽이든 **ExternalName Service·Service topology·Gateway API HTTPRoute**도
동일 원칙(cross-namespace는 명시 허용)으로 묶어야 DNS/트래픽 양쪽이 일관된다.

### 6.2 cluster-scoped Watch로 새는 정보

`list namespaces`, `list nodes`, `list customresourcedefinitions` 권한은
테넌트에게 **다른 테넌트의 존재와 구조를 노출**한다.
RBAC에서 ClusterRole verb를 최소화하고,
플랫폼이 네임스페이스 목록을 노출할 필요가 있으면 API Gateway/프록시 계층에서 필터링.

### 6.3 ResourceQuota만으로는 Noisy Neighbor를 못 막는다

Quota는 총량을 제한하지만, CPU throttling·디스크 IOPS·네트워크 대역폭은 커널 cgroup 레벨 공유다.

- `LimitRange`로 기본값·최소·최대 강제.
- 민감 테넌트는 **전용 노드 풀 + Taint/Toleration**.
- I/O 민감 워크로드는 `io.max`(cgroup v2)나 노드별 io scheduler 튜닝을 플랫폼에서 제공.

### 6.4 Admission Webhook 충돌

테넌트가 Mutating Webhook을 설치할 수 있으면 **플랫폼 정책을 우회**할 수 있다.
NaaS에서는 webhook·CRD 생성 권한을 테넌트에게 주지 말고,
vCluster/CaaS로 주고 싶을 때 제공.

### 6.5 감사 로그 분리

모든 테넌트의 audit 로그가 한 스트림에 섞이면 사고 대응 시 스캔 비용이 폭증.
Audit Policy 단계에서 `objectRef.namespace`를 인덱스 키로 뽑아
수집 파이프라인에서 테넌트별 분기 전송.

---

## 7. 모델 선택 — 분기 조건 매트릭스

실무 결정은 신뢰 수준 하나로 끝나지 않는다. 아래 조건 중 몇 개가 매칭되는가로 강도를 판단한다.

| 조건 | NaaS | vCluster | CaaS |
|------|:----:|:--------:|:----:|
| 테넌트 간 상호 신뢰(내부 팀) | ✓ | △ | ✗ |
| 테넌트 20개 이하, 온보딩 주 1~2회 | ✓ | ✓ | △ |
| 테넌트가 CRD·Webhook 직접 설치 필요 | ✗ | ✓ | ✓ |
| 테넌트별 다른 Kubernetes 버전 요구 | ✗ | △(제한적) | ✓ |
| 외부 고객 · 상호 불신 · 데이터 분리 요구 | ✗ | △ | ✓ |
| 규제 대응 증명 비용 > 클러스터 추가 비용 | ✗ | ✗ | ✓ |
| 에어갭·데이터 주권·지리적 분리 | ✗ | ✗ | ✓ |
| 테넌트당 노드 < 3, 밀도 극대화 필요 | ✓ | ✓ | ✗ |
| 고정 예산 · 플랫폼 팀 규모 작음 | ✓ | △ | ✗ |

권고는 "체크된 조건이 많은 쪽을 기본값으로, 예외 테넌트는 한 등급 위 모델로."

---

## 8. 테넌트 온보딩 자동화

테넌트 수가 늘수록 수동 생성은 곧 장애 원인이 된다. 표준 패턴:

- **Backstage/IDP** 에서 셀프서비스 요청 → 플랫폼 파이프라인이 리소스 묶음 생성.
- **Crossplane Composition** 또는 **kro ResourceGraphDefinition** 으로
  "Namespace + Quota + NetworkPolicy + Capsule Tenant + ArgoCD AppProject"를 하나의 XR로 선언.
- **ArgoCD ApplicationSet + AppProject per tenant** 로 테넌트별 GitOps 경계 분리.

상세 구현은 [cicd/](../../cicd/) · [iac/](../../iac/) 참조.

---

## 9. 테넌트 비용 산정

격리만큼 자주 묻는 질문이 "누가 얼마를 썼나"다.

- **OpenCost/Kubecost**로 네임스페이스·레이블 단위 cost allocation.
- 노드 풀 분리(label `tenant=xxx`) + Karpenter per-tenant NodePool 조합이면
  물리 자원까지 테넌트 기준으로 추적 가능.
- Chargeback 모델을 선택하기 전, **Quota를 먼저 강제**해야 데이터가 왜곡되지 않는다.

상세는 Kubernetes 카테고리의 비용(FinOps) 섹션에서 별도 다룸.

---

## 10. 평가 — Multi-Tenancy Benchmark와 대체 방안

Kubernetes SIG Multi-Tenancy의 **Multi-Tenancy Benchmarks(MTB)** 는
테넌트 격리가 제대로 걸렸는지 자동 검사하는 표준 체크리스트였다.

- 카테고리: Control Plane Isolation, Tenant Isolation, Fairness, **Identity**, Host Isolation.
- CLI(`kubectl-mtb`)로 Behavioral/Configuration 체크 실행.

> ⚠️ WG Multi-Tenancy는 2023년 6월 공식 spin down되었고,
> 리포지토리는 `kubernetes-retired/multi-tenancy`로 아카이브되었다.
> **체크리스트 개념은 여전히 유효**하지만, 최신 격리 검증은
> Kyverno·Gatekeeper 정책 테스트, 자체 Conftest·OPA 룰, 침투 테스트 자동화로 이관하는 흐름.

프로덕션에서 최소 7개 축(2절 표) 각각에 대해
"성공 시나리오"와 "침해 시나리오" 테스트를 둘 다 보유해야
설계가 유효하다고 말할 수 있다.

---

## 11. 다음 글과의 연결

| 다음 읽기 | 왜 |
|----------|-----|
| [vCluster·Capsule](./vcluster-capsule.md) | NaaS와 CPaaS의 대표 구현 심화 |
| [멀티클러스터 패턴](./multi-cluster-patterns.md) | CaaS를 여러 클러스터로 확장할 때의 설계(Karmada, Fleet, CAPI) |
| [RBAC](../security/rbac.md) | Control Plane 격리의 핵심 수단 |
| [Network Policy](../service-networking/network-policy.md) | Data Plane 격리의 시작점 |
| [네임스페이스 설계](../resource-management/namespace-design.md) | NaaS 구현의 뼈대 |
| [Pod Security Admission](../security/pod-security-admission.md) | PSA로 커널 격리 최소선 확보 |

---

## 참고 자료

- [Kubernetes 공식 — Multi-tenancy](https://kubernetes.io/docs/concepts/security/multi-tenancy/) · 2026-04-24 확인
- [Kubernetes Blog — Three Tenancy Models For Kubernetes](https://kubernetes.io/blog/2021/04/15/three-tenancy-models-for-kubernetes/) · 2026-04-24 확인
- [Kubernetes Blog — User Namespaces enabled by default (v1.33)](https://kubernetes.io/blog/2025/04/25/userns-enabled-by-default/) · 2026-04-24 확인
- [Kubernetes docs — User Namespaces](https://kubernetes.io/docs/concepts/workloads/pods/user-namespaces/) · 2026-04-24 확인
- [AWS EKS Best Practices — Multi-tenancy](https://aws.github.io/aws-eks-best-practices/security/docs/multitenancy/) · 2026-04-24 확인
- [Google Cloud — GKE Multi-tenancy Overview](https://docs.cloud.google.com/kubernetes-engine/docs/concepts/multitenancy-overview) · 2026-04-24 확인
- [CNCF — Virtual cluster: extending namespace-based multi-tenancy](https://www.cncf.io/blog/2019/06/20/virtual-cluster-extending-namespace-based-multi-tenancy-with-a-cluster-view/) · 2026-04-24 확인
- [kubernetes-retired/multi-tenancy — Benchmarks(archived)](https://github.com/kubernetes-retired/multi-tenancy/tree/master/benchmarks) · 2026-04-24 확인
- [kubernetes-retired/hierarchical-namespaces (archived 2025-04-17)](https://github.com/kubernetes-retired/hierarchical-namespaces) · 2026-04-24 확인
- [Capsule (CNCF Sandbox)](https://projectcapsule.dev/) · 2026-04-24 확인
- [vCluster Labs](https://www.vcluster.com/) · 2026-04-24 확인
