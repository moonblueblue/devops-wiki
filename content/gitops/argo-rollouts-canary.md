---
title: "Argo Rollouts Canary 배포 실습"
date: 2026-04-14
tags:
  - argo-rollouts
  - canary
  - gitops
  - deployment
sidebar_label: "Canary 실습"
---

# Argo Rollouts Canary 배포 실습

## 1. Canary 개념

새 버전에 트래픽을 **점진적으로** 전환한다.
문제가 생기면 전체 전환 전에 차단할 수 있다.

```
v1 (stable) 90% → 70% → 40% → 0%
v2 (canary)  10% → 30% → 60% → 100%
```

---

## 2. 기본 Canary Rollout

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
        image: myapp:v1.0.0

  strategy:
    canary:
      canaryService: my-app-canary    # 카나리 트래픽용
      stableService: my-app-stable    # 안정 트래픽용
      trafficRouting:
        nginx:
          stableIngress: my-app-ingress   # Nginx Ingress 사용
      steps:
      - setWeight: 10         # 10% 카나리로
      - pause: {duration: 5m} # 5분 대기
      - setWeight: 30
      - pause: {}             # 수동 승인 대기
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 100        # 전체 전환
```

---

## 3. Nginx Ingress 트래픽 분할

```yaml
# Ingress (stable 트래픽 기준)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/canary: "false"
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: my-app-stable
            port:
              number: 80
```

Argo Rollouts가 자동으로 카나리 Ingress를 생성하고
`nginx.ingress.kubernetes.io/canary-weight` 어노테이션으로 가중치를 조정한다.

---

## 4. Istio 트래픽 분할

```yaml
strategy:
  canary:
    canaryService: my-app-canary
    stableService: my-app-stable
    trafficRouting:
      istio:
        virtualService:
          name: my-app-vsvc
          routes:
          - primary
```

```yaml
# VirtualService
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: my-app-vsvc
spec:
  hosts:
  - my-app-stable
  http:
  - name: primary
    route:
    - destination:
        host: my-app-stable
      weight: 100
    - destination:
        host: my-app-canary
      weight: 0
```

---

## 5. Header 기반 카나리 (특정 사용자만)

```yaml
strategy:
  canary:
    canaryService: my-app-canary
    stableService: my-app-stable
    trafficRouting:
      nginx:
        stableIngress: my-app-ingress
        additionalIngressAnnotations:
          # X-Canary: true 헤더가 있는 요청만 카나리로
          nginx.ingress.kubernetes.io/canary-by-header: X-Canary
          nginx.ingress.kubernetes.io/canary-by-header-value: "true"
```

---

## 6. 배포 진행 흐름

```bash
# 1. 새 이미지 배포
kubectl argo rollouts set image my-app-canary \
  app=myapp:v2.0.0

# 2. 단계별 진행 모니터링
kubectl argo rollouts get rollout my-app-canary --watch

# 3. 수동 승인 대기 시 승격
kubectl argo rollouts promote my-app-canary

# 4. 배포 중단 및 롤백
kubectl argo rollouts abort my-app-canary

# 5. 완전 롤백 (stable로 되돌리기)
kubectl argo rollouts undo my-app-canary
```

---

## 참고 문서

- [Canary 배포](https://argoproj.github.io/argo-rollouts/features/canary/)
- [Nginx Ingress 연동](https://argoproj.github.io/argo-rollouts/features/traffic-management/nginx/)
- [Istio 연동](https://argoproj.github.io/argo-rollouts/features/traffic-management/istio/)
