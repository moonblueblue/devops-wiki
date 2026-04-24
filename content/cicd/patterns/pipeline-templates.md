---
title: "파이프라인 템플릿 — 재사용 가능한 설계"
sidebar_label: "템플릿"
sidebar_position: 2
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - cicd
  - templates
  - reusable-workflow
  - golden-path
  - backstage
---

# 파이프라인 템플릿 — 재사용 가능한 설계

> **파이프라인 템플릿**은 "lint → test → build → scan → push → deploy"
> 패턴이 수십~수백 리포에 복제되는 현실을 한 곳으로 수렴시키는 도구다.
> 한 번 작성한 표준이 조직 전체에 PR 한 번으로 적용되며, 보안 정책·
> 품질 게이트·SLSA·SBOM이 **자동 강제**된다.
>
> 2026년 핵심 변화는 **공급망 보안**. tj-actions/changed-files
> CVE-2025-30066 사건 이후 **SHA pin이 사실상 필수**가 됐고, GitHub은
> **Immutable Actions·Required Workflows·SHA pinning policy**를
> 통합한 거버넌스를 GA했다. GitLab의 **CI/CD Components Catalog**,
> Tekton의 **StepAction + Artifact Hub** 전환도 같은 방향.
>
> 그리고 **Backstage Software Templates + Scaffolder**가 "Golden Path"
> 의 표준 구현체로 굳어지면서, 단순 YAML 재사용을 넘어 **개발자 경험
> 전체**가 템플릿화된다. AI 에이전트 시대의 가드레일도 결국 이 위에서
> 동작한다.

- **현재 기준**: GHA Reusable Workflow + Immutable Actions GA,
  GitLab Components 17.0+, Tekton Cluster Resolver + StepAction,
  Backstage CNCF Incubating
- **상위 카테고리**: CI/CD 운영
- **인접 글**: [GHA 고급](../github-actions/gha-advanced.md),
  [GHA 보안](../github-actions/gha-security.md),
  [GitLab CI](../gitlab-ci/gitlab-ci.md),
  [Jenkins Pipeline](../jenkins/jenkins-pipeline.md),
  [Tekton](../k8s-native/tekton.md),
  [SLSA](../devsecops/slsa-in-ci.md),
  [모노레포 CI/CD](./monorepo-cicd.md)

---

## 1. 왜 템플릿인가

### 1.1 가치

| 축 | 효과 |
|---|---|
| **DRY** | 동일 패턴 복제 제거 — 한 곳에서 변경하면 전체 전파 |
| **표준화** | 보안 스캔·SBOM·서명·게이트가 모든 리포에 동일 |
| **거버넌스** | SOC2·ISO 27001·PCI-DSS 요구를 템플릿에 내장 |
| **유지보수** | CVE 패치·도구 bump 1 PR로 전 조직 적용 |
| **속도** | 신규 서비스 30초에 CI/CD·모니터링 완비 |

### 1.2 Golden Path

**Spotify의 개념** — "가장 권장되는 경로를 가장 쉬운 경로로 만든다."

- 개발자는 Backstage에서 템플릿 선택만 → 표준 CI·모니터링·보안 기본선
  완비된 새 서비스 생성
- 옆길로 갈 수 있지만, **표준이 마찰이 가장 적은** 길
- 2026년 Backstage: **3,400+ 조직, 200만+ 개발자**, CNCF Incubating

### 1.3 AI 시대의 의미

- AI 에이전트가 코드를 작성·머지하는 시대
- 템플릿 + 카탈로그 메타데이터 = **에이전트의 가드레일·컨텍스트 레이어**
- 2026 BackstageCon 테마: "AI 코파일럿이 안전히 활용할 수 있는 표준
  컨텍스트"

---

## 2. GitHub Actions — Reusable Workflow

### 2.1 개념

`workflow_call` 트리거로 **워크플로(여러 job) 단위** 재사용.

### 2.2 정의

`.github/workflows/build.yml` (templates repo):

```yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: '22'
      run-tests:
        type: boolean
        default: true
    outputs:
      artifact-name:
        value: ${{ jobs.build.outputs.name }}
    secrets:
      NPM_TOKEN:
        required: true

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    outputs:
      name: ${{ steps.upload.outputs.artifact-name }}
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - if: inputs.run-tests
        run: npm test
      - id: upload
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: build-output
          path: dist/
```

### 2.3 호출

```yaml
jobs:
  build:
    uses: my-org/common-workflows/.github/workflows/build.yml@8a4b2c3d... # v1.2.3
    with:
      node-version: '22'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2.4 제약

| 제약 | 한도 |
|---|---|
| 중첩 깊이 | 최대 **10단계** (top-level caller 포함) |
| 한 워크플로의 고유 reusable 참조 | **50개** |
| 워크플로 실행당 matrix job | 256 (nesting으로 곱셈 가능 — 권장 안 함) |
| `workflow_dispatch`와 동시 정의 시 input 스키마 | 호환 규칙 주의 |

### 2.5 권한 모델

- `GITHUB_TOKEN` permissions는 **caller → callee 축소만 가능**, 확대 불가
- 호출 체인 전체 리포의 가시성이 caller에 있어야 호출 가능
- `secrets: inherit` 암묵 전파 → **2026 보안 로드맵에서 단계적 폐기**.
  scoped secrets 명시 전달로 마이그레이션 권장

---

## 3. GitHub Actions — Composite Action

### 3.1 개념

여러 step을 **하나의 step**으로 묶어 caller job 내부에서 실행.

### 3.2 정의

`.github/actions/setup-toolchain/action.yml`:

```yaml
name: 'Setup Toolchain'
description: 'mise 기반 Node·Python·Go 설치'
inputs:
  cache-key-suffix:
    description: 'Cache key suffix'
    required: false
    default: ''
runs:
  using: composite
  steps:
    - uses: jdx/mise-action@d6e32d1796099e0f1f3ac741c220a8b7eae9e5dd # v2
    - shell: bash
      run: mise install --strict
    - shell: bash
      run: |
        echo "TOOLCHAIN_HASH=$(mise ls --installed --json | sha256sum)" >> $GITHUB_ENV
```

### 3.3 호출

```yaml
- uses: ./.github/actions/setup-toolchain    # 로컬
# 또는
- uses: my-org/actions/setup-toolchain@<sha>  # 원격
```

### 3.4 Composite Action 제약

- **중첩 깊이**: 최대 **10단계** (composite-in-composite 재귀)
- step에 `shell:` 명시 필수 — 자동 추론 없음
- input은 string만 (boolean·number도 string으로 전달 후 파싱)

### 3.5 Reusable Workflow vs Composite Action

| 상황 | 선택 |
|---|---|
| 여러 step을 하나로 묶음, 같은 job에서 후속 step 필요 | **Composite** |
| 다른 runner·matrix·job 구조 필요 | **Reusable Workflow** |
| Job 내 플러그형 단위 | Composite |
| 전사 표준 CI 전체 | Reusable Workflow |
| caller의 env·output과 자유롭게 데이터 교환 | Composite |
| 독립 권한·secret 모델 | Reusable Workflow |

---

## 4. GitLab CI — Components·Templates

### 4.1 `include:` 4종

| 종류 | 예 | 용도 |
|---|---|---|
| `local` | `include: '/ci/build.yml'` | 같은 리포 분할 |
| `project` | `include: {project: 'org/templates', file: '/build.yml'}` | 사내 공유 |
| `remote` | `include: {remote: 'https://...'}` | 외부·public |
| `template` | `include: {template: 'Auto-DevOps.gitlab-ci.yml'}` | GitLab 제공 (레거시) |

### 4.2 `extends:` (job 상속)

```yaml
.test-base:
  image: node:22
  before_script:
    - npm ci
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

unit:
  extends: .test-base
  script: npm run test:unit

integration:
  extends: .test-base
  script: npm run test:integration
```

### 4.3 CI/CD Components (17.0 GA, 2024-05)

```yaml
# 호출
include:
  - component: $CI_SERVER_FQDN/my-org/ci-components/build@1.2.3
    inputs:
      node-version: '22'
      run-tests: true
```

```yaml
# 정의 (templates/build.yml)
spec:
  inputs:
    node-version:
      type: string
      default: '22'
    run-tests:
      type: boolean
      default: true
---
build:
  image: node:$[[ inputs.node-version ]]
  script:
    - npm ci
    - if [ "$[[ inputs.run-tests ]]" = "true" ]; then npm test; fi
```

- **CI/CD Catalog** (`/explore/catalog`)에서 검색·버전 선택
- 레거시 `templates/` 디렉터리는 **contribution 종료** — 카탈로그로 수렴
- GitLab 18.7+: `spec:inputs:rules` — 다른 input 값에 따라 default 동적 결정
- Components는 **self-contained** — `spec:include` 사용 불가

### 4.4 YAML Anchors

```yaml
.rules-mr: &rules-mr
  - if: $CI_PIPELINE_SOURCE == "merge_request_event"

job1:
  rules: *rules-mr

job2:
  rules: *rules-mr
```

같은 파일 내에서만 동작 — cross-file 공유는 `extends:`나 components.

---

## 5. Jenkins Shared Library

### 5.1 표준 구조

```
shared-lib/
├── vars/                          # DSL step (파일명 = step 이름)
│   ├── buildAndPush.groovy
│   └── notifySlack.groovy
├── src/                           # Groovy class (Java 패키지 구조)
│   └── org/example/Pipeline.groovy
├── resources/                     # 비-Groovy 리소스
│   └── templates/dockerfile.tpl
└── test/                          # Spock·Pipeline Unit Test
```

### 5.2 사용

```groovy
@Library('org-pipeline-lib@v1.2.0') _

pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        buildAndPush(image: 'my-app', tag: env.GIT_COMMIT)
      }
    }
  }
}
```

### 5.3 Global Pipeline Library

Jenkins admin이 "Manage Jenkins → Configure System → Global Pipeline
Libraries"에 등록. `Load implicitly` 체크 시 `@Library` 없이도 자동.

### 5.4 커스텀 step 예시

```groovy
// vars/buildAndPush.groovy
def call(Map cfg = [:]) {
  def image = cfg.image ?: env.JOB_NAME
  def tag = cfg.tag ?: env.GIT_COMMIT
  container('kaniko') {
    sh """
      /kaniko/executor \
        --dockerfile=${cfg.dockerfile ?: 'Dockerfile'} \
        --destination=${image}:${tag}
    """
  }
}
```

### 5.5 한계·주의

- Groovy CPS 직렬화 제약 (모든 변수 Serializable)
- Sandbox 예외 승인 필요한 케이스
- `@Library('lib@<sha>')` SHA pin 권장

---

## 6. Argo Workflows·Tekton

### 6.1 Argo Workflows

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ClusterWorkflowTemplate
metadata:
  name: build-and-push
spec:
  entrypoint: main
  arguments:
    parameters:
      - name: image
  templates:
    - name: main
      steps:
        - - name: build
            template: kaniko
    - name: kaniko
      container:
        image: gcr.io/kaniko-project/executor:v1.23.2-debug
        args: ["--destination={{workflow.parameters.image}}"]
```

호출:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
spec:
  workflowTemplateRef:
    name: build-and-push
    clusterScope: true
  arguments:
    parameters:
      - name: image
        value: ghcr.io/org/app:v1.0.0
```

- `WorkflowTemplate` (namespace) vs `ClusterWorkflowTemplate` (cluster)
- 공식 centralized hub 없음 — 조직별 GitOps 저장소가 표준

### 6.2 Tekton

**Cluster Resolver** (구 ClusterTask 대체):

```yaml
apiVersion: tekton.dev/v1
kind: TaskRun
spec:
  taskRef:
    resolver: cluster
    params:
      - name: kind
        value: task
      - name: name
        value: build-image
      - name: namespace
        value: tekton-tasks
```

**Hub Resolver** — Artifact Hub 원격 참조:

```yaml
taskRef:
  resolver: hub
  params:
    - name: kind
      value: task
    - name: name
      value: kaniko
    - name: version
      value: "0.7"
```

**StepAction** (Step 단위 재사용 — Tekton 1.0 GA 2025-05, v1.9.0 LTS 2026-02):

```yaml
apiVersion: tekton.dev/v1
kind: StepAction
metadata:
  name: cosign-sign
spec:
  image: cgr.dev/chainguard/cosign
  script: |
    cosign sign --yes $(params.image)
```

- ClusterTask **deprecated** (v0.41 Beta) → Cluster Resolver
- `hub.tekton.dev` deprecated → **Artifact Hub** (artifacthub.io)

---

## 7. CI 추상화 도구

### 7.1 Dagger

CI 코드를 **컨테이너화된 함수**로 작성. 로컬·어떤 CI에서나 동일 실행.

```python
import dagger

async def build(client: dagger.Client):
    src = client.host().directory(".")
    image = (
        client.container()
        .from_("node:22")
        .with_directory("/app", src)
        .with_workdir("/app")
        .with_exec(["npm", "ci"])
        .with_exec(["npm", "run", "build"])
    )
    return await image.directory("/app/dist").export("./dist")
```

- **Dagger Cloud**: Traces (telemetry UI) + Checks (관리형 CI)
- BuildKit 기반, 콘텐츠 주소 캐싱 자동
- "vendor lock-in 없는 CI 이식성"

### 7.2 Earthly

Earthfile (Dockerfile + Makefile 하이브리드):

```earthfile
VERSION 0.8
FROM node:22
WORKDIR /app

deps:
  COPY package*.json ./
  RUN npm ci
  SAVE ARTIFACT node_modules

build:
  FROM +deps
  COPY . .
  RUN npm run build
  SAVE ARTIFACT dist AS LOCAL ./dist

docker:
  FROM +deps
  COPY . .
  RUN npm run build
  SAVE IMAGE my-app:latest
```

- Earthly **CI 제품 deprecated**. 빌드 도구로 포지션
- Earthly Lunar (2026): AI 가드레일 제품으로 피벗

### 7.3 mise / asdf

`.mise.toml` (또는 `.tool-versions`):

```toml
[tools]
node = "22.15.0"
python = "3.12"
go = "1.23"
terraform = "1.10"
```

```yaml
- uses: jdx/mise-action@<sha>
- run: mise install --strict
```

- 로컬 = CI 환경 일치 → "works on my machine" 제거
- mise는 Rust 재작성 → asdf 대비 ~7배 빠름
- 환경변수·태스크 러너까지 흡수

### 7.4 도구 비교

| 도구 | 강점 | 약점 |
|---|---|---|
| Dagger | 진정한 이식성, SDK | 학습 곡선 |
| Earthly | Dockerfile 친숙 | CI 제품 deprecated |
| Bazel `rules_oci` | 모노레포·hermetic | 셋업 비용 |
| mise | 도구 버전 통일 | 빌드 자체는 별도 |

---

## 8. 설계 원칙

### 8.1 7가지 원칙

1. **Convention over configuration** — 표준 위치·이름이면 설정 0줄
2. **Sane defaults** — 90%는 `uses:` 한 줄로 작동
3. **입력 최소화** — 필수 ≤ 3, 나머지는 optional + default
4. **명확한 인터페이스** — input name·type·default·example을 README와 스키마에
5. **시맨틱 버저닝** — major bump = breaking, [SemVer §1](../release/semver-and-changelog.md)
6. **SHA pin** — 프로덕션은 40자 commit SHA + 주석으로 버전 병기
7. **Composable > monolithic** — 작은 브릭 여러 개가 큰 do-everything 하나보다 낫다

### 8.2 좋은 인터페이스 예시

```yaml
# 좋은 예 — 5개 input, 4개 default
on:
  workflow_call:
    inputs:
      app-name:
        type: string
        required: true       # 필수
      registry:
        type: string
        default: ghcr.io     # default
      build-args:
        type: string
        default: ''
      push:
        type: boolean
        default: true
      sbom:
        type: boolean
        default: true
```

### 8.3 나쁜 인터페이스 (안티패턴)

```yaml
# 나쁜 예 — 입력 폭증, "어떤 상황에서도 쓸 수 있지만 쓰기 어려움"
inputs:
  app-name: {required: true}
  registry: {default: ''}
  registry-username: {default: ''}
  registry-password: {default: ''}
  build-args: {default: ''}
  build-target: {default: ''}
  build-platform: {default: ''}
  build-cache-from: {default: ''}
  build-cache-to: {default: ''}
  push: {default: 'true'}
  push-tags: {default: ''}
  # ...20개 이상
```

도메인별로 분리하거나 `preset:` 입력으로 묶음.

---

## 9. 거버넌스·정책 강제

### 9.1 GitHub Actions

| 메커니즘 | 효과 |
|---|---|
| **Organization reusable workflows** | 내부 가시성·단일 소스 |
| **Required workflows (Repository Rulesets)** | 매칭 리포에 workflow 강제 실행 |
| **SHA pinning policy (2025-08+)** | "allowed actions"에 SHA 강제 체크박스 |
| **Immutable Actions (preview→GA)** | `ghcr.io` immutable artifact, 태그 변조 불가 |
| **OIDC immutable `sub` claim (2026-04)** | repo rename/delete-recreate 공격 방어 |

### 9.2 GitHub Environments — 배포 게이트

템플릿이 배포까지 다룬다면 `environment:` 지정으로 deployment
protection rules 적용:

```yaml
jobs:
  deploy:
    uses: my-org/templates/.github/workflows/deploy.yml@<sha>
    with:
      environment: production    # caller가 환경 지정
```

`production` 환경 설정:
- **Required reviewers**: 머지 후 사람 승인 필요
- **Wait timer**: 머지 후 N분 대기 (롤백 윈도)
- **Deployment branch rules**: `main`·`release/*`만 배포 허용
- **Environment secrets**: production 전용 secret 격리

> 📌 2025-11 변경: `pull_request_target` + environment branch protection
> 상호작용 강화. fork PR이 production environment 사용 차단됨이 기본.

### 9.3 OIDC Trust — `job_workflow_ref`

Reusable workflow의 OIDC token `sub` claim은 **caller repo 기준**이
기본. 단, **`job_workflow_ref`** claim으로 reusable workflow 자체를
trust 대상으로 지정 가능 → 조직 차원 템플릿 거버넌스의 핵심.

```json
// AWS IAM trust policy 예시
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:job_workflow_ref":
        "my-org/templates/.github/workflows/deploy.yml@refs/tags/v1"
    }
  }
}
```

caller 리포가 무엇이든 **이 reusable workflow**가 호출됐을 때만
permission 부여. 2026-04 immutable `sub` claim과 결합 시 강력한 보안 모델.

### 9.4 OPA / Conftest로 워크플로 lint

```rego
# policy/sha-pin.rego
package github_actions

deny[msg] {
  input.jobs[_].uses
  not regex.match(`@[0-9a-f]{40}`, input.jobs[_].uses)
  msg := sprintf("Action must be SHA-pinned: %s", [input.jobs[_].uses])
}

deny[msg] {
  some perm
  input.permissions[perm] == "write-all"
  msg := "permissions: write-all is not allowed"
}
```

```bash
conftest test .github/workflows/ --policy policy/
```

PR 머지 전 meta-CI에서 실행.

### 9.5 정책 강제 흐름

```mermaid
flowchart LR
  PR[PR 생성] --> LINT[정책 lint]
  LINT --> REQ[필수 워크플로 검증]
  REQ --> SHA[SHA pin 검증]
  SHA --> MERGE[머지 게이트]
```

---

## 10. Backstage Software Templates

### 10.1 Scaffolder

`template.yaml`:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: go-microservice
  title: Go Microservice
spec:
  parameters:
    - title: Service info
      properties:
        name:
          type: string
        owner:
          type: string
          ui:field: OwnerPicker
  steps:
    - id: fetch
      action: fetch:template
      input:
        url: ./skeleton
        values: {name: ${{ parameters.name }}}
    - id: publish
      action: publish:github
      input:
        repoUrl: github.com?owner=my-org&repo=${{ parameters.name }}
    - id: register
      action: catalog:register
      input:
        repoContentsUrl: ${{ steps.publish.output.repoContentsUrl }}
        catalogInfoPath: '/catalog-info.yaml'
```

### 10.2 Golden Path 자동화

```mermaid
flowchart LR
  USER[개발자 폼 입력] --> SCAF[Scaffolder]
  SCAF --> REPO[Git 리포 생성]
  REPO --> CI[표준 CI 워크플로 삽입]
  CI --> ARGO[ArgoCD 등록]
  ARGO --> MON[모니터링 자동]
  MON --> CAT[Catalog 등록]
```

### 10.3 Custom Actions

내장 액션(`fetch:template`·`publish:github`·`catalog:register`) 외에
조직 특수 통합:

- Jira 이슈 자동 생성
- Slack 알림
- Vault secret 등록
- DataDog 모니터 자동 생성

---

## 11. 버전 관리

### 11.1 참조 모드

| 모드 | 예 | 적용 |
|---|---|---|
| **SHA pin** | `@b4ffde65f...` (40자) | **프로덕션·규제 환경 (필수)** |
| **tag** | `@v1.2.3` | 검증된 공개 action 일부 |
| **floating major** | `@v1` | MVP·개발 |
| **branch** | `@main` | 금지 (self-hosted 예외) |

### 11.2 tj-actions 교훈 (CVE-2025-30066)

2025-03 사건:
- 공격자가 모든 태그(v1~v44)를 동일 악성 commit으로 포인팅
- **20,000+ 리포 영향**, PAT·npm 토큰 유출
- **SHA pin만이 유일 방어선**

### 11.3 SHA pin 자동 유지

Renovate `helpers:pinGitHubActionDigests` 프리셋 ([의존성 업데이트 §8.9](../dependency/dependency-updates.md)):

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
```

- 주석으로 사람이 읽을 수 있는 버전 병기
- Renovate가 SHA + 주석을 함께 업데이트
- PR diff로 사람이 변경 감사 가능

### 11.4 호환성 정책 (SemVer)

| 변경 | 버전 영향 |
|---|---|
| input 추가 (optional·default 유지) | minor |
| 기능 추가 | minor |
| 버그 수정 | patch |
| input 삭제·타입 변경·default 변경 | **major** |
| step 순서·외부 동작 변경 | major (보통) |

### 11.5 관측성·Drift 감지

대규모 조직은 **버전 분포 대시보드** 필수:

| 지표 | 측정 |
|---|---|
| 리포별 사용 버전 | GitHub API + 정적 분석으로 `uses:` 추출 |
| Latest 대비 lag | major·minor·patch별 뒤처짐 |
| Deprecated 사용 리포 | 마커 매칭 |
| SHA pin 미준수 리포 | 정책 lint 결과 집계 |

도구: `octokit` 스크립트, Backstage Tech Radar, Grafana 대시보드.

### 11.6 마이그레이션

- Breaking change → **새 major 파일** (`build-v2.yml`)로 분리 공존
- v1은 최소 6개월 유지
- README에 `DEPRECATED` 마커 + CI 로그 경고
- CHANGELOG 필수 — [SemVer·Changelog §3](../release/semver-and-changelog.md)

---

## 12. 테스트·디버깅

### 12.1 act (nektos/act)

`.github/workflows/*.yml`을 Docker 컨테이너로 로컬 실행.

```bash
brew install act
act pull_request                   # PR 트리거 시뮬레이션
act -j build                       # 특정 job
act --secret-file .secrets         # secret 주입
```

- 클라우드 2~5분 → 로컬 5~20초
- 제약: `GITHUB_TOKEN` 실제 토큰 아님, 일부 action 동작 차이 (cache 서비스)

### 12.2 템플릿 자체 테스트

```yaml
# templates repo의 .github/workflows/test-build.yml
name: Test build template
on:
  pull_request:
    paths: ['.github/workflows/build.yml']

jobs:
  test-defaults:
    uses: ./.github/workflows/build.yml
    with:
      app-name: test-app

  test-matrix:
    strategy:
      matrix:
        node: ['20', '22', '24']
    uses: ./.github/workflows/build.yml
    with:
      node-version: ${{ matrix.node }}
      app-name: test-app
```

### 12.3 dry-run 패턴

```yaml
inputs:
  dry-run:
    type: boolean
    default: false

steps:
  - if: inputs.dry-run
    run: echo "Would push to ${{ inputs.registry }}"
  - if: '!inputs.dry-run'
    run: docker push ${{ inputs.registry }}/...
```

### 12.4 Policy unit test

```bash
conftest verify --policy policy/ --data fixtures/
```

Rego 정책을 fixture YAML로 검증.

### 12.5 점진 도입

1. **Phase 1**: 1개 파일럿 리포에서 적용
2. **Phase 2**: 2주 운영 데이터로 튜닝
3. **Phase 3**: 팀 단위 확대 (5~10 리포)
4. **Phase 4**: 조직 필수 정책으로 승격

---

## 13. 공통 카탈로그 예시

조직 표준 템플릿 묶음:

| 템플릿 | 역할 |
|---|---|
| **setup-toolchain** | mise/asdf로 Node·Python·Go·Terraform 설치 |
| **build-multi-language** | 언어 감지 → lockfile 기반 install → 캐시 |
| **test-with-coverage** | 러너 + coverage upload + threshold 게이트 |
| **container-build-push** | multi-arch + OCI registry push |
| **sbom-provenance-sign** | Syft + `attest-build-provenance` + Cosign |
| **deploy-gitops** | Helm bump PR → ArgoCD sync wait |
| **release-changesets** | changesets·release-please·semantic-release |
| **security-scan** | Trivy + Grype + Semgrep + gitleaks → SARIF |

각 템플릿은 **독립 버전·SHA·input 스키마**로 관리 + 조합으로 도메인
워크플로 구성.

---

## 14. 흔한 함정

| 함정 | 증상 | 대책 |
|---|---|---|
| 너무 일반화 | input 20개, 쓰기 어려움 | 도메인별 분리, input ≤ 5 |
| 너무 특화 | 1팀 전용 | 공통만 추출, 특화는 caller |
| 입력 폭증 | flag 무한 추가 | `preset` 입력으로 묶음 |
| Silent breaking | minor에 breaking 포함 | SemVer 엄수, major 파일 공존 |
| **SHA 미고정** | tag만 참조 | org policy + Renovate 자동 |
| Transitive dep pin 누락 | 템플릿 내부 action 미pin | `pin-github-action` 재귀 pin |
| Ref drift | 팀마다 다른 버전 | Required workflow + 버전 대시보드 |
| Fork PR secret 노출 | `pull_request_target` 오용 | `pull_request` + 제한 권한, **`workflow_run` split pattern** (untrusted build → trusted publish 분리), OIDC |
| 중첩 과다 | 10층 reusable | 2~3층 제한 |
| 테스트 부재 | 변경 시 전 조직 붕괴 | 파일럿 리포, 점진 rollout |
| 도입 강제 없음 | 팀마다 자체 워크플로 | required workflow + ruleset |

---

## 15. 글로벌 사례

### 15.1 GitHub (자체 dogfooding)

- `.github` 리포의 `workflow-templates/` 디렉터리 → 신규 리포 워크플로
  추천 UI에 노출
- Required workflows + Immutable Actions + SHA pinning policy 통합
- OIDC immutable `sub` claim (2026-04)

### 15.2 Spotify Backstage

- Software Catalog + Scaffolder
- 3,400+ 조직, 200만+ 개발자
- 내부적으로 **Spotify Portal** (SaaS)이 OSS 위에 UX·AI 레이어

### 15.3 Netflix

- **Spinnaker Managed Pipeline Templates (MPT v2)**
- JSON 기반 상속·variable 치환
- Multi-region canary, Red/Black 배포 패턴 표준화

### 15.4 HashiCorp

- Terraform Registry + Private Module Registry
- 모듈 베스트 프랙티스가 GHA reusable workflow 원형
- input·output·example README 문법

### 15.5 Google Cloud Build

- `cloudbuild.yaml` `include` 없음
- **Builder images + 모듈형 step**으로 재사용
- **Skaffold profiles**로 환경별 변형

### 15.6 Uber

- Bazel 기반 + 자체 CI orchestrator
- 전사 "Cerberus" 게이트 (테스트·보안·코드리뷰) 강제

---

## 16. 체크리스트

**설계**
- [ ] 단위 결정 (Step / Job / Workflow)
- [ ] 필수 input ≤ 3개, 나머지 default
- [ ] 명확한 인터페이스 + 예제 README
- [ ] Composable 단위 (작은 브릭)

**버전**
- [ ] SemVer 준수
- [ ] CHANGELOG 유지
- [ ] Breaking change는 major 파일로 공존
- [ ] **SHA pin** + 주석으로 버전 병기

**보안·거버넌스**
- [ ] Required workflow 또는 동등 강제
- [ ] Immutable Actions (가능한 곳)
- [ ] SHA pinning policy
- [ ] OPA/Conftest로 워크플로 lint
- [ ] OIDC + 단기 토큰
- [ ] `secrets: inherit` 회피

**개발자 경험**
- [ ] Backstage Scaffolder 또는 동등 골든 패스
- [ ] 1줄 호출이 90% 케이스 커버
- [ ] dry-run 모드
- [ ] act으로 로컬 실행 가능

**테스트**
- [ ] 템플릿 자체 PR CI
- [ ] matrix로 input 조합 검증
- [ ] 점진 도입 (파일럿 → 팀 → 조직)
- [ ] 버전 별 호환성 매트릭스

---

## 17. 안티패턴

| 안티패턴 | 결과 |
|---|---|
| 모든 케이스 처리하는 do-everything 템플릿 | 입력 폭증, 사용 어려움 |
| tag만 참조 (`@v1`) | 공급망 공격 노출 (tj-actions) |
| `@main` 참조 | 무음 변경, 재현 불가 |
| Breaking을 minor로 릴리스 | 전 조직 CI 붕괴 |
| 호출 체인 5층 이상 | 디버깅 불가 |
| `secrets: inherit` 남용 | 권한 경계 흐림 |
| 템플릿만 표준, 강제 없음 | 팀별 자체 워크플로 |
| 템플릿 자체 테스트 없음 | 매 변경이 도박 |
| Fork PR에 `pull_request_target` | secret 노출 |
| Convention 무시한 input | 90% 케이스도 10줄 설정 |

---

## 참고 자료

- [GitHub Docs — Reusable Workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) (확인: 2026-04-25)
- [GitHub Docs — Reusing Workflow Configurations](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations) (확인: 2026-04-25)
- [GitHub Blog — 2026 Actions Security Roadmap](https://github.blog/news-insights/product-news/whats-coming-to-our-github-actions-2026-security-roadmap/) (확인: 2026-04-25)
- [GitHub Blog — SHA Pinning Policy](https://github.blog/changelog/2025-08-15-github-actions-policy-now-supports-blocking-and-sha-pinning-actions/) (확인: 2026-04-25)
- [GitHub Blog — Immutable OIDC Subject Claims](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/) (확인: 2026-04-25)
- [GitLab Docs — CI/CD Components](https://docs.gitlab.com/ci/components/) (확인: 2026-04-25)
- [GitLab Docs — `include:`](https://docs.gitlab.com/ci/yaml/includes/) (확인: 2026-04-25)
- [GitLab Blog — Components Catalog GA](https://about.gitlab.com/blog/2024/05/08/ci-cd-catalog-goes-ga-no-more-building-pipelines-from-scratch/) (확인: 2026-04-25)
- [Jenkins Docs — Shared Libraries](https://www.jenkins.io/doc/book/pipeline/shared-libraries/) (확인: 2026-04-25)
- [Argo Workflows — WorkflowTemplate](https://argo-workflows.readthedocs.io/en/latest/workflow-templates/) (확인: 2026-04-25)
- [Tekton — Cluster Resolver](https://tekton.dev/docs/pipelines/cluster-resolver/) (확인: 2026-04-25)
- [Tekton — Hub Resolver](https://tekton.dev/docs/pipelines/hub-resolver/) (확인: 2026-04-25)
- [Backstage Docs — Software Templates](https://backstage.io/docs/features/software-templates/) (확인: 2026-04-25)
- [CNCF — Backstage Documentary](https://www.cncf.io/announcements/2026/03/25/cncf-backstage-documentary-highlights-project-evolution-from-development-to-global-open-source-standard-for-platform-engineering/) (확인: 2026-04-25)
- [Dagger Docs](https://docs.dagger.io/) (확인: 2026-04-25)
- [mise vs asdf](https://mise.jdx.dev/dev-tools/comparison-to-asdf.html) (확인: 2026-04-25)
- [nektos/act](https://github.com/nektos/act) (확인: 2026-04-25)
- [CISA — tj-actions Supply Chain Compromise](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066) (확인: 2026-04-25)
- [Wiz — tj-actions Analysis](https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066) (확인: 2026-04-25)
- [OpenSSF — Securing CI/CD After tj-actions](https://openssf.org/blog/2025/06/11/maintainers-guide-securing-ci-cd-pipelines-after-the-tj-actions-and-reviewdog-supply-chain-attacks/) (확인: 2026-04-25)
