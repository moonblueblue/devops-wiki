---
title: "IaC 모듈 버전 관리"
date: 2026-04-14
tags:
  - terraform
  - module
  - versioning
  - iac
sidebar_label: "모듈 버전 관리"
---

# IaC 모듈 버전 관리

## 1. 왜 버전 관리가 필요한가

모듈을 버전 없이 사용하면:

```hcl
# ❌ 위험: 최신 버전 자동 사용
module "vpc" {
  source = "git::https://github.com/myorg/tf-vpc.git"
  # 모듈이 변경되면 같은 코드도 다른 결과
}
```

```hcl
# ✅ 안전: 버전 고정
module "vpc" {
  source = "git::https://github.com/myorg/tf-vpc.git?ref=v2.1.0"
}
```

---

## 2. Terraform Registry 모듈 버전 고정

```hcl
# 정확한 버전 (프로덕션 권장)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"
}

# 패치만 자동 업데이트
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.8"   # 20.8.x 허용, 21.0 미허용
}

# 마이너까지 자동 업데이트
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = ">= 6.0, < 7.0"
}
```

---

## 3. 사내 모듈 버전 관리 (Git Tags)

```bash
# 모듈 저장소에서 태그 생성
cd tf-modules/vpc
git tag -a v1.0.0 -m "초기 릴리즈"
git tag -a v1.1.0 -m "NAT Gateway 옵션 추가"
git push origin --tags
```

```hcl
# 사용 측에서 버전 고정
module "vpc" {
  source = "git::https://github.com/myorg/tf-modules.git//vpc?ref=v1.1.0"
}
```

### CHANGELOG 관리

```markdown
# CHANGELOG.md (tf-modules/vpc/)

## [v1.2.0] - 2026-04-14
### Added
- IPv6 지원 추가

### Changed
- 기본 NAT Gateway 수를 AZ당 1개로 변경

## [v1.1.0] - 2026-03-01
### Added
- NAT Gateway 옵션 추가 (`enable_nat_gateway` 변수)

## [v1.0.0] - 2026-01-15
### Added
- 초기 릴리즈
```

---

## 4. 모듈 업그레이드 프로세스

```
1. CHANGELOG 확인
    → breaking change 있는지 검토

2. dev 환경에서 먼저 테스트
    → module version = "new_version"
    → terraform plan
    → terraform apply

3. 문제 없으면 staging → prod 순서로 적용
    → 각 환경별 PR 생성
    → 리뷰 후 적용
```

```bash
# 모듈 업데이트 명령
terraform init -upgrade

# 어떤 버전이 적용됐는지 확인
cat .terraform.lock.hcl
```

---

## 5. .terraform.lock.hcl

Terraform이 자동 생성하는 프로바이더 버전 잠금 파일.
**반드시 Git에 커밋해야 한다.**

```hcl
# .terraform.lock.hcl (자동 생성)
provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.31.0"
  constraints = "~> 5.0"
  hashes = [
    "h1:...",
    "zh:...",
  ]
}
```

```bash
# 프로바이더 업데이트
terraform init -upgrade

# 특정 프로바이더만 업데이트
terraform providers lock \
  -platform=linux_amd64 \
  -platform=darwin_amd64 \
  registry.terraform.io/hashicorp/aws
```

---

## 6. 모듈 호환성 매트릭스 관리

```hcl
# modules/eks/versions.tf
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 6.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.20"
    }
  }
}
```

---

## 7. 자동화 (Dependabot)

```yaml
# .github/dependabot.yml
version: 2
updates:
- package-ecosystem: terraform
  directory: "/environments/prod"
  schedule:
    interval: weekly
  groups:
    terraform-modules:
      patterns:
      - "*"
```

Dependabot이 모듈/프로바이더 업데이트를 주간으로 감지해
자동으로 PR을 생성한다.

---

## 참고 문서

- [Module Sources](https://developer.hashicorp.com/terraform/language/modules/sources)
- [Dependency Lock File](https://developer.hashicorp.com/terraform/language/files/dependency-lock)
