---
title: "선언형 vs 명령형 IaC"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - declarative
sidebar_label: "선언형 vs 명령형"
---

# 선언형 vs 명령형 IaC

## 1. 핵심 차이

| 구분 | 선언형 (Declarative) | 명령형 (Imperative) |
|-----|---------------------|-------------------|
| 정의 방식 | **원하는 상태** 기술 | **실행할 단계** 기술 |
| 도구 결정 | 어떻게 할지는 도구가 결정 | 순서·방법을 직접 지정 |
| 멱등성 | 기본 보장 | 직접 구현 필요 |
| 드리프트 감지 | 가능 | 어려움 |
| 대표 도구 | Terraform, K8s, CloudFormation | Ansible, Chef, Bash |

---

## 2. 선언형 (Declarative)

원하는 **최종 상태**를 정의한다.
도구가 현재 상태와 비교해 필요한 작업을 결정한다.

```hcl
# Terraform - "이런 EC2 인스턴스가 있어야 한다"
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

```yaml
# Kubernetes - "이 파드가 3개 실행되어야 한다"
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: myapp:v1.0
```

**동작 방식**:
```
현재 상태 조회
    → 선언된 상태와 비교 (diff)
        → 차이만큼 자동 적용
```

---

## 3. 명령형 (Imperative)

**실행할 단계**를 순서대로 정의한다.

```yaml
# Ansible - "이 단계를 순서대로 실행하라"
- name: nginx 패키지 설치
  apt:
    name: nginx
    state: present

- name: 설정 파일 복사
  copy:
    src: nginx.conf
    dest: /etc/nginx/nginx.conf

- name: nginx 서비스 시작
  systemd:
    name: nginx
    state: started
```

```bash
# Bash - 순서가 매우 중요
apt-get install -y nginx
cp nginx.conf /etc/nginx/nginx.conf
systemctl start nginx
```

**특징**:
- 실행 순서가 중요
- 복잡한 분기·조건 처리에 유연
- 멱등성을 직접 보장해야 함

---

## 4. 언제 어떤 방식을 선택하는가

| 상황 | 선택 |
|-----|------|
| 클라우드 리소스 생성·관리 | 선언형 (Terraform) |
| 서버 소프트웨어 설치·설정 | 명령형 (Ansible) |
| 쿠버네티스 배포 | 선언형 (K8s YAML) |
| 복잡한 데이터 이관 | 명령형 (스크립트) |
| 드리프트 감지가 필요한 인프라 | 선언형 |

---

## 5. 실제 조합 패턴

```
Terraform (선언형)
  → 서버, 네트워크, DB 생성
      ↓
Ansible (명령형)
  → 생성된 서버에 앱 설치·설정
```

두 방식은 서로 배타적이 아니라 **보완 관계**다.

---

## 참고 문서

- [Terraform: declarative](https://developer.hashicorp.com/terraform/intro)
- [Ansible: imperative automation](https://docs.ansible.com/)
