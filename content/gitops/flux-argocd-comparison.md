---
title: "Flux와 ArgoCD 비교 및 선택 기준"
date: 2026-04-14
tags:
  - flux
  - argocd
  - gitops
  - kubernetes
sidebar_label: "Flux vs ArgoCD"
---

# Flux와 ArgoCD 비교 및 선택 기준

## 1. Flux 개요

CNCF Graduated 프로젝트. GitOps Toolkit이라는
모듈식 컨트롤러 집합으로 구성된다.

```
Flux GitOps Toolkit
├── source-controller    Git/Helm/OCI 소스 감시·캐시
├── kustomize-controller Kustomization CR 처리
├── helm-controller      HelmRelease CR 처리
├── notification-controller 알림·웹훅
└── image-automation     이미지 업데이트 자동화
```

---

## 2. 설치 (Bootstrap)

```bash
# Flux CLI 설치
curl -s https://fluxcd.io/install.sh | sudo bash

# GitHub에 bootstrap (GitOps 저장소 자동 생성·커밋)
flux bootstrap github \
  --owner=myorg \
  --repository=fleet-infra \
  --branch=main \
  --path=clusters/production \
  --personal
```

Bootstrap은 flux-system 네임스페이스를 생성하고,
컨트롤러 매니페스트를 Git에 자동으로 커밋한다.

---

## 3. 핵심 CRD

### GitRepository (소스 정의)

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-apps
  namespace: flux-system
spec:
  interval: 1m          # 1분마다 Git 폴링
  url: https://github.com/myorg/gitops.git
  ref:
    branch: main
  secretRef:
    name: git-credentials
```

### Kustomization (배포 정의)

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-apps
  namespace: flux-system
spec:
  interval: 5m
  path: ./clusters/production    # 폴링할 경로
  prune: true                    # Git에서 삭제 시 클러스터에서도 제거
  sourceRef:
    kind: GitRepository
    name: my-apps
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: frontend
    namespace: production
```

### HelmRelease (Helm 배포)

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
      version: ">=45.0.0 <46.0.0"
      sourceRef:
        kind: HelmRepository
        name: prometheus-community
        namespace: flux-system
  values:
    grafana:
      enabled: true
      adminPassword: ${GRAFANA_PASSWORD}
  valuesFrom:
  - kind: ConfigMap
    name: prometheus-values
```

---

## 4. 이미지 자동 업데이트

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

# 태그 필터 정책
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
      range: ">=1.0.0"   # semver 범위

# Git에 자동 커밋
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
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@example.com
        name: fluxcdbot
      messageTemplate: "chore: update image to {{range .Updated.Images}}{{.}}{{end}}"
    push:
      branch: main
```

---

## 5. ArgoCD vs Flux 비교

| 항목 | ArgoCD | Flux |
|-----|--------|------|
| 아키텍처 | 단일 애플리케이션 | GitOps Toolkit (모듈식) |
| Web UI | 풍부한 대시보드 | 없음 (CLI 중심) |
| 설정 방식 | ArgoCD CRD | Flux CRD |
| 멀티 테넌시 | AppProject | Kustomization 경로 분리 |
| Helm 지원 | Application.spec.source | HelmRelease CRD |
| Kustomize 지원 | 기본 내장 | kustomize-controller |
| 이미지 업데이트 | Image Updater (별도) | image-automation (기본) |
| 알림 | Notification Controller | Notification Controller |
| OCI 레지스트리 | 지원 | 기본 지원 (OCIRepository) |
| 학습 곡선 | 낮음 (UI 덕분) | 보통 (YAML 중심) |
| CNCF 상태 | Graduated | Graduated |
| 시장 점유율 | ~60% | ~30% |

---

## 6. 언제 어떤 것을 선택하는가

### ArgoCD를 선택할 때

- 개발팀이 배포 상태를 직접 확인해야 할 때
- 여러 팀이 UI로 앱을 관리해야 할 때
- ApplicationSet으로 대규모 앱 관리가 필요할 때
- ArgoCD Rollouts와 연동한 고급 배포 전략

### Flux를 선택할 때

- 인프라 자동화 중심 (클러스터 자체를 GitOps로 관리)
- Helm 릴리즈를 선언적으로 관리해야 할 때
- OCI 레지스트리를 소스로 사용할 때
- 플랫폼 엔지니어링: 여러 클러스터를 단일 저장소로 관리

### 함께 사용하는 경우

```
Flux (인프라 레이어)
  → 클러스터 부트스트랩
  → ArgoCD 자체 설치
  → 공통 인프라 (모니터링, 보안)
      ArgoCD (애플리케이션 레이어)
        → 앱 배포 관리
        → 팀별 AppProject
```

---

## 7. 멀티 클러스터 관리

### Flux (단일 저장소 패턴)

```
fleet-infra/
├── clusters/
│   ├── production/
│   │   ├── flux-system/
│   │   └── apps/
│   └── staging/
│       ├── flux-system/
│       └── apps/
└── infrastructure/
    ├── monitoring/
    └── ingress/
```

### ArgoCD (ApplicationSet 패턴)

```yaml
# 클러스터 레이블로 자동 배포
generators:
- clusters:
    selector:
      matchLabels:
        environment: production
```

---

## 참고 문서

- [Flux 공식 문서](https://fluxcd.io/flux/)
- [ArgoCD 공식 문서](https://argo-cd.readthedocs.io/)
- [GitOps 도구 비교 (CNCF)](https://landscape.cncf.io/gitops)
- [OpenGitOps](https://opengitops.dev/)
