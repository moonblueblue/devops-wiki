---
title: "GitHub Actions 보안 (시크릿, 토큰, OIDC)"
date: 2026-04-14
tags:
  - github-actions
  - security
  - oidc
  - secrets
  - cicd
sidebar_label: "GHA 보안"
---

# GitHub Actions 보안

## 1. 시크릿 관리

### 저장소/조직 시크릿

```
저장소 → Settings → Secrets and variables → Actions
조직 → Settings → Secrets and variables → Actions
```

```yaml
steps:
- name: 시크릿 사용
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    API_KEY: ${{ secrets.API_KEY }}
  run: ./deploy.sh

# 주의: 시크릿은 로그에 마스킹됨 (***로 표시)
# 하지만 base64 인코딩 등으로 우회 가능하므로 주의
```

### 환경별 시크릿 (Environment Secrets)

```yaml
jobs:
  deploy-prod:
    environment: production   # 이 환경의 시크릿만 접근 가능
    steps:
    - env:
        DEPLOY_KEY: ${{ secrets.PROD_DEPLOY_KEY }}
      run: ./deploy.sh
```

---

## 2. GITHUB_TOKEN

GitHub가 자동 발급하는 임시 토큰. 별도 설정 불필요.

```yaml
permissions:
  contents: read      # 기본값 - 저장소 읽기
  packages: write     # GHCR push
  pull-requests: write  # PR 코멘트
  issues: write       # 이슈 코멘트
  id-token: write     # OIDC 토큰 (클라우드 인증용)

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}  # 자동 발급
```

> **보안**: `permissions` 미지정 시 기본값이 write-all.
> 반드시 필요한 최소 권한만 명시한다.

---

## 3. OIDC (OpenID Connect) - 권장

장기 자격증명(Access Key) 없이 임시 토큰으로 클라우드 인증.

```
GitHub Actions → OIDC 토큰 발급
    → AWS/GCP/Azure가 토큰 검증
        → 임시 자격증명 발급 (1시간 유효)
```

### AWS

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: ap-northeast-2

    - run: aws s3 sync dist/ s3://my-bucket/
```

```json
// AWS IAM Trust Policy
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:myorg/myrepo:ref:refs/heads/main"
      }
    }
  }]
}
```

### GCP

```yaml
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: google-github-actions/auth@v2
      with:
        workload_identity_provider: >-
          projects/12345/locations/global/workloadIdentityPools/github/providers/github
        service_account: github-actions@myproject.iam.gserviceaccount.com

    - uses: google-github-actions/setup-gcloud@v2
    - run: gcloud run deploy myapp --image gcr.io/myproject/myapp
```

---

## 4. Action 버전 고정 (SHA 핀닝)

태그 대신 커밋 SHA로 고정해 공급망 공격을 방지한다.

```yaml
# ❌ 태그는 이동 가능 (공급망 공격 위험)
- uses: actions/checkout@v4

# ✅ SHA로 고정 (불변)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: docker/build-push-action@67a2d409e2e2e91f34e2c9e1e7a5f3ddc0a94b33  # v6
```

---

## 5. Dependabot으로 자동 업데이트

```yaml
# .github/dependabot.yml
version: 2
updates:
- package-ecosystem: github-actions
  directory: /
  schedule:
    interval: weekly
  groups:
    github-actions:
      patterns: ["*"]
```

---

## 6. 보안 체크리스트

```
□ permissions 최소화 (write-all 금지)
□ OIDC 사용 (장기 자격증명 제거)
□ Action SHA 고정
□ 외부 Action pull-request에서 제한 (first-time contributors)
□ 환경별 시크릿 분리
□ Dependabot으로 Action 업데이트 자동화
□ 시크릿 스캔 활성화 (Advanced Security)
```

---

## 참고 문서

- [OIDC 가이드](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments)
- [보안 강화 가이드](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [OpenSSF Scorecard](https://securityscorecards.dev/)
