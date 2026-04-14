---
title: "Flux 기본 사용법"
date: 2026-04-14
tags:
  - flux
  - gitops
  - kubernetes
sidebar_label: "Flux 기본"
---

# Flux 기본 사용법

## 1. 설치 (Bootstrap)

Bootstrap은 Flux를 클러스터에 설치하고
설치 매니페스트를 Git에 자동으로 커밋한다.

```bash
# Flux CLI 설치
curl -s https://fluxcd.io/install.sh | sudo bash

# GitHub에 bootstrap
flux bootstrap github \
  --owner=myorg \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --personal

# GitLab에 bootstrap
flux bootstrap gitlab \
  --owner=mygroup \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --token-auth
```

Bootstrap 후 `flux-system` 네임스페이스에 컨트롤러가 설치된다.

---

## 2. GitRepository (소스 정의)

Flux가 감시할 Git 저장소를 정의한다.

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-apps
  namespace: flux-system
spec:
  interval: 1m           # 1분마다 Git 폴링
  url: https://github.com/myorg/gitops.git
  ref:
    branch: main
  secretRef:
    name: git-credentials   # 프라이빗 저장소 인증
```

---

## 3. Kustomization (배포 정의)

Git에서 읽은 매니페스트를 클러스터에 적용한다.

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./clusters/production     # 감시할 경로
  prune: true                     # Git 삭제 시 클러스터도 삭제
  sourceRef:
    kind: GitRepository
    name: my-apps
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: frontend
    namespace: production
```

---

## 4. HelmRelease (Helm 배포)

Helm 차트를 선언적으로 관리한다.

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: prometheus
  namespace: monitoring
spec:
  interval: 10m
  chart:
    spec:
      chart: kube-prometheus-stack
      version: ">=65.0.0 <66.0.0"
      sourceRef:
        kind: HelmRepository
        name: prometheus-community
        namespace: flux-system
  values:
    grafana:
      enabled: true
  valuesFrom:
  - kind: ConfigMap
    name: prometheus-values
    valuesKey: values.yaml
```

---

## 5. 이미지 자동 업데이트

```yaml
# 레지스트리 감시
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  image: ghcr.io/myorg/my-app
  interval: 5m

# 태그 정책
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: my-app
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: my-app
  policy:
    semver:
      range: ">=1.0.0"

# Git 자동 커밋
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: flux-system
  namespace: flux-system
spec:
  interval: 30m
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    commit:
      author:
        email: fluxcdbot@example.com
        name: fluxcdbot
      messageTemplate: >-
        chore: update image to
        {{range .Updated.Images}}{{.}}{{end}}
    push:
      branch: main
```

---

## 6. 주요 CLI 명령

```bash
# 상태 확인
flux get all

# GitRepository 동기화 강제
flux reconcile source git my-apps

# Kustomization 동기화 강제
flux reconcile kustomization my-apps

# HelmRelease 동기화 강제
flux reconcile helmrelease prometheus -n monitoring

# 로그 확인
flux logs --all-namespaces
```

---

## 7. OCI 레지스트리 소스 (Flux 2.0+)

Git 저장소 대신 OCI 이미지 레지스트리를 소스로 사용한다.

```yaml
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: my-manifests
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/myorg/my-manifests
  ref:
    tag: latest
```

---

## 참고 문서

- [Flux 공식 문서](https://fluxcd.io/flux/)
- [Flux Bootstrap](https://fluxcd.io/flux/installation/bootstrap/)
- [HelmRelease CRD](https://fluxcd.io/flux/components/helm/)
