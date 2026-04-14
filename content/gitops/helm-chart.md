---
title: "Helm Chart 작성과 관리"
date: 2026-04-14
tags:
  - helm
  - kubernetes
  - gitops
sidebar_label: "Helm Chart"
---

# Helm Chart 작성과 관리

## 1. Helm 개요

Kubernetes 애플리케이션을 패키징하는 도구.
재사용 가능한 템플릿으로 복잡한 배포를 단순화한다.

```
Chart.yaml       # 메타데이터
values.yaml      # 기본 설정값
templates/       # K8s 매니페스트 템플릿
  deployment.yaml
  service.yaml
  ingress.yaml
  _helpers.tpl   # 재사용 가능한 헬퍼 함수
```

---

## 2. Chart 구조 생성

```bash
# 기본 Chart 스캐폴딩
helm create my-app

# 생성된 구조
my-app/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   └── _helpers.tpl
└── charts/           # 서브차트
```

---

## 3. Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: My Application Helm Chart
type: application   # application 또는 library
version: 1.2.3      # Chart 버전 (SemVer)
appVersion: "2.0.0" # 배포되는 앱 버전

# 의존성 차트
dependencies:
- name: postgresql
  version: "12.x.x"
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled
```

---

## 4. values.yaml

```yaml
# 기본 설정값
replicaCount: 1

image:
  repository: ghcr.io/myorg/my-app
  pullPolicy: IfNotPresent
  tag: ""            # Chart.yaml의 appVersion 사용

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  hosts:
  - host: my-app.example.com
    paths:
    - path: /
      pathType: Prefix

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

postgresql:
  enabled: true
  auth:
    database: myapp
```

---

## 5. 템플릿 작성

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "my-app.fullname" . }}
  labels:
    {{- include "my-app.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "my-app.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "my-app.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:
          {{- .Values.image.tag | default .Chart.AppVersion }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: 8080
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
```

---

## 6. 배포 명령어

```bash
# 저장소 추가
helm repo add myrepo https://charts.example.com
helm repo update

# 설치
helm install my-app myrepo/my-app \
  --namespace production \
  --create-namespace \
  --values values-prod.yaml \
  --set image.tag=v1.5.0

# 업그레이드
helm upgrade my-app myrepo/my-app \
  --namespace production \
  --set image.tag=v1.6.0

# 설치 or 업그레이드 (idempotent)
helm upgrade --install my-app myrepo/my-app \
  --namespace production \
  --create-namespace

# 롤백
helm rollback my-app 1 -n production

# 삭제
helm uninstall my-app -n production
```

---

## 7. Chart 저장소 (OCI 레지스트리)

```bash
# OCI 레지스트리에 Chart 푸시 (Helm 3.8+)
helm package my-app
helm push my-app-1.2.3.tgz oci://ghcr.io/myorg/charts

# OCI 레지스트리에서 설치
helm install my-app \
  oci://ghcr.io/myorg/charts/my-app \
  --version 1.2.3
```

---

## 참고 문서

- [Helm 공식 문서](https://helm.sh/docs/)
- [Chart Best Practices](https://helm.sh/docs/chart_best_practices/)
- [Helm Hub](https://artifacthub.io/)
