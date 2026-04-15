---
title: "Kustomize"
date: 2026-04-14
tags:
  - kubernetes
  - kustomize
  - gitops
  - configuration
sidebar_label: "Kustomize"
---

# Kustomize

## 1. 개요

템플릿 없이 Kubernetes 매니페스트를 환경별로 관리하는 도구.
`kubectl apply -k`로 내장 지원된다.

```
base/          ← 공통 리소스
overlays/
  dev/         ← base + 개발 환경 변경사항
  staging/     ← base + 스테이징 환경 변경사항
  production/  ← base + 운영 환경 변경사항
```

---

## 2. 기본 구조

```
project/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    └── production/
        ├── kustomization.yaml
        └── patch-replicas.yaml
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml
```

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

namePrefix: prod-
nameSuffix: -v1

commonLabels:
  env: production
  team: platform

replicas:
- name: myapp
  count: 3
```

---

## 3. 패치 방식

### Strategic Merge Patch

변경할 필드만 작성한다. 나머지는 base에서 유지된다.

```yaml
# overlays/production/patch-resources.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          limits:
            memory: "1Gi"
            cpu: "500m"
```

```yaml
# kustomization.yaml에 패치 등록
patches:
- path: patch-resources.yaml
```

### JSON6902 Patch

경로 기반으로 정밀하게 조작한다.

```yaml
patches:
- target:
    group: apps
    version: v1
    kind: Deployment
    name: myapp
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 5
    - op: add
      path: /spec/template/spec/containers/0/env/-
      value:
        name: LOG_LEVEL
        value: DEBUG
    - op: remove
      path: /spec/template/spec/containers/0/livenessProbe
```

| op | 동작 |
|----|------|
| `replace` | 값 교체 |
| `add` | 값 추가 |
| `remove` | 필드 제거 |
| `copy` / `move` | 복사/이동 |

---

## 4. ConfigMap / Secret 생성

파일이나 리터럴에서 자동 생성한다.
변경 시 이름에 해시가 붙어 Pod 롤링 업데이트를 자동으로 트리거한다.

```yaml
configMapGenerator:
- name: app-config
  files:
  - config.properties
  literals:
  - ENVIRONMENT=production
  - DEBUG=false

secretGenerator:
- name: db-credentials
  files:
  - username.txt
  - password.txt
  type: Opaque
```

```
# 생성 결과 (해시 자동 추가)
app-config-g8hc9f7b2m
```

---

## 5. 변환 옵션

```yaml
# 이름 접두사/접미사
namePrefix: prod-
nameSuffix: -v2

# 공통 라벨 (selector에도 적용)
commonLabels:
  app: myapp
  env: production

# 공통 어노테이션
commonAnnotations:
  team: platform

# 이미지 태그 변경
images:
- name: myapp
  newTag: v2.0.0
- name: nginx
  newName: nginx
  newTag: "1.25"
```

---

## 6. 명령어

```bash
# 렌더링만 확인 (적용 안 함)
kubectl kustomize overlays/production

# 적용
kubectl apply -k overlays/production

# 삭제
kubectl delete -k overlays/production

# diff 확인
kubectl diff -k overlays/production
```

---

## 참고 문서

- [Kustomize 공식 문서](https://kustomize.io/)
- [Declarative Management](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/)
