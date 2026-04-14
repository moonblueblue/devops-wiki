---
title: "Terraform Workspace와 디렉토리 전략"
date: 2026-04-14
tags:
  - terraform
  - workspace
  - iac
sidebar_label: "Workspace·디렉토리"
---

# Terraform Workspace와 디렉토리 전략

## 1. Workspace란

같은 코드베이스로 여러 환경(dev/staging/prod)을
격리된 state로 관리하는 기능.

```bash
# 워크스페이스 목록
terraform workspace list
# * default
#   dev
#   staging
#   prod

# 생성 및 전환
terraform workspace new dev
terraform workspace select prod

# 현재 확인
terraform workspace show
```

---

## 2. Workspace 활용

```hcl
# 현재 워크스페이스에 따라 다른 설정 적용
locals {
  env = terraform.workspace   # "dev", "staging", "prod"

  instance_type = {
    dev     = "t2.micro"
    staging = "t3.small"
    prod    = "t3.large"
  }
}

resource "aws_instance" "web" {
  instance_type = local.instance_type[local.env]

  tags = {
    Environment = local.env
  }
}
```

```hcl
# 환경별 다른 VPC CIDR
variable "cidr_blocks" {
  default = {
    dev     = "10.0.0.0/16"
    staging = "10.1.0.0/16"
    prod    = "10.2.0.0/16"
  }
}

resource "aws_vpc" "main" {
  cidr_block = var.cidr_blocks[terraform.workspace]
}
```

---

## 3. Workspace의 한계

| 한계 | 설명 |
|-----|------|
| 코드 공유 강제 | 환경별로 완전히 다른 구성 적용 어려움 |
| 실수 위험 | 잘못된 workspace에서 apply 가능 |
| 가시성 부족 | 현재 workspace 항상 확인해야 함 |
| 백엔드 공유 | 같은 S3 버킷에 key만 다름 |

---

## 4. 디렉토리 분리 전략 (권장)

실무에서는 Workspace보다 **디렉토리 분리**가 더 안전하다.

```
infrastructure/
├── modules/              # 재사용 모듈
│   ├── vpc/
│   ├── eks/
│   └── rds/
├── environments/
│   ├── dev/
│   │   ├── main.tf       # dev 전용 설정
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   └── prod/
│       ├── main.tf
│       └── terraform.tfvars
└── global/               # 공통 리소스 (Route53, IAM 등)
    └── main.tf
```

```hcl
# environments/prod/main.tf
module "vpc" {
  source = "../../modules/vpc"

  cidr_block = "10.2.0.0/16"
  env        = "prod"
}

module "eks" {
  source = "../../modules/eks"

  vpc_id       = module.vpc.vpc_id
  node_count   = 5
  instance_type = "t3.large"
}
```

---

## 5. Workspace vs 디렉토리 비교

| 항목 | Workspace | 디렉토리 분리 |
|-----|-----------|------------|
| 코드 중복 | 없음 | 환경별 파일 존재 |
| 안전성 | 낮음 (workspace 혼동 위험) | 높음 |
| 환경별 차이 | 제한적 | 완전 자유 |
| 적합한 규모 | 소규모, 단순 환경 | 중대규모 팀 |
| 권장 여부 | 단순한 경우만 | 실무 권장 |

---

## 참고 문서

- [Workspaces](https://developer.hashicorp.com/terraform/language/state/workspaces)
- [Module Composition](https://developer.hashicorp.com/terraform/language/modules/develop/composition)
