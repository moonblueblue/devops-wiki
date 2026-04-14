---
title: "GitOps"
date: 2026-04-14
tags:
  - gitops
  - argocd
  - flux
  - roadmap
---

# GitOps

CI/CD의 다음 단계. 선언적 배포와 드리프트 방지.

## 목차

### 개념

- [x] [GitOps란 무엇인가](gitops-overview.md)
- [x] [Push vs Pull 배포 모델](gitops-push-pull-model.md)
- [x] [GitOps의 4가지 원칙](gitops-four-principles.md)

### ArgoCD

- [x] [ArgoCD 아키텍처와 설치](argocd-install.md)
- [x] [Application과 Project](argocd-application-project.md)
- [x] [Sync 정책과 Auto Sync](argocd-sync-policy.md)
- [x] [Kustomize 기반 배포](argocd-kustomize.md)
- [x] [Helm 기반 배포](argocd-helm.md)
- [x] [ArgoCD Image Updater](argocd-image-updater.md)
- [x] [RBAC과 SSO 연동](argocd-rbac-sso.md)
- [x] [ArgoCD 모니터링 (Prometheus, Grafana)](argocd-monitoring.md)
- [x] [ArgoCD 보안 가이드](argocd-security.md)
- [x] [Orphaned Resource 관리](argocd-orphaned-resources.md)

### Flux

- [x] [Flux 소개와 ArgoCD 비교](flux-overview.md)
- [x] [Flux 기본 사용법](flux-basics.md)

### Helm & Kustomize

- [x] [Helm Chart 작성과 관리](helm-chart.md)
- [x] [Kustomize 기본과 활용](kustomize-basics.md)
- [x] [Helm vs Kustomize vs Helm+Kustomize](helm-vs-kustomize.md)

### 배포 전략

- [x] [Argo Rollout 소개](argo-rollouts-overview.md)
- [x] [Blue/Green 배포 실습](argo-rollouts-bluegreen.md)
- [x] [Canary 배포 실습](argo-rollouts-canary.md)
- [x] [Rollout Analysis와 자동 롤백](argo-rollouts-analysis.md)
