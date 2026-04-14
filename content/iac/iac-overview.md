---
title: "IaC란 무엇인가"
date: 2026-04-14
tags:
  - iac
  - terraform
  - ansible
  - infrastructure
sidebar_label: "IaC란"
---

# IaC란 무엇인가

## 1. 개요

인프라를 코드로 정의하고 자동화하는 방식.
수동 클릭이나 SSH 접속 대신 코드로 인프라를 관리한다.

```
수동 방식           IaC 방식
──────────────      ──────────────────────────
콘솔 클릭     →     코드 작성 → 리뷰 → 적용
SSH 접속      →     플레이북 실행
메모장 기록   →     Git 이력
```

---

## 2. 핵심 원칙

| 원칙 | 설명 |
|-----|------|
| 버전 관리 | Git으로 인프라 변경 이력 추적 |
| 멱등성 | 같은 코드를 여러 번 실행해도 결과 동일 |
| 자동화 | CI/CD 파이프라인에서 인프라 변경 적용 |
| 문서화 | 코드 자체가 인프라의 실행 가능한 문서 |

---

## 3. IaC 도구 비교 (2025-2026)

| 도구 | 유형 | 언어 | 특징 |
|-----|------|------|------|
| **Terraform** | 프로비저닝 | HCL | 시장 점유율 ~76%, 18,000+ 프로바이더 |
| **OpenTofu** | 프로비저닝 | HCL | Terraform 오픈소스 포크, CNCF 소속 |
| **Pulumi** | 프로비저닝 | Python/TS/Go | 일반 언어 사용, 빠른 성장세 |
| **CloudFormation** | 프로비저닝 | JSON/YAML | AWS 네이티브 |
| **AWS CDK** | 프로비저닝 | Python/TS/Java | CloudFormation 생성기 |
| **Ansible** | 구성 관리 | YAML | 에이전트리스, 진입 장벽 낮음 |
| **Chef** | 구성 관리 | Ruby DSL | 대규모 엔터프라이즈 |
| **Puppet** | 구성 관리 | Puppet DSL | 선언형 구성, 에이전트 기반 |

> **2025 라이선스 이슈**: HashiCorp가 Terraform을 BSL로 변경.
> 오픈소스 대안으로 **OpenTofu**가 CNCF에 합류.

---

## 4. 왜 IaC인가

### 드리프트 감지

```bash
terraform plan
# 출력: "1 to change" - 콘솔에서 직접 변경한 것 감지
```

### GitOps 연동

```
개발자 → PR 생성 → 코드 리뷰 → merge
    → CI/CD → terraform apply
```

- 모든 인프라 변경에 PR 리뷰 적용
- 변경 이력 완전 추적
- 빠른 롤백 (`git revert`)

---

## 참고 문서

- [Terraform 공식 문서](https://developer.hashicorp.com/terraform)
- [OpenTofu](https://opentofu.org/)
- [roadmap.sh/devops](https://roadmap.sh/devops)
