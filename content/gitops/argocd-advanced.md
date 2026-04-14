---
title: "ArgoCD 고급 (ApplicationSet, Image Updater, RBAC)"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - applicationset
  - helm
  - kustomize
sidebar_label: "ArgoCD 고급"
---

# ArgoCD 고급

## 1. Kustomize 기반 배포

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: kustomize-app
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: apps/my-app/overlays/production  # Kustomize overlay
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## 2. Helm 기반 배포

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: helm-app
  namespace: argocd
spec:
  source:
    repoURL: https://charts.mycompany.com
    chart: my-application
    targetRevision: 1.5.0
    helm:
      releaseName: my-app
      values: |
        replicaCount: 3
        image:
          tag: v1.2.3
      valueFiles:
      - values-prod.yaml    # Git에서 참조
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

---

## 3. ApplicationSet

단일 템플릿으로 여러 Application을 자동 생성한다.

### Git Directory Generator

```yaml
# gitops/ 하위 각 서비스 디렉토리마다 Application 생성
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: services
  namespace: argocd
spec:
  generators:
  - git:
      repoURL: https://github.com/myorg/gitops.git
      revision: main
      directories:
      - path: 'services/*'
  template:
    metadata:
      name: '{{path.basename}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/gitops.git
        path: '{{path}}'
        targetRevision: main
      destination:
        server: https://kubernetes.default.svc
        namespace: '{{path.basename}}'
      syncPolicy:
        automated:
          prune: true
```

### Cluster Generator (멀티 클러스터)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: multi-cluster-app
  namespace: argocd
spec:
  generators:
  - clusters:
      selector:
        matchLabels:
          env: production    # 이 라벨이 붙은 클러스터에 배포
  template:
    metadata:
      name: 'app-{{name}}'
    spec:
      source:
        repoURL: https://github.com/myorg/gitops.git
        path: apps/my-app
      destination:
        server: '{{server}}'
        namespace: default
```

---

## 4. ArgoCD Image Updater

컨테이너 레지스트리를 모니터링해 새 이미지 출시 시
자동으로 Git을 업데이트한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    # 모니터링할 이미지
    argocd-image-updater.argoproj.io/image-list: >-
      ghcr.io/myorg/myapp
    # 업데이트 전략: semver, latest, digest, name
    argocd-image-updater.argoproj.io/ghcr.io/myorg/myapp.update-strategy: semver
    argocd-image-updater.argoproj.io/ghcr.io/myorg/myapp.allow-tags: "regexp:^v[0-9]+"
    # Git에 변경사항 기록 (GitOps 방식)
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
spec:
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: apps/my-app
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: production
```

---

## 5. RBAC 설정

```yaml
# argocd-rbac-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  policy.default: role:readonly   # 기본: 읽기만
  policy.csv: |
    # 역할 권한 정의
    p, role:developer, applications, get,    */*, allow
    p, role:developer, applications, sync,   dev-*/*, allow
    p, role:developer, applications, create, dev-*/*, allow

    p, role:admin, applications, *, */*, allow
    p, role:admin, clusters,      *, *, allow

    # 그룹 매핑 (SSO OIDC 그룹 → ArgoCD 역할)
    g, devops-team,    role:admin
    g, frontend-devs,  role:developer
    g, readonly-users, role:readonly
```

### SSO 연동 (OIDC)

```yaml
# argocd-cm ConfigMap
data:
  oidc.config: |
    name: Okta
    issuer: https://dev-123456.okta.com
    clientID: my-client-id
    clientSecret: $oidc.okta.clientSecret
    requestedScopes:
    - openid
    - profile
    - email
    - groups
    groupsField: groups
```

---

## 6. ArgoCD 3.x 주요 변경사항 (2025)

| 항목 | 2.x | 3.x |
|-----|-----|-----|
| 기본 RBAC | 광범위한 기본 권한 | 최소 권한 기본값 |
| 클러스터 접근 | 암묵적 허용 | 명시적 화이트리스트 |
| 보안 기본값 | 느슨함 | 강화됨 |
| PreDelete Hook | 미지원 | 지원 |

---

## 참고 문서

- [ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
- [Image Updater](https://argocd-image-updater.readthedocs.io/)
- [RBAC 설정](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
- [Notifications](https://argocd-notifications.readthedocs.io/)
