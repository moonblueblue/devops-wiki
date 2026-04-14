---
title: "ArgoCD 아키텍처와 설치"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - kubernetes
sidebar_label: "ArgoCD 설치"
---

# ArgoCD 아키텍처와 설치

## 1. 아키텍처

```
┌──────────────────────────────────────┐
│              ArgoCD                  │
│                                      │
│  API Server ←→ Web UI / CLI / CI     │
│      ↓                               │
│  Repo Server (Git 캐시, 매니페스트 생성) │
│      ↓                               │
│  App Controller (상태 비교·조정)      │
│      ↓                               │
│    Redis (캐시)                      │
└──────────────────────────────────────┘
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

### kubectl 방식

```bash
kubectl create namespace argocd
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### Helm 방식 (권장)

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm install argocd argo/argo-cd \
  --namespace argocd \
  --create-namespace \
  --set server.service.type=LoadBalancer
```

### 설치 후 접근

```bash
# 초기 admin 비밀번호 확인
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo

# 포트 포워딩 (로컬 접근)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# argocd CLI 로그인
argocd login localhost:8080 \
  --username admin \
  --password <위에서 확인한 비밀번호> \
  --insecure
```

---

## 3. 버전 정책

| 항목 | 내용 |
|-----|------|
| 최신 stable | ArgoCD 2.14.x / 3.0.x (2025) |
| K8s 지원 범위 | 현재 - 3개 마이너 버전 |
| 업그레이드 방법 | 한 마이너 버전씩 순차 업그레이드 권장 |

---

## 4. argocd CLI 기본 명령

```bash
# 앱 목록
argocd app list

# 앱 상태 상세 조회
argocd app get my-app

# 수동 동기화
argocd app sync my-app

# 롤백 (이전 revision으로)
argocd app rollback my-app <revision>

# 클러스터 추가 (멀티 클러스터)
argocd cluster add <context-name>
```

---

## 참고 문서

- [ArgoCD 공식 문서](https://argo-cd.readthedocs.io/)
- [ArgoCD Getting Started](https://argo-cd.readthedocs.io/en/stable/getting_started/)
- [Helm Chart](https://github.com/argoproj/argo-helm)
