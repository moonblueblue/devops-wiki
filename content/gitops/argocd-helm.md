---
title: "ArgoCD + Helm 기반 배포"
date: 2026-04-14
tags:
  - argocd
  - helm
  - gitops
sidebar_label: "ArgoCD Helm"
---

# ArgoCD + Helm 기반 배포

## 1. Helm Chart 소스

ArgoCD는 Helm을 기본으로 지원한다.
Helm 레지스트리 또는 Git 저장소의 Chart를 직접 소스로 사용할 수 있다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: prometheus
  namespace: argocd
spec:
  source:
    # Helm 레지스트리에서 Chart 직접 사용
    repoURL: https://prometheus-community.github.io/helm-charts
    chart: kube-prometheus-stack
    targetRevision: 65.1.1    # Chart 버전 고정 권장

    helm:
      releaseName: prometheus
      values: |
        grafana:
          enabled: true
          adminPassword: mysecretpassword
        prometheus:
          prometheusSpec:
            retention: 30d
      # 별도 values 파일 참조
      valueFiles:
      - values-prod.yaml

  destination:
    server: https://kubernetes.default.svc
    namespace: monitoring
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

---

## 2. Git 저장소 내 Chart 사용

```yaml
spec:
  source:
    repoURL: https://github.com/myorg/charts.git
    path: charts/my-application    # Chart 디렉토리
    targetRevision: main
    helm:
      releaseName: my-app
      valueFiles:
      - values.yaml
      - values-prod.yaml           # Git에서 환경별 values
```

---

## 3. 멀티 소스 (Chart + Values 분리)

Chart와 Values를 다른 저장소에 분리할 수 있다. (ArgoCD 2.6+)

```yaml
spec:
  sources:
  # Chart 저장소
  - repoURL: https://charts.mycompany.com
    chart: my-application
    targetRevision: 1.5.0
    helm:
      valueFiles:
      - $values/environments/production/values.yaml

  # Values 저장소 (별도 Git 저장소)
  - repoURL: https://github.com/myorg/gitops-values.git
    targetRevision: main
    ref: values     # 위 $values 참조 변수
```

---

## 4. values.yaml 환경별 오버라이드

```
gitops/
├── charts/
│   └── my-app/         # Chart
└── environments/
    ├── staging/
    │   └── values.yaml # 스테이징 values
    └── production/
        └── values.yaml # 프로덕션 values
```

```yaml
# environments/production/values.yaml
replicaCount: 3
resources:
  requests:
    memory: 512Mi
    cpu: 200m
  limits:
    memory: 1Gi
    cpu: 500m
ingress:
  host: api.example.com
  tls: true
```

---

## 5. Helm Release 관리 주의사항

| 항목 | 내용 |
|-----|------|
| `helm upgrade` 직접 실행 | 금지 - ArgoCD가 Override함 |
| values 변경 방법 | Git 커밋으로만 |
| Chart 버전 업 | `targetRevision` 변경 커밋 |
| Secret in values | Sealed Secrets 또는 Vault 사용 |

---

## 참고 문서

- [ArgoCD Helm](https://argo-cd.readthedocs.io/en/stable/user-guide/helm/)
- [ArgoCD Multiple Sources](https://argo-cd.readthedocs.io/en/stable/user-guide/multiple_sources/)
