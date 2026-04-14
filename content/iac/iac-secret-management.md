---
title: "시크릿 관리와 IaC"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - secret
  - security
sidebar_label: "시크릿 관리"
---

# 시크릿 관리와 IaC

## 1. IaC에서 시크릿이 문제인 이유

```hcl
# ❌ 절대 이렇게 하면 안 됨
resource "aws_db_instance" "main" {
  password = "mypassword123"   # Git에 노출됨
}
```

```yaml
# ❌ Ansible에서도 마찬가지
vars:
  db_password: "mypassword123"  # Git에 노출됨
```

---

## 2. Terraform에서 시크릿 처리

### 환경 변수 (간단한 경우)

```bash
# AWS 자격증명
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."

# Terraform 변수로 전달
export TF_VAR_db_password="mypassword"
```

```hcl
variable "db_password" {
  type      = string
  sensitive = true   # plan/apply 출력에서 마스킹
}
```

### AWS Secrets Manager에서 읽기 (권장)

```hcl
# Secrets Manager에서 시크릿 조회
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/database/password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

### HashiCorp Vault 연동

```hcl
provider "vault" {
  address = "https://vault.internal:8200"
}

data "vault_generic_secret" "db" {
  path = "secret/prod/database"
}

resource "aws_db_instance" "main" {
  password = data.vault_generic_secret.db.data["password"]
}
```

### tfvars 파일 (gitignore 필수)

```hcl
# secrets.tfvars (절대 Git에 커밋하지 않음)
db_password = "mypassword"
api_key     = "secret-key"
```

```bash
# 적용 시 명시적으로 전달
terraform apply -var-file=secrets.tfvars
```

```gitignore
# .gitignore
secrets.tfvars
*.auto.tfvars
```

---

## 3. Ansible Vault

Ansible 내장 암호화 기능.
민감한 변수를 암호화해 Git에 안전하게 저장한다.

```bash
# 파일 암호화
ansible-vault encrypt group_vars/all/vault.yaml

# 파일 복호화
ansible-vault decrypt group_vars/all/vault.yaml

# 암호화된 채로 내용 보기
ansible-vault view group_vars/all/vault.yaml

# 내용 수정
ansible-vault edit group_vars/all/vault.yaml

# 비밀번호 변경
ansible-vault rekey group_vars/all/vault.yaml
```

```yaml
# group_vars/all/vault.yaml (암호화 전)
vault_db_password: "mypassword"
vault_api_key: "secret-key"

# 암호화 후 파일 내용 (Git에 커밋 OK)
$ANSIBLE_VAULT;1.1;AES256
66386439653236336462626566653...
```

```yaml
# group_vars/all/vars.yaml (일반 변수)
db_password: "{{ vault_db_password }}"   # vault 변수 참조
```

```bash
# vault 비밀번호 파일 사용 (CI/CD)
ansible-playbook site.yaml \
  --vault-password-file ~/.vault_pass

# 또는 환경 변수
export ANSIBLE_VAULT_PASSWORD_FILE=~/.vault_pass
ansible-playbook site.yaml
```

---

## 4. 외부 시크릿 관리 도구

### HashiCorp Vault

```yaml
# Ansible에서 Vault 조회
- name: DB 비밀번호 가져오기
  community.hashi_vault.vault_read:
    path: "secret/data/prod/database"
    auth_method: token
    token: "{{ lookup('env', 'VAULT_TOKEN') }}"
  register: db_secret

- name: DB 접속 확인
  postgresql_ping:
    login_host: "{{ db_host }}"
    login_password: "{{ db_secret.data.data.password }}"
```

### AWS Secrets Manager (Ansible)

```yaml
- name: AWS Secrets Manager에서 읽기
  amazon.aws.aws_secret:
    name: "prod/database/password"
    region: ap-northeast-2
  register: db_password

- name: DB 설정
  template:
    src: db.conf.j2
    dest: /etc/app/db.conf
  vars:
    password: "{{ db_password.secret }}"
```

---

## 5. State 파일 보안

```hcl
# S3 서버 사이드 암호화 (필수)
terraform {
  backend "s3" {
    bucket  = "my-terraform-state"
    key     = "prod/terraform.tfstate"
    region  = "ap-northeast-2"
    encrypt = true          # AES-256 암호화
    kms_key_id = "arn:aws:kms:..."  # KMS 키 사용 (선택)
  }
}
```

```bash
# State에서 민감 값 확인 (주의: 평문 출력)
terraform state show aws_db_instance.main

# 민감 출력 값 확인 (sensitive 마스킹 우회)
terraform output -json | jq .db_password.value
```

---

## 6. 요약: 시크릿별 권장 방법

| 시크릿 유형 | Terraform | Ansible |
|-----------|-----------|---------|
| 클라우드 자격증명 | 환경 변수 / OIDC | 환경 변수 / IAM Role |
| DB 비밀번호 | Secrets Manager / Vault | ansible-vault |
| API 키 | Secrets Manager / Vault | ansible-vault |
| SSH 키 | Terraform 관리 금지 | ansible-vault |
| 인증서 | ACM / Vault | ansible-vault |

---

## 참고 문서

- [Terraform Sensitive Variables](https://developer.hashicorp.com/terraform/language/values/variables#suppressing-values-in-cli-output)
- [Ansible Vault](https://docs.ansible.com/ansible/latest/vault_guide/)
- [HashiCorp Vault](https://developer.hashicorp.com/vault)
