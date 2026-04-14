---
title: "Terraform Cloud와 Atlantis"
date: 2026-04-14
tags:
  - terraform
  - atlantis
  - cicd
  - iac
sidebar_label: "TF Cloud·Atlantis"
---

# Terraform Cloud와 Atlantis

## 1. 왜 필요한가

로컬에서 `terraform apply`를 실행하면:
- 누가 언제 적용했는지 추적 어려움
- state 파일 잠금 충돌 가능
- 시크릿을 로컬에 보관해야 함

**해결책**: Terraform 실행을 중앙화한다.

---

## 2. Terraform Cloud / Enterprise

HashiCorp의 관리형 플랫폼.
State 저장, 실행, 정책 검사, 협업을 통합 제공한다.

```hcl
# terraform.tf
terraform {
  cloud {
    organization = "my-company"
    workspaces {
      name = "production"
    }
  }
}
```

```bash
# 로그인
terraform login

# 초기화 (Cloud 연결)
terraform init
```

### 주요 기능

| 기능 | 설명 |
|-----|------|
| Remote State | 암호화된 중앙 state 저장 |
| Remote Runs | Cloud에서 plan/apply 실행 |
| Sentinel | 정책 검사 (예: 프로덕션 수동 승인) |
| Variable Sets | 여러 workspace에 변수 공유 |
| Audit Logs | 모든 실행 기록 |
| VCS 연동 | GitHub PR → 자동 plan |

### VCS 연동 워크플로우

```
개발자 → PR 생성
    → Terraform Cloud가 plan 자동 실행
        → PR에 plan 결과 코멘트
            → 승인 후 merge
                → 자동 apply
```

---

## 3. Atlantis (오픈소스 대안)

셀프 호스팅 가능한 Terraform Pull Request 자동화 도구.
GitHub/GitLab/Bitbucket에 webhook으로 연동한다.

```yaml
# atlantis.yaml (저장소 루트)
version: 3
projects:
- name: prod-vpc
  dir: environments/prod/vpc
  workspace: default
  autoplan:
    when_modified: ["*.tf", "../../modules/vpc/**/*.tf"]
    enabled: true
  apply_requirements:
  - approved       # 1명 이상 승인 필수
  - mergeable      # CI 통과 필수
```

### 동작 흐름

```
PR 생성
  → Atlantis가 감지 (webhook)
      → terraform plan 자동 실행
          → PR에 결과 코멘트 추가

PR 코멘트: "atlantis apply"
  → Atlantis가 terraform apply 실행
      → 결과를 PR에 코멘트
```

### 설치 (Kubernetes)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: atlantis
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: atlantis
        image: ghcr.io/runatlantis/atlantis:v0.28.0
        env:
        - name: ATLANTIS_REPO_ALLOWLIST
          value: "github.com/myorg/*"
        - name: ATLANTIS_GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: atlantis-secret
              key: github-token
        - name: ATLANTIS_GITHUB_WEBHOOK_SECRET
          valueFrom:
            secretKeyRef:
              name: atlantis-secret
              key: webhook-secret
```

---

## 4. Terraform Cloud vs Atlantis

| 항목 | Terraform Cloud | Atlantis |
|-----|----------------|---------|
| 호스팅 | HashiCorp 관리형 | 셀프 호스팅 |
| 비용 | 무료(500 리소스) / 유료 | 무료 (오픈소스) |
| State 관리 | 기본 제공 | 별도 백엔드 필요 |
| 정책 검사 | Sentinel (유료) | conftest + OPA |
| 설정 복잡도 | 낮음 | 중간 |
| 데이터 주권 | HashiCorp 서버 | 사내 보관 가능 |
| 적합한 환경 | SaaS 허용 조직 | 온프레미스·규제 환경 |

---

## 5. OpenTofu + Atlantis 조합

Terraform BSL 라이선스 이슈로 OpenTofu로 이전하는 경우:

```yaml
# atlantis.yaml
version: 3
projects:
- name: prod
  dir: environments/prod
  terraform_version: v1.8.0   # OpenTofu 버전
```

```bash
# Atlantis에서 OpenTofu 사용
ATLANTIS_TERRAFORM_VERSION=1.8.0
```

---

## 참고 문서

- [Terraform Cloud 공식 문서](https://developer.hashicorp.com/terraform/cloud-docs)
- [Atlantis 공식 문서](https://www.runatlantis.io/docs/)
- [OpenTofu](https://opentofu.org/)
