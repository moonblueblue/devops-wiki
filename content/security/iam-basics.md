---
title: "IAM 기본 개념"
date: 2026-04-14
tags:
  - iam
  - security
  - authentication
  - authorization
sidebar_label: "IAM 기본"
---

# IAM 기본 개념

## 1. 인증 vs 인가

| 구분 | 인증 (Authentication) | 인가 (Authorization) |
|-----|---------------------|-------------------|
| 질문 | 당신은 누구인가? | 무엇을 할 수 있는가? |
| 확인 | 신원 확인 | 권한 확인 |
| 방법 | 비밀번호, MFA, 인증서 | RBAC, ABAC, 정책 |
| 실패 시 | 401 Unauthorized | 403 Forbidden |

---

## 2. IAM 핵심 개념

### 주체 (Principal)

접근을 요청하는 주체.

```
사람 (Human):
  - 개발자, 운영자, 감사자
  - SSO/IdP 계정으로 관리

시스템 (Service):
  - 마이크로서비스, CI/CD 파이프라인
  - ServiceAccount, IAM Role로 관리

그룹 (Group):
  - 역할이 같은 사람들의 모음
  - 그룹에 권한 할당 후 사람을 그룹에 추가
```

### 리소스 (Resource)

접근하려는 대상.

```
AWS: S3 버킷, EC2 인스턴스, RDS
Kubernetes: Pod, Secret, ConfigMap
앱: API 엔드포인트, 데이터베이스 레코드
```

### 정책 (Policy)

누가 무엇을 어떻게 할 수 있는지 정의.

```json
{
  "Effect": "Allow",
  "Principal": {"AWS": "arn:aws:iam::123:role/deploy-role"},
  "Action": ["s3:GetObject", "s3:PutObject"],
  "Resource": "arn:aws:s3:::my-bucket/*"
}
```

---

## 3. 최소 권한 원칙 적용

```
Bad:
  CI/CD에 AdministratorAccess 부여
  → 배포에 필요하지 않은 모든 권한 있음

Good:
  CI/CD에 필요한 서비스에만 필요한 액션만 허용
  → ECR: ecr:GetAuthorizationToken, ecr:PutImage
  → EKS: eks:UpdateNodegroupConfig
  → S3: s3:PutObject (특정 버킷만)
```

---

## 4. 임시 자격증명 (STS / OIDC)

장기 자격증명(Access Key)은 위험하다.
OIDC를 통한 임시 자격증명을 사용한다.

```yaml
# GitHub Actions → AWS OIDC 연동
# 시크릿 없이 AWS 리소스 접근 가능
jobs:
  deploy:
    permissions:
      id-token: write
      contents: read
    steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::123456789:role/GitHubActionsRole
        aws-region: ap-northeast-2
    # 이후 AWS CLI 사용 가능 (임시 토큰 자동 사용)
```

---

## 5. Kubernetes ServiceAccount

Pod에 Kubernetes API 접근 권한을 부여한다.

```yaml
# ServiceAccount 생성
apiVersion: v1
kind: ServiceAccount
metadata:
  name: payment-service
  namespace: production

# RBAC: SA에 권한 부여
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: payment-service-binding
  namespace: production
subjects:
- kind: ServiceAccount
  name: payment-service
  namespace: production
roleRef:
  kind: Role
  name: secret-reader
  apiGroup: rbac.authorization.k8s.io

# Pod에 SA 적용
spec:
  serviceAccountName: payment-service
  automountServiceAccountToken: false  # 필요한 경우만 true
```

---

## 6. 자격증명 보안 체크리스트

```
□ 장기 Access Key 삭제 (OIDC/임시 자격증명으로 대체)
□ Root 계정 MFA 활성화
□ 비사용 IAM 사용자 삭제
□ 모든 사용자 MFA 필수화
□ 자격증명 90일 주기 로테이션
□ 마지막 사용일 90일 초과 자격증명 비활성화
□ CloudTrail / Kubernetes Audit Log 활성화
```

---

## 참고 문서

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
