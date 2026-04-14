---
title: "Terraform 기초 (HCL, 워크플로우)"
date: 2026-04-14
tags:
  - terraform
  - hcl
  - iac
sidebar_label: "Terraform 기초"
---

# Terraform 기초

## 1. HCL 기본 문법

HCL(HashiCorp Configuration Language)은 Terraform의 설정 언어다.
사람이 읽기 쉽고 기계가 처리하기 쉽게 설계되었다.

```hcl
# 블록 구조: block_type "label1" "label2" { ... }
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name        = "web-server"
    Environment = "production"
  }
}
```

### 주요 블록 유형

| 블록 | 역할 |
|-----|------|
| `terraform` | Terraform 자체 설정 (버전, 백엔드) |
| `provider` | 클라우드 프로바이더 설정 |
| `resource` | 인프라 리소스 정의 |
| `variable` | 입력 변수 |
| `output` | 출력 값 |
| `locals` | 로컬 변수 |
| `data` | 기존 리소스 조회 |
| `module` | 재사용 모듈 호출 |

### 표현식

```hcl
# 문자열 보간
tags = {
  Name = "web-${var.environment}-server"
}

# 조건식
instance_type = var.is_production ? "t3.large" : "t2.micro"

# 참조 (다른 리소스의 속성)
subnet_id = aws_subnet.main.id

# 함수 호출
bucket = "my-bucket-${data.aws_caller_identity.current.account_id}"
```

---

## 2. 핵심 워크플로우

```
init → validate → plan → apply → destroy
```

```bash
# 1. 초기화 (프로바이더 플러그인 다운로드)
terraform init

# 2. 포맷 정규화
terraform fmt

# 3. 문법·설정 유효성 검사
terraform validate

# 4. 변경 계획 미리보기 (인프라 변경 없음)
terraform plan
terraform plan -out=tfplan    # 플랜 파일 저장

# 5. 변경 적용
terraform apply
terraform apply tfplan        # 저장된 플랜 적용

# 6. 상태 확인
terraform show
terraform state list

# 7. 인프라 제거
terraform destroy
terraform destroy -target=aws_instance.web  # 특정 리소스만
```

---

## 3. 프로바이더 설정

```hcl
# terraform.tf
terraform {
  required_version = "~> 1.8"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = "ap-northeast-2"
  profile = "dev"

  # 모든 리소스에 공통 태그 자동 추가
  default_tags {
    tags = {
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# 다중 리전 (alias 사용)
provider "aws" {
  alias  = "us-east"
  region = "us-east-1"
}

resource "aws_s3_bucket" "backup" {
  provider = aws.us-east
  bucket   = "my-backup-bucket"
}
```

---

## 4. 변수 파일

```hcl
# variables.tf - 변수 선언
variable "environment" {
  type        = string
  description = "배포 환경"
  default     = "dev"
}

variable "instance_type" {
  type        = string
  description = "EC2 인스턴스 타입"

  validation {
    condition     = contains(["t2.micro","t3.small","t3.medium"], var.instance_type)
    error_message = "지원하지 않는 인스턴스 타입."
  }
}
```

```hcl
# terraform.tfvars - 변수 값 설정
environment   = "production"
instance_type = "t3.small"
```

### 변수 우선순위 (높음 → 낮음)

```
1. -var, -var-file 플래그
2. terraform.tfvars
3. *.auto.tfvars (알파벳 순)
4. TF_VAR_name 환경변수
5. 기본값 (default)
```

---

## 5. .terraform.lock.hcl

프로바이더 버전을 고정해 재현 가능한 빌드를 보장한다.

```hcl
# .terraform.lock.hcl (자동 생성, Git에 커밋)
provider "registry.terraform.io/hashicorp/aws" {
  version     = "5.42.0"
  constraints = "~> 5.0"
  hashes = [
    "h1:VzZWmKfcUV2cjK...",
  ]
}
```

- `terraform init`으로 자동 생성/업데이트
- **반드시 Git에 커밋** → 팀 전체가 동일한 버전 사용
- `terraform init -upgrade`로 최신 버전으로 업데이트

---

## 6. 버전 제약

```hcl
# ~> : 마지막 버전 컴포넌트만 증가 허용
version = "~> 5.40"   # >= 5.40.0, < 5.41.0
version = "~> 1.8"    # >= 1.8.0, < 1.9.0

# >= : 이상
version = ">= 5.0"

# 범위 지정
version = ">= 5.0, < 6.0"

# 정확한 버전
version = "5.42.0"
```

---

## 7. Terraform vs OpenTofu (2025 기준)

| 항목 | Terraform | OpenTofu |
|-----|-----------|----------|
| 라이선스 | BSL 1.1 (제한적) | MPL 2.0 (오픈소스) |
| 관리 | HashiCorp | CNCF |
| HCL 호환 | 기준 | 완전 호환 |
| 시장 점유율 | ~76% | 증가 중 |
| 추천 | 기존 사용자 유지 | 신규 프로젝트 |

> 기존 Terraform 코드는 OpenTofu에서 그대로 동작한다.

---

## 참고 문서

- [Terraform 공식 문서](https://developer.hashicorp.com/terraform/language)
- [OpenTofu](https://opentofu.org/docs/)
- [AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
