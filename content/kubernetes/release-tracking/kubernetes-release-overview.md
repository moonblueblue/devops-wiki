---
title: "Kubernetes 릴리스 개요 — 1.33 ~ 1.36"
sidebar_label: "K8s 릴리스"
sidebar_position: 1
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - kubernetes
  - release
  - upgrade
  - version-skew
  - deprecation
---

# Kubernetes 릴리스 개요 — 1.33 ~ 1.36

> 네 마이너(1.33 Octarine · 1.34 O' WaW · 1.35 Timbernetes · 1.36 Haru)를
> 관통하는 축은 세 개다. **In-Place Pod Resize**의 단계적 GA, **DRA**의
> Core GA(1.34) → 운영 기능 성숙(1.36), 그리고 **배치 워크로드의 네이티브화**
> (Pod Replacement GA, Workload API Alpha). 1.35·1.36은 **큰 점프 마이너**
> (cgroup v2·containerd 2.0·IPVS·Ingress NGINX·gitRepo). 업그레이드 계획의
> 단일 참조점으로 쓰도록 구성했다.

- **수명 상태 (2026-04-24)** — 1.32 EOL, 1.33 Maintenance, 1.34·1.35·1.36 Standard Support
- **DRA Core GA 1.34**, 운영 기능 GA·Beta는 **1.36 Haru**
- **In-Place Pod Resize** — 1.33 Beta → **1.35 GA**
- **Workload API**(Gang Scheduling) — 1.35 Alpha 도입

선행: [클러스터 업그레이드](../upgrade-ops/cluster-upgrade.md),
[Version Skew](../upgrade-ops/version-skew.md),
[노드 유지보수](../upgrade-ops/node-maintenance.md).
심화: [DRA](../ai-ml/dra.md),
[AI 워크로드 스케줄링](../ai-ml/ai-workload-scheduling.md),
[배치 워크로드](../special-workloads/batch-workload.md).

---

## 1. 릴리스 케이던스와 수명

### 1.1 연 3회, 15주 케이던스

- SIG Release 정책상 **약 15주(3.5개월) 주기**로 연 3회 마이너 릴리스
- 2020년부터 연 3회 기조 확립 (이전은 연 4회)
- 각 마이너마다 Release Lead·Theme·코드네임 지정

### 1.2 14개월 지원 창

| 구간 | 의미 | 기간 |
|---|---|---|
| **Standard Support** | 모든 cherry-pick 대상, 정기 패치 | 12개월 |
| **Maintenance Mode** | 중대 버그·CVE만 | +2개월 |
| 합계 (EOL까지) | | **14개월** |

동시 표준 지원 = **3개 마이너**(최신 + 직전 2개). 최신 GA 순간에 가장
오래된 표준 마이너가 Maintenance로 내려간다.

### 1.3 2026-04-24 기준 수명표

| 마이너 | 코드네임 | GA | Std EOL | Maint EOL | 현재 상태 |
|---|---|---|---|---|---|
| 1.32 | Penelope | 2024-12-11 | 2025-12-11 | **2026-02-28** | **EOL** |
| 1.33 | Octarine | 2025-04-23 | 2026-04-28 | 2026-06-28 | **Maintenance Mode** (04-28 진입) |
| 1.34 | Of Wind & Will (O' WaW) | 2025-08-27 | 2026-08-27 | 2026-10-27 | Standard Support |
| 1.35 | Timbernetes | 2025-12-17 | 2026-12-17 | 2027-02-28 | Standard Support |
| 1.36 | Haru (ハル, 봄) | 2026-04-22 | 2027-04-22 | 2027-06-28 | **최신** |
| 1.37 | 미정 | 2026-08 예상 | — | — | — |

**주의**: 1.33은 1.36 GA 직후(2026-04-28) 마지막 패치 릴리스와 함께
**Maintenance Mode**로 진입한다. 새 기능 패치는 없고 중대 수정만 반영된다.
6월 말 EOL 이전에 업그레이드 일정을 확정해야 한다.

### 1.4 업스트림 LTS는 없다 — 벤더 연장

업스트림은 14개월이 한계다. LTS는 벤더만 제공한다.

| 제공처 | 연장 폭 | 조건 |
|---|---|---|
| **EKS Extended Support** | +12개월 | 유료, skew 정책은 동일 |
| **GKE Extended Channel** | 최대 24개월 | 채널 지정 |
| **AKS LTS** | 2년 | 특정 마이너만 지정 |
| **OpenShift EUS** | 18개월 | 짝수 마이너만 |

**오해 주의**: Extended Support는 "업그레이드 유예"일 뿐, **kubelet skew
정책(n-3)은 유효**하다. 노드·컨트롤 플레인 모두 Extended여야 의미가 있다.

---

## 2. 1.33 ~ 1.36 한눈에

### 2.1 운영 핵심 요약

| 마이너 | 운영 핵심 | 부차 |
|---|---|---|
| **1.33 Octarine** | In-Place Pod Resize **Beta**(기본 on) | Sidecar GA, nftables GA, Multiple Service CIDRs GA, `kubeProxyVersion` 필드 제거 |
| **1.34 O' WaW** | **DRA Core GA** (`resource.k8s.io/v1`) | Pod Replacement Policy GA, **VolumeAttributesClass GA**, HPA Configurable Tolerance Beta, 58개 enhancement |
| **1.35 Timbernetes** | In-Place Pod Resize **GA** | **Workload API Alpha**(Gang), cgroup v1 종료, 60개 enhancement |
| **1.36 Haru** | **DRA 운영 기능 성숙**(AdminAccess·PrioritizedList GA, Partitionable·DeviceTaints·Resource Health Beta) + **MutatingAdmissionPolicy GA**, **User Namespaces GA** | **gitRepo 볼륨 제거**, Ingress NGINX 은퇴 후 첫 릴리스, Fine-grained Kubelet Authz GA, 70개 enhancement |

### 2.2 기능 매트릭스 (1.33 → 1.36)

| 영역 | 1.33 | 1.34 | 1.35 | 1.36 |
|---|---|---|---|---|
| In-Place Pod Resize | Beta | Beta | **GA** | GA + Pod-level Alpha |
| DRA Core | Beta | **GA** | GA | GA |
| DRA AdminAccess | — | Beta | Beta | **GA** |
| DRA PrioritizedList | — | Beta | Beta | **GA** |
| DRA Partitionable Devices | — | Alpha | Alpha | **Beta** |
| DRA DeviceTaints | — | Alpha | Alpha | **Beta** |
| DRA Resource Health | — | Alpha | Alpha | **Beta** |
| DRA Consumable Capacity | — | Alpha | Beta | Beta |
| Sidecar Containers | **GA** | GA | GA | GA |
| Pod Replacement Policy | — | **GA** | GA | GA |
| SuccessPolicy·backoffLimitPerIndex | **GA** | GA | GA | GA |
| nftables kube-proxy | **GA** | default | default | default |
| IPVS kube-proxy | ok | ok | Deprecated | Deprecated 진전 |
| User Namespaces | Beta(default) | Beta | Beta | **GA** |
| Workload API (Gang) | — | — | **Alpha** v1alpha1 | Alpha **v1alpha2** (PodGroup 분리, breaking) |
| MutatingAdmissionPolicy | — | **Beta** | Beta | **GA** |
| VolumeAttributesClass | — | **GA** | GA | GA |
| Fine-grained Kubelet Authz | Alpha | Beta | Beta | **GA** |
| `kubeProxyVersion` 필드 | **제거** | — | — | — |
| cgroup v1 | ok | ok | **종료** | 미지원 |
| containerd 지원 | 1.7·2.0 | 1.7·2.0 | 1.7 마지막 | **2.0+ 필수** |
| gitRepo volume | Deprecated | Deprecated | Deprecated | **제거** |

---

## 3. 1.33 Octarine — In-Place Resize의 시작

**GA 일자**: 2025-04-23. **운영 핵심**: In-Place Pod Resize가 **Beta 기본
on**이 되어, VPA·FinOps의 **무중단 rightsizing** 경로가 실질적으로 열렸다.

### 3.1 GA로 승격된 주요 기능

| 기능 | KEP | 의미 |
|---|---|---|
| **Sidecar Containers** | KEP-753 | `restartPolicy: Always` init. Istio·Linkerd 수명주기 정식화 (1.28 Alpha → 1.29 Beta → 1.33 GA) |
| **Multiple Service CIDRs** | KEP-1880 | `ServiceCIDR`·`IPAddress` CRD로 Service IP 풀 동적 확장 |
| **nftables kube-proxy** | KEP-3866 | kubeadm 기본 후보. IPVS 탈출 경로 완성 |
| **SupplementalGroupsPolicy** | KEP-3619 | Pod의 gid supplement 정책 명시 |
| **backoffLimitPerIndex** | KEP-3850 | Indexed Job 인덱스별 실패 예산 |
| **SuccessPolicy (Indexed Job)** | KEP-3998 | 조기 성공 종료 |
| **Topology Aware Routing** | KEP-4444 | `trafficDistribution: PreferClose` GA |

### 3.1.1 제거된 필드

| 항목 | KEP | 의미 |
|---|---|---|
| `Node.status.nodeInfo.kubeProxyVersion` 제거 | KEP-4004 | 1.31 deprecated → **1.33 제거**. kubelet이 kube-proxy 버전을 알 수 없다는 전제 확립 |

### 3.2 Beta·Alpha

| 기능 | 의미 |
|---|---|
| In-Place Pod Resize (Beta, 기본 on) | VPA·HPA와의 결합으로 rightsizing 자동화 기반 |
| **User Namespaces** (Beta, enabled by default) | KEP-127. 1.30 Beta → 1.33 기본 on(여전히 Beta) → 1.36 GA |
| DRA (Beta 확장) | `DeviceClass`·`ResourceSlice`·CEL selector 안정화 |
| `kubectl .kuberc` (Alpha) | 사용자 프리퍼런스 파일 |

### 3.3 운영 영향

- **VPA 모드 판단 재검토**: `Auto`가 재시작을 동반한다는 전제가 약해짐
- **FinOps**: 파드 재생성 없는 조정이 가능해지면서 **관측 손실 없이**
  Kubecost·OpenCost의 권고를 적용할 수 있는 기반 마련

### 3.4 덧: 부가 품질 개선

| 영역 | 내용 |
|---|---|
| kubelet | **Topology Manager** 정책 표현 확장, Align 오류 메시지 개선 |
| kubectl | `.kuberc` Alpha, `kubectl debug` 프로파일 강화 |
| kubeadm | ClusterConfiguration 마이그레이션 도구 개선 |

---

## 4. 1.34 Of Wind & Will — DRA GA

**GA 일자**: 2025-08-27. **운영 핵심**: **DRA Core GA**
(`resource.k8s.io/v1`). AI 리소스 모델이 Extended Resource → DRA로 이동을
시작하는 분기점. 58개 enhancement(GA 23 / Beta 22 / Alpha 13).

### 4.1 GA로 승격된 주요 기능

| 기능 | KEP | 의미 |
|---|---|---|
| **DRA Core** | KEP-4381 | Structured Parameters 모델 표준화 |
| **Pod Replacement Policy** | KEP-3939 | `TerminatingOrFailed`(기본) vs `Failed`의 의미 확정 |
| **VolumeAttributesClass** | KEP-3751 | StorageClass 런타임 속성. CSI `ModifyVolume` 표준 경로 |
| **Kubelet Tracing** | — | OpenTelemetry 트레이스 노출 |
| **Ordered Namespace Deletion** | — | 순서 있는 종료 |

### 4.2 Beta·Alpha

DRA 외에도 중요한 Beta 승격이 두 건이다.

| 기능 | 상태 | KEP |
|---|---|---|
| **HPA Configurable Tolerance** | **Beta**(기본 on) | KEP-4951 — HPA마다 tolerance 별도 지정 |
| **MutatingAdmissionPolicy** | **Beta** | KEP-3962 — CEL 기반 admission webhook 대체 경로 시작 |
| DRA AdminAccess | Beta (1.36 GA) | — |
| DRA PrioritizedList | Beta (1.36 GA) | — |
| DRA Partitionable Devices | Alpha (1.36 Beta) | — |
| DRA DeviceTaints·Tolerations | Alpha (1.36 Beta) | — |
| DRA Consumable Capacity | Alpha | — |
| DRA Resource Health (Pod Status) | Alpha (1.36 Beta) | — |
| DRA Extended Resource Mapping | Alpha — 기존 `nvidia.com/gpu:1`을 내부 DRA로 변환 | — |

### 4.3 주의할 기본값 변경

**Pod Replacement Policy**의 기본값이 `TerminatingOrFailed`이다.
**Pod Failure Policy를 사용하는 Job은 자동으로 `Failed`로 고정**되어 다른
값이 허용되지 않는다. PFP 미사용 Job이라도 **리소스 타이트 클러스터**이거나
**rank 고정이 필요한 분산 학습**이면 기본값 대신 `Failed`를 명시해 동시
기동 과잉을 피한다.

---

## 5. 1.35 Timbernetes — In-Place GA + Workload API Alpha

**GA 일자**: 2025-12-17. **운영 핵심**: In-Place Pod Resize **GA**
+ **Workload API Alpha**(Gang Scheduling 업스트림 도입). 동시에 **cgroup v1
종료**와 **containerd 1.x 마지막 지원**의 큰 점프 마이너.
60개 enhancement(GA 17 / Beta 19 / Alpha 22 수준, 공식 블로그 기준).

### 5.1 GA

| 기능 | KEP |
|---|---|
| **In-Place Pod Resize** | KEP-1287 — memory limit 감소(best-effort)까지 허용 |
| **ServiceAccount Token Node Restriction** | KEP-4193 GA 완성 — audience-bound 토큰 확립 |

### 5.2 주목할 Alpha (방향 선언)

| 기능 | KEP | 의미 |
|---|---|---|
| **Workload API** (`scheduling.k8s.io/v1alpha1/Workload`) | KEP-4671 (Gang) + 관련 KEP | Gang Scheduling 1급 객체. **1.36에서 v1alpha2로 breaking**(매니페스트 재작성 필요) |
| **Workload-Aware Preemption** | 관련 KEP 진행 | 그룹 단위 선점 |
| **Opportunistic Batching** | KEP-5233 | 스케줄러 배치 평가 (Beta·기본 활성) |
| **DRA Device Binding Conditions** | KEP-5007 | 네트워크·IB 토폴로지 인지 바인딩 |
| **Pod-level resources In-Place resize** | KEP-2837·1287 | 파드 단위 총합 resize |

### 5.3 제거·Deprecation

- **cgroup v1 완전 종료** — RHEL 9·Ubuntu 22.04+ 등 v2 기본 OS로 전환 선결
- **containerd 1.x 마지막 지원** — 1.36에서 2.0+ 필수
- **IPVS kube-proxy deprecated** — 공식 블로그의 deprecation 선언 (참고: `kubeProxyVersion` 필드는 1.33에서 이미 제거)

### 5.4 초기 패치 진입 원칙

1.35.0 초기에 In-Place Resize GA 경로의 kubelet·scheduler 경계 사례가
커뮤니티에서 일부 보고되었다. **`.0` 회피, `.1`·`.2` 이후 진입**이
보수 운영 표준.

---

## 6. 1.36 Haru — DRA 운영 성숙 + 큰 점프

**GA 일자**: 2026-04-22. **운영 핵심**: DRA의 **운영 기능**이 GA·Beta로
성숙하여 AI 워크로드의 표준 기본값이 되었다. 동시에 **gitRepo 제거**,
**Ingress NGINX 은퇴 후 첫 릴리스**, **containerd 2.0+ 필수**로 "**큰 점프**"
마이너. 70개 enhancement(GA 18 / Beta 25 / Alpha 25).

### 6.1 GA

| 기능 | KEP | 의미 |
|---|---|---|
| **DRA AdminAccess** | (DRA 서브 KEP) | DCGM·Profiler 등 관측 에이전트의 GPU 병행 접근 |
| **DRA PrioritizedList** | KEP-4816 | "H100 없으면 L40S 2장" 등 대체 후보 |
| **MutatingAdmissionPolicy** | KEP-3962 | CEL 기반 mutating admission. webhook 대체 경로 정식화, 기본 활성 |
| **User Namespaces** | KEP-127 | 컨테이너 root UID를 호스트 root와 분리. 1.25 Alpha → 1.30 Beta → 1.33 default on → **1.36 GA** |
| **Fine-grained Kubelet Authz** | KEP-2862 | kubelet API 최소권한, `nodes/proxy` 대체 |
| **Stable Kubelet Tracing** | — | 1.34 확장의 완성 |

### 6.2 Beta

| 기능 | KEP |
|---|---|
| **DRA Partitionable Devices** | KEP-4815 — MIG 동적 분할 표준 |
| **DRA DeviceTaints·Tolerations** | KEP-5055 |
| **DRA Resource Health (Pod Status)** | KEP-4680 |
| **DRA Extended Resource Mapping** | — |

### 6.3 Alpha·Workload 진화

**Workload Aware Scheduling (WAS)** — Job 컨트롤러와 Workload API를 통합하고,
**PodGroup API를 분리**한다. 1.35의 "monolithic Workload"가 가진 모호성을
해소하고 정책(Workload) × 런타임 그루핑(PodGroup)의 분리 설계를 도입.

**Breaking 주의**: 1.35의 `scheduling.k8s.io/v1alpha1/Workload` 매니페스트는
1.36에서 **동작하지 않는다**(v1alpha2만 지원). 1.35에서 Alpha를 실험한
운영자는 업그레이드 전 매니페스트를 재작성해야 한다.

### 6.4 제거 (Breaking)

| 제거 대상 | 영향 | 대응 |
|---|---|---|
| **gitRepo 볼륨 타입** | 사용 파드 admission 거부 | init container + `git clone`, 또는 `git-sync` 사이드카 |
| (**Ingress NGINX**는 2026-03-24 **업스트림 유지 종료** — 릴리스 자체의 제거는 아니나 실질 영향) | 업스트림 패치 종료 | Gateway API(+Cilium·Envoy Gateway), NGINX Gateway Fabric |

**참고**: IPVS kube-proxy 모드의 **최종 제거 일정**은 공식 deprecation
가이드로 재확인할 것. 1.35에서 deprecated 선언되었으며, 1.36부터 실운영
경로로는 권장되지 않는다.

### 6.5 업그레이드 전 감사 체크리스트

| 항목 | 확인 방법 |
|---|---|
| gitRepo 볼륨 사용 | 전체 매니페스트 grep `gitRepo:` 및 CRD 파라미터 감사 |
| IPVS kube-proxy | `kubectl -n kube-system get cm kube-proxy -o yaml` |
| containerd 버전 | 모든 노드에서 `containerd --version` |
| cgroup 버전 | `stat -fc %T /sys/fs/cgroup` 결과 `cgroup2fs` |
| Ingress NGINX 컨트롤러 | 존재 시 Gateway API·NGF 이관 계획 |
| Deprecated API 사용 | `kube-no-trouble`(`kubent`)·`pluto` 스캔 |

---

## 7. Deprecation·제거 경로 (1.33 ~ 1.36 통합)

### 7.1 API·기능 제거 타임라인

| 릴리스 | 제거 항목 |
|---|---|
| 1.32 | ServiceAccount 토큰 Secret 자동 생성 종료 (`kubectl create token` 사용) |
| 1.33 | **`Node.status.nodeInfo.kubeProxyVersion` 필드 제거** (KEP-4004, 1.31 deprecated) |
| 1.34 | (주요 API 제거 없음) |
| 1.35 | **cgroup v1 지원 종료**, IPVS kube-proxy deprecated 선언 |
| **1.36** | **gitRepo 볼륨 제거**, containerd 2.0+ 필수 |

### 7.2 DRA — Classic → Structured Parameters

1.30까지의 **Classic DRA** 리소스(`PodSchedulingContext`·`ResourceClass`
opaque 파라미터 모델)는 제거됐다. 1.31부터 **Structured Parameters**로
재설계, 1.34 GA. 옛 `v1alpha`·초기 `v1beta` 샘플은 **호환 없음**,
`kubectl convert` **미지원** — 매니페스트 수작업 재작성이 원칙.

### 7.3 deprecation 정책 요약

- Beta API는 **GA 후 3 마이너** 또는 deprecated 후 **9개월** 중 늦은 쪽에 제거
- Deprecated API Migration Guide(공식 문서)가 기준점
- `kubent`·`pluto` 같은 스캐너로 사전 감사

---

## 8. Version Skew & 업그레이드 순서

상세 표는 [Version Skew](../upgrade-ops/version-skew.md), 절차는
[클러스터 업그레이드](../upgrade-ops/cluster-upgrade.md) 참조. 여기서는
요약.

| 컴포넌트 | 허용 범위 (apiserver X 기준) |
|---|---|
| HA apiserver 간 | 최신·최구 ≤ 1 마이너 |
| controller-manager·scheduler·CCM | X, X-1 |
| kubelet·kube-proxy | X, X-1, X-2, **X-3** (1.28+) |
| kubectl | X-1, X, X+1 |
| kubeadm | X, X+1 (업그레이드 중) |

### 8.1 업그레이드 순서 원칙

1. CP 먼저, 워커 나중 (스큐 역전 금지)
2. HA CP는 **한 대씩**, 쿼럼 확인
3. kubelet ↔ apiserver 간극 **n-1 이내** 권장(허용 n-3이라도 최소화)
4. 마이너 skip 금지 — 1.33 → 1.36 한 번에 금지, 1.33→1.34→1.35→1.36 순
5. `.0` 회피, `.1`·`.2` 이후 진입

### 8.2 1.36으로 올리는 선결

- containerd **2.0+** 전 노드 반영 (1.35 기간에 완료)
- kube-proxy **nftables 모드** 고정 (IPVS 탈출)
- **cgroup v2** 전 노드 확인
- **gitRepo 볼륨** 사용처 전부 교체
- **Ingress NGINX** 사용 시 Gateway API·NGF 이관 계획

---

## 9. 업그레이드 판단 기준

### 9.1 2026-04-24 현재 어느 버전에 머물 수 있나

| 현재 | 판단 |
|---|---|
| **1.36** | 최신. 초기면 `.1`·`.2` 패치 대기 권장 |
| **1.35** | Standard Support. DRA 운영 기능 필요 없으면 유지 가능 |
| **1.34** | Standard Support, DRA Core 사용에 충분 |
| **1.33** | **Maintenance Mode**, 6월 말 EOL. 분기 내 업그레이드 |
| **1.32 이하** | **EOL**. 보안 우선순위 최상위 |

### 9.2 지금 기준으로 무엇이 합리적인가

| 목적 | 권장 |
|---|---|
| 보수적 운영 (안전 최우선) | **1.34**(GA 8개월 숙성, 1.34.5+ 패치 풍부) |
| 균형 (현실적 디폴트) | **1.35**(In-Place GA, cgroup v2·containerd 2.0 전환 완료) |
| AI 워크로드·DRA 운영 기능 | **1.36**(AdminAccess·PrioritizedList GA, Partitionable·DeviceTaints Beta) |
| 벤더 LTS 연장 | 관리형 제품의 연장 채널로 1.32·1.33 유지 가능하나 skew는 동일 |

### 9.3 1.36으로 당장 점프할 조건

**이유 있음**:
- DRA Partitionable(MIG 동적 분할)·DeviceTaints가 GPU 운영에 직접 가치
- 대규모 DRA 플릿 스케줄링 지연 개선
- **MutatingAdmissionPolicy GA**로 admission webhook 본격 대체 가능
- User Namespaces GA로 SecurityContext 강화 경로 정식화

**선결 조건**:
- containerd 2.0+ / cgroup v2 / nftables kube-proxy 모두 충족
- gitRepo 사용처 전면 교체
- Ingress NGINX 대체 완료 또는 계획 확정

---

## 10. 1.37 예고 (추정)

- **예상 GA**: 2026-08 ± 2주 (15주 케이던스 기준)
- **주목 KEP** (확정 전, 변경 가능):
  - DRA Consumable Capacity GA 후보
  - Pod-level resources In-Place Resize Beta
  - Workload API Beta (1.35 Alpha 연속)
  - Mutating Admission Policy GA 후보
  - SchedulerQueueingHint 추가 개선

**주의**: 2026-04-24 시점에서 1.37 공식 Sneak Peek 블로그는 아직 미발표다.
위 목록은 KEP 상태·현 릴리스 흐름 기반 추정이며, SIG Release 공식 타임라인
공개 후 `last_verified` 갱신 시 재검토한다.

---

## 11. 흔한 오해 정리

| 오해 | 사실 |
|---|---|
| "1.33이 아직 Standard Support" | 1.36 GA 직후(2026-04-28) Maintenance Mode. 표준 = 1.34·1.35·1.36 |
| "User Namespaces는 1.33에서 GA" | 1.33은 Beta default on. **실제 GA는 1.36** (KEP-127) |
| "DRA는 별도 controller-manager 필요" | Classic 잔재. 1.31+ 현행은 스케줄러 플러그인 하나 |
| "1.34 DRA GA = 바로 마이그" | Device Plugin과 **노드 단위 배타**. Extended Resource Mapping으로 점진 전환 |
| "Extended Support가 skew 완화" | skew 정책은 동일. kubelet n-3 유지 |
| "VPA `Auto`가 여전히 기본" | **1.4.0부터 deprecated**, 1.5.0에서 `InPlaceOrRecreate` GA로 권장 |
| "In-Place Resize로 memory 자유 감소" | 1.35+ 허용되나 **best-effort**. JVM·Python은 `RestartContainer` 명시 권장 |
| "1.35 Workload API가 Gang을 해결" | Alpha. 프로덕션은 Kueue + Volcano·KAI. Workload API는 방향 선언 |
| "1.35의 Workload 매니페스트가 1.36에서도 동작" | **v1alpha1 → v1alpha2 breaking**. 매니페스트 재작성 필요 |
| "1.36에서 containerd 1.x 유지 가능" | CRI 호환 깨짐. **2.0+ 필수**(1.35가 1.x 마지막 지원) |
| "Ingress NGINX는 1.36에서 제거" | 릴리스 자체 제거는 아니고 **업스트림 유지 종료**. Gateway API·NGF 이관 필요 |
| "MutatingAdmissionPolicy는 아직 Beta" | **1.36 GA**(KEP-3962). admission webhook 신규 작성은 CEL 우선 |
| "1.34 코드네임 미지정" | "Of Wind & Will (O' WaW)" |

---

## 12. 핵심 요약

1. **2026-04-24 현재 표준 지원 3개 = 1.34·1.35·1.36**. 1.33은 2026-04-28
   Maintenance Mode 진입, 6월 말 EOL.
2. 네 마이너의 단일 축: **In-Place Resize GA(1.35) × DRA Core GA(1.34) ×
   운영 기능 성숙(1.36, MutatingAdmissionPolicy·User Namespaces GA 포함)
   × 배치 워크로드 네이티브화(1.34 Pod Replacement GA → 1.35 Workload API
   Alpha → 1.36 v1alpha2 breaking)**.
3. 큰 점프 마이너는 **1.35**(cgroup v2·containerd 2.0) **1.36**(gitRepo·
   IPVS·Ingress NGINX 은퇴).
4. **보수 운영 권장 = 1.34, 균형 디폴트 = 1.35, AI 워크로드 필요 = 1.36**.
5. 업그레이드는 **CP 먼저 → 노드, 마이너 skip 금지, `.0` 회피**. 1.36
   진입 전 **containerd 2.0·cgroup v2·nftables·gitRepo 감사** 필수.

---

## 참고 자료

- [Kubernetes v1.33 Octarine — Release Blog](https://kubernetes.io/blog/2025/04/23/kubernetes-v1-33-release/) (확인: 2026-04-24)
- [Kubernetes v1.34 Of Wind & Will — Release Blog](https://kubernetes.io/blog/2025/08/27/kubernetes-v1-34-release/) (확인: 2026-04-24)
- [Kubernetes v1.35 Timbernetes — Release Blog](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/) (확인: 2026-04-24)
- [Kubernetes v1.36 Haru — Release Blog](https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/) (확인: 2026-04-24)
- [Kubernetes Releases — All](https://kubernetes.io/releases/) (확인: 2026-04-24)
- [Kubernetes Patch Releases · EOL 일정](https://kubernetes.io/releases/patch-releases/) (확인: 2026-04-24)
- [Kubernetes Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/) (확인: 2026-04-24)
- [Kubernetes v1.34 — DRA has graduated to GA](https://kubernetes.io/blog/2025/09/01/kubernetes-v1-34-dra-updates/) (확인: 2026-04-24)
- [Kubernetes v1.34 — Pod Replacement Policy GA](https://kubernetes.io/blog/2025/09/05/kubernetes-v1-34-pod-replacement-policy-for-jobs-goes-ga/) (확인: 2026-04-24)
- [Kubernetes v1.35 — In-Place Pod Resize GA](https://kubernetes.io/blog/2025/12/19/kubernetes-v1-35-in-place-pod-resize-ga/) (확인: 2026-04-24)
- [Kubernetes v1.35 — Introducing Workload-Aware Scheduling](https://kubernetes.io/blog/2025/12/29/kubernetes-v1-35-introducing-workload-aware-scheduling/) (확인: 2026-04-24)
- [Kubernetes v1.33 — backoffLimitPerIndex GA](https://kubernetes.io/blog/2025/05/13/kubernetes-v1-33-jobs-backoff-limit-per-index-goes-ga/) (확인: 2026-04-24)
- [Kubernetes v1.33 — In-Place Pod Resize Beta](https://kubernetes.io/blog/2025/05/16/kubernetes-v1-33-in-place-pod-resize-beta/) (확인: 2026-04-24)
- [Kubernetes Deprecated API Migration Guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/) (확인: 2026-04-24)
- [Kubernetes Deprecation Policy](https://kubernetes.io/docs/reference/using-api/deprecation-policy/) (확인: 2026-04-24)
- [Kubernetes 1.36 Sneak Peek](https://kubernetes.io/blog/2026/03/30/kubernetes-v1-36-sneak-peek/) (확인: 2026-04-24)
- [Kubernetes 1.33 Sneak Peek (kubeProxyVersion 제거)](https://kubernetes.io/blog/2025/03/26/kubernetes-v1-33-upcoming-changes/) (확인: 2026-04-24)
- [Kubernetes v1.34 — VolumeAttributesClass GA](https://kubernetes.io/blog/2025/09/08/kubernetes-v1-34-volume-attributes-class/) (확인: 2026-04-24)
- [KEP-127 — User Namespaces in Pods](https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/127-user-namespaces/README.md) (확인: 2026-04-24)
- [KEP-3962 — Mutating Admission Policies](https://github.com/kubernetes/enhancements/tree/master/keps/sig-api-machinery/3962-mutating-admission-policies) (확인: 2026-04-24)
- [KEP-4951 — Configurable HPA Tolerance](https://github.com/kubernetes/enhancements/tree/master/keps/sig-autoscaling/4951-configurable-hpa-tolerance) (확인: 2026-04-24)
- [KEP-4444 — Service Traffic Distribution](https://github.com/kubernetes/enhancements/tree/master/keps/sig-network/4444-service-traffic-distribution) (확인: 2026-04-24)
- [Ingress NGINX Retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/) (확인: 2026-04-24)
- [VPA InPlaceOrRecreate 마이그레이션](https://github.com/kubernetes/autoscaler/blob/master/vertical-pod-autoscaler/docs/quickstart.md) (확인: 2026-04-24)
- [endoflife.date — Kubernetes](https://endoflife.date/kubernetes) (확인: 2026-04-24)
