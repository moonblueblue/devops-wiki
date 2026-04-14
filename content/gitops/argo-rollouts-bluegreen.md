---
title: "Argo Rollouts Blue/Green 배포 실습"
date: 2026-04-14
tags:
  - argo-rollouts
  - blue-green
  - gitops
  - deployment
sidebar_label: "Blue/Green 실습"
---

# Argo Rollouts Blue/Green 배포 실습

## 1. Blue/Green 개념

```
Active (Blue)  → 현재 트래픽 100%
Preview (Green) → 새 버전 미리보기 (트래픽 없음)

검증 완료 후:
  Preview → Active 전환 (순간 전환)
  이전 Active → 대기 (rollback 준비)
```

기존 버전과 새 버전이 **동시에 운영**되어 즉시 롤백이 가능하다.

---

## 2. Rollout 정의

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
        image: myapp:v1.0.0
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
      # Preview 레플리카 수 (검증용)
      previewReplicaCount: 2
      # 승격 후 Blue 파드 유지 시간 (롤백 대비)
      scaleDownDelaySeconds: 30
```

---

## 3. Service 2개 설정

```yaml
# Active 서비스 (라이브 트래픽)
apiVersion: v1
kind: Service
metadata:
  name: my-app-active
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 8080
---
# Preview 서비스 (테스트 트래픽)
apiVersion: v1
kind: Service
metadata:
  name: my-app-preview
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 8080
```

---

## 4. 배포 흐름

```bash
# 1. 새 이미지로 업데이트 (배포 시작)
kubectl argo rollouts set image my-app \
  app=myapp:v2.0.0

# 2. Green 파드 준비 대기
kubectl argo rollouts get rollout my-app --watch
# Status: Paused (autoPromotionEnabled: false)

# 3. Preview 서비스로 검증
# curl http://my-app-preview/health

# 4. 검증 완료 → 승격 (Green → Active)
kubectl argo rollouts promote my-app

# 5. 결과: Active 트래픽이 새 버전으로 전환
```

---

## 5. 자동 승격 (autoPromotionEnabled: true)

```yaml
strategy:
  blueGreen:
    activeService: my-app-active
    previewService: my-app-preview
    autoPromotionEnabled: true
    # 자동 승격 대기 시간 (준비 후 N초 뒤 자동 전환)
    autoPromotionSeconds: 30
```

---

## 6. Pre/Post Promotion Hook

승격 전후에 분석 또는 작업을 실행한다.

```yaml
strategy:
  blueGreen:
    activeService: my-app-active
    previewService: my-app-preview
    autoPromotionEnabled: false
    # 승격 전 자동 분석
    prePromotionAnalysis:
      templates:
      - templateName: success-rate
      args:
      - name: service-name
        value: my-app-preview
    # 승격 후 자동 분석
    postPromotionAnalysis:
      templates:
      - templateName: success-rate
      args:
      - name: service-name
        value: my-app-active
```

---

## 7. 롤백

```bash
# 즉시 롤백 (Active → 이전 Blue 버전)
kubectl argo rollouts undo my-app

# 특정 버전으로 롤백
kubectl argo rollouts undo my-app --to-revision=2
```

---

## 참고 문서

- [Blue/Green 배포](https://argoproj.github.io/argo-rollouts/features/bluegreen/)
- [Pre/Post Promotion Analysis](https://argoproj.github.io/argo-rollouts/features/analysis/)
