---
title: "ArgoCD Application과 AppProject"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - kubernetes
sidebar_label: "Application·Project"
---

# ArgoCD Application과 AppProject

## 1. Application CRD

"어떤 Git 저장소의 어떤 경로를 어떤 클러스터에 배포할 것인가"를 정의하는
ArgoCD의 핵심 리소스.

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
    server: https://kubernetes.default.svc
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

## 2. App of Apps 패턴

루트 Application이 다른 Application들을 관리한다.
여러 서비스를 한꺼번에 GitOps로 관리할 때 사용한다.

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
    path: applications       # Application YAML 파일 디렉토리
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

## 3. AppProject (RBAC 경계)

팀별·환경별로 배포 범위를 제한한다.
어떤 저장소에서, 어떤 클러스터에 배포할 수 있는지를 제어한다.

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

## 4. 동기화 상태

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

# 수동 동기화
argocd app sync my-app --prune

# 롤백
argocd app rollback my-app <revision-number>
```

---

## 5. ApplicationSet (대규모 앱 자동화)

단일 템플릿으로 여러 Application을 자동 생성한다.
마이크로서비스·멀티 클러스터 환경에서 Application 관리를 자동화한다.

```yaml
# Git 디렉토리 기반: services/ 하위 디렉토리마다 앱 생성
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

---
# 클러스터 기반: 레이블 매칭된 클러스터에 배포
generators:
- clusters:
    selector:
      matchLabels:
        env: production
```

---

## 6. Notification (Slack 연동)

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

- [ArgoCD Application CRD](https://argo-cd.readthedocs.io/en/stable/operator-manual/application-specification/)
- [ArgoCD Projects](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
- [App of Apps 패턴](https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/)
