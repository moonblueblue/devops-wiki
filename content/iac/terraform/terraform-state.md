---
title: "Terraform State — Workspace·분할·마이그레이션·리팩터링"
sidebar_label: "TF State"
sidebar_position: 2
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - iac
  - terraform
  - opentofu
  - state
  - refactor
---

# Terraform State

> [State 관리](../concepts/state-management.md)에서 다룬 **개념·전략**은
> 모든 IaC 도구에 공통. 본 글은 **Terraform/OpenTofu 특화**: workspace,
> 다중 state 분할, 리팩터링 블록(`moved`·`removed`·`import`), state
> 마이그레이션 도구.
>
> "큰 state 하나"는 결국 깨진다. **언제·어떻게 쪼개고, 어떻게 안전하게
> 이전하는가**가 운영의 본질.

- **전제**: [Terraform 기본](./terraform-basics.md), [State 관리](../concepts/state-management.md)
- 본 글에서 다루지 않는 것: **개념적 backend·lock·암호화** (→ State 관리)

---

## 1. Workspace — 같은 코드, 다른 state

### 1.1 정의

**Workspace** = 동일 configuration에 대해 **별도 state 파일**을 생성하는
메커니즘. 디렉토리 구조 변경 없이 state만 분리.

```bash
terraform workspace list                # 목록
terraform workspace new dev             # 생성
terraform workspace select prod         # 전환
terraform workspace show                # 현재
terraform workspace delete dev          # 삭제
```

backend의 state 경로 구조:
```text
s3://myorg-tf-state/network/
├── env:/dev/terraform.tfstate
├── env:/stg/terraform.tfstate
└── env:/prod/terraform.tfstate
```

### 1.2 코드에서 활용

```hcl
locals {
  env       = terraform.workspace
  is_prod   = local.env == "prod"
  instance  = local.is_prod ? "m5.large" : "t3.small"
  replicas  = local.is_prod ? 3 : 1
}

resource "aws_instance" "web" {
  instance_type = local.instance
  count         = local.replicas
}
```

### 1.3 Workspace는 만능이 아니다

**HashiCorp 공식 권장**(2025+):
- **단기·임시 환경**: workspace OK (PR 미리보기, ephemeral test)
- **장기 운영 환경**(prod·stg): **별도 디렉토리 권장**

이유:
- workspace는 하나의 backend·하나의 provider configuration — **AWS
  account·IAM 권한 분리 불가** (코드 레벨에서 구조적으로)
- 잘못된 workspace에서 `apply` 사고 흔함 (CLI에 현재 workspace 표시 약함)
- 환경마다 provider·module·variable 차이가 커지면 ternary 폭주
- compliance·blast radius 분리 어려움

### 1.4 권장 결합

| 환경 | 패턴 |
|---|---|
| dev·stg·prod (장기) | 디렉토리 분리 |
| feature branch 미리보기 | workspace |
| 멀티테넌트 SaaS의 customer당 stack | workspace 또는 fanout 도구 |

---

## 2. 디렉토리 분할 패턴

### 2.1 표준 구조

```text
infra/
├── modules/
│   ├── vpc/
│   ├── eks/
│   └── rds/
├── live/
│   ├── _global/
│   │   ├── iam-baseline/   # state 1: 멱등 IAM
│   │   └── route53/        # state 2: DNS
│   ├── prod/
│   │   ├── network/        # state 3
│   │   ├── data/           # state 4: RDS, Redis
│   │   └── compute/        # state 5: EKS, app
│   └── stg/
│       ├── network/
│       ├── data/
│       └── compute/
└── ci/
```

각 leaf 디렉토리 = **하나의 state**. 자체 backend·lock·variable.

### 2.2 분할 기준

| 기준 | 효과 |
|---|---|
| **변경 빈도** | 자주 바뀌는 app과 거의 안 바뀌는 IAM 분리 |
| **권한 경계** | 팀별·역할별 IAM 차등 |
| **수명** | 장기(VPC) vs 단기(테스트 환경) |
| **blast radius** | 한 stack의 destroy가 다른 stack을 깨지 않도록 |
| **provider 차이** | AWS·Azure·K8s·vSphere 섞일 때 분리 |

### 2.3 cross-state 의존 패턴

#### 패턴 A: `terraform_remote_state`

```hcl
data "terraform_remote_state" "network" {
  backend = "s3"
  config = {
    bucket = "myorg-tf-state"
    key    = "live/prod/network/terraform.tfstate"
    region = "us-east-1"
  }
}

resource "aws_eks_cluster" "main" {
  vpc_config {
    subnet_ids = data.terraform_remote_state.network.outputs.private_subnet_ids
  }
}
```

**한계**: 다른 state **파일 전체를 읽을 권한** 필요. output뿐 아니라
**resource 속성 전체(시크릿 포함)** 가 노출됨 — `sensitive` output을
선언해도 의미 없음(state 자체를 읽으므로). 권한 분리·시크릿 보호
관점에서 모두 깨짐.

#### 패턴 B: 명시 채널 (권장)

| 채널 | 용도 |
|---|---|
| **AWS SSM Parameter Store / GCP Secret Manager / Azure App Config** | 다른 stack이 publish, 본 stack이 `data.aws_ssm_parameter.x`로 read |
| **Resource discovery** (`data.aws_vpc`, `data.aws_subnets`) | tag·이름으로 발견 |
| **HCP Terraform `tfe_outputs`** | HCP 사용 시 |

```hcl
# 패턴 B 예시
data "aws_ssm_parameter" "private_subnets" {
  name = "/prod/network/private-subnets"
}

# stringList → list
locals {
  private_subnets = split(",", data.aws_ssm_parameter.private_subnets.value)
}
```

**원칙**: cross-state 의존을 **API 계약**으로 만들면 backend·구조 변경에
영향 적음.

### 2.4 `for_each` 모듈 fanout 패턴

같은 stack을 여러 인스턴스로:

```hcl
module "tenant" {
  source   = "../modules/tenant"
  for_each = var.tenants
  
  name        = each.key
  environment = each.value.env
  size        = each.value.size
}
```

대형 fanout(수십 tenant)은 **plan 시간 폭증** — 다음 옵션이 표준:

| 도구 | 라이선스·모델 | 핵심 |
|---|---|---|
| **Terraform Stacks** | **HCP Terraform 전용**(유료) | 2025 GA. CLI 서브커맨드는 OSS 1.14+ 포함되지만 **실행은 HCP** |
| **Terragrunt** | OSS | 디렉토리 단위 wrapper, dependency·remote_state·module fanout |
| **Terramate** | OSS | stack 그래프, 변경 영향 분석 |
| **Atlantis multi-stack** | OSS | PR 자동화 + 다중 stack |

온프레/OSS 환경은 **Terragrunt 또는 Terramate**가 현실적. Stacks는
HCP 사용자에게만 유효한 선택지.

---

## 3. State 명령 (Terraform/OpenTofu)

### 3.1 read-only

```bash
terraform state list                 # 관리 중인 리소스 주소
terraform state list module.vpc      # 모듈 내부만
terraform state show <addr>          # 속성 확인
terraform state pull > state.json    # 백업 (분석·검사)
```

### 3.2 mutating — 위험순

```bash
# 1. mv — 안전
terraform state mv aws_instance.web aws_instance.api

# 2. mv 모듈 간
terraform state mv module.web.aws_instance.x module.api.aws_instance.x

# 3. mv 다른 state로 (-state-out)
terraform state mv \
  -state=src.tfstate \
  -state-out=dst.tfstate \
  aws_instance.web aws_instance.web

# 4. rm — 리소스는 그대로, state에서만 제거
terraform state rm aws_instance.web

# 5. replace-provider — provider 이전
terraform state replace-provider \
  registry.terraform.io/hashicorp/aws \
  registry.terraform.io/hashicorp/aws \
  -lock-timeout=5m
```

### 3.3 직접 명령은 마지막 수단

HashiCorp 공식 입장: **state 명령보다 선언형 블록**(`moved`·`removed`·
`import`)이 우선. 명령은 PR review·history가 없어 협업이 어렵다.

---

## 4. 선언형 리팩터링 블록

### 4.1 `moved` (TF 1.1+ / OpenTofu 1.6+) — 리소스 이름·위치 변경

```hcl
# BEFORE
resource "aws_instance" "web" { ... }

# AFTER (이름 변경)
resource "aws_instance" "api" { ... }

moved {
  from = aws_instance.web
  to   = aws_instance.api
}
```

`apply` 시 destroy/recreate 대신 **state key만 변경**. PR diff에 의도가
명시되어 review 가능.

**전형적 활용**:

| 시나리오 | from | to |
|---|---|---|
| 이름 변경 | `aws_instance.web` | `aws_instance.api` |
| 모듈로 추출 | `aws_instance.web` | `module.app.aws_instance.web` |
| `count` → `for_each` | `aws_instance.web[0]` | `aws_instance.web["alice"]` |
| 모듈 간 이동 | `module.a.aws_instance.x` | `module.b.aws_instance.x` |
| **모듈 내부 리팩터** | (모듈 v1.x 내부) | (모듈 v2.x 내부) |

**모듈 메인테이너 시각**: 모듈 자체의 publish version이 올라가며
내부 리소스 주소가 바뀌는 경우 `moved` 블록을 **모듈 내부**에 두면,
사용자가 새 버전으로 업그레이드해도 destroy/recreate 없이 자동 이동.
사용자가 자신의 root에서 `moved` 블록을 따로 작성하지 않아도 됨.

### 4.2 `removed` (TF 1.7+ / OpenTofu 1.7+) — 선언적 제거

> ⚠ **`destroy` 기본값은 `true`**. 단순히 `removed` 블록만 추가하면
> **실제 리소스가 destroy됨**. IaC 관리에서만 분리하려면 반드시
> `lifecycle { destroy = false }` 명시. prod에서 의도치 않은 destroy
> 사고의 단골 원인.

```hcl
# 이전 코드: resource "aws_instance" "old" {...}
# 새 코드: 해당 resource 블록 삭제 + 아래 추가

removed {
  from = aws_instance.old
  
  lifecycle {
    destroy = false   # state에서만 제거, 실제 리소스 보존
    # destroy = true (기본) → 실제 리소스도 삭제
  }
}
```

`terraform state rm`의 선언적·재현 가능 버전. PR diff에 흔적 남음.

### 4.3 `import` 블록 (TF 1.5+ / OpenTofu 1.6+) — 선언적 import

```hcl
import {
  to = aws_security_group.web
  id = "sg-0123456789abcdef0"
}

resource "aws_security_group" "web" {
  # 속성은 직접 작성하거나 terraform plan -generate-config-out=...
}
```

`plan`에서 import 결과 미리보기, `apply`에서 적용. 기존 명령형
`terraform import`보다 안전.

`-generate-config-out=imported.tf`로 기존 resource block을 자동 생성
→ 수동 정제. 한 번에 수십 리소스 인계할 때 유용.

**제약**: `import` 블록의 **작성 위치**는 root module 한정. 단,
`to` 인자는 `module.app.aws_security_group.web` 같은 자식 모듈
**내부 리소스 주소**를 가리킬 수 있다 — 즉 모듈로 분할된 새 stack에도
import 가능. 단지 import 블록 자체를 모듈 내부에 두는 것이 안 될 뿐
(2026-04 기준, GitHub hashicorp/terraform#33474 트래킹 중).

### 4.4 세 블록 비교

| 블록 | 의도 | state 영향 | 실제 인프라 |
|---|---|---|---|
| `moved` | 이름·위치 변경 | key 갱신 | 변경 없음 |
| `removed` (`destroy=false`) | IaC에서 분리 | 제거 | 보존 |
| `removed` (`destroy=true`) | 완전 삭제 | 제거 | 삭제 |
| `import` | 외부 리소스 인계 | key 추가 | 변경 없음 |

이 세 블록을 함께 쓰면 PR 한 번으로:
- 다른 state로 리소스 이전
- 거대 모듈 분리
- 기존 콘솔 리소스 인계
모두 history 보존하며 review 가능.

---

## 5. State 분할 마이그레이션

### 5.1 단순 분할 — `removed` + `import`

**BEFORE**:

```text
infra/live/prod/
└── all/
    ├── vpc
    ├── subnets
    ├── rds
    └── eks
```

**AFTER**:

```text
infra/live/prod/
├── network/         # vpc, subnets
├── data/            # rds
└── compute/         # eks
```

#### 절차

0. **provider 버전 일치 확인** — 기존·신규 디렉토리의 `.terraform.lock.hcl`
   provider hash가 동일해야 한다. 다르면 import/state mv 시 plan diff
   폭주 (schema 차이로 인한 의도치 않은 재생성)

1. **백업** — 기존 state pull
   ```bash
   cd infra/live/prod/all
   terraform state pull > backup-$(date +%s).json
   ```

2. **새 디렉토리 생성** — 빈 backend, 동일 코드 부분 복사

3. **새 디렉토리에서 `import` 블록**
   ```hcl
   # network/imports.tf
   import {
     to = aws_vpc.main
     id = "vpc-0abc..."
   }
   ```

4. **새 디렉토리 plan·apply**
   ```bash
   cd infra/live/prod/network
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

5. **기존 디렉토리에서 `removed` 블록**
   ```hcl
   # all/remove.tf
   removed {
     from = aws_vpc.main
     lifecycle { destroy = false }   # 실제는 보존
   }
   ```

6. **기존 디렉토리 plan·apply** — state에서 제거

7. **양쪽 `terraform plan` "No changes" 확인**

### 5.2 `state mv` 직접 이동

선언형 블록을 쓰기 어려운 경우(모듈 import 제한, 다른 state로 직접
이동):

```bash
# 양쪽 state pull
cd infra/live/prod/all
terraform state pull > /tmp/all.tfstate

cd infra/live/prod/network
terraform state pull > /tmp/network.tfstate

# 리소스 이동
terraform state mv \
  -state=/tmp/all.tfstate \
  -state-out=/tmp/network.tfstate \
  aws_vpc.main aws_vpc.main

# 검증 후 push
terraform state push -force /tmp/network.tfstate   # ⚠ -force 위험
cd ../all
terraform state push -force /tmp/all.tfstate
```

**`-force`는 마지막 수단**. lineage·serial 검증 우회 — 잘못 쓰면
다른 state를 덮어쓴다.

**lineage 충돌 함정**: 위 절차에서 `state mv -state-out`으로 만든
파일은 **목적지 state와 lineage가 다르므로** push 시 검증 실패가
정상 동작이다. 이를 피하려면:

| 상황 | 권장 방법 |
|---|---|
| 새 backend가 **빈 상태**(첫 init 안 한 backend) | 만든 파일을 그대로 첫 push — 신규 lineage 인정 |
| 목적지가 **이미 다른 state 보유** | `-force` 대신 `removed`+`import` 또는 `tfmigrate`(§5.3) |

§5.2 절차는 일회성·소규모에만, **대규모는 §5.3 tfmigrate가 안전**.

### 5.3 `tfmigrate` 도구 (최우의 선택)

[minamijoyo/tfmigrate](https://github.com/minamijoyo/tfmigrate)는 **GitOps
스타일** state migration 도구. 마이그레이션을 HCL로 선언하고 plan·apply
모델로 실행.

```hcl
# migrations/20260425-split-network.hcl
migration "multi_state" "split_network" {
  from_dir = "infra/live/prod/all"
  to_dir   = "infra/live/prod/network"
  actions = [
    "mv aws_vpc.main aws_vpc.main",
    "mv aws_subnet.private aws_subnet.private",
  ]
}
```

```bash
tfmigrate plan migrations/20260425-split-network.hcl
tfmigrate apply migrations/20260425-split-network.hcl
```

**장점**: 마이그레이션 자체가 PR review 가능, 실패 시 자동 rollback.
대규모 리팩터링의 사실상 표준.

**한계 균형**:
- 단일 메인테이너(minamijoyo) OSS 프로젝트, 상용 백업 없음
- OpenTofu 호환은 따라가지만 새 기능 lag 가능
- `TFMIGRATE_EXEC_PATH` 환경변수로 binary 지정 필요
- 대안: `removed`+`import` 블록을 PR로 쪼개는 수작업, 또는 HCP
  Terraform의 state migration UI

---

## 6. State 백업·복구 (Terraform 특화)

### 6.1 자동 백업 파일

`apply` 시 **로컬 작업 디렉토리**에 `terraform.tfstate.backup` 생성
(직전 state). Remote backend 사용 시에도 로컬 캐시에만 남는다 — CI
러너가 사라지면 함께 사라짐. **Remote 환경의 1차 안전망은 백엔드
versioning** (→ [State 관리 §7.4](../concepts/state-management.md)).

### 6.2 `state pull` + `jq` 감사 패턴

손상 진단·통계·리소스 검색에 가장 자주 쓰이는 패턴.

```bash
# 현재 lineage·serial 확인
terraform state pull | jq '{lineage, serial, terraform_version}'

# 모듈별 리소스 개수
terraform state pull | jq -r '.resources[] | .module // "root"' | sort | uniq -c

# 특정 provider의 모든 리소스
terraform state pull | jq '.resources[] | select(.provider | contains("aws"))'

# 시크릿 스캔 (audit)
terraform state pull | jq -r '.. | strings' | grep -i 'AKIA\|password\|secret'
```

손상 시 백업과 비교하거나, 분할 마이그레이션 전 inventory를 만들 때
필수.

### 6.3 수동 백업 절차

```bash
# 1. 작업 전 항상
terraform state pull > backup-pre-$(date +%Y%m%d-%H%M%S).json

# 2. S3 versioning에서 특정 시점 복구
aws s3api list-object-versions \
  --bucket myorg-tf-state \
  --prefix live/prod/network/

aws s3api copy-object \
  --bucket myorg-tf-state \
  --copy-source "myorg-tf-state/live/prod/network/terraform.tfstate?versionId=XYZ" \
  --key live/prod/network/terraform.tfstate
```

### 6.4 복구 후 검증

```bash
terraform init -reconfigure
terraform plan
# 반드시 "No changes" 또는 의도된 diff만 표시
```

`-reconfigure`로 backend 재인식. plan에서 의도치 않은 destroy/recreate
가 보이면 즉시 중단하고 백업으로 다시 복구.

---

## 7. State 손상 시나리오·대응

| 시나리오 | 증상 | 대응 |
|---|---|---|
| `state rm`/`mv` 오타 후 apply | 멀쩡한 리소스 destroy 시도 | Ctrl-C → 백업 복원 |
| 동시 apply (lock 우회) | serial mismatch | force-unlock 후 백엔드 versioning 복원 |
| state JSON 직접 수정 후 깨짐 | 파싱 실패 | 백업 복원 |
| backend 마이그레이션 중단 | 양쪽 state 존재 | 한쪽 삭제 → reinit |
| provider schema 변경 | plan 에러 | provider 다운그레이드 또는 [Refactor 가이드](https://developer.hashicorp.com/terraform/language/state/refactor) |
| lineage 다른 state push | "lineage doesn't match" | `-force` 절대 금지, 진짜 의도 확인 |

**원칙**: `force-*`는 사람의 명시적 승인 후, 사고 후 plan으로 무결성
확인. CI 자동화 절대 금지.

---

## 8. 안티패턴

| 안티패턴 | 왜 문제 | 교정 |
|---|---|---|
| 단일 monolithic state | lock 경합·blast radius | 환경·레이어 분할 |
| workspace로 prod·stg·dev 영구 운영 | 권한 분리 불가, 잘못된 workspace apply 사고 | 디렉토리 분리 |
| `terraform state push -force` 일상 | 다른 state 덮어씀 | 90% 회피, force는 사고 복구만 |
| `state mv` 명령으로 대규모 리팩터 | history·review 없음 | `moved` 블록 |
| 모듈 추출 시 `count` index 그대로 | recreate | `moved { from to }` |
| `count` → `for_each` 전환에 state mv 안 함 | destroy/recreate | `moved` 블록 또는 `state mv` |
| `-target`으로 부분 destroy 일상화 | 의존 관리 깨짐 | 전체 plan, target은 디버깅만 |
| `terraform_remote_state`로 모든 cross-state | 권한 분리 깨짐, output 노출 | SSM/Secrets Manager 명시 채널 |
| 새 stack에 `import` 안 하고 새로 생성 | duplicate 생성 사고 | 항상 `import` 또는 data 검증 먼저 |
| state lock 분실 시 `force-unlock` 자동 | 진행 중 apply 충돌 | 사람 승인 + 보유자 확인 |
| state JSON 직접 편집 | 파싱·serial·lineage 깨짐 | `state mv`/`mv -state-out` |
| split 후 `terraform_remote_state`로 다시 묶음 | 분할 의미 상실 | publish/subscribe 채널 |
| `removed` 블록을 destroy=true로 prod에서 무심결 | 의도와 다른 destroy | `destroy=false` 기본, 진짜 destroy 별도 단계 |
| state 분할을 한 PR에 너무 크게 | 리뷰 불가 | 작은 batch + tfmigrate |
| 백엔드 마이그레이션 검증 없이 prod | half-migrated | staging 1회 + 백업 |

---

## 9. 도입 로드맵

1. **단일 디렉토리·단일 state로 시작** — over-engineering 금지
2. **remote backend + native lock** — [State 관리](../concepts/state-management.md)
3. **환경 디렉토리 분리** — dev/stg/prod
4. **레이어 분리** — network → data → compute
5. **선언적 리팩터링 블록 도입** — `moved`/`removed`/`import` PR 표준
6. **cross-state 의존을 SSM/Secret Manager로** — `terraform_remote_state` 회피
7. **대규모 분할에 `tfmigrate` 도입**
8. **backend·KMS DR 구성**
9. **drift 감지** — `plan -refresh-only` 정기
10. **Fanout 도구 검토** — multi-tenant·multi-region 시 Terragrunt /
    Terramate (OSS) 또는 HCP Terraform Stacks (유료)

---

## 10. 관련 문서

- [State 관리](../concepts/state-management.md) — backend·lock·암호화·드리프트 개념
- [Terraform 기본](./terraform-basics.md) — HCL·workflow
- [Terraform 모듈](./terraform-modules.md) — 분할의 한 축
- [OpenTofu vs Terraform](./opentofu-vs-terraform.md) — state 암호화·removed 블록 차이
- [IaC 테스트](../operations/testing-iac.md) — terratest, conftest

---

## 참고 자료

- [Terraform: Refactor State 공식 가이드](https://developer.hashicorp.com/terraform/language/state/refactor) — 확인: 2026-04-25
- [Terraform: `moved` 블록 공식](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring) — 확인: 2026-04-25
- [Terraform: `removed` 블록 공식](https://developer.hashicorp.com/terraform/language/block/removed) — 확인: 2026-04-25
- [Terraform: `import` 블록 공식](https://developer.hashicorp.com/terraform/language/import) — 확인: 2026-04-25
- [Terraform: `state mv` 명령 공식](https://developer.hashicorp.com/terraform/cli/commands/state/mv) — 확인: 2026-04-25
- [Terraform: Workspaces 공식](https://developer.hashicorp.com/terraform/language/state/workspaces) — 확인: 2026-04-25
- [HashiCorp: Workspace vs Directory 가이드](https://developer.hashicorp.com/terraform/cli/workspaces) — 확인: 2026-04-25
- [tfmigrate (GitHub)](https://github.com/minamijoyo/tfmigrate) — 확인: 2026-04-25
- [Spacelift: Importing Existing Infrastructure](https://spacelift.io/blog/importing-exisiting-infrastructure-into-terraform) — 확인: 2026-04-25
- [Terraform: Manage Resources in State CLI](https://developer.hashicorp.com/terraform/tutorials/state/state-cli) — 확인: 2026-04-25
