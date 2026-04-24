---
title: "클러스터 업그레이드"
sidebar_label: "업그레이드"
sidebar_position: 1
date: 2026-04-24
last_verified: 2026-04-24
tags:
  - kubernetes
  - upgrade
  - kubeadm
  - version-skew
  - deprecation
  - compatibility-version
  - rolling-upgrade
---

# 클러스터 업그레이드

클러스터 업그레이드는 **네 가지 원칙** 위에 선다.

1. **마이너 버전은 한 단계씩만**(skip 금지).
2. **컴포넌트 간 버전 스큐 규칙**(kube-apiserver → kubelet n-3 등)을
   지킨다.
3. **컨트롤 플레인이 먼저, 워커가 나중**. 스큐 역전 금지.
4. **업그레이드 전에 deprecated API·removed API·애드온·PSA 프로파일**
   호환성을 감사한다.

**2026-04 시점.** Kubernetes **1.36 "Haru"** 가 2026-04-22 릴리즈됐고
표준 지원은 **1.34·1.35·1.36**. 1.33은 maintenance mode. 1.36은
**IPVS kube-proxy 제거**, **gitRepo 볼륨 제거**, **Ingress NGINX
2026-03-24 은퇴 후 첫 릴리즈**로 운영자 입장에서 대표적 "큰 점프"
마이너다.

이 글은 **업그레이드 절차와 의사결정** 에 집중한다. 스큐 규칙의 상세
표는 [Version Skew](./version-skew.md), 노드 단위 drain·cordon은
[노드 유지보수](./node-maintenance.md)에서 다룬다.

> 관련: [Version Skew](./version-skew.md)
> · [노드 유지보수](./node-maintenance.md)
> · [HA 클러스터 설계](../cluster-setup/ha-cluster-design.md)
> · [etcd](../architecture/etcd.md)

---

## 1. 버전 정책 요약

### 1.1 릴리즈 주기와 지원 기간

Kubernetes는 **대략 4개월(~16주)마다 1 마이너** 버전을 낸다.

| 항목 | 정책 |
|------|------|
| 마이너 릴리즈 주기 | ~16주 |
| Standard Support(패치) | 각 마이너 **12개월** |
| Maintenance Mode | +2개월(중대·보안만) |
| 풀 윈도우 | 약 **14개월** |
| 동시 표준 지원 | **3개 마이너**(현재·직전·그 전) |
| LTS | 업스트림에는 **없음**(상용 벤더 제공) |

2026-04 기준 예시: 표준 지원 **1.34·1.35·1.36**, 1.33은 maintenance.

### 1.2 스큐 핵심 규칙

| 쌍 | 허용 범위 |
|----|---------|
| kube-apiserver(HA 내 최신·최구) | **1 마이너** 이내 |
| kubelet ↔ kube-apiserver | kubelet ≤ kube-apiserver, **최대 n-3** |
| kubectl ↔ kube-apiserver | ±1 마이너 |
| kubeadm | **클러스터와 동일 마이너**(업그레이드 중 ±1) |

**황금률.** **CP 먼저, 워커 나중.** kubelet이 apiserver보다 새로우면
안 된다.

**n-3 의 함정.** kubelet을 n-3로 벌려 두면 **CP를 더 올릴 수 없어
업그레이드 데드락**에 빠진다. 허용 범위 ≠ 영구 유지 범위. 실무 권장은
**kubelet=kubeapiserver 또는 n-1 유지**.

상세 표·시나리오는 [Version Skew](./version-skew.md).

### 1.3 마이너 skip이 금지인 이유

- 제거된 API 가 건너뛴 버전에서만 마이그 경로를 제공한다.
- 업그레이드 중간 버전에서만 수행되는 storage version migration을
  놓치면 etcd 데이터 해석이 어긋난다.
- `kubeadm upgrade plan` 은 **인접 마이너만** 경로를 계산한다.

**예외.** Cluster API v1.12+의 **chained upgrade** 는 여러 마이너를
순차 자동화(내부는 한 단계씩).

---

## 2. Compatibility Version — 2026 판 롤백 안전망

KEP-4330 "Compatibility Versions"(1.31 Alpha → 1.32+ 점진 확장)이
"바이너리는 새 버전, 동작은 이전 버전" 이라는 **2상 업그레이드** 를
가능하게 한다.

### 2.1 핵심 플래그

| 플래그 | 역할 |
|-------|------|
| `--emulated-version=1.N-1` | 바이너리가 1.N 이지만 **API·feature 동작은 1.N-1** |
| `--min-compatibility-version=1.N-1` | 1.N-1 에서 있었던 기능을 **제거하지 않음** — 1.N-1 로 **롤백 가능 보장** |

**Alpha 기능** 은 emulation 시 자동 비활성(alpha는 emulate 불가).
Beta·GA 기능만 대상.

### 2.2 2상 업그레이드 패턴

```mermaid
flowchart LR
  A[바이너리 N] --> B[emulate N-1 롤링]
  B --> C[안정 확인]
  C --> D[emulate 해제]
  D --> E[신기능 활성]
```

1. **1상** — 바이너리만 N으로 올리고 `--emulated-version=1.N-1`
   유지. 문제가 생기면 바이너리만 N-1로 돌림.
2. **2상** — 안정 후 `--emulated-version` 제거, 신기능 활성.

**실전 의미.** "K8s는 자동 롤백이 없다" 는 명제는 **이 기능 활용
전제 하에 완화** 된다. 단, 데이터(etcd 스키마) 영구 변경은 여전히
롤백 불가 — 설계 단계에서 구분할 것.

---

## 3. 업그레이드 전 — 감사(Audit)

클러스터에 손대기 전, 가장 중요한 단계.

### 3.1 Deprecated / Removed API 조사

**정적 분석(IaC·Helm)** 과 **라이브 클러스터** 둘 다 필수.

| 도구 | 대상 | 특징 |
|------|------|------|
| **kubent**(kube-no-trouble) | 라이브 클러스터 | Rego 정책·타깃 버전 지정 |
| **Pluto**(Fairwinds) | YAML·Helm 정적 | CI 파이프라인 통합 |
| `kubectl-convert`(plugin) | 구버전 manifest 변환 | `krew install convert` 로 설치, **일부 API 변환 제한** |
| `apiserver_requested_deprecated_apis` | Prometheus 메트릭 | deprecated 호출 실시간 |
| kube-apiserver audit | 사용 API 로그 | 전수 분석 |

**kubent 예.**

```bash
kubent -t 1.36
kubent --helm3 --cluster
```

**Pluto 예.**

```bash
pluto detect-files -d ./manifests --target-versions k8s=v1.36.0
pluto detect-helm --target-versions k8s=v1.36.0
```

**라이브 지표.**

```promql
apiserver_requested_deprecated_apis{removed_release=~"1.3[5-9].*"} > 0
```

### 3.2 Pod Security Admission 프로파일 버전 점검

PSP는 1.25에서 제거되고 PSA(Pod Security Admission) 로 대체됐다.
**baseline·restricted 프로파일 내용이 마이너마다 갱신** 되므로
`pod-security.kubernetes.io/enforce-version: latest` 사용 클러스터는
**K8s 업그레이드만으로 기존 통과 파드가 막히는 회귀** 가 생긴다.

**권장 전략.**

1. 업그레이드 전에 **프로파일 버전을 현재 마이너로 고정** (`enforce-version: v1.35`).
2. 타깃 마이너로 올린 뒤 `warn-version: v1.36` 으로 드리프트 감사.
3. 문제 없으면 `enforce-version: v1.36` 로 진행.

### 3.3 CRD·Webhook 가용성 점검

- **CRD storage version** — 구버전에서 저장된 오브젝트를 새 스토리지
  버전으로 옮기기. `StorageVersionMigration` v1(1.33 GA) + storage-
  version-migrator 로 수행.
- **conversion webhook** — CRD가 여러 버전을 둘 때 webhook 서비스
  가용성 필수. 업그레이드 중 pod 이동 타이밍에 failurePolicy=Fail 이면
  API 전체가 멎는다. `timeoutSeconds`·`reinvocationPolicy`·인증서
  rotation 사전 점검.
- **admission webhook** — 업그레이드 중 webhook 가용성 보장을 위해
  `failurePolicy=Ignore` 로 임시 완화를 고려하거나, webhook 자체를
  드레인 예외(DaemonSet·tolerations) 로 배치.

### 3.4 CSI Migration 상태

KEP-625(CSI Migration)는 1.25 GA, **1.31부터 in-tree cloud provider
영구 제거**. 업그레이드 전 점검.

- 기존 PV의 `.annotations["pv.kubernetes.io/migrated-to"]` 가 CSI
  드라이버 이름으로 찍혀 있는가.
- vSphere·OpenStack·Azure·GCE·AWS in-tree 드라이버를 여전히 쓰는가 →
  대응 CSI로 전환 후 업그레이드.

### 3.5 릴리즈 노트·CHANGELOG

**최소 4개 문서.**

1. CHANGELOG-\{N+1\}.md — 전체 변경.
2. Urgent Upgrade Notes — breaking.
3. Deprecated API Migration Guide — 제거된 API.
4. 배포판·관리형(EKS·GKE·AKS·RKE2·k3s) 릴리즈 노트.

### 3.6 최근 마이너 주요 변경(2026-04 기준)

| 마이너 | 변경 | 영향 |
|-------|------|------|
| 1.25 | PSP 제거, PSA 대체 | 정책 재설계 |
| 1.29 | in-tree 클라우드 프로바이더 제거 | CCM·CSI 필수 |
| 1.31 | in-tree 클라우드 provider 영구 제거, **Compatibility Version alpha** | CSI 완전 전환 |
| 1.32 | SA 토큰 Secret 자동 생성 종료 | 기존 Secret 관리 |
| 1.33 | SidecarContainers GA, StorageVersionMigration v1 GA | 사이드카 재설계 가능 |
| 1.34 | kube-proxy nftables 기본, DRA beta 확대 | iptables→nftables 확인 |
| 1.35 | **cgroup v1 종료**, containerd 1.x 마지막, IPVS kube-proxy deprecated | OS 전환·containerd 2.0 |
| 1.36 | **IPVS kube-proxy 제거**, gitRepo 볼륨 제거, Ingress NGINX 2026-03-24 은퇴, HPA scale-to-zero, User Namespace GA, `externalIPs` deprecated(1.43 제거 목표) | Gateway API·nftables 전환 |

### 3.7 애드온 호환 매트릭스

| 애드온 | 체크 |
|--------|------|
| Cilium·Calico | K8s 지원 매트릭스 |
| CoreDNS | `coredns/coredns` K8s 호환 |
| metrics-server | 버전별 태그 |
| Ingress NGINX | **2026-03-24 은퇴** — 신규 금지, 기존은 Gateway API 전환 |
| kube-state-metrics | API skew |
| ArgoCD·Flux | 핫 패치 필요 여부 |
| CSI 드라이버 | sidecar·snapshot 컨트롤러 버전 |

### 3.8 etcd 백업·복원 리허설

업그레이드 직전 **반드시 스냅샷**. 스냅샷을 오프사이트에 두고, **복원
리허설을 최근 1회 이상** 수행. 실제 사고에서 처음 복원하는 일을 막는다.

```bash
ETCDCTL_API=3 etcdctl snapshot save pre-upgrade.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

### 3.9 스테이징 소크

- **스테이징 클러스터에서 동일 경로** 로 먼저.
- **신규 마이너 릴리즈 직후(`.0`)는 피한다** — 실무 권장은 최소
  `.1`·`.2` 패치가 나온 이후 프로덕션 진입.
- 실 트래픽과 유사한 부하로 **최소 1일 소크**.

---

## 4. 업그레이드 경로 설계

### 4.1 2단계 규칙 — "최신 패치 → 다음 마이너 → 최신 패치"

```mermaid
flowchart LR
  A[현재 버전] --> B[현 마이너 최신 패치]
  B --> C[다음 마이너 진입]
  C --> D[타깃 마이너 최신 패치]
```

### 4.2 전략 비교

| 전략 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **In-place 롤링** | 한 노드씩 교체 | 상태·라벨·PV 유지 | 실패 시 수동 복구 |
| **Blue-Green 클러스터 스왑** | 신규 클러스터 구축 후 트래픽 이전 | 롤백 단순(DNS·LB) | 중복 자원·상태 이전 |
| **노드 풀 Blue-Green** | 새 버전 노드 풀 추가 후 구 풀 drain | CP in-place + DP Blue-Green | Managed·Karpenter와 궁합 좋음 |
| **Compatibility Version 2상** | 바이너리 N + emulate N-1 → 신기능 활성 | **롤백 창** 제공 | 1.32+ 지원 |

**권장.**

- 패치 → In-place 롤링.
- 마이너 → In-place + Compatibility Version(지원 시).
- 여러 마이너 점프·대대적 변경 → Blue-Green.

### 4.3 CI/CD 감사 게이트

- Argo CD·Flux **드리프트 없음** 확인.
- Helm 차트 **타깃 K8s API 버전** 으로 linting.
- **pre-upgrade / post-upgrade hook** 으로 smoke test·migration.
- ArgoCD **SyncWave**, Helm **OCI 태그 pin** 으로 순서 제어.

---

## 5. kubeadm 업그레이드 절차

### 5.1 순서 전체

```mermaid
flowchart LR
  A[감사] --> B[첫 CP apply]
  B --> C[추가 CP node]
  C --> D[워커 drain node uncordon]
  D --> E[애드온 점검]
```

### 5.2 첫 컨트롤 플레인

```bash
# 패키지 저장소 마이너 전환(예: v1.35 → v1.36)
# /etc/apt/sources.list.d/kubernetes.list 수정
# deb https://pkgs.k8s.io/core:/stable:/v1.36/deb/ /

sudo apt update
sudo apt-mark unhold kubeadm
sudo apt install -y kubeadm=1.36.0-1.1
sudo apt-mark hold kubeadm

sudo kubeadm upgrade plan                      # 경로·영향 리뷰
sudo kubeadm upgrade diff v1.36.0              # 실제 manifest diff
sudo kubeadm upgrade apply v1.36.0

# kubelet·kubectl 패키지 교체
sudo apt-mark unhold kubelet kubectl
sudo apt install -y kubelet=1.36.0-1.1 kubectl=1.36.0-1.1
sudo apt-mark hold kubelet kubectl
sudo systemctl daemon-reload && sudo systemctl restart kubelet
```

### 5.3 phases·config·diff — 실전 유용

```bash
kubeadm upgrade plan --print-config          # 적용될 설정 미리보기
kubeadm upgrade diff <new-version>           # static pod manifest diff
kubeadm config migrate --old-config <f>      # 구 설정 업스트림 변환
kubeadm upgrade apply --skip-phases=addon/coredns   # 단계 스킵
```

`kubeadm-config` ConfigMap(네임스페이스 kube-system)은 클러스터 구성
스냅샷이며, `kubelet-config` ConfigMap은 kubelet 기본 설정. 버전별로
`apiVersion` 변경이 있으므로 `kubeadm config migrate` 로 사전 변환.

### 5.4 추가 컨트롤 플레인(2·3번째)

**`upgrade plan/apply` 가 아니라 `upgrade node`**.

```bash
sudo apt install -y kubeadm=1.36.0-1.1
sudo kubeadm upgrade node
sudo apt install -y kubelet=1.36.0-1.1 kubectl=1.36.0-1.1
sudo systemctl restart kubelet
```

**한 대씩** 진행. 사이에 쿼럼·헬스 확인.

```bash
kubectl get --raw /readyz?verbose
etcdctl endpoint health --cluster
```

### 5.5 워커 노드

```bash
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data

sudo apt install -y kubeadm=1.36.0-1.1
sudo kubeadm upgrade node
sudo apt install -y kubelet=1.36.0-1.1 kubectl=1.36.0-1.1
sudo systemctl restart kubelet

kubectl uncordon <node>
```

drain·cordon 상세·PDB 상호작용은 [노드 유지보수](./node-maintenance.md).

### 5.6 업그레이드 중 HA 유지 키

| 기능 | 설정 | 역할 |
|------|------|------|
| `--goaway-chance` | 0.001 | HTTP/2 연결 쏠림 방지 |
| `--shutdown-delay-duration` | 30s+ | LB drain 유예 |
| `--shutdown-watch-termination-grace-period` | (1.34 GA) | watch 연결 정리 |
| readyz 기반 헬스체크 | LB 설정 | 실패한 CP 제외 |

상세는 [HA 클러스터 설계](../cluster-setup/ha-cluster-design.md).

### 5.7 etcd 쿼럼 함정

Stacked etcd 3대 중 1대가 10분 넘게 offline 이면 다른 멤버가 타이밍
아웃 경계에 걸린다. **업그레이드 창 안에 재기동이 완료되는지** 가 핵심.

- leader를 먼저 한 번 다른 노드로 이동시켜 업그레이드할 노드를
  follower로 만들고 재기동(선택).
- `etcdctl endpoint status -w table` 로 leader·raft 상태 확인.
- 한 대 업그레이드 완료·쿼럼 Ready 후 다음 노드.

### 5.8 kubelet config·drop-in

`/var/lib/kubelet/config.yaml`(KubeletConfiguration v1) 외에
**drop-in 디렉터리**(`--config-dir /etc/kubernetes/kubelet.conf.d/`,
1.30+)가 있다. 업그레이드 시 apiVersion 전환을 kubeadm 이 처리하지만
수동 커스텀은 diff 확인 필수.

---

## 6. 도구별 업그레이드 비교

| 도구 | 업그레이드 방식 |
|------|---------------|
| kubeadm | `upgrade plan/apply/node` + 패키지 |
| Kubespray | `upgrade-cluster.yml` + `serial:` 로 속도 제어 |
| RKE2 | `system-upgrade-controller` + `Plan` CRD |
| k3s | 동일 `system-upgrade-controller`, 설치 스크립트 재실행 |
| Talos | 이미지 교체 + A/B 파티션 롤백 |
| Cluster API | `KubeadmControlPlane.spec.version` 변경 → 롤링, `rolloutStrategy.maxSurge` 조정 |
| EKS·GKE·AKS | 콘솔·API, 관리형 노드 풀 auto·surge |
| OpenShift(OCP) | Cluster Version Operator(CVO) + ClusterOperator 상태 기반 |
| Rancher(multi-cluster) | Rancher UI + Fleet Bundle 배포 |

### 6.1 system-upgrade-controller (RKE2/k3s)

```yaml
apiVersion: upgrade.cattle.io/v1
kind: Plan
metadata:
  name: server-plan
  namespace: system-upgrade
spec:
  concurrency: 1
  nodeSelector:
    matchExpressions:
    - {key: node-role.kubernetes.io/control-plane, operator: Exists}
  serviceAccountName: system-upgrade
  upgrade:
    image: rancher/k3s-upgrade
  version: v1.36.0+k3s1
  cordon: true
```

**장점.** 스케줄링·drain·재기동을 K8s 리소스로 선언. GitOps 친화.

### 6.2 Cluster API 업그레이드

```yaml
apiVersion: controlplane.cluster.x-k8s.io/v1beta1
kind: KubeadmControlPlane
spec:
  version: v1.36.0
  rolloutStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
```

**v1.12+** 는 **chained upgrade**(여러 마이너 자동 순차), **in-place
update**(프로바이더 지원 시 노드 교체 없음). `MachineDeployment.spec.
strategy`·MHC 동작 점검.

---

## 7. 컴포넌트·플러그인 업그레이드

### 7.1 kubelet·kube-proxy

- kubelet: 노드별 패키지 + 재시작. 스큐 규칙에서 가장 민감.
- kube-proxy: DaemonSet — 이미지 태그 업데이트로 롤링.
- **IPVS kube-proxy 는 1.36에서 제거됨** → 1.35 중 **nftables 또는
  iptables 로 전환** 필수. 1.34부터 nftables 가 기본 옵션.

### 7.2 CNI

- Cilium·Calico·Flannel: K8s와 독립 릴리즈. 호환 매트릭스 먼저.
- Cilium은 Cilium CLI 로 롤링(`cilium upgrade`).
- Calico는 Operator 기반 업그레이드 권장.
- CNI 업그레이드는 **K8s 업그레이드와 별도 창** 으로 분리. 동시 변경
  금물.

### 7.3 CSI·Snapshot 컨트롤러

- CSI 드라이버는 **벤더 릴리즈 주기**. CSI spec 버전 매칭.
- `external-snapshotter` — 별도 CRD·Deployment. `VolumeSnapshot v1`
  고정 사용.
- in-tree → CSI 마이그 완료 여부 재확인(3.4).

### 7.4 CoreDNS·metrics-server

- CoreDNS: `kubeadm upgrade` 가 함께 올림. Corefile 커스텀은 diff 점검.
- metrics-server: K8s 버전별 권장 태그.

### 7.5 containerd 2.0 마이그(1.35 이후 필수)

K8s 1.35가 **containerd 1.x 마지막 지원**. 1.36 이전에 2.0 마이그 완료.

```bash
containerd --version
sudo apt install -y containerd.io=2.0.*
sudo systemctl restart containerd kubelet
```

`/etc/containerd/config.toml` 의 `SystemdCgroup = true` 와 레지스트리
미러 설정이 유지되는지 확인.

### 7.6 cgroup v2 (1.35 이후 강제)

```bash
stat -fc %T /sys/fs/cgroup    # 결과 "cgroup2fs" 확인
```

v1 이면 OS 전환(RHEL 9·Ubuntu 22.04+는 기본 v2).

### 7.7 Ingress NGINX 은퇴 대응 (2026-03-24)

**NGINX 업스트림 유지 종료**. 신규 채택 금지. 대체 선택지.

| 대체 | 특징 |
|------|------|
| Gateway API + Cilium/Envoy Gateway | SIG Network 표준 |
| Nginx Gateway Fabric | F5 주도, NGINX 계열 계속 쓰려는 조직 |
| Traefik·HAProxy Ingress | 기존 유저 |

상세는 [Gateway API](../service-networking/gateway-api.md).

### 7.8 Feature Gate 라이프사이클

- **1.24+ 신규 Beta는 기본 OFF**.
- **GA 후 N+2 마이너에 feature gate 자체 제거** — `--feature-gates`
  에 제거된 이름이 있으면 kube-apiserver 기동 실패.
- 업그레이드 감사에 **현재 명시한 feature gate 가 타깃 마이너에서도
  존재하는지** 확인.

---

## 8. 업그레이드 실패 롤백

Kubernetes 공식은 **kubeadm 기준 etcd schema 변경이 있으면 자동 롤백
불가**. Compatibility Version·CAPI·Talos A/B·관리형 노드 풀 Blue-Green
은 각기 다른 층위에서 롤백 창을 제공한다.

| 실패 지점 | 대응 |
|---------|------|
| 첫 CP `upgrade apply` 중 실패 | 정지 → etcd 스냅샷 복원 + 패키지 다운그레이드 |
| 추가 CP `upgrade node` 실패 | 해당 노드 격리, 교체 |
| kubelet 재기동 후 NotReady | kubelet 로그·CRI 확인, 패키지 다운그레이드 가능 |
| CNI·CSI 호환 불가 | 애드온 다운그레이드, K8s 버전 유지 |
| 워크로드 deprecated API | manifest 수정 후 재배포(`kubectl-convert`) |

### 8.1 etcd 스냅샷 복원 절차 (kubeadm)

1. 모든 CP에서 `kube-apiserver`·`etcd` static pod 중지
   (`/etc/kubernetes/manifests/*.yaml` 일시 이동).
2. 각 CP에서 `etcdctl snapshot restore` → `/var/lib/etcd` 대체.
3. manifests 복원 → kubelet 이 static pod 재기동.
4. `etcdctl endpoint status --cluster` 확인.
5. Service·Endpoint·Lease 상태 불일치 주시 — 복원 후 초기에는 **leader
   election lease 혼란**, 다중 leader 가능성. controller-manager·
   scheduler 로그 확인.

### 8.2 패키지 다운그레이드

```bash
sudo apt install -y kubeadm=1.35.6-1.1 kubelet=1.35.6-1.1 kubectl=1.35.6-1.1
```

`kubeadm apply` 이전 단계에서만 실질적 되돌림. apply 이후 롤백은
etcd 복원 경로가 안전.

### 8.3 etcd 데이터 다운그레이드

etcd 3.5+ 는 **한 단계 데이터 다운그레이드 지원**. 복잡하므로 공식
etcd downgrade 가이드 숙지 필요.

---

## 9. Managed Kubernetes 업그레이드

### 9.1 주요 특성

| 벤더 | 컨트롤 플레인 | 노드 풀 |
|------|-------------|--------|
| EKS | 수동·API | managed node group auto, self-managed 수동 |
| GKE | 릴리즈 채널(Rapid·Regular·Stable) + maintenance window | Surge, Blue-green node pool |
| AKS | 수동·auto-upgrade 채널 | surge·max-unavailable |
| OpenShift(OCP) | CVO 기반 자동 | MachineConfigPool rollout |
| Rancher-managed | Rancher UI | Fleet Plan |

### 9.2 권장 패턴

- **릴리즈 채널** 으로 예측 가능한 주기 확보.
- **노드 풀은 Blue-Green** 으로 고위험 격리.
- **Surge** 조정으로 drain 시 가용성 보장.
- **벤더 자체 deprecation** 도 함께 체크(EKS AMI·GKE Autopilot 정책·
  AKS addon).

---

## 10. 관측(Observability) — 무엇을 볼 것인가

| 지표 | 의미 |
|------|------|
| `apiserver_request_duration_seconds` | API 응답 지연(롤링 중 p99 상승 감지) |
| `apiserver_requested_deprecated_apis` | deprecated API 호출 — 0 유지 목표 |
| `apiserver_storage_objects` | etcd 객체 수 — 갑작스런 증감 경고 |
| `etcd_server_leader_changes_seen_total` | leader 교체 빈도 — 업그레이드 중 일부 정상 |
| `workqueue_depth` | 컨트롤러 큐 — 지연 신호 |
| `kubelet_runtime_operations_errors_total` | CRI 오류 — containerd 2.0 전환 신호 |

업그레이드 전·중·후 **1일 소크** 동안 대시보드 고정 관찰.

---

## 11. 안티패턴

| 안티패턴 | 문제 | 대안 |
|---------|------|------|
| 마이너 2단계 이상 skip | kubeadm 비지원, data migration 건너뜀 | 한 단계씩 |
| 워커 먼저 CP 나중 | 스큐 역전 | CP 먼저 |
| 사전 감사 없이 upgrade apply | removed API 로 대량 장애 | kubent/Pluto |
| PSA `enforce-version: latest` 고정 | 마이너 업그레이드에서 파드 막힘 | 특정 버전 고정 + warn 으로 드리프트 검사 |
| etcd 백업 없이 시작 | 복구 경로 부재 | 직전 스냅샷 |
| 스테이징 없이 프로덕션 직행 | 벤더·애드온 호환 이슈 | 스테이징 + 카나리 |
| `.0` 릴리즈 즉시 프로덕션 | 초기 cherry-pick 버그 노출 | 최소 `.1`·`.2` 대기 |
| `--goaway-chance` 없이 롤링 | CP 편중 → 5xx | 0.001 |
| n-3 까지 kubelet 방치 | 업그레이드 데드락 | kubelet=CP 또는 n-1 유지 |
| Ingress NGINX 신규 채택 | 2026-03-24 은퇴 | Gateway API |
| IPVS kube-proxy 1.36 진입 | 시작 안 됨 | nftables·iptables 전환 후 업그레이드 |
| cgroup v1 유지 + 1.35 | 부팅 실패 | OS 전환 |
| containerd 1.x + 1.36 | CRI 깨짐 | 사전 containerd 2.0 |
| 한 번에 모든 CP 재기동 | 쿼럼 손실 | 한 대씩 |
| webhook `failurePolicy=Fail` 상태로 업그레이드 | 롤링 중 API 마비 | 임시 Ignore·가용성 보장 |

---

## 12. 체크리스트

**감사.**

- [ ] CHANGELOG·Urgent Upgrade Notes
- [ ] kubent·Pluto 로 deprecated/removed API
- [ ] **PSA 프로파일 버전 고정 + warn 드리프트 감사**
- [ ] **CRD storage version migration 완료**
- [ ] **CSI Migration — in-tree 잔존 확인**
- [ ] **webhook 가용성·cert rotation**
- [ ] CNI·CSI·Ingress·Gateway·CoreDNS·metrics-server 호환
- [ ] **IPVS → nftables** 전환(1.36 진입 시)
- [ ] **containerd 2.0 전환**(1.36 진입 시)
- [ ] cgroup v2 확인
- [ ] 벤더(EKS·GKE·AKS·RKE2·k3s) 릴리즈 노트
- [ ] 애드온(Argo CD·Flux·Kyverno·Prometheus) 호환
- [ ] Feature Gate 제거 여부

**실행 전.**

- [ ] 최신 etcd 스냅샷(+ 오프사이트)
- [ ] 복원 리허설 최근 1회 이상
- [ ] 스테이징 동일 경로 소크 1일+
- [ ] `.0` 회피, `.1`·`.2` 이후 진입
- [ ] 유지보수 창·롤백 결정 기준 공지
- [ ] `--goaway-chance=0.001`, `--shutdown-delay-duration=30s`
- [ ] Compatibility Version 2상 계획(지원 시)

**실행 중.**

- [ ] 현 마이너 최신 패치 → 다음 마이너 → 타깃 최신 패치
- [ ] 첫 CP `kubeadm upgrade apply`, 추가 CP `upgrade node`
- [ ] 각 사이 `kubectl get --raw /readyz?verbose`
- [ ] etcd leader·쿼럼 상태 확인
- [ ] kubelet·kube-proxy 롤링

**실행 후.**

- [ ] `kubectl version` 컴포넌트 버전
- [ ] 노드 Ready·CoreDNS·CNI DaemonSet Ready
- [ ] 애드온 정상
- [ ] 관측 메트릭 1일+ 소크
- [ ] `apiserver_requested_deprecated_apis` 0 유지

---

## 참고 자료

- [Upgrading kubeadm clusters — kubernetes.io](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/) — 2026-04-24
- [Version Skew Policy](https://kubernetes.io/releases/version-skew-policy/) — 2026-04-24
- [Compatibility Version For Control Plane Components](https://kubernetes.io/docs/concepts/cluster-administration/compatibility-version/) — 2026-04-24
- [KEP-4330 Compatibility Versions](https://github.com/kubernetes/enhancements/blob/master/keps/sig-architecture/4330-compatibility-versions/README.md) — 2026-04-24
- [Deprecated API Migration Guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/) — 2026-04-24
- [Deprecation Policy](https://kubernetes.io/docs/reference/using-api/deprecation-policy/) — 2026-04-24
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/) — 2026-04-24
- [Kubernetes Release Cycle](https://kubernetes.io/releases/release/) — 2026-04-24
- [Patch Releases](https://kubernetes.io/releases/patch-releases/) — 2026-04-24
- [Kubernetes v1.36 "Haru" Release Blog](https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/) — 2026-04-24
- [Kubernetes v1.35 "Timbernetes" Release Blog](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/) — 2026-04-24
- [doitintl/kube-no-trouble (kubent)](https://github.com/doitintl/kube-no-trouble) — 2026-04-24
- [FairwindsOps/pluto](https://github.com/FairwindsOps/pluto) — 2026-04-24
- [kubectl-convert (krew)](https://kubernetes.io/docs/tasks/tools/included/kubectl-convert-overview/) — 2026-04-24
- [CSI Migration KEP-625](https://github.com/kubernetes/enhancements/blob/master/keps/sig-storage/625-csi-migration/README.md) — 2026-04-24
- [StorageVersionMigration v1 (1.33)](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.33/#storageversionmigration-v1-storagemigration-k8s-io) — 2026-04-24
- [Ingress NGINX retirement announcement](https://github.com/kubernetes/ingress-nginx) — 2026-04-24
- [system-upgrade-controller (Rancher)](https://github.com/rancher/system-upgrade-controller) — 2026-04-24
- [Cluster API v1.12 — In-place and Chained Upgrades](https://kubernetes.io/blog/2026/01/27/cluster-api-v1-12-release/) — 2026-04-24
- [GKE upgrade best practices](https://cloud.google.com/kubernetes-engine/docs/best-practices/upgrading-clusters) — 2026-04-24
