---
title: "Helm"
date: 2026-04-14
tags:
  - kubernetes
  - helm
  - package-manager
  - chart
sidebar_label: "Helm"
---

# Helm

## 1. 개요

Kubernetes 패키지 매니저.
복잡한 애플리케이션을 Chart로 패키징하고 배포한다.

> Helm 2(Tiller 기반)는 2020년 지원 종료. Helm 3만 사용한다.

---

## 2. Chart 구조

```
mychart/
├── Chart.yaml          # 차트 메타데이터
├── values.yaml         # 기본값
├── values.schema.json  # 값 검증 스키마
├── charts/             # 의존 차트
├── templates/          # 템플릿
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl    # 재사용 헬퍼 함수
│   └── NOTES.txt       # 설치 후 안내 메시지
└── crds/               # CRD 정의
```

```yaml
# Chart.yaml
apiVersion: v2
name: myapp
description: My application chart
type: application
version: 1.0.0
appVersion: "2.0.0"
dependencies:
- name: postgresql
  version: "14.0.0"
  repository: "oci://registry-1.docker.io/bitnamicharts"
```

---

## 3. values.yaml

```yaml
replicaCount: 2

image:
  repository: myapp
  tag: "1.0.0"
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  hosts:
  - host: myapp.example.com
    paths:
    - path: /
      pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
```

---

## 4. 템플릿 문법

### 내장 객체

```yaml
{{ .Release.Name }}        # 릴리즈 이름
{{ .Release.Namespace }}   # 네임스페이스
{{ .Release.IsUpgrade }}   # 업그레이드 여부
{{ .Chart.Name }}          # 차트 이름
{{ .Chart.Version }}       # 차트 버전
{{ .Values.image.tag }}    # values.yaml 값
```

### 함수와 파이프라인

```yaml
{{ .Values.name | upper }}       # 대문자
{{ .Values.name | quote }}       # 따옴표 추가
{{ .Values.port | default 8080 }}  # 기본값
{{ .Values.config | toYaml | nindent 4 }}  # YAML 변환
```

### 조건문

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
...
{{- end }}

{{- if .Values.resources }}
resources:
  {{- toYaml .Values.resources | nindent 10 }}
{{- end }}
```

### 반복문

```yaml
# ConfigMap 생성
data:
  {{- range $key, $value := .Values.config }}
  {{ $key }}: {{ $value | quote }}
  {{- end }}

# 리스트 반복
{{- range .Values.services }}
- name: {{ .name }}
  port: {{ .port }}
{{- end }}
```

### with (스코프 변경)

```yaml
{{- with .Values.podAnnotations }}
annotations:
  {{- toYaml . | nindent 4 }}
{{- end }}
```

---

## 5. Hooks

특정 시점에 Job을 실행한다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-db-migrate
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: myapp:{{ .Chart.AppVersion }}
        command: ["./migrate.sh"]
      restartPolicy: Never
```

| Hook | 실행 시점 |
|------|---------|
| `pre-install` | 리소스 생성 전 |
| `post-install` | 모든 리소스 생성 후 |
| `pre-upgrade` | 업그레이드 전 |
| `post-upgrade` | 업그레이드 후 |
| `pre-delete` | 삭제 전 |

---

## 6. 주요 명령어

```bash
# 레포지토리 관리
helm repo add bitnami \
  oci://registry-1.docker.io/bitnamicharts
helm repo update
helm search repo nginx

# 설치/업그레이드
helm install myapp ./mychart -f values-prod.yaml
helm upgrade myapp ./mychart --set image.tag=2.0.0
helm upgrade --install myapp ./mychart  # 없으면 설치

# dry-run 및 디버그
helm install myapp ./mychart \
  --dry-run --debug

# 상태 확인
helm list -A
helm status myapp
helm get values myapp
helm history myapp

# 롤백
helm rollback myapp 1   # revision 1로 롤백

# 삭제
helm uninstall myapp
```

---

## 7. OCI 레지스트리 (2025 기준 기본값)

Helm 3.8.0+에서 GA. Bitnami는 2025년부터 OCI 레지스트리를 기본으로 사용한다.

```bash
# OCI 레지스트리 로그인
helm registry login ghcr.io -u myuser

# 차트 Push
helm package ./mychart
helm push mychart-1.0.0.tgz oci://ghcr.io/myorg

# OCI에서 설치
helm install myapp \
  oci://ghcr.io/myorg/mychart:1.0.0
```

---

## 8. Helm 2 vs Helm 3

| 항목 | Helm 2 | Helm 3 |
|-----|--------|--------|
| Tiller | 클러스터 내 필수 | 제거됨 |
| 권한 | Tiller 클러스터 관리자 | 사용자 kubeconfig |
| 릴리즈 저장 | kube-system 중앙 | 네임스페이스별 |
| 머지 전략 | 2-way | 3-way strategic merge |
| OCI 지원 | 없음 | GA |

---

## 참고 문서

- [Helm 공식 문서](https://helm.sh/docs/)
- [Helm Hub](https://artifacthub.io/)
- [Chart Best Practices](https://helm.sh/docs/chart_best_practices/)
