---
title: "Terraform State 관리와 Backend"
date: 2026-04-14
tags:
  - terraform
  - state
  - backend
  - iac
sidebar_label: "Terraform State"
---

# Terraform State 관리와 Backend

## 1. State 파일이란

Terraform이 관리하는 인프라의 현재 상태를
`terraform.tfstate`에 JSON으로 기록한다.

```json
{
  "version": 4,
  "terraform_version": "1.10.0",
  "serial": 42,
  "resources": [
    {
      "type": "aws_instance",
      "name": "web",
      "instances": [{
        "attributes": {
          "id": "i-0123456789abcdef0",
          "instance_type": "t2.micro"
        }
      }]
    }
  ]
}
```

> **주의**: state 파일에 DB 비밀번호 등 민감 정보 포함 가능.
> Git에 절대 커밋하지 말 것. 암호화된 원격 백엔드를 사용한다.

---

## 2. 원격 백엔드

팀 협업을 위해 state를 중앙 저장소에서 관리한다.

### S3 + DynamoDB (AWS, 전통적 방법)

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
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
    use_lockfile = true   # DynamoDB 없이 S3 잠금
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

### Azure Blob Storage

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform"
    storage_account_name = "terraformstate"
    container_name       = "tfstate"
    key                  = "prod.terraform.tfstate"
  }
}
```

---

## 3. State 명령어

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

# 기존 리소스를 State로 가져오기
terraform import aws_instance.web i-0123456789abcdef0
```

### Import Block (Terraform 1.5+, 권장)

```hcl
# import.tf
import {
  to = aws_instance.web
  id = "i-0123456789abcdef0"
}
```

```bash
# 설정 자동 생성
terraform plan -generate-config-out=generated.tf
terraform apply
```

---

## 4. State 잠금 (Locking)

동시에 여러 사람이 apply하면 state가 손상될 수 있다.
원격 백엔드는 자동으로 잠금을 관리한다.

```bash
# 잠금이 걸린 경우 강제 해제 (신중히 사용)
terraform force-unlock <LOCK_ID>
```

---

## 5. State 분리 전략

```
# 환경별 분리 (권장)
prod/terraform.tfstate
staging/terraform.tfstate
dev/terraform.tfstate

# 레이어별 분리
network/terraform.tfstate     # VPC, 서브넷
compute/terraform.tfstate     # EC2, EKS
database/terraform.tfstate    # RDS
```

분리 이유: 한 state 파일에 모든 리소스를 담으면
`plan/apply` 속도 저하 및 장애 영향 범위가 넓어진다.

---

## 참고 문서

- [State 공식 문서](https://developer.hashicorp.com/terraform/language/state)
- [S3 Backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [State Locking](https://developer.hashicorp.com/terraform/language/state/locking)
