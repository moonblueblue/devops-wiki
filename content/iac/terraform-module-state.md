---
title: "Terraform Module 설계와 State 관리"
date: 2026-04-14
tags:
  - terraform
  - module
  - state
  - backend
sidebar_label: "Module·State 관리"
---

# Terraform Module 설계와 State 관리

## 1. 모듈 구조

모듈은 재사용 가능한 Terraform 구성 단위다.

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

## 2. 모듈 호출

```hcl
# main.tf (루트 모듈)
module "vpc" {
  source = "./modules/vpc"   # 로컬 경로

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

## 3. 모듈 소스 유형

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

### 버전 고정 (프로덕션 필수)

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

---

## 4. State 파일

Terraform은 인프라 상태를 `terraform.tfstate`에 저장한다.

```json
{
  "version": 4,
  "terraform_version": "1.8.3",
  "serial": 42,
  "resources": [
    {
      "type": "aws_instance",
      "name": "web",
      "instances": [{
        "attributes": {
          "id": "i-0123456789abcdef0",
          "ami": "ami-0c55b159cbfafe1f0",
          "instance_type": "t2.micro"
        }
      }]
    }
  ]
}
```

> **주의**: state 파일에 민감 정보(DB 비밀번호 등)가 포함될 수 있다.
> Git에 절대 커밋하지 말 것. 반드시 암호화된 원격 백엔드를 사용한다.

---

## 5. 원격 백엔드

팀 협업을 위해 state를 중앙 저장소에 관리한다.

### S3 + DynamoDB (AWS, 전통적 방법)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"   # 동시 실행 방지
  }
}
```

```bash
# 백엔드 인프라 사전 생성
aws s3 mb s3://my-terraform-state --region ap-northeast-2
aws s3api put-bucket-versioning \
  --bucket my-terraform-state \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### S3 네이티브 잠금 (Terraform 1.10+, 권장)

```hcl
terraform {
  backend "s3" {
    bucket       = "my-terraform-state"
    key          = "prod/terraform.tfstate"
    region       = "ap-northeast-2"
    encrypt      = true
    use_lockfile = true   # DynamoDB 불필요
  }
}
```

### GCS (GCP)

```hcl
terraform {
  backend "gcs" {
    bucket = "my-terraform-state"
    prefix = "prod"
  }
}
```

### Terraform Cloud

```hcl
terraform {
  cloud {
    organization = "my-company"
    workspaces {
      name = "production"
    }
  }
}
```

---

## 6. State 명령어

```bash
# 리소스 목록 조회
terraform state list

# 특정 리소스 상세 조회
terraform state show aws_instance.web

# 리소스 이름 변경 (코드 리팩터링 시)
terraform state mv \
  aws_instance.old_name \
  aws_instance.new_name

# State에서 리소스 제거 (실제 삭제 없이)
terraform state rm aws_instance.web

# 기존 리소스를 State로 가져오기 (import)
terraform import aws_instance.web i-0123456789abcdef0
```

### Import Block (Terraform 1.5+, 권장)

```hcl
# import.tf
import {
  to = aws_instance.web
  id = "i-0123456789abcdef0"
}

# 설정 자동 생성
# terraform plan -generate-config-out=generated.tf
```

```bash
# import 적용
terraform apply
```

---

## 7. Workspace

같은 코드로 여러 환경을 분리 관리한다.

```bash
# 워크스페이스 생성
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# 전환
terraform workspace select prod

# 현재 워크스페이스 확인
terraform workspace show

# 목록
terraform workspace list
```

```hcl
# 워크스페이스에 따라 다른 설정 적용
locals {
  env = terraform.workspace   # "dev", "staging", "prod"
}

resource "aws_instance" "web" {
  instance_type = local.env == "prod" ? "t3.large" : "t2.micro"

  tags = {
    Environment = local.env
  }
}
```

> **팁**: 환경별 디렉토리 분리 방식(`environments/dev/`, `environments/prod/`)이
> Workspace보다 더 명확하고 실수가 적다. 팀 규모에 따라 선택한다.

---

## 참고 문서

- [Modules](https://developer.hashicorp.com/terraform/language/modules)
- [State](https://developer.hashicorp.com/terraform/language/state)
- [S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [Terraform Registry](https://registry.terraform.io/)
