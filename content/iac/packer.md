---
title: "Packer로 머신 이미지 관리"
date: 2026-04-14
tags:
  - packer
  - iac
  - ami
  - image
sidebar_label: "Packer"
---

# Packer로 머신 이미지 관리

## 1. 개요

HashiCorp Packer는 동일한 설정으로
여러 플랫폼의 머신 이미지를 자동 생성하는 도구.

```
Packer 템플릿
    → 임시 VM 시작
        → 프로비저닝 (shell, Ansible 등)
            → 이미지 스냅샷 생성
                → 임시 VM 삭제
```

| 생성 가능한 이미지 | 설명 |
|----------------|------|
| AWS AMI | EC2 인스턴스 이미지 |
| GCP 이미지 | GCE 인스턴스 이미지 |
| Azure VHD | Azure VM 이미지 |
| VMware OVF | 온프레미스 가상 머신 |
| Docker 이미지 | 컨테이너 이미지 |

---

## 2. 설치

```bash
# macOS
brew tap hashicorp/tap
brew install hashicorp/tap/packer

# Linux
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor \
  | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] \
  https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install packer

packer version
```

---

## 3. HCL2 템플릿 (권장)

```hcl
# aws-ubuntu.pkr.hcl
packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = "~> 1.0"
    }
  }
}

variable "aws_region" {
  default = "ap-northeast-2"
}

variable "app_version" {
  default = "2.0.0"
}

source "amazon-ebs" "ubuntu" {
  region        = var.aws_region
  source_ami_filter {
    filters = {
      name                = "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"
      virtualization-type = "hvm"
    }
    owners      = ["099720109477"]   # Canonical
    most_recent = true
  }
  instance_type = "t3.micro"
  ssh_username  = "ubuntu"
  ami_name      = "my-app-${var.app_version}-{{timestamp}}"
  ami_description = "My App v${var.app_version} baked AMI"

  tags = {
    Version     = var.app_version
    BuildDate   = "{{timestamp}}"
    OS          = "ubuntu-22.04"
  }
}

build {
  sources = ["source.amazon-ebs.ubuntu"]

  # Shell 프로비저닝
  provisioner "shell" {
    inline = [
      "sudo apt-get update -y",
      "sudo apt-get install -y nginx curl git",
      "sudo systemctl enable nginx",
    ]
  }

  # Ansible 프로비저닝
  provisioner "ansible" {
    playbook_file = "./playbook.yaml"
    extra_arguments = [
      "--extra-vars", "app_version=${var.app_version}"
    ]
  }

  # 파일 업로드
  provisioner "file" {
    source      = "./config/app.conf"
    destination = "/tmp/app.conf"
  }

  provisioner "shell" {
    inline = ["sudo mv /tmp/app.conf /etc/app/app.conf"]
  }
}
```

---

## 4. 실행

```bash
# 플러그인 설치
packer init aws-ubuntu.pkr.hcl

# 유효성 검사
packer validate aws-ubuntu.pkr.hcl

# 빌드
packer build aws-ubuntu.pkr.hcl

# 변수 오버라이드
packer build \
  -var "aws_region=us-east-1" \
  -var "app_version=3.0.0" \
  aws-ubuntu.pkr.hcl

# 디버그 모드
packer build -debug aws-ubuntu.pkr.hcl
```

---

## 5. CI/CD 파이프라인 연동

```yaml
# GitHub Actions
- name: Packer Build
  run: |
    packer init ./packer/
    packer validate ./packer/
    packer build \
      -var "app_version=${{ github.ref_name }}" \
      ./packer/aws-ubuntu.pkr.hcl
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## 6. Terraform과 연동

```hcl
# Packer가 생성한 AMI를 Terraform에서 사용
data "aws_ami" "app" {
  most_recent = true
  owners      = ["self"]

  filter {
    name   = "name"
    values = ["my-app-*"]
  }

  filter {
    name   = "tag:Version"
    values = ["2.0.0"]
  }
}

resource "aws_instance" "web" {
  ami           = data.aws_ami.app.id
  instance_type = "t3.small"
}
```

---

## 7. Packer를 사용하는 이유 (Immutable Infrastructure)

```
기존 방식 (Mutable):
  서버 실행 중 → apt upgrade → 설정 변경 → 재시작
  문제: 환경별 차이 발생, 롤백 어려움

Packer 방식 (Immutable):
  새 AMI 빌드 → 새 인스턴스 시작 → 트래픽 전환 → 구 인스턴스 종료
  장점: 일관성 보장, 즉시 롤백 가능
```

---

## 참고 문서

- [Packer 공식 문서](https://developer.hashicorp.com/packer)
- [Amazon EBS Builder](https://developer.hashicorp.com/packer/integrations/hashicorp/amazon)
- [Ansible Provisioner](https://developer.hashicorp.com/packer/integrations/hashicorp/ansible)
