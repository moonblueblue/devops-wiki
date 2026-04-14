---
title: "Policy as Code"
date: 2026-04-14
tags:
  - policy-as-code
  - opa
  - kyverno
  - security
sidebar_label: "Policy as Code"
---

# Policy as Code

## 1. 개념

인프라·보안 정책을 코드로 관리한다.

```
기존 방식:
  문서, 위키, 구두 전달 → 사람이 수동 적용
  → 불일관성, 감사 불가

Policy as Code:
  정책을 코드로 작성 → Git에서 버전 관리
  → 자동 검증, 감사 추적 가능
```

---

## 2. 적용 계층

```
개발 단계:
  IDE 플러그인, Pre-commit Hook
  → 이른 피드백, 로컬에서 문제 발견

CI 단계:
  PR에서 정책 위반 자동 차단
  → 머지 전 강제 검증

배포 단계:
  Admission Controller (Gatekeeper/Kyverno)
  → 클러스터에 실제 적용

런타임:
  Falco, OPA 런타임 검사
  → 배포 후 지속 감시
```

---

## 3. Terraform 정책 (OPA + Conftest)

IaC 코드 배포 전 정책 검사.

```bash
# conftest 설치
brew install conftest

# terraform plan을 JSON으로 추출
terraform plan -out=tfplan
terraform show -json tfplan > tfplan.json

# 정책 검사
conftest test tfplan.json
```

```rego
# policy/terraform.rego
package main

# S3 버킷 공개 접근 금지
deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket"
  resource.change.after.acl == "public-read"
  msg := sprintf(
    "S3 버킷 공개 접근 금지: %v",
    [resource.address]
  )
}

# 암호화 필수
deny[msg] {
  resource := input.resource_changes[_]
  resource.type == "aws_s3_bucket"
  not resource.change.after.server_side_encryption_configuration
  msg := sprintf(
    "S3 암호화 필수: %v",
    [resource.address]
  )
}
```

---

## 4. Kubernetes 매니페스트 검사 (CI)

```yaml
# GitHub Actions: PR에서 정책 위반 차단
name: Policy Check

on: [pull_request]

jobs:
  policy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Kyverno CLI로 정책 검사
      uses: kyverno/action-install-cli@v0.2.0

    - name: 정책 적용 테스트
      run: |
        kyverno apply \
          ./policies/ \
          --resource ./k8s/ \
          --detailed-results

    - name: Conftest로 OPA 정책 검사
      run: |
        conftest test ./k8s/ \
          --policy ./opa-policies/ \
          --all-namespaces
```

---

## 5. Helm Chart 정책 검사

```bash
# helm template으로 렌더링 후 검사
helm template my-release ./my-chart | \
  kyverno apply ./policies/ --stdin

# 또는 conftest
helm template my-release ./my-chart | \
  conftest test -
```

---

## 6. 정책 계층 구조

```yaml
# 조직 전체 기본 정책 (ClusterPolicy)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: baseline-security
  annotations:
    policies.kyverno.io/category: "Baseline"
spec:
  validationFailureAction: Audit
  rules:
  - name: no-privilege-escalation
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      pattern:
        spec:
          containers:
          - securityContext:
              allowPrivilegeEscalation: false

---
# 프로덕션 강화 정책 (네임스페이스별)
apiVersion: kyverno.io/v1
kind: Policy
metadata:
  name: production-hardening
  namespace: production
spec:
  validationFailureAction: Enforce
  rules:
  - name: require-non-root
    match:
      any:
      - resources:
          kinds: [Pod]
    validate:
      pattern:
        spec:
          securityContext:
            runAsNonRoot: true
```

---

## 7. 정책 테스트

```yaml
# Kyverno 정책 유닛 테스트
# kyverno-test.yaml
name: disallow-latest-tag
policies:
- disallow-latest-tag.yaml
resources:
- test-pod.yaml
results:
- policy: disallow-latest-tag
  rule: no-latest-tag
  resource: test-pod
  kind: Pod
  result: fail    # 예상 결과
```

```bash
# 테스트 실행
kyverno test .
```

---

## 8. 정책 거버넌스 흐름

```
1. 정책 초안 → Git PR
2. CI에서 정책 유닛 테스트
3. 스테이징 클러스터에 Audit 모드 적용
4. 위반 리포트 검토 (2주)
5. 프로덕션에 Enforce 모드 전환
6. 지속적 위반 모니터링
```

---

## 참고 문서

- [Conftest](https://www.conftest.dev/)
- [Kyverno CLI](https://kyverno.io/docs/kyverno-cli/)
- [OPA 정책 테스트](https://www.openpolicyagent.org/docs/latest/policy-testing/)
