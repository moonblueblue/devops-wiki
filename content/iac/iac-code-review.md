---
title: "IaC 코드 리뷰 체크리스트"
date: 2026-04-14
tags:
  - iac
  - terraform
  - code-review
  - checklist
sidebar_label: "코드 리뷰 체크리스트"
---

# IaC 코드 리뷰 체크리스트

## 1. 보안

```
□ 민감 변수에 sensitive = true 적용됐는가
□ 시크릿이 코드에 하드코딩되지 않았는가
□ S3 버킷이 public으로 열려있지 않은가
□ 보안 그룹 inbound 0.0.0.0/0 규칙이 최소화됐는가
□ IAM 정책이 최소 권한 원칙을 따르는가
□ 암호화(encrypt = true, KMS)가 적용됐는가
□ State 파일 백엔드가 암호화 설정됐는가
```

```hcl
# ❌ 과도한 권한
resource "aws_iam_role_policy" "bad" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "*"         # 모든 액션 허용
      Resource = "*"
    }]
  })
}

# ✅ 최소 권한
resource "aws_iam_role_policy" "good" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "arn:aws:s3:::my-bucket/*"
    }]
  })
}
```

---

## 2. 안정성

```
□ 프로바이더 버전이 고정됐는가 (version = "~> 5.0")
□ 모듈 버전이 고정됐는가 (ref=v1.2.0)
□ .terraform.lock.hcl이 커밋됐는가
□ lifecycle 설정이 필요한 리소스에 적용됐는가
□ deletion_protection이 DB/상태 저장소에 적용됐는가
□ 백업 설정이 적용됐는가
```

```hcl
# 삭제 방지 (RDS, 중요 리소스)
resource "aws_db_instance" "main" {
  deletion_protection = true
  backup_retention_period = 7

  lifecycle {
    prevent_destroy = true
  }
}

# 교체 전 새 리소스 먼저 생성 (다운타임 방지)
resource "aws_security_group" "web" {
  lifecycle {
    create_before_destroy = true
  }
}
```

---

## 3. 가독성

```
□ 리소스 이름이 규칙을 따르는가
□ 변수와 출력에 description이 있는가
□ 복잡한 표현식에 주석이 있는가
□ locals로 중복 표현이 줄여졌는가
□ 파일이 적절히 분리됐는가 (main, variables, outputs)
```

```hcl
# ❌ 설명 없음
variable "sz" {
  type = string
}

# ✅ 명확한 설명
variable "instance_size" {
  type        = string
  description = "EC2 인스턴스 타입 (예: t3.micro, t3.large)"
  default     = "t3.micro"

  validation {
    condition     = can(regex("^t[23]\\.", var.instance_size))
    error_message = "t2 또는 t3 계열만 허용됩니다."
  }
}
```

---

## 4. 비용

```
□ 불필요하게 큰 인스턴스 타입을 사용하지 않는가
□ dev/staging 환경에 prod 사양이 적용되지 않는가
□ 사용하지 않는 EIP, NAT Gateway가 없는가
□ 자동 종료 설정이 개발 환경에 있는가
```

```hcl
# 환경별 다른 사양
locals {
  is_prod = var.environment == "prod"
}

resource "aws_instance" "web" {
  instance_type = local.is_prod ? "t3.large" : "t2.micro"
}

resource "aws_rds_instance" "db" {
  instance_class         = local.is_prod ? "db.t3.medium" : "db.t3.micro"
  multi_az               = local.is_prod ? true : false
  backup_retention_period = local.is_prod ? 7 : 1
}
```

---

## 5. 멱등성

```
□ plan을 여러 번 실행해도 동일한 diff가 나오는가
□ null_resource/local-exec가 불필요하게 사용되지 않는가
□ triggers 설정이 올바른가
```

```hcl
# null_resource는 멱등성이 없어 주의 필요
resource "null_resource" "setup" {
  triggers = {
    # 이 값이 바뀔 때만 재실행
    script_hash = filemd5("${path.module}/setup.sh")
  }

  provisioner "local-exec" {
    command = "./setup.sh"
  }
}
```

---

## 6. plan 결과 검토

```
□ 예상치 못한 destroy가 없는가
□ 영향 받는 리소스 수가 예상과 일치하는가
□ forces replacement가 필요한 리소스가 적절한가
```

```bash
# plan 결과에서 destroy 목록만 확인
terraform plan -out=tfplan
terraform show -json tfplan \
  | jq '.resource_changes[] | select(.change.actions[] == "delete") | .address'

# 영향 범위 확인
terraform plan | grep -E "^  # |will be (created|destroyed|updated)"
```

---

## 7. Ansible 코드 리뷰

```
□ FQCN(Fully Qualified Collection Name)이 사용됐는가
□ 모든 태스크에 name이 있는가
□ become이 필요한 태스크에만 사용됐는가
□ 루프에서 loop_control.label이 있는가
□ ignore_errors가 남용되지 않는가
□ ansible-lint 경고가 해소됐는가
```

```bash
# 코드 품질 검사
ansible-lint playbook.yaml
ansible-lint --strict   # 경고도 에러로 처리
```

---

## 8. CI/CD에서 자동 검증

```yaml
# GitHub Actions
- name: Terraform Validate
  run: terraform validate

- name: Terraform fmt check
  run: terraform fmt -check -recursive

- name: tfsec (보안 정적 분석)
  uses: aquasecurity/tfsec-action@v1.0.0

- name: checkov (정책 검사)
  uses: bridgecrewio/checkov-action@v12
  with:
    directory: .
    framework: terraform

- name: Ansible Lint
  run: ansible-lint
```

---

## 참고 문서

- [tfsec](https://github.com/aquasecurity/tfsec)
- [checkov](https://github.com/bridgecrewio/checkov)
- [ansible-lint](https://ansible.readthedocs.io/projects/lint/)
- [Terraform Best Practices](https://developer.hashicorp.com/terraform/language/style)
