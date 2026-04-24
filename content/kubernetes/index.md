---
title: "Kubernetes"
sidebar_label: "Kubernetes"
sidebar_position: 4
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - kubernetes
  - index
---

# Kubernetes

> **티어**: 메인 (핵심) — **작성 원칙**: 빠짐없이
>
> DevOps 엔지니어의 일상 업무 핵심. 공식 문서 최상위 목차 수준의 완결성을 목표로 한다.

---

## 학습 경로

```
아키텍처   Control Plane · etcd · Reconciliation
리소스     Workloads · Config · Network · Storage
스케줄링   Scheduler · Affinity · Autoscaling
운영       Security · Upgrade · Backup · Troubleshooting
확장       CRD · Operator · Admission · Multi-cluster
비용       Kubecost · OpenCost (FinOps 통합)
```

---

## 목차

### 아키텍처

- [x] [K8s 개요](./architecture/k8s-overview.md) — 전체 구성, 컨트롤 루프 개념
- [x] [API Server](./architecture/api-server.md) — API versioning, aggregation, watch
- [x] [etcd](./architecture/etcd.md) — Raft, consistency, compaction, 백업·복구
- [x] [Scheduler](./architecture/scheduler.md) — 스케줄링 사이클, 플러그인, 가중치
- [x] [Controller·kubelet](./architecture/controller-kubelet.md) — 컨트롤러 매니저, kubelet, kube-proxy
- [x] [Reconciliation Loop](./architecture/reconciliation-loop.md) — 선언적 모델, desired vs actual

### 워크로드

- [x] [Pod 라이프사이클](./workloads/pod-lifecycle.md) — phases, probes, init/sidecar, graceful shutdown
- [x] [Deployment](./workloads/deployment.md) — 롤링 전략, revision, rollback
- [x] [StatefulSet](./workloads/statefulset.md) — 순서·네트워크 ID, PVC 템플릿
- [x] [DaemonSet](./workloads/daemonset.md) — 노드 단위 배포, 업데이트 전략
- [x] [Job·CronJob](./workloads/job-cronjob.md) — completion, parallelism, history limits
- [x] [ReplicaSet](./workloads/replicaset.md) — Deployment와의 관계

### 설정

- [x] [ConfigMap](./configuration/configmap.md) — 주입 패턴, 재배포 트리거
- [x] [Secret](./configuration/secret.md) — Opaque·TLS·Docker, immutable, 암호화 저장
- [x] [Downward API](./configuration/downward-api.md) — Pod 정보 주입
- [x] [Projected Volume](./configuration/projected-volume.md) — 복합 볼륨, SA token projection

### 리소스 관리

- [x] [Requests·Limits](./resource-management/requests-limits.md) — QoS, eviction, overcommit
- [x] [LimitRange·ResourceQuota](./resource-management/limitrange-resourcequota.md) — 네임스페이스 제한
- [x] [네임스페이스 설계](./resource-management/namespace-design.md) — 테넌시·환경 분리 패턴

### 스케줄링

- [x] [NodeSelector·Affinity](./scheduling/node-selector-affinity.md) — nodeSelector, node/pod affinity, preferred
- [x] [Taint·Toleration](./scheduling/taint-toleration.md) — taint 효과, dedicated node 패턴
- [x] [Topology Spread](./scheduling/topology-spread.md) — 존·노드 분산, skew 제어
- [x] [Priority·Preemption](./scheduling/priority-preemption.md) — PriorityClass, preemption 비용
- [x] [Scheduler 내부](./scheduling/scheduler-internals.md) — extender, 커스텀 스케줄러

### 오토스케일링

- [x] [HPA](./autoscaling/hpa.md) — 메트릭 소스, 안정화, custom metrics
- [x] [VPA](./autoscaling/vpa.md) — 모드, Pod Resize(In-Place VPA)
- [x] [Cluster Autoscaler](./autoscaling/cluster-autoscaler.md) — 노드 그룹, scale-down, expander
- [x] [Karpenter](./autoscaling/karpenter.md) — NodePool, 통합 최적화, Spot 활용
- [x] [KEDA](./autoscaling/keda.md) — 이벤트 기반 스케일, scaler 목록

### 서비스 네트워킹

- [x] [Service](./service-networking/service.md) — ClusterIP·NodePort·LoadBalancer, sessionAffinity
- [x] [EndpointSlice](./service-networking/endpointslice.md) — 엔드포인트 분할, 대규모 서비스
- [x] [Headless Service](./service-networking/headless-service.md) — StatefulSet, 개별 DNS
- [x] [CoreDNS](./service-networking/coredns.md) — 플러그인 체인, 튜닝, NodeLocal DNS
- [x] [Ingress](./service-networking/ingress.md) — Ingress API, EOL 흐름, 컨트롤러 비교
- [x] [Gateway API](./service-networking/gateway-api.md) — GAMMA, HTTPRoute, 마이그레이션 경로
- [x] [Network Policy](./service-networking/network-policy.md) — Calico·Cilium 구현 차이, default deny

### 스토리지

- [x] [PV·PVC](./storage/pv-pvc.md) — 바인딩, reclaim policy, 리사이즈, VolumeAttributesClass
- [x] [StorageClass](./storage/storageclass.md) — provisioner, volumeBindingMode, default SC, 암호화
- [x] [CSI Driver](./storage/csi-driver.md) — CSI 아키텍처, 사이드카, CSIDriver 리소스, Volume Limits
- [x] [Volume Snapshot](./storage/volume-snapshot.md) — VolumeSnapshot API, GroupSnapshot, 복원·일관성
- [x] [분산 스토리지](./storage/distributed-storage.md) — Rook-Ceph, Longhorn, OpenEBS, 선택·마이그레이션

### 보안

- [x] [Authentication](./security/authentication.md) — x509·OIDC·Structured Authn·Bootstrap Token
- [x] [RBAC](./security/rbac.md) — Role·ClusterRole, 최소 권한, RBAC 점검 도구
- [x] [ServiceAccount](./security/serviceaccount.md) — SA token, bound token, projected
- [x] [Admission Controllers](./security/admission-controllers.md) — 내장 admission, VAP, MAP
- [x] [Pod Security Admission](./security/pod-security-admission.md) — baseline·restricted 프로파일
- [x] [Security Context](./security/security-context.md) — runAsNonRoot, seccomp, capabilities
- [x] [Runtime Class](./security/runtime-class.md) — gVisor·Kata·UserNS 격리 스펙트럼
- [x] [Secret 암호화](./security/secret-encryption.md) — etcd 암호화, KMS provider
- [x] [Audit Logging](./security/audit-logging.md) — audit policy, 로그 포워딩
- [x] [Cluster Hardening](./security/cluster-hardening.md) — CIS Benchmark, kubelet·apiserver·etcd 플래그

### 확장성

- [x] [CRD](./extensibility/crd.md) — OpenAPI schema, conversion, 서브리소스
- [x] [Operator 패턴](./extensibility/operator-pattern.md) — controller-runtime, Level/Edge-driven
- [x] [Admission Webhook 개발](./extensibility/admission-controllers.md) — Validating·Mutating Webhook 구현 관점
- [x] [VAP 저작 관점](./extensibility/validating-admission-policy.md) — CEL 문법·파라미터 CRD·테스트
- [x] [API Aggregation](./extensibility/api-aggregation.md) — extension apiserver 패턴
- [x] [kro](./extensibility/kro.md) — Kube Resource Orchestrator, ResourceGraphDefinition

### 신뢰성

- [x] [PDB](./reliability/pdb.md) — PodDisruptionBudget 설계
- [ ] Graceful Shutdown — preStop, terminationGracePeriod
- [ ] Eviction — API-initiated, 노드 드레인, DisruptionTarget

### 클러스터 구축

- [x] [클러스터 구축 방법](./cluster-setup/cluster-setup-methods.md) — kubeadm, Kubespray, RKE2, managed
- [x] [HA 클러스터 설계](./cluster-setup/ha-cluster-design.md) — etcd 토폴로지, multi-AZ
- [x] [경량 K8s](./cluster-setup/lightweight-k8s.md) — k3s, k0s, MicroK8s

### 업그레이드·운영

- [x] [클러스터 업그레이드](./upgrade-ops/cluster-upgrade.md) — skip version 금지, skew 정책
- [x] [노드 유지보수](./upgrade-ops/node-maintenance.md) — drain, cordon, surge
- [x] [Version Skew](./upgrade-ops/version-skew.md) — 컴포넌트별 허용 범위

### 백업·복구

- [x] [etcd 백업](./backup-recovery/etcd-backup.md) — snapshot, restore, 정기성
- [x] [Velero](./backup-recovery/velero.md) — 백업 전략, DR 테스트
- [x] [재해 복구](./backup-recovery/disaster-recovery.md) — 리전 장애, PITR

### 트러블슈팅

- [x] [Pod 디버깅](./troubleshooting/pod-debugging.md) — CrashLoopBackOff, ImagePullBackOff, OOMKilled
- [x] [etcd 트러블슈팅](./troubleshooting/etcd-troubleshooting.md) — 성능, 조각화, defrag
- [x] [컨트롤 플레인 장애](./troubleshooting/control-plane-failure.md) — API server 장애, 증상·복구
- [ ] K8s 에러 메시지 — 자주 보는 에러 해석
- [ ] Finalizer Stuck — 리소스 삭제 불가 증상

### 멀티테넌시·멀티클러스터

- [ ] 멀티테넌시 개요 — hard vs soft, 적합 모델 선택
- [ ] vCluster·Capsule — 가상 클러스터 vs 네임스페이스 오케스트레이션
- [ ] 멀티클러스터 패턴 — Karmada, Fleet, Cluster API

### 관리 도구

- [ ] kubectl 팁 — context, jsonpath, debug, krew
- [ ] Helm — 차트 구조, values, subchart, OCI
- [ ] Kustomize — base/overlay, patch, generator

### 특수 워크로드

- [ ] GPU 스케줄링 — NVIDIA device plugin, MIG, time-slicing
- [ ] 배치 워크로드 — Kueue, JobSet, queueing

### AI/ML 워크로드

- [ ] AI 워크로드 스케줄링 — GPU, topology, 고성능 옵션
- [ ] DRA — Dynamic Resource Allocation, structured parameters
- [ ] LWS·JobSet — LeaderWorkerSet, JobSet, 분산 학습

### 비용 (FinOps 통합)

- [ ] Kubecost·OpenCost — 네임스페이스·워크로드별 비용 분석

### 릴리스 추적

- [ ] Kubernetes 릴리스 개요 — 1.33 ~ 1.36 주요 변경 요약

---

## 이 카테고리의 경계

- 도구 자체(Helm·Kustomize)는 여기, **GitOps 맥락 활용**은 `cicd/`
- Service Mesh **구현**은 `network/`, K8s 리소스 매핑만 여기
- 보안 **전략**(Zero Trust·공급망)은 `security/`

---

## 참고 표준

- kubernetes.io 공식 문서, KEP
- CNCF Project Documentation
- CIS Kubernetes Benchmark
- NSA/CISA Kubernetes Hardening Guide
- Kubernetes Patterns (Bilgin Ibryam)
- Production Kubernetes (Josh Rosso)
