---
title: "Kyverno"
date: 2026-04-14
tags:
  - kyverno
  - policy
  - kubernetes
  - security
sidebar_label: "Kyverno"
---

# Kyverno

## 1. 개요

CNCF Graduated 프로젝트.
Kubernetes 전용 정책 엔진.
Rego 없이 YAML로 정책을 작성한다.

```
OPA/Gatekeeper:  Rego 언어 학습 필요
Kyverno:         YAML만으로 정책 작성 가능
```

---

## 2. 설치

```bash
helm repo add kyverno https://kyverno.github.io/kyverno/
helm install kyverno kyverno/kyverno \
  -n kyverno --create-namespace \
  --set replicaCount=3    # HA 구성

# 정책 라이브러리
helm install kyverno-policies kyverno/kyverno-policies \
  -n kyverno \
  --set podSecurityStandard=restricted
```

---

## 3. 정책 종류

| 종류 | 설명 |
|------|------|
| `validate` | 리소스 검증, 위반 시 거부 |
| `mutate` | 리소스 자동 수정/보완 |
| `generate` | 리소스 자동 생성 |
| `verifyImages` | 이미지 서명 검증 |

---

## 4. Validate 정책

```yaml
# 이미지 latest 태그 금지
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-latest-tag
spec:
  validationFailureAction: Enforce
  background: true
  rules:
  - name: no-latest-tag
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      message: "latest 태그 사용 금지 — 고정 버전 사용"
      pattern:
        spec:
          containers:
          - image: "!*:latest"
```

---

## 5. Mutate 정책

```yaml
# 리소스 요청이 없으면 기본값 자동 설정
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-resources
spec:
  rules:
  - name: add-resources
    match:
      any:
      - resources:
          kinds: [Pod]
    mutate:
      patchStrategicMerge:
        spec:
          containers:
          - (name): "*"
            resources:
              +(requests):
                cpu: "100m"
                memory: "128Mi"
              +(limits):
                memory: "256Mi"
```

---

## 6. Generate 정책

```yaml
# 네임스페이스 생성 시 NetworkPolicy 자동 생성
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-network-policy
spec:
  rules:
  - name: default-deny
    match:
      any:
      - resources:
          kinds: [Namespace]
    generate:
      apiVersion: networking.k8s.io/v1
      kind: NetworkPolicy
      name: default-deny-ingress
      namespace: "{{request.object.metadata.name}}"
      synchronize: true    # 소스 변경 시 동기화
      data:
        spec:
          podSelector: {}
          policyTypes:
          - Ingress
```

---

## 7. verifyImages 정책

```yaml
# Cosign 서명 검증
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-signed-images
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-signature
    match:
      any:
      - resources:
          kinds: [Pod]
          namespaces: [production]
    verifyImages:
    - imageReferences:
      - "ghcr.io/myorg/*"
      attestors:
      - entries:
        - keyless:
            subject: "https://github.com/myorg/*"
            issuer: "https://token.actions.githubusercontent.com"
            rekor:
              url: https://rekor.sigstore.dev
```

---

## 8. 정책 결과 확인

```bash
# 정책 목록
kubectl get clusterpolicy

# 정책 위반 리포트 (background scan)
kubectl get policyreport -A
kubectl get clusterpolicyreport

# 특정 리포트 상세
kubectl describe policyreport \
  polr-ns-production -n production
```

---

## 9. 예외 처리

```yaml
# 특정 ServiceAccount 예외
spec:
  rules:
  - name: no-latest-tag
    exclude:
      any:
      - resources:
          kinds: [Pod]
          namespaces: [kube-system]
      - subjects:
        - kind: ServiceAccount
          name: system-deployer
```

---

## 참고 문서

- [Kyverno 공식 문서](https://kyverno.io/docs/)
- [Kyverno Policies 라이브러리](https://kyverno.io/policies/)
- [Kyverno GitHub](https://github.com/kyverno/kyverno)
