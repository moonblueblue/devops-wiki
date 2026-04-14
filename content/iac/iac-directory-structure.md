---
title: "IaC 디렉토리 구조 설계"
date: 2026-04-14
tags:
  - iac
  - terraform
  - directory
  - structure
sidebar_label: "디렉토리 구조 설계"
---

# IaC 디렉토리 구조 설계

## 1. 왜 구조 설계가 중요한가

잘못된 구조:
- 환경 간 실수로 인한 프로덕션 장애
- 코드 중복으로 인한 유지보수 어려움
- 팀원이 어디에 무엇을 수정해야 하는지 모름

---

## 2. 기본 구조 (소규모 팀)

```
infrastructure/
├── modules/              # 재사용 가능한 모듈
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── README.md
│   ├── eks/
│   └── rds/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   └── ...
│   └── prod/
│       └── ...
└── global/               # 환경 독립 리소스
    ├── iam/
    │   └── main.tf
    └── route53/
        └── main.tf
```

---

## 3. 레이어 분리 구조 (중대규모 팀)

```
infrastructure/
├── layers/
│   ├── 00-bootstrap/     # S3 버킷, DynamoDB (state 저장소)
│   ├── 01-network/       # VPC, 서브넷, 피어링
│   ├── 02-security/      # IAM, 보안 그룹, KMS
│   ├── 03-compute/       # EKS, EC2
│   └── 04-application/   # RDS, ElastiCache, S3
└── modules/
    └── ...
```

각 레이어는 독립적으로 `terraform apply`하며
이전 레이어의 output을 `data "terraform_remote_state"`로 참조한다.

```hcl
# 03-compute/main.tf
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "my-terraform-state"
    key    = "prod/01-network/terraform.tfstate"
    region = "ap-northeast-2"
  }
}

module "eks" {
  source = "../../modules/eks"
  vpc_id     = data.terraform_remote_state.network.outputs.vpc_id
  subnet_ids = data.terraform_remote_state.network.outputs.private_subnets
}
```

---

## 4. 모노레포 vs 멀티레포

### 모노레포

```
infra-repo/
├── terraform/
│   ├── modules/
│   └── environments/
├── ansible/
│   ├── roles/
│   └── playbooks/
└── packer/
    └── templates/
```

| 장점 | 단점 |
|-----|------|
| 하나의 PR로 전체 변경 | 저장소 크기 증가 |
| 도구 간 일관성 | 권한 관리 복잡 |
| 쉬운 코드 공유 | CI 빌드 시간 증가 |

### 멀티레포

```
infra-modules-repo/    # 모듈만 (공유 라이브러리)
infra-prod-repo/       # 프로덕션 환경
infra-staging-repo/    # 스테이징 환경
```

---

## 5. 파일 명명 규칙

```
각 환경 디렉토리 내 권장 파일:
├── main.tf          # 주 리소스 정의
├── variables.tf     # 변수 선언
├── outputs.tf       # 출력 값 선언
├── locals.tf        # 로컬 값 (복잡한 표현식)
├── providers.tf     # 프로바이더 설정
├── versions.tf      # terraform, 프로바이더 버전 고정
├── terraform.tfvars # 변수 값 (기본값, Git 커밋 OK)
└── secrets.tfvars   # 민감 변수 (Git 커밋 금지)
```

```hcl
# versions.tf
terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
  }
}
```

---

## 6. .gitignore

```gitignore
# Terraform
**/.terraform/
*.tfstate
*.tfstate.backup
*.tfstate.lock.info
.terraform.lock.hcl   # 이건 커밋해야 함

# 민감 파일
*.tfvars             # secrets만 담긴 파일
secrets.tfvars
override.tf
override.tf.json

# Crash 로그
crash.log
```

> `.terraform.lock.hcl`은 **반드시 Git에 커밋**한다.
> 프로바이더 버전을 팀 전체에서 고정하는 역할이다.

---

## 참고 문서

- [Terraform Best Practices](https://developer.hashicorp.com/terraform/language/style)
- [Module Structure](https://developer.hashicorp.com/terraform/language/modules/develop/structure)
