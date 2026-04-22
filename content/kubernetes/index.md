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
- [ ] Topology Spread — 존·노드 분산, skew 제어
- [ ] Priority·Preemption — PriorityClass, preemption 비용
- [ ] Scheduler 내부 — extender, 커스텀 스케줄러

### 오토스케일링

- [ ] HPA — 메트릭 소스, 안정화, custom metrics
- [ ] VPA — 모드, Pod Resize(In-Place VPA)
- [ ] Cluster Autoscaler — 노드 그룹, scale-down, expander
- [ ] Karpenter — NodePool, 통합 최적화, Spot 활용
- [ ] KEDA — 이벤트 기반 스케일, scaler 목록

### 서비스 네트워킹

- [ ] Service — ClusterIP·NodePort·LoadBalancer, sessionAffinity
- [ ] EndpointSlice — 엔드포인트 분할, 대규모 서비스
- [ ] Headless Service — StatefulSet, 개별 DNS
- [ ] CoreDNS — 플러그인 체인, 튜닝, NodeLocal DNS
- [ ] Ingress — Ingress API, EOL 흐름, 컨트롤러 비교
- [ ] Gateway API — GAMMA, HTTPRoute, 마이그레이션 경로
- [ ] Network Policy — Calico·Cilium 구현 차이, default deny

### 스토리지

- [ ] PV·PVC — 바인딩, reclaim policy, 리사이즈
- [ ] StorageClass — provisioner, volumeBindingMode
- [ ] CSI Driver — CSI 아키텍처, 주요 드라이버
- [ ] Volume Snapshot — VolumeSnapshot API, CSI
- [ ] 분산 스토리지 — Rook-Ceph, Longhorn, OpenEBS

### 보안

- [ ] RBAC — Role·ClusterRole, 최소 권한, RBAC 점검 도구
- [ ] ServiceAccount — SA token, bound token, projected
- [ ] Pod Security Admission — baseline·restricted 프로파일
- [ ] Security Context — runAsNonRoot, seccomp, capabilities
- [ ] Secret 암호화 — etcd 암호화, KMS provider
- [ ] Audit Logging — audit policy, 로그 포워딩

### 확장성

- [ ] CRD — OpenAPI schema, conversion, 서브리소스
- [ ] Operator 패턴 — controller-runtime, Level/Edge-driven
- [ ] Admission Controller — Validating·Mutating Webhook
- [ ] Validating Admission Policy — CEL 기반, Webhook 대비 장단
- [ ] API Aggregation — extension apiserver 패턴
- [ ] kro — Kube Resource Orchestrator, ResourceGroups

### 신뢰성

- [ ] PDB — PodDisruptionBudget 설계
- [ ] Graceful Shutdown — preStop, terminationGracePeriod
- [ ] Eviction — API-initiated, 노드 드레인, DisruptionTarget

### 클러스터 구축

- [ ] 클러스터 구축 방법 — kubeadm, Kubespray, RKE2, managed
- [ ] HA 클러스터 설계 — etcd 토폴로지, multi-AZ
- [ ] 경량 K8s — k3s, k0s, MicroK8s

### 업그레이드·운영

- [ ] 클러스터 업그레이드 — skip version 금지, skew 정책
- [ ] 노드 유지보수 — drain, cordon, surge
- [ ] Version Skew — 컴포넌트별 허용 범위

### 백업·복구

- [ ] etcd 백업 — snapshot, restore, 정기성
- [ ] Velero — 백업 전략, DR 테스트
- [ ] 재해 복구 — 리전 장애, PITR

### 트러블슈팅

- [ ] Pod 디버깅 — CrashLoopBackOff, ImagePullBackOff, OOMKilled
- [ ] etcd 트러블슈팅 — 성능, 조각화, defrag
- [ ] 컨트롤 플레인 장애 — API server 장애, 증상·복구
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
