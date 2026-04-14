---
title: "ArgoCD + Kustomize 기반 배포"
date: 2026-04-14
tags:
  - argocd
  - kustomize
  - gitops
sidebar_label: "ArgoCD Kustomize"
---

# ArgoCD + Kustomize 기반 배포

## 1. 기본 구조

ArgoCD는 Kustomize를 기본으로 지원한다.
`path`에 `kustomization.yaml`이 있으면 자동으로 Kustomize로 처리한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-prod
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: apps/my-app/overlays/production  # Kustomize overlay 경로
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

## 2. 저장소 구조 (Base + Overlays)

```
apps/my-app/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── staging/
    │   ├── kustomization.yaml
    │   └── patch-replicas.yaml
    └── production/
        ├── kustomization.yaml
        └── patch-replicas.yaml
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
bases:
- ../../base
namePrefix: prod-
commonLabels:
  env: production
patches:
- patch-replicas.yaml
images:
- name: myapp
  newTag: v1.5.0
```

---

## 3. Application에서 Kustomize 옵션 지정

```yaml
spec:
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: apps/my-app/base
    targetRevision: main
    kustomize:
      # 이미지 태그 오버라이드 (CI에서 동적으로 지정)
      images:
      - myapp=ghcr.io/myorg/myapp:v1.5.0
      # 네임 접두사
      namePrefix: prod-
      # 공통 레이블
      commonLabels:
        app.kubernetes.io/part-of: my-platform
```

---

## 4. 환경별 Application 관리

```yaml
# staging application
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-staging
spec:
  source:
    path: apps/my-app/overlays/staging
    kustomize:
      images:
      - myapp=ghcr.io/myorg/myapp:latest

---
# production application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-production
spec:
  source:
    path: apps/my-app/overlays/production
    kustomize:
      images:
      - myapp=ghcr.io/myorg/myapp:v1.5.0
```

---

## 5. Secret 관리 (Sealed Secrets + Kustomize)

```yaml
# overlays/production/kustomization.yaml
resources:
- ../../base
- sealed-secret.yaml    # kubeseal로 암호화된 시크릿

generators:
- secretGenerator:
  - name: app-config
    envs:
    - config.env        # 민감하지 않은 환경 변수
```

---

## 참고 문서

- [ArgoCD Kustomize](https://argo-cd.readthedocs.io/en/stable/user-guide/kustomize/)
- [Kustomize 공식 문서](https://kustomize.io/)
