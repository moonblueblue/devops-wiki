---
title: "RBAC과 ABAC"
date: 2026-04-14
tags:
  - rbac
  - abac
  - security
  - authorization
sidebar_label: "RBAC·ABAC"
---

# RBAC과 ABAC

## 1. RBAC (Role-Based Access Control)

**역할(Role)** 기반으로 권한을 부여한다.
사용자 → 역할 → 권한 계층 구조.

```
사용자 홍길동 → 역할: developer → 권한: read, write (dev 네임스페이스)
사용자 김운영 → 역할: ops → 권한: read, write (모든 네임스페이스)
```

---

## 2. Kubernetes RBAC

```yaml
# Role: 네임스페이스 수준 권한
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "update"]

# ClusterRole: 클러스터 전체 권한
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: secret-reader
rules:
- apiGroups: [""]
  resources: ["secrets"]
  verbs: ["get", "list"]
```

```yaml
# RoleBinding: 사용자/그룹/SA에 Role 연결
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: developer-binding
  namespace: development
subjects:
- kind: User
  name: hong@company.com
  apiGroup: rbac.authorization.k8s.io
- kind: Group
  name: developers
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

---

## 3. RBAC 설계 패턴

### 팀 기반 분리

```
역할 계층:
  cluster-admin    → 클러스터 전체 관리
  namespace-admin  → 특정 네임스페이스 전체
  developer        → 앱 배포·확인
  viewer           → 읽기 전용

네임스페이스 기반:
  dev-*    → 개발팀 자유 사용
  staging  → ops팀 관리
  prod     → admin + 자동화만
```

---

## 4. ABAC (Attribute-Based Access Control)

**속성(Attribute)** 기반으로 권한을 부여한다.
RBAC보다 세밀하지만 복잡하다.

```
정책 예시:
  IF 사용자.부서 = "결제팀"
  AND 리소스.환경 = "production"
  AND 요청.시간 = 업무시간
  AND 사용자.MFA = 인증됨
  THEN 허용
```

---

## 5. RBAC vs ABAC 비교

| 항목 | RBAC | ABAC |
|-----|------|------|
| 기반 | 역할 | 속성 |
| 복잡도 | 낮음 | 높음 |
| 세밀도 | 보통 | 매우 세밀 |
| 관리 | 역할 수 증가 문제 | 정책 복잡도 증가 |
| 적합 케이스 | 대부분의 경우 | 복잡한 컨텍스트 기반 정책 |

---

## 6. OPA/Kyverno를 활용한 고급 정책

Kubernetes RBAC만으로 부족한 경우 OPA/Kyverno를 사용한다.

```rego
# OPA Rego - ABAC 예시
# 업무시간에만 프로덕션 삭제 허용
package kubernetes.admission

deny[msg] {
  input.request.operation == "DELETE"
  input.request.namespace == "production"
  not is_business_hours
  msg := "프로덕션 리소스는 업무시간에만 삭제 가능"
}

is_business_hours {
  hour := time.now_ns() / 1e9 / 3600 % 24
  hour >= 9
  hour < 18
}
```

---

## 7. RBAC 감사

```bash
# 사용자/SA의 실제 권한 확인
kubectl auth can-i create pods --namespace production
kubectl auth can-i --list --namespace production

# 특정 사용자로 시뮬레이션
kubectl auth can-i delete secrets --as user@company.com --namespace production

# RBAC 분석 도구
# rakkess: 모든 리소스 접근 권한 매트릭스
# rbac-lookup: 역할별 사용자 목록
kubectl rakkess --namespace production
```

---

## 참고 문서

- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [RBAC Best Practices](https://kubernetes.io/docs/concepts/security/rbac-good-practices/)
