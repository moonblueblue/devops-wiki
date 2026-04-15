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

- [ ] [클러스터 구성 요소 전체 개요](k8s-architecture.md)
- [ ] [Control Plane (API Server, etcd, Scheduler, Controller Manager)](control-plane.md)
- [ ] [Worker Node (kubelet, kube-proxy, 컨테이너 런타임)](worker-node.md)
- [ ] [API Server 내부와 요청 흐름](api-server-internals.md)
- [ ] [etcd 아키텍처와 백업](etcd.md)
- [ ] [Reconciliation Loop 원리](reconciliation-loop.md)
- [ ] [K8s API 버전 정책 (alpha/beta/GA, deprecation)](api-versioning.md)

### 클러스터 구축

- [ ] [kubeadm 수동 설치](cluster-kubeadm.md)
- [ ] [매니지드 (EKS, GKE, AKS, DOKS) 비교](managed-k8s.md)
- [ ] [경량 배포판 (k3s, k0s, microk8s)](lightweight-k8s.md)
- [ ] [로컬 개발 (kind, minikube, Rancher Desktop)](local-k8s.md)
- [ ] [HA 클러스터 설계](ha-cluster-design.md)

### 핵심 워크로드

- [ ] [Pod 라이프사이클과 probe, lifecycle hooks](pod-lifecycle.md)
- [ ] [ReplicaSet](replicaset.md)
- [ ] [Deployment (롤링 업데이트, 롤백)](deployment.md)
- [ ] [StatefulSet (stable identity, ordered deployment)](statefulset.md)
- [ ] [DaemonSet](daemonset.md)
- [ ] [Job과 CronJob](job-cronjob.md)

### 구성 관리

- [ ] [ConfigMap (환경변수, 볼륨 마운트, immutable)](configmap.md)
- [ ] [Secret (타입별, etcd 암호화, KMS)](secret.md)
- [ ] [Downward API](downward-api.md)
- [ ] [Projected Volume](projected-volume.md)

### 서비스 디스커버리와 네트워킹

- [ ] [Service (ClusterIP, NodePort, LoadBalancer, ExternalName)](service.md)
- [ ] [Headless Service](headless-service.md)
- [ ] [EndpointSlice](endpointslice.md)
- [ ] [Ingress와 IngressClass](ingress.md)
- [ ] [Gateway API (v1 GA)](gateway-api.md)
- [ ] [Ingress Controller 비교 (Nginx, Traefik, HAProxy)](ingress-controller-comparison.md)
- [ ] [NetworkPolicy](network-policy.md)
- [ ] [CoreDNS와 K8s DNS 스펙](coredns.md)

### 스토리지

- [ ] [PV와 PVC](pv-pvc.md)
- [ ] [StorageClass와 Dynamic Provisioning](storageclass.md)
- [ ] [CSI Driver 아키텍처](csi-driver.md)
- [ ] [Volume Snapshot과 백업](volume-snapshot.md)
- [ ] [RWX 볼륨과 분산 스토리지 (Rook, Longhorn)](distributed-storage.md)

### 스케줄링

- [ ] [Scheduler 동작 원리](scheduler-internals.md)
- [ ] [NodeSelector, NodeName](node-selector.md)
- [ ] [Affinity와 Anti-Affinity](affinity.md)
- [ ] [Taint와 Toleration](taint-toleration.md)
- [ ] [Topology Spread Constraints](topology-spread.md)
- [ ] [Priority Class와 Preemption](priority-preemption.md)
- [ ] [Pod Overhead](pod-overhead.md)

### 리소스 관리

- [ ] [Requests와 Limits (QoS Classes)](requests-limits.md)
- [ ] [LimitRange와 ResourceQuota](limitrange-resourcequota.md)
- [ ] [Namespace 설계](namespace-design.md)

### 안정성

- [ ] [Pod Disruption Budget (PDB)](pdb.md)
- [ ] [Eviction과 Node Pressure](eviction.md)
- [ ] [Graceful Shutdown과 preStop hook](graceful-shutdown.md)

### 오토스케일링

- [ ] [HPA (Metrics Server, custom metrics, external metrics)](hpa.md)
- [ ] [VPA (Vertical Pod Autoscaler)](vpa.md)
- [ ] [Cluster Autoscaler](cluster-autoscaler.md)
- [ ] [Karpenter](karpenter.md)
- [ ] [KEDA (이벤트 기반 스케일링)](keda.md)

### 확장성 (Extensibility)

- [ ] [CRD (Custom Resource Definition)](crd.md)
- [ ] [Operator 패턴 (Operator SDK, Kubebuilder)](operator-pattern.md)
- [ ] [Admission Controllers (Mutating, Validating Webhook)](admission-controllers.md)
- [ ] [API Aggregation Layer](api-aggregation.md)
- [ ] [Scheduling Framework와 커스텀 스케줄러](custom-scheduler.md)
- [ ] [kro (Kubernetes Resource Orchestrator)](kro.md)
- [ ] [Native Sidecar Container (KEP-753)](native-sidecar.md)
- [ ] [Image Volume (K8s 1.33 alpha)](image-volume.md)

### 보안

- [ ] [RBAC (Role, ClusterRole, RoleBinding)](rbac.md)
- [ ] [ServiceAccount와 Token](serviceaccount.md)
- [ ] [Security Context (runAsUser, readOnlyRootFilesystem)](security-context.md)
- [ ] [Pod Security Admission (PSA) - PSP 대체](pod-security-admission.md)
- [ ] [Audit Logging 설정](audit-logging.md)
- [ ] [Secret 암호화 (KMS 연동)](secret-encryption.md)

### 관리 도구

- [ ] [kubectl 고급 팁과 플러그인 (krew)](kubectl-tips.md)
- [ ] [Kustomize (K8s 내장)](kustomize.md)
- [ ] [Helm (패키지 매니저)](helm.md)
- [ ] [k9s, Lens, kubectx/kubens](cluster-ui-tools.md)
- [ ] [stern과 multi-pod 로그 조회](stern.md)

### 업그레이드와 운영

- [ ] [클러스터 버전 업그레이드 (kubeadm, 매니지드)](cluster-upgrade.md)
- [ ] [Version Skew Policy](version-skew.md)
- [ ] [인증서 교체와 관리](cert-rotation.md)
- [ ] [Node 유지보수 (drain, cordon)](node-maintenance.md)

### 백업과 복구

- [ ] [Velero로 클러스터 백업](velero.md)
- [ ] [etcd 백업과 복구](etcd-backup.md)
- [ ] [DR 시나리오와 전략](disaster-recovery.md)

### 멀티테넌시와 멀티클러스터

- [ ] [Multi-tenancy 전략 개요](multi-tenancy-overview.md)
- [ ] [vCluster (가상 K8s 클러스터)](vcluster.md)
- [ ] [Hierarchical Namespaces (HNC)](hierarchical-namespaces.md)
- [ ] [Capsule 멀티테넌시 Operator](capsule.md)
- [ ] [Cluster API (CAPI)](cluster-api.md)
- [ ] [Karmada](karmada.md)
- [ ] [Fleet 관리와 멀티클러스터 패턴](multi-cluster-patterns.md)

### 특수 워크로드

- [ ] [GPU 스케줄링 (NVIDIA Device Plugin)](gpu-scheduling.md)
- [ ] [KubeVirt (VM on K8s)](kubevirt.md)
- [ ] [배치 워크로드 (Volcano, Kueue)](batch-workload.md)

### AI/ML 워크로드 (2025~)

- [ ] [Dynamic Resource Allocation (DRA)](dra.md)
- [ ] [LeaderWorkerSet (LWS)](lws.md)
- [ ] [JobSet API](jobset.md)
- [ ] [AI 워크로드 스케줄링 패턴 (Kueue, Gang Scheduling)](ai-workload-scheduling.md)

### 트러블슈팅

- [ ] [Pod가 안 뜰 때 디버깅 순서](pod-debugging.md)
- [ ] [리소스별 에러 메시지 유형](k8s-error-messages.md)
- [ ] [Finalizer와 Stuck 리소스 처리](finalizer-stuck.md)
- [ ] [etcd 문제 진단](etcd-troubleshooting.md)
- [ ] [Control Plane 장애 대응](control-plane-failure.md)

### 릴리즈 추적

- [ ] [Kubernetes 최신 릴리즈 총정리 (v1.33~v1.36)](kubernetes-release-overview.md)

---

## 참고 레퍼런스

- [Kubernetes 공식 문서](https://kubernetes.io/docs/)
- [Kubernetes Patterns (Bilgin Ibryam)](https://k8spatterns.io/)
- [Production Kubernetes (O'Reilly)](https://www.oreilly.com/library/view/production-kubernetes/9781492092292/)
- [KEP (Kubernetes Enhancement Proposals)](https://github.com/kubernetes/enhancements)
- [CNCF End User Case Studies](https://www.cncf.io/case-studies/)
