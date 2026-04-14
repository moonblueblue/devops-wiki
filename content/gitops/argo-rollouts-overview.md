---
title: "Argo Rollouts 소개"
date: 2026-04-14
tags:
  - argo-rollouts
  - gitops
  - kubernetes
  - deployment
sidebar_label: "Argo Rollouts 소개"
---

# Argo Rollouts 소개

## 1. 개요

Kubernetes 기본 `Deployment`를 대체하는 고급 배포 컨트롤러.
블루/그린·카나리 배포를 선언적으로 정의하고,
메트릭 분석을 통해 자동 승격·롤백을 수행한다.

```
Rollout CRD
  → Rollout Controller가 감시
      → 트래픽 분할 (Ingress / Service Mesh)
          → AnalysisRun으로 메트릭 검증
              → 자동 승격 or 자동 롤백
```

---

## 2. Deployment vs Rollout 비교

| 항목 | Deployment | Rollout |
|-----|-----------|---------|
| 배포 전략 | RollingUpdate, Recreate | BlueGreen, Canary |
| 트래픽 제어 | 없음 | 가중치 기반 분할 |
| 메트릭 분석 | 없음 | AnalysisTemplate 연동 |
| 자동 롤백 | 없음 | 분석 실패 시 자동 |
| kubectl 지원 | 기본 | 플러그인 필요 |

---

## 3. 설치

```bash
# kubectl 방식
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml

# Helm 방식
helm repo add argo https://argoproj.github.io/argo-helm
helm install argo-rollouts argo/argo-rollouts \
  --namespace argo-rollouts \
  --create-namespace

# kubectl 플러그인 설치
brew install argoproj/tap/kubectl-argo-rollouts
# 또는
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
```

---

## 4. 기본 CLI 명령

```bash
# Rollout 목록
kubectl argo rollouts list rollouts

# 상태 확인 (실시간)
kubectl argo rollouts get rollout my-app --watch

# 이미지 업데이트 (배포 시작)
kubectl argo rollouts set image my-app \
  app=myapp:v2.0.0

# 다음 단계로 진행 (수동 승인)
kubectl argo rollouts promote my-app

# 배포 중단·롤백
kubectl argo rollouts abort my-app
kubectl argo rollouts undo my-app
```

---

## 5. ArgoCD 연동

ArgoCD와 함께 사용하면 GitOps 방식으로 Rollout을 관리할 수 있다.

```bash
# ArgoCD가 Rollout 상태를 정상 인식하려면
# argo-rollouts extension 설치 필요
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj-labs/rollout-extension/main/manifests/install.yaml
```

---

## 6. 트래픽 분할 방식

| 방식 | 지원 도구 | 특징 |
|-----|---------|------|
| Ingress 가중치 | Nginx, ALB, Traefik | 간단, 퍼센트 기반 |
| Service Mesh | Istio, Linkerd | 세밀한 제어 |
| SMI (TrafficSplit) | SMI 호환 메시 | 표준화된 API |
| Header 기반 | Nginx, Istio | 특정 사용자만 카나리 |

---

## 참고 문서

- [Argo Rollouts 공식 문서](https://argoproj.github.io/argo-rollouts/)
- [설치 가이드](https://argoproj.github.io/argo-rollouts/installation/)
