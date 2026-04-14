---
title: "Terraform Module 설계와 재사용"
date: 2026-04-14
tags:
  - terraform
  - module
  - iac
sidebar_label: "Terraform 모듈"
---

# Terraform Module 설계와 재사용

## 1. 모듈이란

재사용 가능한 Terraform 구성 단위.
공통 인프라 패턴을 캡슐화해 여러 환경에서 재사용한다.

```
modules/
├── vpc/
│   ├── main.tf        # 리소스 정의
│   ├── variables.tf   # 입력 변수
│   ├── outputs.tf     # 출력 값
│   └── terraform.tf   # 버전 요구사항
├── rds/
│   └── ...
└── eks/
    └── ...
```

---

## 2. 모듈 작성

```hcl
# modules/vpc/variables.tf
variable "cidr_block" {
  type        = string
  description = "VPC CIDR"
  validation {
    condition     = can(cidrhost(var.cidr_block, 0))
    error_message = "유효한 CIDR이어야 합니다."
  }
}

variable "availability_zones" {
  type = list(string)
}

variable "tags" {
  type    = map(string)
  default = {}
}
```

```hcl
# modules/vpc/outputs.tf
output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
```

---

## 3. 모듈 호출

```hcl
# main.tf (루트 모듈)
module "vpc" {
  source = "./modules/vpc"

  cidr_block         = "10.0.0.0/16"
  availability_zones = ["ap-northeast-2a", "ap-northeast-2c"]

  tags = {
    Environment = "production"
  }
}

# 모듈 출력 참조
resource "aws_security_group" "web" {
  vpc_id = module.vpc.vpc_id
}

resource "aws_db_subnet_group" "main" {
  subnet_ids = module.vpc.private_subnet_ids
}
```

---

## 4. 모듈 소스 유형

```hcl
# 로컬 경로
source = "./modules/vpc"

# Terraform 레지스트리 (공식)
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
}

# GitHub
module "eks" {
  source = "git::https://github.com/my-org/tf-eks.git?ref=v2.0"
}

# OCI 레지스트리 (Terraform Cloud / 사설)
module "rds" {
  source  = "app.terraform.io/my-org/rds/aws"
  version = "~> 2.1"
}
```

---

## 5. 버전 고정

```hcl
# 프로덕션: 정확한 버전 고정
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.2"
}

# 개발: 패치 업데이트만 허용
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"
}
```

| 표현식 | 의미 |
|-------|------|
| `= 5.1.2` | 정확히 이 버전만 |
| `~> 5.1` | 5.1.x (5.2 미만) |
| `>= 5.0, < 6.0` | 범위 지정 |

---

## 6. 모듈 업데이트

```bash
# 모듈 소스 다운로드·업데이트
terraform init -upgrade

# 특정 모듈만 초기화
terraform get -update
```

---

## 참고 문서

- [Modules 공식 문서](https://developer.hashicorp.com/terraform/language/modules)
- [Terraform Registry](https://registry.terraform.io/)
