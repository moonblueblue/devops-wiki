---
title: "Kustomize 기본과 활용"
date: 2026-04-14
tags:
  - kustomize
  - kubernetes
  - gitops
sidebar_label: "Kustomize"
---

# Kustomize 기본과 활용

## 1. Kustomize 개요

템플릿 없이 Kubernetes YAML을 환경별로 커스터마이징하는 도구.
`kubectl`에 내장되어 있어 별도 설치가 불필요하다.

```
base/           # 공통 매니페스트
overlays/       # 환경별 커스터마이징
  staging/
  production/
```

---

## 2. Base 구조

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
- configmap.yaml

commonLabels:
  app: my-app
```

```yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: app
        image: ghcr.io/myorg/my-app:latest
```

---

## 3. Overlay (환경별 커스터마이징)

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
- ../../base

# 네임 접두사 추가
namePrefix: prod-

# 공통 레이블/어노테이션 추가
commonLabels:
  env: production

# 이미지 태그 오버라이드
images:
- name: ghcr.io/myorg/my-app
  newTag: v1.5.0

# 패치 적용
patches:
- path: patch-replicas.yaml
- path: patch-resources.yaml
```

```yaml
# overlays/production/patch-replicas.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app    # base의 Deployment 이름
spec:
  replicas: 5     # 프로덕션은 5 replicas
```

---

## 4. 패치 종류

### Strategic Merge Patch

```yaml
# 기존 필드 병합 방식
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          limits:
            memory: 1Gi
```

### JSON Patch

```yaml
patches:
- target:
    kind: Deployment
    name: my-app
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 3
    - op: add
      path: /spec/template/spec/containers/0/env/-
      value:
        name: ENV_NAME
        value: production
```

---

## 5. ConfigMap / Secret 생성

```yaml
# kustomization.yaml
configMapGenerator:
- name: app-config
  literals:
  - LOG_LEVEL=info
  - DB_HOST=postgres.production.svc
  files:
  - application.properties

secretGenerator:
- name: db-credentials
  literals:
  - DB_PASSWORD=mysecret
  options:
    disableNameSuffixHash: true   # 고정 이름 사용
```

---

## 6. Component (재사용 가능한 패치)

여러 overlay에서 공통으로 사용하는 패치를 컴포넌트로 추출한다.

```yaml
# components/monitoring/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component

patches:
- path: add-prometheus-annotations.yaml
```

```yaml
# overlays/production/kustomization.yaml
components:
- ../../components/monitoring
- ../../components/security
```

---

## 7. 적용 명령어

```bash
# 결과 미리 보기 (적용 안 함)
kubectl kustomize overlays/production

# 적용
kubectl apply -k overlays/production

# 삭제
kubectl delete -k overlays/production

# 독립 실행 (kubectl 없이)
kustomize build overlays/production | kubectl apply -f -
```

---

## 참고 문서

- [Kustomize 공식 문서](https://kustomize.io/)
- [Kustomize 레퍼런스](https://kubectl.docs.kubernetes.io/references/kustomize/)
