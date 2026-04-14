---
title: "ArgoCD RBAC과 SSO 연동"
date: 2026-04-14
tags:
  - argocd
  - rbac
  - sso
  - security
sidebar_label: "RBAC·SSO"
---

# ArgoCD RBAC과 SSO 연동

## 1. RBAC 구조

ArgoCD RBAC은 **Casbin** 정책 엔진 기반이다.
역할(role)을 정의하고, 사용자/그룹을 역할에 매핑한다.

```
사용자/그룹 → 역할 매핑 (g 규칙)
역할 → 권한 정의 (p 규칙)
```

---

## 2. RBAC 설정 (argocd-rbac-cm)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-rbac-cm
  namespace: argocd
data:
  # 기본 정책: 로그인 사용자에게 읽기 권한
  policy.default: role:readonly

  policy.csv: |
    # 역할 권한 정의
    # p, <역할>, <리소스>, <액션>, <프로젝트/앱>, allow|deny
    p, role:developer, applications, get,    */*, allow
    p, role:developer, applications, sync,   dev-*/*, allow
    p, role:developer, applications, create, dev-*/*, allow
    p, role:developer, logs,         get,    dev-*/*, allow

    p, role:ops, applications, *,  staging-*/*, allow
    p, role:ops, applications, get, */*, allow

    p, role:admin, applications, *, */*, allow
    p, role:admin, clusters,      *, *, allow
    p, role:admin, repositories,  *, *, allow

    # 그룹 매핑 (SSO OIDC 그룹 → ArgoCD 역할)
    g, devops-team,    role:admin
    g, backend-devs,   role:developer
    g, frontend-devs,  role:developer
    g, readonly-users, role:readonly
```

---

## 3. SSO 연동 (OIDC)

### Dex (내장 IdP)

ArgoCD에는 Dex가 내장되어 있다.
GitHub, GitLab, LDAP 등을 외부 공급자로 연결한다.

```yaml
# argocd-cm ConfigMap
data:
  url: https://argocd.example.com

  dex.config: |
    connectors:
    - type: github
      id: github
      name: GitHub
      config:
        clientID: my-github-client-id
        clientSecret: $github-client-secret
        orgs:
        - name: myorg
          teams:
          - devops
          - backend
```

### 외부 OIDC (Okta, Keycloak 등)

```yaml
data:
  oidc.config: |
    name: Okta
    issuer: https://dev-123456.okta.com/oauth2/default
    clientID: my-client-id
    clientSecret: $oidc.okta.clientSecret
    requestedScopes:
    - openid
    - profile
    - email
    - groups
    groupsField: groups
    # 그룹 클레임이 nested인 경우
    groupsClaim: groups
```

---

## 4. ArgoCD 3.x RBAC 변경사항

ArgoCD 3.0부터 기본 RBAC이 강화되었다.

| 항목 | 2.x | 3.x |
|-----|-----|-----|
| 기본 권한 | 광범위한 기본 권한 | 최소 권한 원칙 |
| 클러스터 접근 | 암묵적 허용 | 명시적 화이트리스트 |
| 원격 클러스터 | 자동 신뢰 | 명시적 등록 필요 |
| PreDelete Hook | 미지원 | 지원 |

```yaml
# 3.x에서 클러스터 접근 화이트리스트 예시
data:
  policy.csv: |
    p, role:admin, clusters, get, *, allow
    p, role:admin, clusters, create, *, allow
```

---

## 5. 실무 권장 RBAC 설계

```
role:readonly  → 모든 앱 조회만 가능
role:developer → 자신 팀의 앱 sync, 로그 확인
role:ops       → 스테이징 앱 전체 관리
role:admin     → 클러스터·저장소·프로젝트 전체 관리

dev-* AppProject  → 개발팀용 프로젝트
staging-* Project → Ops팀 관리
prod-* Project    → admin만 접근
```

---

## 참고 문서

- [ArgoCD RBAC 공식 문서](https://argo-cd.readthedocs.io/en/stable/operator-manual/rbac/)
- [ArgoCD SSO 설정](https://argo-cd.readthedocs.io/en/stable/operator-manual/user-management/)
- [Dex 연동](https://argo-cd.readthedocs.io/en/stable/operator-manual/sso/dex/)
