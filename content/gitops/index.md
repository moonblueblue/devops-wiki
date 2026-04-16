---
title: "GitOps"
date: 2026-04-16
tags:
  - gitops
  - argocd
  - flux
  - argo-rollouts
  - roadmap
sidebar_label: "GitOps"
---

# 07. GitOps

Git을 단일 진실 공급원(Single Source of Truth)으로 하는 선언적 배포.
CI/CD의 진화형이며, ArgoCD·Flux를 중심으로 점진적 배포, 시크릿 관리,
멀티클러스터까지 다룬다.

## 목차

### 개념

- [ ] [GitOps란 무엇인가](concepts/gitops-overview.md)
- [ ] [GitOps의 4가지 원칙 (Declarative, Versioned, Approved, Applied)](concepts/gitops-four-principles.md)
- [ ] [Push vs Pull 배포 모델](concepts/push-vs-pull.md)
- [ ] [CI/CD vs GitOps 경계](concepts/cicd-vs-gitops.md)
- [ ] [OpenGitOps WG의 표준](concepts/opengitops.md)

### ArgoCD 기본

- [ ] [ArgoCD 아키텍처와 설치](argocd-basics/argocd-install.md)
- [ ] [Application과 Project](argocd-basics/argocd-application-project.md)
- [ ] [Sync 정책과 Auto-Sync](argocd-basics/argocd-sync-policy.md)
- [ ] [Sync Waves와 Sync Hooks](argocd-basics/argocd-sync-waves.md)
- [ ] [Health Checks와 Resource Customization](argocd-basics/argocd-health-check.md)

### ArgoCD 심화

- [ ] [ApplicationSet (다중 클러스터/환경 배포)](argocd-advanced/argocd-applicationset.md)
- [ ] [App of Apps 패턴](argocd-advanced/argocd-app-of-apps.md)
- [ ] [Multi-source Application](argocd-advanced/argocd-multi-source.md)
- [ ] [Config Management Plugin (CMP)](argocd-advanced/argocd-cmp.md)
- [ ] [ArgoCD Image Updater](argocd-advanced/argocd-image-updater.md)
- [ ] [Argo Events (이벤트 기반 GitOps)](argocd-advanced/argo-events.md)
- [ ] [Notifications (Slack, PagerDuty)](argocd-advanced/argocd-notifications.md)
- [ ] [Orphaned Resource 관리](argocd-advanced/argocd-orphaned-resources.md)
- [ ] [Resource Tracking (annotation vs label)](argocd-advanced/argocd-resource-tracking.md)
- [ ] [ArgoCD Extensions 생태계](argocd-advanced/argocd-extensions.md)

### ArgoCD 운영

- [ ] [RBAC과 SSO 연동 (OIDC, SAML, LDAP)](argocd-operations/argocd-rbac-sso.md)
- [ ] [ArgoCD 모니터링 (Prometheus, Grafana)](argocd-operations/argocd-monitoring.md)
- [ ] [ArgoCD 보안 하드닝](argocd-operations/argocd-security.md)
- [ ] [ArgoCD HA와 성능 튜닝](argocd-operations/argocd-ha.md)

### Flux

- [ ] [Flux 아키텍처와 설치](flux/flux-install.md)
- [ ] [GitRepository와 Kustomization](flux/flux-kustomization.md)
- [ ] [HelmRelease 관리](flux/flux-helmrelease.md)
- [ ] [Image Automation Controller](flux/flux-image-automation.md)
- [ ] [Notification Controller](flux/flux-notification.md)
- [ ] [Flux vs ArgoCD 선택 기준](flux/flux-vs-argocd.md)

### 배포 도구 (GitOps 관점)

- [ ] [Helm Chart 작성과 관리](deploy-tools/helm-chart.md)
- [ ] [Kustomize 오버레이 전략](deploy-tools/kustomize-overlays.md)
- [ ] [Helm vs Kustomize vs 조합](deploy-tools/helm-vs-kustomize.md)

### 점진적 배포 (Progressive Delivery)

- [ ] [Argo Rollouts 개요](progressive-delivery/argo-rollouts-overview.md)
- [ ] [Blue/Green 배포](progressive-delivery/argo-rollouts-bluegreen.md)
- [ ] [Canary 배포](progressive-delivery/argo-rollouts-canary.md)
- [ ] [Rollout Analysis와 자동 롤백](progressive-delivery/argo-rollouts-analysis.md)
- [ ] [Flagger (Argo Rollouts 대안)](progressive-delivery/flagger.md)
- [ ] [Feature Flag 통합 (OpenFeature, LaunchDarkly)](progressive-delivery/feature-flags.md)

### 시크릿 관리 (GitOps 관점)

- [ ] [Sealed Secrets (Bitnami)](secrets-management/sealed-secrets.md)
- [ ] [SOPS + age + KSOPS](secrets-management/sops-gitops.md)
- [ ] [External Secrets Operator (ESO)](secrets-management/eso.md)
- [ ] [Vault + ArgoCD 통합](secrets-management/vault-argocd.md)
- [ ] [Secret Rotation in GitOps](secrets-management/secret-rotation-gitops.md)

### GitOps 보안 (저장소 무결성)

- [ ] [Git Commit Signing (GPG, SSH)](gitops-security/git-signing.md)
- [ ] [Sigstore gitsign (keyless signing)](gitops-security/gitsign.md)
- [ ] [ArgoCD GPG Verification](gitops-security/argocd-gpg-verification.md)

### 의존성 자동 업데이트

- [ ] [Renovate 설정과 운영](dependency-update/renovate.md)
- [ ] [Dependabot](dependency-update/dependabot.md)
- [ ] [ArgoCD Image Updater와 비교](dependency-update/image-update-comparison.md)

### 멀티클러스터 GitOps

- [ ] [ApplicationSet Generators (List, Cluster, Git, Matrix)](multi-cluster/applicationset-generators.md)
- [ ] [Cluster API와 GitOps 통합](multi-cluster/gitops-clusterapi.md)
- [ ] [Fleet (Rancher)와 멀티클러스터 관리](multi-cluster/fleet.md)

### GitOps + IaC

- [ ] [Flux Terraform Controller](gitops-iac/flux-terraform-controller.md)
- [ ] [Crossplane과 GitOps 결합](gitops-iac/crossplane-gitops.md)
- [ ] [인프라와 앱 동시 GitOps 운영](gitops-iac/unified-gitops.md)

### 저장소 구조

- [ ] [Monorepo vs Polyrepo for GitOps](repo-structure/gitops-repo-structure.md)
- [ ] [환경별 오버레이 전략](repo-structure/environment-overlays.md)
- [ ] [앱 저장소 vs 매니페스트 저장소 분리](repo-structure/app-vs-config-repo.md)

---

## 참고 레퍼런스

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Flux Documentation](https://fluxcd.io/docs/)
- [OpenGitOps Principles](https://opengitops.dev/)
- [Argo Rollouts Documentation](https://argoproj.github.io/argo-rollouts/)
- [GitOps Working Group](https://github.com/open-gitops)
- [GitOps Patterns (Natan Yellin)](https://codefresh.io/learn/gitops/)
