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

### Architecture

- [ ] k8s-overview — 전체 구성, 컨트롤 루프 개념
- [ ] api-server — API versioning, aggregation, watch
- [ ] etcd — Raft, consistency, compaction, 백업·복구
- [ ] scheduler — 스케줄링 사이클, 플러그인, 가중치
- [ ] controller-kubelet — 컨트롤러 매니저, kubelet, kube-proxy
- [ ] reconciliation-loop — 선언적 모델, desired vs actual

### Workloads

- [ ] pod-lifecycle — phases, probes, init/sidecar, graceful shutdown
- [ ] deployment — 롤링 전략, revision, rollback
- [ ] statefulset — 순서·네트워크 ID, PVC 템플릿
- [ ] daemonset — 노드 단위 배포, 업데이트 전략
- [ ] job-cronjob — completion, parallelism, history limits
- [ ] replicaset — Deployment와의 관계

### Configuration

- [ ] configmap — 주입 패턴, 재배포 트리거
- [ ] secret — Opaque·TLS·Docker, immutable, 암호화 저장
- [ ] downward-api — Pod 정보 주입
- [ ] projected-volume — 복합 볼륨, SA token projection

### Resource Management

- [ ] requests-limits — QoS, eviction, overcommit
- [ ] limitrange-resourcequota — 네임스페이스 제한
- [ ] namespace-design — 테넌시·환경 분리 패턴

### Scheduling

- [ ] node-selector-affinity — nodeSelector, node/pod affinity, preferred
- [ ] taint-toleration — taint 효과, dedicated node 패턴
- [ ] topology-spread — 존·노드 분산, skew 제어
- [ ] priority-preemption — PriorityClass, preemption 비용
- [ ] scheduler-internals — extender, 커스텀 스케줄러

### Autoscaling

- [ ] hpa — 메트릭 소스, 안정화, custom metrics
- [ ] vpa — 모드, Pod Resize(In-Place VPA)
- [ ] cluster-autoscaler — 노드 그룹, scale-down, expander
- [ ] karpenter — NodePool, 통합 최적화, Spot 활용
- [ ] keda — 이벤트 기반 스케일, scaler 목록

### Service Networking

- [ ] service — ClusterIP·NodePort·LoadBalancer, sessionAffinity
- [ ] endpointslice — 엔드포인트 분할, 대규모 서비스
- [ ] headless-service — StatefulSet, 개별 DNS
- [ ] coredns — 플러그인 체인, 튜닝, NodeLocal DNS
- [ ] ingress — Ingress API, EOL 흐름, 컨트롤러 비교
- [ ] gateway-api — GAMMA, HTTPRoute, 마이그레이션 경로
- [ ] network-policy — Calico·Cilium 구현 차이, default deny

### Storage

- [ ] pv-pvc — 바인딩, reclaim policy, 리사이즈
- [ ] storageclass — provisioner, volumeBindingMode
- [ ] csi-driver — CSI 아키텍처, 주요 드라이버
- [ ] volume-snapshot — VolumeSnapshot API, CSI
- [ ] distributed-storage — Rook-Ceph, Longhorn, OpenEBS

### Security

- [ ] rbac — Role·ClusterRole, 최소 권한, RBAC 점검 도구
- [ ] serviceaccount — SA token, bound token, projected
- [ ] pod-security-admission — baseline·restricted 프로파일
- [ ] security-context — runAsNonRoot, seccomp, capabilities
- [ ] secret-encryption — etcd 암호화, KMS provider
- [ ] audit-logging — audit policy, 로그 포워딩

### Extensibility

- [ ] crd — OpenAPI schema, conversion, 서브리소스
- [ ] operator-pattern — controller-runtime, Level/Edge-driven
- [ ] admission-controllers — Validating·Mutating Webhook
- [ ] validating-admission-policy — CEL 기반, Webhook 대비 장단
- [ ] api-aggregation — extension apiserver 패턴
- [ ] kro — Kube Resource Orchestrator, ResourceGroups

### Reliability

- [ ] pdb — PodDisruptionBudget 설계
- [ ] graceful-shutdown — preStop, terminationGracePeriod
- [ ] eviction — API-initiated, 노드 드레인, DisruptionTarget

### Cluster Setup

- [ ] cluster-setup-methods — kubeadm, Kubespray, RKE2, managed
- [ ] ha-cluster-design — etcd 토폴로지, multi-AZ
- [ ] lightweight-k8s — k3s, k0s, MicroK8s

### Upgrade & Operations

- [ ] cluster-upgrade — skip version 금지, skew 정책
- [ ] node-maintenance — drain, cordon, surge
- [ ] version-skew — 컴포넌트별 허용 범위

### Backup & Recovery

- [ ] etcd-backup — snapshot, restore, 정기성
- [ ] velero — 백업 전략, DR 테스트
- [ ] disaster-recovery — 리전 장애, PITR

### Troubleshooting

- [ ] pod-debugging — CrashLoopBackOff, ImagePullBackOff, OOMKilled
- [ ] etcd-troubleshooting — 성능, 조각화, defrag
- [ ] control-plane-failure — API server 장애, 증상·복구
- [ ] k8s-error-messages — 자주 보는 에러 해석
- [ ] finalizer-stuck — 리소스 삭제 불가 증상

### Multi-tenancy & Multi-cluster

- [ ] multi-tenancy-overview — hard vs soft, 적합 모델 선택
- [ ] vcluster-capsule — 가상 클러스터 vs 네임스페이스 오케스트레이션
- [ ] multi-cluster-patterns — Karmada, Fleet, Cluster API

### Management Tools

- [ ] kubectl-tips — context, jsonpath, debug, krew
- [ ] helm — 차트 구조, values, subchart, OCI
- [ ] kustomize — base/overlay, patch, generator

### Special Workloads

- [ ] gpu-scheduling — NVIDIA device plugin, MIG, time-slicing
- [ ] batch-workload — Kueue, JobSet, queueing

### AI/ML Workloads

- [ ] ai-workload-scheduling — GPU, topology, 고성능 옵션
- [ ] dra — Dynamic Resource Allocation, structured parameters
- [ ] lws-jobset — LeaderWorkerSet, JobSet, 분산 학습

### Cost (FinOps 통합)

- [ ] kubecost-opencost — 네임스페이스·워크로드별 비용 분석

### Release Tracking

- [ ] kubernetes-release-overview — 1.33 ~ 1.36 주요 변경 요약

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
