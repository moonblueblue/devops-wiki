---
title: "Helm vs Kustomize vs Helm+Kustomize"
date: 2026-04-14
tags:
  - helm
  - kustomize
  - kubernetes
  - gitops
sidebar_label: "Helm vs Kustomize"
---

# Helm vs Kustomize vs Helm+Kustomize

## 1. 핵심 비교

| 항목 | Helm | Kustomize |
|-----|------|-----------|
| 접근 방식 | 템플릿 + values | 패치 오버레이 |
| 패키징 | Chart 단위 배포 | 없음 (YAML 직접 관리) |
| 설치 | 별도 설치 필요 | kubectl 내장 |
| 복잡도 | 높음 (템플릿 언어) | 낮음 |
| 버전 관리 | Chart 버전으로 관리 | Git으로 관리 |
| 외부 Chart 사용 | 쉬움 | 어려움 |
| 환경별 분리 | values 파일 | overlays 디렉토리 |
| GitOps 친화성 | 보통 | 높음 |

---

## 2. Helm을 선택할 때

```
외부 오픈소스 소프트웨어 설치
  예: Prometheus, Nginx Ingress, Cert-Manager
  → helm install 한 줄로 해결

자체 앱을 패키징해서 배포
  → 팀 내 표준화된 Chart로 재사용

복잡한 조건부 로직이 필요
  → {{ if .Values.ingress.enabled }}
```

---

## 3. Kustomize를 선택할 때

```
이미 존재하는 K8s YAML을 환경별로 분리
  → base + overlays 구조로 DRY하게 관리

템플릿 언어 없이 순수 YAML로 유지
  → 학습 비용 없음, 가독성 높음

직접 작성한 앱의 환경별 설정 관리
  → staging: replicas=1, prod: replicas=5
```

---

## 4. Helm + Kustomize 조합

외부 Chart를 Kustomize로 커스터마이징하는 패턴.
Helm이 생성한 매니페스트에 Kustomize 패치를 적용한다.

### 방법 1: helmCharts 필드 (Kustomize 4.1+)

```yaml
# kustomization.yaml
helmCharts:
- name: ingress-nginx
  repo: https://kubernetes.github.io/ingress-nginx
  version: 4.10.0
  releaseName: ingress-nginx
  namespace: ingress-nginx
  valuesFile: values.yaml

patches:
- path: patch-hpa.yaml    # Helm이 생성한 HPA에 패치 적용
```

### 방법 2: helm template + Kustomize

```bash
# Helm 매니페스트 생성
helm template ingress-nginx ingress-nginx/ingress-nginx \
  --values values.yaml \
  --namespace ingress-nginx \
  > base/rendered.yaml

# Kustomize로 패치 적용
kubectl apply -k overlays/production
```

---

## 5. GitOps에서의 선택 기준

```
ArgoCD / Flux를 사용하는 경우:

외부 오픈소스 (Prometheus, Argo, etc.)
  → Helm Chart 소스 직접 지정
  → values.yaml로 설정 관리

내부 앱
  → Kustomize 권장
  → base + overlays로 환경 분리
  → 변경 추적이 명확

복잡한 내부 앱
  → Helm Chart + Kustomize 패치 조합
  → 또는 Helm Chart만으로 관리
```

---

## 6. 실무 권장 패턴

| 케이스 | 권장 도구 |
|--------|---------|
| 클러스터 인프라 (모니터링, 보안) | Helm |
| 팀 내 앱 표준화 패키징 | Helm |
| 기존 K8s YAML 환경별 분리 | Kustomize |
| ArgoCD/Flux GitOps 저장소 | Kustomize (또는 Helm) |
| 외부 Chart 미세 조정 | Helm + Kustomize 조합 |

---

## 참고 문서

- [Helm 공식 문서](https://helm.sh/docs/)
- [Kustomize 공식 문서](https://kustomize.io/)
- [ArgoCD Helm+Kustomize](https://argo-cd.readthedocs.io/en/stable/user-guide/kustomize/#kustomizing-helm-charts)
