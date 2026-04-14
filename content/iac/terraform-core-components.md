---
title: "Terraform Resource, Data, Variable, Output"
date: 2026-04-14
tags:
  - terraform
  - hcl
  - resource
  - module
sidebar_label: "Terraform 핵심 구성요소"
---

# Terraform 핵심 구성요소

## 1. Resource

인프라 리소스를 정의하는 핵심 블록이다.

```hcl
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  # 다른 리소스 참조 (암시적 의존성)
  subnet_id = aws_subnet.main.id

  tags = {
    Name = "web-server"
  }
}
```

---

## 2. 메타 인수 (Meta-Arguments)

### count: 개수로 복수 리소스 생성

```hcl
resource "aws_instance" "server" {
  count         = 3
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  tags = {
    Name = "server-${count.index + 1}"
  }
}

# 참조: aws_instance.server[0], [1], [2]
output "server_ips" {
  value = aws_instance.server[*].private_ip
}

# 조건부 생성
resource "aws_instance" "optional" {
  count         = var.create ? 1 : 0
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

### for_each: 맵/셋으로 복수 리소스 생성

```hcl
variable "servers" {
  default = {
    web = { type = "t2.micro",  subnet = "subnet-aaa" }
    db  = { type = "t2.small",  subnet = "subnet-bbb" }
    api = { type = "t2.medium", subnet = "subnet-ccc" }
  }
}

resource "aws_instance" "server" {
  for_each      = var.servers
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = each.value.type
  subnet_id     = each.value.subnet

  tags = {
    Name = each.key   # "web", "db", "api"
  }
}

# 참조: aws_instance.server["web"], ["db"], ["api"]
```

### count vs for_each

| 구분 | count | for_each |
|-----|-------|----------|
| 기준 | 숫자 인덱스 | 고유 키 |
| 순서 변경 영향 | 재생성 위험 | 없음 (키 기준) |
| 참조 방식 | `resource[0]` | `resource["key"]` |
| 권장 상황 | 단순 반복 | 명확한 식별자 있을 때 |

### depends_on: 명시적 의존성

```hcl
# 참조가 없어도 순서 보장이 필요한 경우
resource "aws_instance" "app" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"

  depends_on = [
    aws_internet_gateway.main,  # IGW 생성 후 EC2 생성
    null_resource.db_ready
  ]
}
```

### lifecycle: 리소스 생명주기 제어

```hcl
resource "aws_instance" "prod" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.large"

  lifecycle {
    # 실수로 삭제 방지
    prevent_destroy = true

    # 교체 시 새 리소스 먼저 생성 (무중단)
    create_before_destroy = true

    # AMI 변경 무시 (초기 생성 후 외부 관리)
    ignore_changes = [ami, tags["LastModified"]]
  }
}

# DB 보호
resource "aws_db_instance" "main" {
  identifier = "production-db"

  lifecycle {
    prevent_destroy = true
  }
}
```

---

## 3. Data Source

기존 리소스를 읽기 전용으로 조회한다.

```hcl
# 최신 Amazon Linux 2 AMI 조회
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# 기존 VPC 조회
data "aws_vpc" "default" {
  default = true
}

# 현재 AWS 계정 정보
data "aws_caller_identity" "current" {}

# 사용
resource "aws_instance" "web" {
  ami       = data.aws_ami.amazon_linux_2.id
  subnet_id = data.aws_subnet.main.id

  tags = {
    Account = data.aws_caller_identity.current.account_id
  }
}
```

---

## 4. Variable

입력 값을 외부에서 주입한다.

```hcl
# 기본 타입
variable "environment" {
  type        = string
  description = "배포 환경"
  default     = "dev"
}

variable "instance_count" {
  type    = number
  default = 2
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

# 복합 타입
variable "tags" {
  type    = map(string)
  default = { Project = "MyApp" }
}

variable "allowed_ports" {
  type    = list(number)
  default = [80, 443, 8080]
}

variable "instance_config" {
  type = object({
    instance_type = string
    volume_size   = number
  })
  default = {
    instance_type = "t2.micro"
    volume_size   = 20
  }
}

# 민감 정보 (출력에서 숨김)
variable "db_password" {
  type      = string
  sensitive = true
}

# 유효성 검사
variable "port" {
  type = number
  validation {
    condition     = var.port >= 1 && var.port <= 65535
    error_message = "포트는 1~65535 사이여야 합니다."
  }
}
```

---

## 5. Output

다른 모듈이나 워크스페이스에서 참조할 값을 노출한다.

```hcl
# 단순 출력
output "instance_id" {
  value       = aws_instance.web.id
  description = "EC2 인스턴스 ID"
}

# 민감 출력
output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

# 복합 출력
output "instance_details" {
  value = {
    id         = aws_instance.web.id
    public_ip  = aws_instance.web.public_ip
    private_ip = aws_instance.web.private_ip
  }
}

# for_each 리소스의 출력
output "server_ips" {
  value = {
    for name, instance in aws_instance.server :
    name => instance.private_ip
  }
}
```

```bash
# 출력 값 조회
terraform output
terraform output instance_id
terraform output -json
```

---

## 6. Locals

모듈 내부에서 재사용할 값을 계산한다.

```hcl
locals {
  env    = var.environment
  prefix = "${var.project}-${local.env}"

  common_tags = merge(
    var.default_tags,
    {
      Environment = local.env
      ManagedBy   = "Terraform"
    }
  )

  # 조건부 값
  instance_type = local.env == "prod" ? "t3.large" : "t2.micro"
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.amazon_linux_2.id
  instance_type = local.instance_type

  tags = merge(
    local.common_tags,
    { Name = "${local.prefix}-web" }
  )
}
```

---

## 참고 문서

- [Resources](https://developer.hashicorp.com/terraform/language/resources)
- [Data Sources](https://developer.hashicorp.com/terraform/language/data-sources)
- [Input Variables](https://developer.hashicorp.com/terraform/language/values/variables)
- [Output Values](https://developer.hashicorp.com/terraform/language/values/outputs)
