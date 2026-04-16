---
title: "Kubernetes"
date: 2026-04-16
tags:
  - kubernetes
  - roadmap
sidebar_label: "Kubernetes"
---

# 04. Kubernetes

컨테이너 오케스트레이션의 사실상 표준. DevOps 엔지니어의 코어 역량.
아키텍처, 리소스, 스케줄링, 보안, 확장성(Operator), 백업, 멀티클러스터까지
프로덕션 운영에 필요한 모든 개념을 다룬다.

## 목차

### 아키텍처

- [ ] [클러스터 구성 요소 전체 개요](architecture/k8s-architecture.md)
- [ ] [Control Plane (API Server, etcd, Scheduler, Controller Manager)](architecture/control-plane.md)
- [ ] [Worker Node (kubelet, kube-proxy, 컨테이너 런타임)](architecture/worker-node.md)
- [ ] [API Server 내부와 요청 흐름](architecture/api-server-internals.md)
- [ ] [etcd 아키텍처와 백업](architecture/etcd.md)
- [ ] [Reconciliation Loop 원리](architecture/reconciliation-loop.md)
- [ ] [K8s API 버전 정책 (alpha/beta/GA, deprecation)](architecture/api-versioning.md)

### 클러스터 구축

- [ ] [kubeadm 수동 설치](cluster-setup/cluster-kubeadm.md)
- [ ] [매니지드 (EKS, GKE, AKS, DOKS) 비교](cluster-setup/managed-k8s.md)
- [ ] [경량 배포판 (k3s, k0s, microk8s)](cluster-setup/lightweight-k8s.md)
- [ ] [로컬 개발 (kind, minikube, Rancher Desktop)](cluster-setup/local-k8s.md)
- [ ] [HA 클러스터 설계](cluster-setup/ha-cluster-design.md)

### 핵심 워크로드

- [ ] [Pod 라이프사이클과 probe, lifecycle hooks](workloads/pod-lifecycle.md)
- [ ] [ReplicaSet](workloads/replicaset.md)
- [ ] [Deployment (롤링 업데이트, 롤백)](workloads/deployment.md)
- [ ] [StatefulSet (stable identity, ordered deployment)](workloads/statefulset.md)
- [ ] [DaemonSet](workloads/daemonset.md)
- [ ] [Job과 CronJob](workloads/job-cronjob.md)

### 구성 관리

- [ ] [ConfigMap (환경변수, 볼륨 마운트, immutable)](configuration/configmap.md)
- [ ] [Secret (타입별, etcd 암호화, KMS)](configuration/secret.md)
- [ ] [Downward API](configuration/downward-api.md)
- [ ] [Projected Volume](configuration/projected-volume.md)

### 서비스 디스커버리와 네트워킹

- [ ] [Service (ClusterIP, NodePort, LoadBalancer, ExternalName)](service-networking/service.md)
- [ ] [Headless Service](service-networking/headless-service.md)
- [ ] [EndpointSlice](service-networking/endpointslice.md)
- [ ] [Ingress와 IngressClass](service-networking/ingress.md)
- [ ] [Gateway API (v1 GA)](service-networking/gateway-api.md)
- [ ] [Ingress Controller 비교 (Nginx, Traefik, HAProxy)](service-networking/ingress-controller-comparison.md)
- [ ] [NetworkPolicy](service-networking/network-policy.md)
- [ ] [CoreDNS와 K8s DNS 스펙](service-networking/coredns.md)

### 스토리지

- [ ] [PV와 PVC](storage/pv-pvc.md)
- [ ] [StorageClass와 Dynamic Provisioning](storage/storageclass.md)
- [ ] [CSI Driver 아키텍처](storage/csi-driver.md)
- [ ] [Volume Snapshot과 백업](storage/volume-snapshot.md)
- [ ] [RWX 볼륨과 분산 스토리지 (Rook, Longhorn)](storage/distributed-storage.md)

### 스케줄링

- [ ] [Scheduler 동작 원리](scheduling/scheduler-internals.md)
- [ ] [NodeSelector, NodeName](scheduling/node-selector.md)
- [ ] [Affinity와 Anti-Affinity](scheduling/affinity.md)
- [ ] [Taint와 Toleration](scheduling/taint-toleration.md)
- [ ] [Topology Spread Constraints](scheduling/topology-spread.md)
- [ ] [Priority Class와 Preemption](scheduling/priority-preemption.md)
- [ ] [Pod Overhead](scheduling/pod-overhead.md)

### 리소스 관리

- [ ] [Requests와 Limits (QoS Classes)](resource-management/requests-limits.md)
- [ ] [LimitRange와 ResourceQuota](resource-management/limitrange-resourcequota.md)
- [ ] [Namespace 설계](resource-management/namespace-design.md)

### 안정성

- [ ] [Pod Disruption Budget (PDB)](reliability/pdb.md)
- [ ] [Eviction과 Node Pressure](reliability/eviction.md)
- [ ] [Graceful Shutdown과 preStop hook](reliability/graceful-shutdown.md)

### 오토스케일링

- [ ] [HPA (Metrics Server, custom metrics, external metrics)](autoscaling/hpa.md)
- [ ] [VPA (Vertical Pod Autoscaler)](autoscaling/vpa.md)
- [ ] [Cluster Autoscaler](autoscaling/cluster-autoscaler.md)
- [ ] [Karpenter](autoscaling/karpenter.md)
- [ ] [KEDA (이벤트 기반 스케일링)](autoscaling/keda.md)

### 확장성 (Extensibility)

- [ ] [CRD (Custom Resource Definition)](extensibility/crd.md)
- [ ] [Operator 패턴 (Operator SDK, Kubebuilder)](extensibility/operator-pattern.md)
- [ ] [Admission Controllers (Mutating, Validating Webhook)](extensibility/admission-controllers.md)
- [ ] [API Aggregation Layer](extensibility/api-aggregation.md)
- [ ] [Scheduling Framework와 커스텀 스케줄러](extensibility/custom-scheduler.md)
- [ ] [kro (Kubernetes Resource Orchestrator)](extensibility/kro.md)
- [ ] [Native Sidecar Container (KEP-753)](extensibility/native-sidecar.md)
- [ ] [Image Volume (K8s 1.33 alpha)](extensibility/image-volume.md)

### 보안

- [ ] [RBAC (Role, ClusterRole, RoleBinding)](security/rbac.md)
- [ ] [ServiceAccount와 Token](security/serviceaccount.md)
- [ ] [Security Context (runAsUser, readOnlyRootFilesystem)](security/security-context.md)
- [ ] [Pod Security Admission (PSA) - PSP 대체](security/pod-security-admission.md)
- [ ] [Audit Logging 설정](security/audit-logging.md)
- [ ] [Secret 암호화 (KMS 연동)](security/secret-encryption.md)

### 관리 도구

- [ ] [kubectl 고급 팁과 플러그인 (krew)](management-tools/kubectl-tips.md)
- [ ] [Kustomize (K8s 내장)](management-tools/kustomize.md)
- [ ] [Helm (패키지 매니저)](management-tools/helm.md)
- [ ] [k9s, Lens, kubectx/kubens](management-tools/cluster-ui-tools.md)
- [ ] [stern과 multi-pod 로그 조회](management-tools/stern.md)

### 업그레이드와 운영

- [ ] [클러스터 버전 업그레이드 (kubeadm, 매니지드)](upgrade-operations/cluster-upgrade.md)
- [ ] [Version Skew Policy](upgrade-operations/version-skew.md)
- [ ] [인증서 교체와 관리](upgrade-operations/cert-rotation.md)
- [ ] [Node 유지보수 (drain, cordon)](upgrade-operations/node-maintenance.md)

### 백업과 복구

- [ ] [Velero로 클러스터 백업](backup-recovery/velero.md)
- [ ] [etcd 백업과 복구](backup-recovery/etcd-backup.md)
- [ ] [DR 시나리오와 전략](backup-recovery/disaster-recovery.md)

### 멀티테넌시와 멀티클러스터

- [ ] [Multi-tenancy 전략 개요](multi-tenancy/multi-tenancy-overview.md)
- [ ] [vCluster (가상 K8s 클러스터)](multi-tenancy/vcluster.md)
- [ ] [Hierarchical Namespaces (HNC)](multi-tenancy/hierarchical-namespaces.md)
- [ ] [Capsule 멀티테넌시 Operator](multi-tenancy/capsule.md)
- [ ] [Cluster API (CAPI)](multi-tenancy/cluster-api.md)
- [ ] [Karmada](multi-tenancy/karmada.md)
- [ ] [Fleet 관리와 멀티클러스터 패턴](multi-tenancy/multi-cluster-patterns.md)

### 특수 워크로드

- [ ] [GPU 스케줄링 (NVIDIA Device Plugin)](special-workloads/gpu-scheduling.md)
- [ ] [KubeVirt (VM on K8s)](special-workloads/kubevirt.md)
- [ ] [배치 워크로드 (Volcano, Kueue)](special-workloads/batch-workload.md)

### AI/ML 워크로드 (2025~)

- [ ] [Dynamic Resource Allocation (DRA)](ai-ml-workloads/dra.md)
- [ ] [LeaderWorkerSet (LWS)](ai-ml-workloads/lws.md)
- [ ] [JobSet API](ai-ml-workloads/jobset.md)
- [ ] [AI 워크로드 스케줄링 패턴 (Kueue, Gang Scheduling)](ai-ml-workloads/ai-workload-scheduling.md)

### 트러블슈팅

- [ ] [Pod가 안 뜰 때 디버깅 순서](troubleshooting/pod-debugging.md)
- [ ] [리소스별 에러 메시지 유형](troubleshooting/k8s-error-messages.md)
- [ ] [Finalizer와 Stuck 리소스 처리](troubleshooting/finalizer-stuck.md)
- [ ] [etcd 문제 진단](troubleshooting/etcd-troubleshooting.md)
- [ ] [Control Plane 장애 대응](troubleshooting/control-plane-failure.md)

### 릴리즈 추적

- [ ] [Kubernetes 최신 릴리즈 총정리 (v1.33~v1.36)](release-tracking/kubernetes-release-overview.md)

---

## 참고 레퍼런스

- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [Kubernetes Patterns (Bilgin Ibryam)](https://k8spatterns.io/)
- [Production Kubernetes (O'Reilly)](https://www.oreilly.com/library/view/production-kubernetes/9781492092292/)
- [KEP (Kubernetes Enhancement Proposals)](https://github.com/kubernetes/enhancements)
- [CNCF End User Case Studies](https://www.cncf.io/case-studies/)
