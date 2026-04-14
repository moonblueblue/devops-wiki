---
title: "Kubernetes"
date: 2026-04-12
tags:
  - kubernetes
  - roadmap
---

# Kubernetes

컨테이너 오케스트레이션. 컨테이너를 알아야 이해된다.

## 목차

### 아키텍처

- [x] [쿠버네티스 클러스터 구성요소](k8s-architecture.md)
- [x] [Control Plane (API Server, etcd, Scheduler, Controller Manager)](control-plane.md)
- [x] [Worker Node (kubelet, kube-proxy, 컨테이너 런타임)](worker-node.md)
- [x] [클러스터 구축 방법 비교 (kubeadm, 매니지드, k3s, kind)](cluster-setup.md)

### 핵심 리소스

- [x] [Pod, ReplicaSet, Deployment](pod-replicaset-deployment.md)
- [x] [Service, Ingress, Gateway API](service-ingress-gateway.md)
- [x] [ConfigMap, Secret](configmap-secret.md)
- [x] [Namespace, ResourceQuota, LimitRange](namespace-quota.md)
- [x] [Job, CronJob, DaemonSet, StatefulSet](job-daemonset-statefulset.md)
- [x] [PV, PVC, StorageClass](pv-pvc-storageclass.md)

### 운영

- [x] [kubectl 사용법과 팁](kubectl-tips.md)
- [x] [파드 배치 전략 (NodeSelector, Affinity, Taint/Toleration)](pod-scheduling.md)
- [x] [롤링 업데이트와 롤백](rolling-update.md)
- [x] [클러스터 버전 업그레이드](cluster-upgrade.md)
- [x] [리소스 관리와 오토스케일링 (HPA, VPA, Karpenter)](autoscaling.md)

### 네트워킹

- [ ] 서비스 디스커버리와 CoreDNS
- [ ] Ingress Controller 비교
- [ ] 네트워크 폴리시

### 관리 도구

- [ ] Kustomize
- [ ] Helm
- [ ] k9s, Lens, kubectx/kubens

### 트러블슈팅

- [ ] 파드가 안 뜰 때 디버깅 순서
- [ ] 리소스 별 에러 메시지 유형과 해결
- [ ] Finalizer와 Stuck 리소스 처리

### 릴리즈 노트

- [x] Kubernetes v1.33~v1.36 릴리즈 총정리
