---
title: "IaC란 무엇인가"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - infrastructure
sidebar_label: "IaC 개요"
---

# IaC란 무엇인가

## 1. 개요

인프라를 코드로 정의하고 자동화하는 방식.
수동 클릭이나 SSH 접속 대신 코드로 인프라를 관리한다.

**핵심 원칙**:

| 원칙 | 설명 |
|-----|------|
| 버전 관리 | Git으로 인프라 변경 이력 추적 |
| 멱등성 | 같은 코드를 여러 번 실행해도 결과 동일 |
| 자동화 | CI/CD 파이프라인에서 인프라 변경 적용 |
| 문서화 | 코드 자체가 인프라의 실행 가능한 문서 |

---

## 2. 선언형 vs 명령형

### 선언형 (Declarative)

원하는 **최종 상태**를 정의한다.
도구가 현재 상태와 비교해 필요한 작업을 결정한다.

```hcl
# "이런 EC2 인스턴스가 있어야 한다"
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
}
```

- 대표 도구: Terraform, CloudFormation, Kubernetes
- 특징: 드리프트 감지 가능, 순서 독립적

### 명령형 (Imperative)

**실행할 단계**를 정의한다.
지정한 순서대로 명령을 실행한다.

```yaml
# "이 단계를 순서대로 실행하라"
- name: nginx 설치
  apt:
    name: nginx
    state: present
- name: nginx 시작
  systemd:
    name: nginx
    state: started
```

- 대표 도구: Ansible, Chef, Puppet
- 특징: 복잡한 워크플로우 표현 용이, 순서 중요

---

## 3. 프로비저닝 vs 구성 관리

| 구분 | 역할 | 대표 도구 |
|-----|------|---------|
| 프로비저닝 | 인프라 리소스 생성/관리 (서버, 네트워크, DB) | Terraform, CloudFormation, Pulumi |
| 구성 관리 | 기존 서버에 소프트웨어 설치·설정 | Ansible, Chef, Puppet, SaltStack |

**일반적인 조합**:
```
Terraform → 서버/네트워크 생성
    ↓
Ansible → 생성된 서버에 앱 배포·설정
```

---

## 4. IaC 도구 비교 (2025-2026)

| 도구 | 유형 | 언어 | 클라우드 | 특징 |
|-----|------|------|---------|------|
| **Terraform** | 프로비저닝 | HCL | 멀티클라우드 | 시장 점유율 ~76%, 18,000+ 프로바이더 |
| **OpenTofu** | 프로비저닝 | HCL | 멀티클라우드 | Terraform 오픈소스 포크, CNCF 소속 |
| **Pulumi** | 프로비저닝 | Python/TS/Go | 멀티클라우드 | 일반 언어 사용, 45% YoY 성장 |
| **CloudFormation** | 프로비저닝 | JSON/YAML | AWS 전용 | AWS 네이티브 |
| **AWS CDK** | 프로비저닝 | Python/TS/Java | AWS 전용 | CloudFormation 생성기 |
| **Ansible** | 구성 관리 | YAML | 멀티OS | 에이전트리스, 진입 장벽 낮음 |
| **Chef** | 구성 관리 | Ruby DSL | 멀티OS | 대규모 엔터프라이즈 |
| **Puppet** | 구성 관리 | Puppet DSL | 멀티OS | 선언형 구성, 에이전트 기반 |

> **2025 라이선스 이슈**: HashiCorp가 Terraform을 BSL(Business Source License)로 변경.
> 오픈소스 대안으로 **OpenTofu**가 CNCF에 합류. 신규 프로젝트는 OpenTofu 검토 권장.

---

## 5. 주요 이점

### 드리프트 감지

코드와 실제 인프라 상태를 자동 비교한다.

```bash
terraform plan
# 출력: "1 to change" - 누군가 콘솔에서 직접 변경한 것 감지
```

### GitOps 연동

```
개발자 → PR 생성 → 코드 리뷰 → merge → CI/CD → 인프라 변경
```

- 모든 인프라 변경에 PR 리뷰 적용
- 변경 이력 완전 추적
- 빠른 롤백 (git revert)

---

## 참고 문서

- [Terraform 공식 문서](https://developer.hashicorp.com/terraform)
- [OpenTofu](https://opentofu.org/)
- [roadmap.sh/devops](https://roadmap.sh/devops)
