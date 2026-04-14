---
title: "Ansible vs Terraform 역할 구분"
date: 2026-04-14
tags:
  - ansible
  - terraform
  - iac
sidebar_label: "Ansible vs Terraform"
---

# Ansible vs Terraform 역할 구분

## 1. 핵심 차이

| 항목 | Terraform | Ansible |
|-----|-----------|---------|
| 주요 목적 | 인프라 프로비저닝 | 서버 구성 관리 |
| 패러다임 | 선언형 | 명령형 |
| 상태 관리 | state 파일로 추적 | 없음 (멱등성으로 보완) |
| 드리프트 감지 | 있음 (`terraform plan`) | 없음 |
| 에이전트 | 필요 없음 | 필요 없음 (SSH) |
| 클라우드 리소스 | 매우 강함 | 가능하지만 비권장 |
| OS 설정 | 제한적 | 매우 강함 |
| 실행 속도 | 느림 (API 호출) | 빠름 |

---

## 2. 무엇으로 무엇을 하는가

### Terraform으로 해야 하는 것

```hcl
# ✅ 클라우드 리소스 생성·관리
resource "aws_vpc" "main" { ... }
resource "aws_eks_cluster" "main" { ... }
resource "aws_rds_instance" "db" { ... }
resource "aws_s3_bucket" "assets" { ... }

# ✅ 네트워크 설계
resource "aws_security_group" "web" { ... }
resource "aws_route53_record" "api" { ... }

# ✅ IAM 정책·역할
resource "aws_iam_role" "eks_node" { ... }
```

### Ansible로 해야 하는 것

```yaml
# ✅ OS 패키지 설치·업데이트
- apt:
    name: [nginx, docker, prometheus-node-exporter]
    state: present

# ✅ 설정 파일 배포 및 관리
- template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf

# ✅ 서비스 시작·중지·재시작
- systemd:
    name: nginx
    state: restarted

# ✅ 앱 배포 (tar 압축 해제, 환경 변수 설정 등)
- unarchive:
    src: myapp-v2.0.tar.gz
    dest: /opt/myapp/
```

---

## 3. 경계가 흐릿한 영역

### 클라우드 리소스 - Terraform 권장

```yaml
# ❌ Ansible로 가능하지만 비권장
- amazon.aws.ec2_instance:
    name: web-server
    instance_type: t3.micro
    # state 추적이 안됨 → 중복 생성 위험
```

```hcl
# ✅ Terraform 사용
resource "aws_instance" "web" {
  instance_type = "t3.micro"
  # 상태 추적, 드리프트 감지, 의존성 관리 가능
}
```

### 서버 초기 설정 - Ansible 권장

```hcl
# ❌ Terraform provisioner 가능하지만 비권장
resource "aws_instance" "web" {
  provisioner "remote-exec" {
    inline = ["apt-get install nginx"]
    # 에러 시 복구 어려움, 멱등성 없음
  }
}
```

---

## 4. 전형적인 조합 패턴

```
1단계: Terraform으로 인프라 프로비저닝
──────────────────────────────────────
  VPC, 서브넷, 보안그룹, EC2, RDS 생성
  Terraform output으로 IP 주소 추출

2단계: Ansible로 서버 구성 관리
──────────────────────────────
  생성된 EC2에 SSH 접속
  nginx, docker, app 설치
  설정 파일 배포
  서비스 시작
```

```hcl
# Terraform이 Ansible 인벤토리를 자동 생성
resource "local_file" "ansible_inventory" {
  content = templatefile("inventory.tpl", {
    web_ips = aws_instance.web[*].public_ip
    db_ip   = aws_db_instance.main.address
  })
  filename = "../ansible/inventory.yaml"
}
```

---

## 5. 어떤 상황에 무엇을 선택하는가

| 상황 | 선택 | 이유 |
|-----|------|------|
| 클라우드 인프라 생성 | Terraform | 드리프트 감지, state 관리 |
| 서버 OS 설정 | Ansible | 에이전트리스, 멱등성 |
| 앱 배포 자동화 | Ansible | 빠르고 유연함 |
| K8s 리소스 관리 | Terraform 또는 Helm | 선언형, state 추적 |
| 긴급 패치 적용 | Ansible | Ad-hoc 명령 즉시 실행 |
| 멀티클라우드 인프라 | Terraform | 18,000+ 프로바이더 |
| 컴플라이언스 설정 | Ansible | 감사 로그, 검증 용이 |

---

## 참고 문서

- [Terraform vs Ansible](https://developer.hashicorp.com/terraform/intro/vs/chef-puppet)
- [Ansible 공식 문서](https://docs.ansible.com/)
