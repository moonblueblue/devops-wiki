---
title: "Configuration Management vs Provisioning"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - configuration-management
sidebar_label: "CM vs 프로비저닝"
---

# Configuration Management vs Provisioning

## 1. 개념 정의

| 구분 | 역할 | 대상 |
|-----|------|------|
| **프로비저닝** | 인프라 리소스를 생성·변경·삭제 | 서버, 네트워크, DB, 스토리지 |
| **구성 관리 (CM)** | 기존 서버에 소프트웨어 설치·설정 | OS 패키지, 설정 파일, 서비스 |

```
프로비저닝 → "서버를 만든다"
구성 관리   → "만들어진 서버를 설정한다"
```

---

## 2. 프로비저닝 도구

인프라 리소스의 **생애주기(lifecycle)**를 관리한다.

```hcl
# Terraform - VPC, 서브넷, EC2, RDS 생성
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.small"
  subnet_id     = aws_subnet.public.id
}

resource "aws_db_instance" "postgres" {
  engine         = "postgres"
  instance_class = "db.t3.micro"
}
```

| 도구 | 특징 |
|-----|------|
| **Terraform** | 멀티클라우드, HCL, 가장 넓은 생태계 |
| **OpenTofu** | Terraform 오픈소스 포크, CNCF |
| **Pulumi** | 일반 프로그래밍 언어로 인프라 정의 |
| **CloudFormation** | AWS 네이티브, 무료 |
| **AWS CDK** | TypeScript/Python으로 CloudFormation 생성 |

---

## 3. 구성 관리 도구

이미 존재하는 서버의 **상태**를 원하는 설정으로 유지한다.

```yaml
# Ansible - 서버에 nginx 설치·설정
- name: 웹 서버 설정
  hosts: web_servers
  tasks:
  - name: nginx 설치
    apt:
      name: nginx
      state: present
  - name: 설정 배포
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
```

| 도구 | 방식 | 특징 |
|-----|------|------|
| **Ansible** | 에이전트리스 (SSH) | 낮은 진입장벽, YAML |
| **Chef** | 에이전트 기반 | Ruby DSL, 대규모 엔터프라이즈 |
| **Puppet** | 에이전트 기반 | 선언형, 수십 년 역사 |
| **SaltStack** | 에이전트/에이전트리스 | 빠른 실행, 이벤트 기반 |

---

## 4. 함께 사용하는 패턴

```
1단계: Terraform으로 인프라 프로비저닝
──────────────────────────────────────
  aws_vpc → aws_subnet → aws_instance
  (서버가 생성됨)

2단계: Ansible로 소프트웨어 구성 관리
──────────────────────────────────────
  → nginx 설치
  → 앱 배포
  → 모니터링 에이전트 설치
```

```hcl
# Terraform이 Ansible을 호출하는 예시
resource "null_resource" "configure" {
  provisioner "local-exec" {
    command = <<-EOF
      ansible-playbook \
        -i '${aws_instance.web.public_ip},' \
        playbook.yaml
    EOF
  }

  depends_on = [aws_instance.web]
}
```

---

## 5. 경계가 흐려지는 경우

Ansible도 클라우드 모듈로 프로비저닝이 가능하고,
Terraform도 `provisioner`로 설정을 적용할 수 있다.

| 상황 | 권장 |
|-----|------|
| 인프라 생성·변경·드리프트 관리 | Terraform |
| OS·소프트웨어 설정, 앱 배포 | Ansible |
| 간단한 서버 1~2대 설정 | Ansible만으로 충분 |
| 멀티클라우드 대규모 인프라 | Terraform + Ansible 조합 |

---

## 참고 문서

- [Terraform vs Ansible (HashiCorp)](https://developer.hashicorp.com/terraform/intro/vs/chef-puppet)
- [Ansible 공식 문서](https://docs.ansible.com/)
