---
title: "OPA / Gatekeeper"
date: 2026-04-14
tags:
  - opa
  - gatekeeper
  - policy
  - kubernetes
sidebar_label: "OPA·Gatekeeper"
---

# OPA / Gatekeeper

## 1. 개요

```
OPA (Open Policy Agent):
  범용 정책 엔진. Rego 언어로 정책 작성.
  Kubernetes, Terraform, API Gateway 등 다양한 통합.

Gatekeeper:
  OPA를 K8s Admission Controller로 구현.
  CRD 기반으로 정책을 K8s 오브젝트처럼 관리.
```

---

## 2. Gatekeeper 아키텍처

```
kubectl apply →
  API Server →
    Admission Webhook →
      Gatekeeper →
        ConstraintTemplate (Rego 로직) +
        Constraint (정책 파라미터) →
          허용 / 거부
```

---

## 3. Gatekeeper 설치

```bash
kubectl apply -f \
  https://raw.githubusercontent.com/open-policy-agent/gatekeeper/v3.17.0/deploy/gatekeeper.yaml

# 확인
kubectl get pods -n gatekeeper-system
```

---

## 4. ConstraintTemplate 작성

```yaml
# 레지스트리 제한 정책 템플릿
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedrepos
spec:
  crd:
    spec:
      names:
        kind: K8sAllowedRepos
      validation:
        openAPIV3Schema:
          type: object
          properties:
            repos:
              type: array
              items:
                type: string

  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8sallowedrepos

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not starts_with_allowed(container.image)
        msg := sprintf("이미지 레지스트리 불허: %v", [container.image])
      }

      starts_with_allowed(image) {
        repo := input.parameters.repos[_]
        startswith(image, repo)
      }
```

---

## 5. Constraint 적용

```yaml
# 정책 파라미터 적용
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: allowed-repos
spec:
  enforcementAction: deny    # warn / deny / dryrun
  match:
    kinds:
    - apiGroups: [""]
      kinds: [Pod]
    namespaces: [production]
  parameters:
    repos:
    - "ghcr.io/myorg/"
    - "registry.k8s.io/"
```

---

## 6. 자주 쓰는 정책

### 리소스 요청 필수

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredresources
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredResources
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredresources

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.requests.cpu
        msg := sprintf("%v: CPU request 필수", [container.name])
      }

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        not container.resources.limits.memory
        msg := sprintf("%v: memory limit 필수", [container.name])
      }
```

### 특권 컨테이너 차단

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8snoprivilegedcontainer
spec:
  crd:
    spec:
      names:
        kind: K8sNoPrivilegedContainer
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8snoprivilegedcontainer

      violation[{"msg": msg}] {
        container := input.review.object.spec.containers[_]
        container.securityContext.privileged == true
        msg := sprintf("특권 컨테이너 불허: %v", [container.name])
      }
```

---

## 7. Gatekeeper Library

CNCF가 관리하는 공식 정책 라이브러리.

```bash
# 라이브러리에서 정책 적용
kubectl apply -f \
  https://raw.githubusercontent.com/open-policy-agent/gatekeeper-library/master/library/general/allowedrepos/template.yaml
```

---

## 8. 감사 모드 (Audit)

```bash
# 기존 리소스에 정책 위반 여부 확인
kubectl get constraint allowed-repos -o yaml

# .status.violations 필드 확인
kubectl get k8sallowedrepos allowed-repos \
  -o jsonpath='{.status.violations}' | jq
```

---

## 참고 문서

- [OPA 공식 문서](https://www.openpolicyagent.org/docs/)
- [Gatekeeper](https://open-policy-agent.github.io/gatekeeper/website/docs/)
- [Gatekeeper Library](https://github.com/open-policy-agent/gatekeeper-library)
