---
title: "Argo Rollouts (블루/그린·카나리 고급 배포)"
date: 2026-04-14
tags:
  - argocd
  - argo-rollouts
  - gitops
  - canary
  - blue-green
sidebar_label: "Argo Rollouts"
---

# Argo Rollouts

## 1. 개요

Kubernetes 기본 `Deployment`를 대체하는 고급 배포 컨트롤러.
블루/그린·카나리 배포를 선언적으로 정의하고,
Prometheus 등 메트릭 분석을 통해 자동 승격·롤백을 수행한다.

```
Rollout CRD
  → Rollout Controller가 감시
      → 트래픽 분할 (Ingress / Service Mesh)
          → AnalysisRun으로 메트릭 검증
              → 자동 승격 or 자동 롤백
```

---

## 2. 설치

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
curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
chmod +x kubectl-argo-rollouts-linux-amd64
mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts
```

---

## 3. Rollout vs Deployment

| 항목 | Deployment | Rollout |
|-----|-----------|---------|
| 배포 전략 | RollingUpdate, Recreate | BlueGreen, Canary |
| 트래픽 제어 | 없음 | 가중치 기반 분할 |
| 메트릭 분석 | 없음 | AnalysisTemplate 연동 |
| 자동 롤백 | 없음 | 분석 실패 시 자동 |
| kubectl 지원 | 기본 | 플러그인 필요 |

---

## 4. 블루/그린 배포

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app
spec:
  replicas: 5
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: myapp:v2.0.0
        ports:
        - containerPort: 8080

  strategy:
    blueGreen:
      # 현재 버전(Blue)에 연결된 서비스
      activeService: my-app-active
      # 새 버전(Green) 미리보기 서비스
      previewService: my-app-preview
      # 자동 승격 비활성화 (수동 검증 후 승격)
      autoPromotionEnabled: false
      # 승격 전 Green 준비 대기 시간
      previewReplicaCount: 2
      scaleDownDelaySeconds: 30
```

```yaml
# 서비스 2개 필요
apiVersion: v1
kind: Service
metadata:
  name: my-app-active    # Blue (라이브 트래픽)
spec:
  selector:
    app: my-app
---
apiVersion: v1
kind: Service
metadata:
  name: my-app-preview   # Green (테스트 트래픽)
spec:
  selector:
    app: my-app
```

```bash
# 배포 승격 (Green → Active)
kubectl argo rollouts promote my-app

# 롤백 (Active → 이전 버전)
kubectl argo rollouts undo my-app

# 상태 확인
kubectl argo rollouts get rollout my-app --watch
```

---

## 5. 카나리 배포

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: my-app-canary
spec:
  replicas: 10
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: myapp:v2.0.0

  strategy:
    canary:
      canaryService: my-app-canary    # 카나리 트래픽
      stableService: my-app-stable    # 안정 트래픽
      trafficRouting:
        nginx:
          stableIngress: my-app-ingress
      steps:
      - setWeight: 10        # 10% 트래픽 카나리로
      - pause: {duration: 5m}
      - setWeight: 30
      - pause: {}            # 수동 승인 대기
      - analysis:
          templates:
          - templateName: success-rate
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 100       # 전체 전환
```

---

## 6. AnalysisTemplate

배포 중 메트릭을 자동으로 분석해 성공·실패를 판단한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  args:
  - name: service-name
  metrics:
  - name: success-rate
    interval: 1m           # 1분마다 측정
    count: 5               # 총 5회 측정
    successCondition: result[0] >= 0.95   # 성공 기준: 95% 이상
    failureLimit: 2        # 2회 실패 시 롤백
    provider:
      prometheus:
        address: http://prometheus-server.monitoring.svc
        query: |
          sum(rate(http_requests_total{
            service="{{args.service-name}}",
            status!~"5.."
          }[5m]))
          /
          sum(rate(http_requests_total{
            service="{{args.service-name}}"
          }[5m]))
```

```yaml
# 에러율 분석 (추가 예시)
- name: error-rate
  successCondition: result[0] <= 0.01    # 에러 1% 이하
  provider:
    prometheus:
      query: |
        rate(http_requests_total{
          status=~"5.."
        }[5m])

# P95 레이턴시 분석
- name: latency-p95
  successCondition: result[0] <= 500     # 500ms 이하
  provider:
    prometheus:
      query: |
        histogram_quantile(0.95,
          rate(http_request_duration_seconds_bucket[5m])
        ) * 1000
```

---

## 7. 배포 흐름 (카나리 + 분석)

```
이미지 업데이트
  → 10% 트래픽 카나리 전환
      → 5분 대기
          → 30% 전환
              → 수동 승인
                  → AnalysisRun 시작
                      ├── 성공(95% 이상): 60% → 100% 순차 전환
                      └── 실패(5회 중 2회): 즉시 0%로 롤백
```

---

## 8. ArgoCD 연동

ArgoCD Application과 함께 사용하면
GitOps 방식으로 Rollout을 관리할 수 있다.

```yaml
# ArgoCD가 Rollout 리소스를 정상 상태로 인식하려면
# argo-rollouts-extension 설치 필요
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj-labs/rollout-extension/main/manifests/install.yaml
```

```bash
# 주요 CLI 명령
kubectl argo rollouts list rollouts
kubectl argo rollouts get rollout my-app
kubectl argo rollouts set image my-app app=myapp:v2.0.0
kubectl argo rollouts promote my-app      # 다음 단계 진행
kubectl argo rollouts abort my-app        # 배포 중단
kubectl argo rollouts retry rollout my-app
```

---

## 참고 문서

- [Argo Rollouts 공식 문서](https://argoproj.github.io/argo-rollouts/)
- [AnalysisTemplate](https://argoproj.github.io/argo-rollouts/features/analysis/)
- [트래픽 관리](https://argoproj.github.io/argo-rollouts/features/traffic-management/)
