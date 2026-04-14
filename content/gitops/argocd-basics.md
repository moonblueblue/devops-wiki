---
title: "ArgoCD 아키텍처와 기본 사용법"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - kubernetes
sidebar_label: "ArgoCD 기초"
---

# ArgoCD 아키텍처와 기본 사용법

## 1. 아키텍처

```
┌─────────────────────────────────────┐
│            ArgoCD                   │
│                                     │
│  API Server ←→ Web UI / CLI / CI    │
│      ↓                              │
│  Repo Server  (Git 캐시, 매니페스트 생성) │
│      ↓                              │
│  App Controller (상태 비교·조정)     │
│      ↓                              │
│    Redis (캐시)                     │
└─────────────────────────────────────┘
         ↕ kubectl
    Kubernetes 클러스터
```

| 컴포넌트 | 역할 |
|---------|------|
| API Server | Web UI, CLI, CI/CD 요청 처리, RBAC 적용 |
| Repo Server | Git 클론 캐시 유지, 매니페스트 생성 (Helm/Kustomize) |
| App Controller | 실제 상태 vs 선언 상태 비교, 자동 조정 |
| Redis | 캐시 (무상태 컴포넌트의 공유 상태) |

---

## 2. 설치

```bash
# kubectl 방식
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Helm 방식 (권장)
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace

# 초기 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d

# 포트 포워딩 (로컬 접근)
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

---

## 3. Application CRD

ArgoCD의 핵심 리소스. "어떤 Git 저장소의 어떤 경로를 어떤 클러스터에 배포할 것인가"를 정의한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
spec:
  project: default

  # 소스: Git 저장소
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: apps/my-app/overlays/production
    targetRevision: main    # 브랜치, 태그, 또는 커밋 SHA

  # 대상: 배포할 클러스터와 네임스페이스
  destination:
    server: https://kubernetes.default.svc   # 같은 클러스터
    namespace: production

  # 동기화 정책
  syncPolicy:
    automated:
      prune: true       # Git에서 삭제된 리소스 클러스터에서도 제거
      selfHeal: true    # 직접 변경된 경우 자동 복원
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    - PrunePropagationPolicy=foreground
```

---

## 4. App of Apps 패턴

루트 Application이 다른 Application들을 관리한다.

```yaml
# root-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/myorg/gitops.git
    path: applications       # Application YAML 파일들이 있는 디렉토리
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

```
gitops/
└── applications/
    ├── frontend-app.yaml     # Application CR
    ├── backend-app.yaml
    ├── database-app.yaml
    └── monitoring-app.yaml
```

---

## 5. AppProject (RBAC 경계)

팀별·환경별로 배포 범위를 제한한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: team-frontend
  namespace: argocd
spec:
  # 허용할 소스 저장소
  sourceRepos:
  - 'https://github.com/myorg/frontend-*'

  # 배포 가능한 대상
  destinations:
  - namespace: 'frontend-*'
    server: https://kubernetes.default.svc

  # 클러스터 수준 리소스 화이트리스트
  clusterResourceWhitelist:
  - group: ''
    kind: Namespace

  # 네임스페이스 수준 블랙리스트
  namespaceResourceBlacklist:
  - group: ''
    kind: NetworkPolicy
```

---

## 6. 동기화 상태

```
Sync Status:
  Synced    → Git과 클러스터 일치
  OutOfSync → 차이 있음 (자동/수동 동기화 필요)

Health Status:
  Healthy    → 모든 리소스 정상
  Degraded   → 일부 리소스 비정상
  Progressing → 변경 진행 중
  Missing    → 리소스 없음
```

```bash
# CLI로 상태 확인
argocd app list
argocd app get my-app
argocd app sync my-app

# 수동 동기화
argocd app sync my-app --prune

# 롤백
argocd app rollback my-app <revision-number>
```

---

## 7. Notification (Slack 연동)

```yaml
# argocd-notifications-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  service.slack: |
    token: $slack-token
  template.app-deployed: |
    message: |
      :white_check_mark: {{.app.metadata.name}} 배포 완료
      상태: {{.app.status.sync.status}}
  trigger.on-deployed: |
    - when: app.status.operationState.phase in ['Succeeded']
      send: [app-deployed]
```

---

## 참고 문서

- [ArgoCD 공식 문서](https://argo-cd.readthedocs.io/)
- [ArgoCD Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- [ApplicationSet](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/)
