---
title: "GHA 고급 — Reusable Workflow·Composite Action·Cache"
sidebar_label: "GHA 고급"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - github-actions
  - reusable-workflow
  - composite-action
  - cache
---

# GHA 고급

> **조직 규모에서 GHA의 실력**은 재사용과 캐시에서 나온다.
> 같은 "lint → test → build → publish"를 수십 개 레포가
> 다시 쓰면서도 변경은 **한 곳**에서만 이뤄져야 한다. 이 글은
> **Reusable Workflow · Composite Action · Cache 전략**을 축으로,
> 2026-04 기준 플랫폼 한계·권한 상속·캐시 eviction 규칙·Docker
> Buildx 캐시까지 실무 의사결정에 필요한 깊이로 정리한다.

- **전제**: [GHA 기본](./gha-basics.md)의 workflow·job·step을 이해
- **현재 기준**: `actions/cache@v4`, `actions/checkout@v5`,
  `actions/upload-artifact@v4` · `download-artifact@v4`. Reusable
  Workflow는 **최대 10단계 중첩**(top-level caller 포함), 한
  워크플로 파일에서 **고유 reusable 50개**까지 호출 가능
- **경계**: OIDC·artifact attestation·보안 하드닝은
  [GHA 보안](./gha-security.md), 자체 호스팅 러너는
  [ARC 러너](./arc-runner.md)

---

## 1. 재사용 단위 — 무엇을 쪼갤 것인가

### 1.1 선택 가이드

| 상황 | 선택 | 이유 |
|---|---|---|
| "설치·캐시·포맷" 같은 **스텝 묶음** | Composite Action | 같은 러너·빠른 호출 |
| **잡 전체**(러너·Environment 포함) 재사용 | Reusable Workflow | 독립 러너·Secret 스코프 |
| 매트릭스 안에서 반복 호출 | Composite Action | Reusable은 matrix 불가 |
| 조직 전반의 **표준 파이프라인** | Reusable Workflow | 중앙 거버넌스·감사 |
| 외부 공개·Marketplace 배포 | Action (JavaScript/Docker) | 패키징·버저닝 표준 |

### 1.2 본질적 차이

| 축 | Composite Action | Reusable Workflow |
|---|---|---|
| 호출 위치 | `steps:`의 한 스텝 | 잡 정의(`uses:` with `jobs.<id>.uses`) |
| 러너 | **호출자와 같은 러너** | **독립 러너** 지정 가능 |
| 잡 단위 기능(`environment`, `if:` on job, matrix) | 불가 | 가능 |
| Secret 참조 | `secrets.*` 직접 불가 (입력으로 전달) | `secrets:` 블록 or `secrets: inherit` |
| 중첩 깊이 | **최대 10단계** | **최대 10단계**(caller 포함) |
| 로그 표시 | 호출자 스텝 밑에 접힘 | 잡·스텝 별도 로그 |
| 매트릭스 내부 사용 | 가능 | 불가 |

**체감 효과**: Composite는 "같은 잡 안의 반복"을 줄이고, Reusable은
"레포 간 파이프라인 표준화"를 담당한다. 둘은 대체재가 아니라 **층**이다.

---

## 2. Composite Action

### 2.0 Action 타입 3종 — 결정 지점

Composite 외에 두 형태가 더 있다. 외부 공개·Marketplace 배포 시
선택지가 된다.

| 타입 | 구현 | 실행 | 장단점 |
|---|---|---|---|
| Composite | `action.yml` + shell/uses 스텝 | 호출자 러너에서 순차 실행 | 단순·가벼움. Secret 직접 접근 불가 |
| JavaScript | Node 런타임 | 호출자 러너에서 Node로 실행 | 크로스 OS 지원·빠른 cold start. Node 버전 전환 주의(Node 20 → 24) |
| Docker Container | `Dockerfile` 빌드 또는 사전 이미지 | 호출자 러너가 컨테이너 실행 | 의존성 캡슐화. **Linux 러너 전용**, cold start 비용 큼 |

조직 내부 재사용은 Composite, 공개 재사용·복잡 로직은 JavaScript,
특이 런타임(Ruby·Rust 등)은 Docker가 일반 기준.

### 2.1 최소 구조

```
.github/actions/node-setup-cached/
  action.yml
  (선택) dist/index.js, scripts/
```

```yaml
# .github/actions/node-setup-cached/action.yml
name: "Node Setup (Cached)"
description: "pnpm 설치 + 의존성 캐시 복원"

inputs:
  node-version:
    description: "Node.js 버전"
    required: false
    default: "22"
  pnpm-version:
    description: "pnpm 버전"
    required: false
    default: "9"
  working-directory:
    required: false
    default: "."

outputs:
  cache-hit:
    description: "pnpm 캐시 hit 여부"
    value: ${{ steps.cache.outputs.cache-hit }}

runs:
  using: "composite"
  steps:
    - uses: actions/setup-node@v5
      with:
        node-version: ${{ inputs.node-version }}

    - uses: pnpm/action-setup@v4
      with:
        version: ${{ inputs.pnpm-version }}

    - id: cache
      uses: actions/cache@v4
      with:
        path: ~/.local/share/pnpm/store
        key: pnpm-${{ runner.os }}-${{ hashFiles(format('{0}/pnpm-lock.yaml', inputs.working-directory)) }}
        restore-keys: |
          pnpm-${{ runner.os }}-

    - run: pnpm install --frozen-lockfile
      shell: bash
      working-directory: ${{ inputs.working-directory }}
```

**호출**:

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: ./.github/actions/node-setup-cached
    with:
      node-version: "22"
      working-directory: apps/web
  - run: pnpm test
```

### 2.2 Composite의 실무 함정

- **`shell` 필수**: `run:` 스텝마다 `shell` 지정 안 하면 액션 로드
  자체가 실패. `defaults.run.shell`은 composite에 상속 안 됨
- **Secret은 입력으로**: `secrets.FOO`를 composite 안에서 직접
  참조 불가. 호출자가 `with:` 입력으로 넘겨야 함. 로그 마스킹은
  GHA 런타임이 처리
- **`GITHUB_ENV` 쓰기는 호출자에도 전파**: composite 안에서
  `echo "X=1" >> "$GITHUB_ENV"`하면 호출 잡의 이후 스텝까지 보임
  → 네임스페이스 접두사 권장
- **조건 스텝**: composite의 각 스텝에 `if:`를 걸 수 있음 —
  하지만 `job.status` 상태 함수 대신 `inputs.*`나 `steps.*`로 제한

### 2.3 외부 레포의 Composite 참조

```yaml
- uses: my-org/shared-actions/node-setup@v1      # 태그
- uses: my-org/shared-actions/node-setup@a81b...  # SHA 권장
```

외부 레포의 액션은 SHA 핀이 사실상 필수. 조직은 중앙 레포
`my-org/actions/`에 모아두고 Dependabot이 SHA 갱신 PR을 자동 생성.

---

## 3. Reusable Workflow

### 3.1 `workflow_call` 정의

```yaml
# .github/workflows/reusable-build.yml
name: Reusable build

on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "22"
      environment:
        type: string
        required: true
      deploy:
        type: boolean
        default: false
    secrets:
      NPM_TOKEN:
        required: true
    outputs:
      image-tag:
        description: "빌드된 이미지 태그"
        value: ${{ jobs.build.outputs.tag }}

jobs:
  build:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    permissions:
      contents: read
      packages: write
      id-token: write
    outputs:
      tag: ${{ steps.meta.outputs.tag }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: ${{ inputs.node-version }}
          cache: npm
      - run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - id: meta
        run: echo "tag=v${{ github.run_number }}" >> "$GITHUB_OUTPUT"
```

### 3.2 호출 (Caller)

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    uses: my-org/platform/.github/workflows/reusable-build.yml@v3
    with:
      node-version: "22"
      environment: staging
      deploy: false
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
    # 또는
    # secrets: inherit   # 호출자의 모든 secret 전파

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying ${{ needs.build.outputs.image-tag }}"
```

**핵심 규칙**:

- 호출 위치는 **`jobs.<id>.uses`** — 스텝 안에서 부를 수 없다
- `@` 뒤의 **ref는 브랜치·태그·SHA 모두 가능** (조직 표준 레포는
  semver 태그 + SHA 핀 권장)
- `secrets: inherit` — 2022-05 도입, 모든 secret을 자동 전파.
  편하지만 **최소권한 원칙 위반 쉬움**. 민감한 secret만 명시 전달 권장
- 호출되는 워크플로의 **`permissions:`는 caller의 권한 범위 내**로
  제한된다 (상속 감쇄는 가능, 승격은 불가)

### 3.3 중첩과 한계

- **최대 10단계 중첩** (최상위 caller 포함). 즉 caller → A → B → … → I까지
- **한 워크플로 파일에서 고유 reusable 50개**가 상한 (중첩 트리
  전체 합산)
- 매트릭스 + reusable 조합 시 실제 잡 수가 256 한도를 우회할 수
  있다 — 조직 차원에서 비용·가시성 모니터링 필요
- **로컬 호출**: 같은 리포 내에서는 `uses: ./.github/workflows/foo.yml`로
  참조 가능(2022-01 도입). 외부 레포는 `org/repo/.github/workflows/foo.yml@ref`

### 3.4 Reusable에서 못 하는 것

| 불가·제약 | 회피 |
|---|---|
| `inputs` 타입이 `string`·`number`·`boolean`만 | 배열/객체는 `type: string` + `fromJSON` |
| 호출자의 `$GITHUB_ENV`·`$GITHUB_PATH` 공유 | outputs로 문자열만 반환 |
| 호출자의 `concurrency` 상속 | reusable 내부에 직접 정의 (caller와 별개 그룹) |
| 러너 레이블 동적 지정 | `runs-on: ${{ inputs.runner }}` 패턴으로 caller가 주입 |
| 워크플로 파일 위치 | **`.github/workflows/` 디렉터리 안**에만 허용 (하위 디렉터리 불가) |

---

## 4. 캐시 전략 (`actions/cache@v4`)

### 4.1 기본 사용

```yaml
- uses: actions/cache@v4
  id: cache
  with:
    path: |
      ~/.cache/go-build
      ~/go/pkg/mod
    key: go-${{ runner.os }}-${{ hashFiles('**/go.sum') }}
    restore-keys: |
      go-${{ runner.os }}-
```

| 파라미터 | 역할 |
|---|---|
| `key` | 정확 매치 — 키가 같으면 restore, 다르면 save 대상 |
| `restore-keys` | 부분 매치 fallback (접두사 비교) |
| `path` | 캐시할 디렉터리/파일 목록 |
| `enableCrossOsArchive` | OS 간 공유 (Linux/Windows) — 보통 false |
| `fail-on-cache-miss` | miss 시 잡 실패 (배포 시 안전장치) |
| `lookup-only` | 존재 여부만 확인, 복원 안 함 |

### 4.2 Save 규칙과 ref 격리

- **Cache는 branch에 귀속**. 레포 기본 브랜치(예: main)에서 만든
  캐시는 모든 브랜치가 **읽기** 가능. 반대는 불가
- **sibling 브랜치의 캐시는 못 읽음** — feature-a → feature-b 불가
- **PR에서 만든 캐시는 base branch에 대해서만 노출**되며 PR 머지 전에는 격리
- **Save는 기본적으로 post-step**에서 수행. 잡이 실패해도 자동 save,
  이를 막으려면 `if: always()`/명시적 save 조건 설계

### 4.3 `save`와 `restore` 분리

`actions/cache/save@v4`와 `actions/cache/restore@v4`로 나누면
**잡 내 여러 지점에서 복원만 하거나, 조건부 save**가 가능하다.

```yaml
steps:
  - uses: actions/cache/restore@v4
    id: restore
    with:
      path: ./out
      key: build-${{ hashFiles('go.sum', 'src/**') }}
      restore-keys: |
        build-

  - if: steps.restore.outputs.cache-hit != 'true'
    run: make build

  - if: always() && steps.restore.outputs.cache-hit != 'true'
    uses: actions/cache/save@v4
    with:
      path: ./out
      key: build-${{ hashFiles('go.sum', 'src/**') }}
```

### 4.4 Eviction·크기·보존

| 항목 | 규칙 |
|---|---|
| 레포당 크기 | 기본 **10GB** (2025-11 이후 일부 플랜 확장 가능) |
| Eviction 정책 | **LRU + 7일 미사용** |
| 키 버전 | action 메이저 버전 업 시 키 네임스페이스 변경 가능 |
| 삭제 | UI(Actions → Caches) / `gh cache delete` / REST API |

**키 설계 체크리스트**:

- `runner.os`를 반드시 포함 (OS 간 호환 안 되는 파일)
- `hashFiles()`에 **락파일만** 포함 (package-lock.json·go.sum·
  poetry.lock 등). 소스 파일을 넣으면 매 커밋마다 miss
- 타임스탬프·커밋 SHA를 키에 직접 넣지 말 것 — 캐시가 영영 hit 안 됨
- Docker 레이어는 `actions/cache`보다 **BuildKit GHA 백엔드** 사용

### 4.5 내장 캐시 (setup-\*)

공식 setup 액션은 대부분 **내장 캐시**를 제공한다:

| 액션 | 캐시 입력 | 키 기반 파일 |
|---|---|---|
| `actions/setup-node@v5` | `cache: 'npm'/'yarn'/'pnpm'` | lockfile 해시 |
| `actions/setup-python@v5` | `cache: 'pip'/'poetry'/'pipenv'` | 의존성 파일 해시 |
| `actions/setup-go@v5` | `cache: true` (기본) | `go.sum` |
| `actions/setup-java@v4` | `cache: 'maven'/'gradle'` | pom/gradle 파일 해시 |

내장 캐시가 있으면 `actions/cache`를 **추가로 쓰지 말 것** — 키
충돌로 eviction이 가속된다. 내장 캐시로 부족할 때만 별도 캐시 추가.

---

## 5. Docker 빌드 캐시

### 5.1 선택지

| 백엔드 | 지속성 | 복원 범위 | 비고 |
|---|---|---|---|
| `type=gha` | GHA Cache 스토어 | 레포·브랜치 스코프 | 가장 간편, 10GB 공유 |
| `type=registry` | OCI 레지스트리 (GHCR·ECR·ACR) | 크로스 레포·리전 | 대규모 모노레포 권장 |
| `type=inline` | 이미지 레이어에 메타 삽입 | 이미지 pull 가능한 곳 | 단순하지만 재사용 폭 좁음 |
| `type=local` | 러너 디스크 | 없음 (ephemeral) | 단독 사용 금지, cache action과 연계 |
| `type=s3` | S3 버킷 | 조직 전체 | 셀프 운영, 비용 통제 |
| `type=azblob` | Azure Blob | 조직 전체 | Azure 기반 조직에 자연스러움 |

### 5.2 GHA 백엔드 표준 형식

```yaml
- uses: docker/setup-buildx-action@v3

- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: type=gha,scope=${{ github.workflow }}
    cache-to: type=gha,scope=${{ github.workflow }},mode=max
```

- **`mode=max`**: 중간 레이어까지 캐시(권장). `min`은 최종만
- **`scope`**: 같은 캐시 영역을 쓰는 식별자. 다른 워크플로가
  섞이지 않게 분리. 매트릭스에선 `matrix.*`를 포함
- 내부적으로 `ACTIONS_CACHE_URL`·`ACTIONS_RUNTIME_TOKEN`을 사용
  → 동일한 10GB 예산 공유

### 5.3 Registry 백엔드 (대규모 권장)

```yaml
- uses: docker/build-push-action@v6
  with:
    push: true
    tags: ghcr.io/org/app:${{ github.sha }}
    cache-from: |
      type=registry,ref=ghcr.io/org/app:buildcache
    cache-to: |
      type=registry,ref=ghcr.io/org/app:buildcache,mode=max,image-manifest=true
```

- **레포·CI 시스템 간 공유** 가능 (ARC 러너와 GHA 호스티드 간 공유도)
- 10GB 한도 회피, 레지스트리 보존·수명 규칙 따름
- 인증은 `docker/login-action`으로 OIDC 또는 Token

### 5.4 Matrix + 캐시 주의

```yaml
strategy:
  matrix:
    arch: [amd64, arm64]
steps:
  - uses: docker/build-push-action@v6
    with:
      platforms: linux/${{ matrix.arch }}
      cache-from: type=gha,scope=build-${{ matrix.arch }}
      cache-to: type=gha,scope=build-${{ matrix.arch }},mode=max
```

`scope`에 matrix 값을 **포함 안 하면** 마지막 매트릭스 실행이
이전 캐시를 덮어쓴다. 결과적으로 캐시가 전혀 없는 것과 같다.

---

## 6. Artifact — 잡·워크플로 간 파일 전달

### 6.1 v4의 breaking change

| 항목 | v3 | v4 |
|---|---|---|
| 같은 이름 재업로드 | 덮어쓰기 | **409 에러** (immutable) |
| 업로드 속도 | 느림 | 10× 이상 개선 |
| 다운로드 | 이름 필수 | **no-name = 전체** 다운로드 지원 |
| API 호환 | 구 API | **Artifacts API v2** |

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: build-${{ matrix.os }}-${{ matrix.node }}
    path: dist/
    retention-days: 7             # 기본 90
    compression-level: 6          # 0~9
    if-no-files-found: error      # warn/error/ignore

- uses: actions/download-artifact@v4
  with:
    name: build-ubuntu-latest-22
    path: ./dist
```

**매트릭스 함정**: 같은 이름으로 여러 매트릭스 잡이 업로드하면
두 번째부터 실패. 이름에 반드시 `matrix.*` 포함.

### 6.2 Artifact vs Cache — 용도 분리

| 기준 | Artifact | Cache |
|---|---|---|
| 목적 | **배포 결과물** 공유·보관 | **빌드 중간** 가속 |
| 보존 | 기본 90일 | LRU·7일 |
| 사이즈 | 없음(플랜 쿼터) | 10GB 상한 |
| 다운로드 | `gh run download`·UI | 내부 runner만 |
| 이름 | **불변** | 키로 버저닝 |
| 크로스 워크플로 | 가능(actions/download-artifact@v4 + `run-id`) | 불가 (같은 레포만) |

---

## 7. 동적 매트릭스 — 재사용의 정점

```yaml
jobs:
  discover:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.find.outputs.services }}
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - id: find
        run: |
          CHANGED=$(git diff --name-only ${{ github.event.before }}..${{ github.sha }} \
            | awk -F/ '/^services\//{print $2}' | sort -u | jq -Rcs 'split("\n")[:-1]')
          echo "services=$CHANGED" >> "$GITHUB_OUTPUT"

  build:
    needs: discover
    if: ${{ needs.discover.outputs.services != '[]' }}
    strategy:
      fail-fast: false
      matrix:
        service: ${{ fromJSON(needs.discover.outputs.services) }}
    uses: ./.github/workflows/reusable-build.yml   # reusable 호출
    with:
      service: ${{ matrix.service }}
```

**주의**: `jobs.<id>.uses`에 매트릭스를 붙일 수 있게 된 것은
**2022-08 개선** 이후다. 과거에 "reusable에서 matrix 불가"라는
블로그는 스테일. 단 매트릭스 조합 수 × reusable의 잡 수가
전체 256 상한에 포함되므로 대형 fan-out은 비용·한도 주의.

---

## 8. 조직 관점 — 중앙 레포 패턴

### 8.1 레포 구조

```
my-org/
├─ platform/                           ← 중앙 재사용 레포
│  ├─ .github/workflows/
│  │  ├─ reusable-node-ci.yml
│  │  ├─ reusable-deploy-k8s.yml
│  │  └─ reusable-security-scan.yml
│  └─ actions/
│     ├─ notify-slack/action.yml
│     └─ setup-go-cache/action.yml
└─ service-a/.github/workflows/ci.yml   ← 각 서비스는 얇은 caller
```

### 8.2 거버넌스

- **`organization.allowed_actions`**: Marketplace 전체 허용 대신
  `my-org/*`·`actions/*`·서명된 액션만 화이트리스트
- **Environment 보호 규칙**을 reusable에 박아두면 caller가 우회 불가
- **Repository Rulesets — "Require workflows to pass"**: 과거의
  "Required workflows" 기능은 2024-07 deprecation 후 Rulesets로
  통합. 조직·레포 단위로 특정 workflow 통과를 merge 조건으로 강제
- **CODEOWNERS**: `platform/.github/workflows/*` 변경은 DevEx 팀만

### 8.3 버저닝

```yaml
uses: my-org/platform/.github/workflows/reusable-node-ci.yml@v3
```

- major 태그(`v3`) + 내부적으로 SHA 추적. Dependabot의 `package-ecosystem: "github-actions"`가 PR 생성
- 실험은 `@main`·`@feature/*`로 시험 후 정식 릴리스
- **breaking change** 시 caller 전체 테스트 — 중앙 레포의 의무

---

## 9. 안티패턴과 실무 교훈

| 안티패턴 | 문제 | 대안 |
|---|---|---|
| 모든 워크플로가 직접 `setup-node` + `cache` 중복 | 수정 지점 분산 | Composite으로 묶기 |
| Reusable 안에서 `secrets: inherit` 남용 | 최소권한 위반 | 필요한 secret만 `with` 명시 |
| Cache 키에 `${{ github.sha }}` 포함 | 영원히 miss | lockfile 해시만 |
| Reusable + 매트릭스로 256 잡 한도 우회 | 청구서 폭탄 | `max-parallel` + 모니터링 |
| Artifact 이름 매트릭스 값 제외 | v4에서 409 실패 | `name: build-${{ matrix.* }}` |
| Docker 캐시 `scope` 공유 | 매트릭스끼리 덮어씀 | scope에 matrix 포함 |
| Reusable `inputs`에 배열·객체 | 타입 거부 | `type: string` + `fromJSON` |
| 호출자의 `concurrency`가 reusable에 상속된다고 가정 | 직렬화 안 됨 | reusable 내부에 concurrency 재정의 |
| Composite 안에서 `defaults.run.shell` 기대 | 로드 실패 | 각 `run:`에 `shell:` 명시 |
| 내장 캐시 + `actions/cache` 병행 | LRU 가속 | 하나만 선택 |

---

## 10. 학습 체크포인트

- [ ] Composite Action과 Reusable Workflow를 상황별로 구분해 쓴다
- [ ] Reusable의 10단계 중첩·50개 고유 상한을 기억한다
- [ ] `secrets: inherit`의 편리함과 위험을 설명할 수 있다
- [ ] `actions/cache@v4` 키 설계 원칙(OS·lockfile only)을 따른다
- [ ] Buildx GHA 캐시와 Registry 캐시의 선택 기준을 안다
- [ ] Artifact v4의 immutable 특성과 매트릭스 충돌을 피한다
- [ ] 동적 매트릭스 + reusable로 모노레포 CI를 설계할 수 있다
- [ ] 중앙 레포 + 버저닝·Dependabot 전략으로 거버넌스한다

---

## 참고 자료

- [Reuse workflows — GitHub Docs](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows) (2026-04 확인)
- [Reusing workflow configurations — GitHub Docs](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations)
- [Dependency caching reference](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [actions/cache — v4 release notes](https://github.com/actions/cache)
- [GitHub Actions cache backend — Docker Docs](https://docs.docker.com/build/cache/backends/gha/)
- [actions/upload-artifact v4 migration](https://github.com/actions/upload-artifact)
- [Simplify using secrets with reusable workflows (2022-05)](https://github.blog/changelog/2022-05-03-github-actions-simplify-using-secrets-with-reusable-workflows/)
- [GitHub Actions cache size can now exceed 10 GB per repository (2025-11)](https://github.blog/changelog/2025-11-20-github-actions-cache-size-can-now-exceed-10-gb-per-repository/)
- [Reusable workflows can be referenced locally (2022-01)](https://github.blog/changelog/2022-01-25-github-actions-reusable-workflows-can-be-referenced-locally/)
- [Improvements to reusable workflows — matrix 지원 (2022-08)](https://github.blog/changelog/2022-08-22-github-actions-improvements-to-reusable-workflows-2/)
- [Repository Rulesets — Require workflows to pass](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
