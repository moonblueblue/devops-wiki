---
title: "OAuth2 / OIDC"
date: 2026-04-14
tags:
  - oauth2
  - oidc
  - security
  - authentication
sidebar_label: "OAuth2·OIDC"
---

# OAuth2 / OIDC

## 1. OAuth2

**위임된 인가(Authorization)** 프레임워크.
"내 대신 이 앱이 GitHub에 접근할 수 있도록 허용"

```
흐름 (Authorization Code):
사용자 → 앱 → GitHub (권한 요청)
             ← 인증 코드
앱 → GitHub (코드 → Access Token 교환)
앱 → GitHub API (Access Token 사용)
```

---

## 2. OIDC (OpenID Connect)

**인증(Authentication)** 레이어. OAuth2 위에서 동작한다.
"이 사용자가 누구인지 확인"

```
OAuth2 + ID Token (JWT) = OIDC

ID Token에 포함되는 정보:
  sub: 사용자 고유 ID
  email: 이메일
  name: 이름
  groups: 그룹 (커스텀 클레임)
  iss: 발급자 (IdP URL)
  exp: 만료 시간
```

---

## 3. OIDC 흐름

```
사용자 → 앱 로그인 버튼
    ↓
IdP (Okta, Keycloak, Google)로 리다이렉트
    ↓
IdP에서 인증 (MFA 포함)
    ↓
앱으로 리다이렉트 + Authorization Code
    ↓
앱이 Code → Access Token + ID Token 교환
    ↓
ID Token 검증 (서명, 만료)
    ↓
사용자 로그인 완료
```

---

## 4. Kubernetes OIDC 인증

```yaml
# kube-apiserver 설정
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --oidc-issuer-url=https://keycloak.example.com/realms/myrealm
    - --oidc-client-id=kubernetes
    - --oidc-username-claim=email
    - --oidc-groups-claim=groups
    - --oidc-ca-file=/etc/kubernetes/oidc-ca.crt
```

```bash
# kubectl config 설정 (OIDC 토큰 사용)
# kubelogin 플러그인 사용
kubectl oidc-login setup \
  --oidc-issuer-url=https://keycloak.example.com/realms/myrealm \
  --oidc-client-id=kubernetes \
  --oidc-client-secret=my-secret
```

---

## 5. GitHub Actions OIDC (CI/CD)

GitHub Actions가 OIDC 토큰으로 클라우드 리소스에 접근한다.
장기 자격증명 저장 없이 안전하게 AWS/GCP에 접근한다.

```yaml
jobs:
  deploy:
    permissions:
      id-token: write    # OIDC 토큰 발급 권한
      contents: read

    steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: ap-northeast-2
        # GitHub OIDC → AWS STS AssumeRoleWithWebIdentity
        # 임시 자격증명 자동 발급
```

```json
// AWS Trust Policy (IAM Role)
{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::123:oidc-provider/token.actions.githubusercontent.com"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:ref:refs/heads/main"
    }
  }
}
```

---

## 6. ArgoCD SSO (OIDC)

```yaml
# argocd-cm ConfigMap
data:
  oidc.config: |
    name: Keycloak
    issuer: https://keycloak.example.com/realms/myrealm
    clientID: argocd
    clientSecret: $oidc.keycloak.clientSecret
    requestedScopes:
    - openid
    - profile
    - email
    - groups
    groupsField: groups
```

---

## 참고 문서

- [OAuth2 RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)
- [OIDC 스펙](https://openid.net/developers/how-connect-works/)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
