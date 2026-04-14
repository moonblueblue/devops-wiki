---
title: "ArgoCD Orphaned Resource 관리"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - kubernetes
sidebar_label: "Orphaned Resource"
---

# ArgoCD Orphaned Resource 관리

## 1. Orphaned Resource란

ArgoCD Application이 관리하는 네임스페이스에
**Git에는 없지만 클러스터에는 존재하는 리소스**.

```
원인:
  - 직접 kubectl apply로 생성한 리소스
  - 삭제된 Application이 남긴 리소스
  - 다른 도구(Helm, Terraform)가 생성한 리소스
```

---

## 2. Orphaned Resource 감지

AppProject에서 설정한다.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: my-project
  namespace: argocd
spec:
  # Orphaned Resource 감지 활성화
  orphanedResources:
    warn: true    # 경고만 (삭제하지 않음)
    # warn: false + ignore 없으면 에러 상태

  # 특정 리소스는 무시 (외부에서 생성한 것이 예상되는 경우)
  orphanedResources:
    warn: true
    ignore:
    - group: ""
      kind: ConfigMap
      name: kube-root-ca.crt   # 시스템 자동 생성
    - group: ""
      kind: ServiceAccount
      name: default            # 네임스페이스 기본 SA
```

---

## 3. Orphaned Resource 경고 상태

```
AppProject에 orphanedResources.warn: true 설정 시:
  → ArgoCD UI에서 해당 앱에 경고 표시
  → health status: Healthy 유지 (경고만)

warn: false 설정 시:
  → Orphaned Resource 발견 시 health: Degraded
  → 앱 동기화 차단 가능
```

---

## 4. 정리 전략

```
1. 확인: argocd app diff my-app
   → Orphaned Resource 목록 확인

2. 원인 파악:
   - 직접 생성한 리소스 → Git에 추가하거나 삭제
   - 오래된 잔재 → kubectl delete로 정리

3. 예방:
   - 모든 리소스는 GitOps 저장소에서만 생성
   - kubectl 직접 변경 금지 정책
```

---

## 5. Resource Exclusion (전역 제외)

특정 리소스 유형을 ArgoCD 관리에서 완전히 제외한다.

```yaml
# argocd-cm ConfigMap
data:
  resource.exclusions: |
    - apiGroups:
      - "*"
      kinds:
      - Event          # 이벤트 리소스 제외
      clusters:
      - "*"
    - apiGroups:
      - cilium.io      # Cilium 내부 리소스 제외
      kinds:
      - CiliumIdentity
      clusters:
      - "*"
```

---

## 6. Resource Inclusions (선택적 관리)

기본적으로 모든 리소스를 관리하지만,
특정 리소스만 관리 대상으로 제한할 수 있다.

```yaml
data:
  resource.inclusions: |
    - apiGroups:
      - ""
      - apps
      - networking.k8s.io
      kinds:
      - "*"
      clusters:
      - "*"
```

---

## 참고 문서

- [ArgoCD Orphaned Resources](https://argo-cd.readthedocs.io/en/stable/user-guide/orphaned-resources/)
- [Resource Exclusion](https://argo-cd.readthedocs.io/en/stable/operator-manual/declarative-setup/#resource-exclusioninclusion)
