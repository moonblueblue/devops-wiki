---
title: "ArgoCD Image Updater — 이미지 태그 자동 감지·Git Write-back"
sidebar_label: "Image Updater"
sidebar_position: 8
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - argocd
  - image-updater
  - semver
  - write-back
  - registry
---

# ArgoCD Image Updater

> **Image Updater는 ArgoCD의 사이드 컨트롤러**. 컨테이너 레지스트리를
> 주기적으로 폴링해 **새 이미지 태그를 감지 → ArgoCD Application 또는
> Git 저장소를 업데이트**. "Git이 진리"와 "이미지 태그는 CI가 찍는다"의
> 중간 자동화. 이 글은 install, 4가지 update strategy (semver/latest/
> name/digest), write-back method (`argocd` vs `git`), Kustomize·Helm
> target, 레지스트리 인증, 멀티 플랫폼까지 실전 깊이로 정리.

- **프로젝트 상태**: **`argoproj-labs/argocd-image-updater`** — 본체와
  별개 프로젝트. **2026 stable은 v1.1.x (CRD 기반 `ImageUpdater` 리소스)**.
  기존 annotation 방식은 **legacy**로 계속 지원되나 공식 권장은 CRD.
  ArgoCD 3.x와 호환
- **주제 경계**: Application 스펙 자체는 [ArgoCD App](./argocd-apps.md).
  여기는 "이미지 태그 자동화"에만 집중
- **대안 비교**: **Flux Image Automation**이 완전 선언적(GitOps 원칙에
  더 부합). Image Updater는 기존 ArgoCD 환경에 덧대는 접근
- **현재 기준**: 2026-04 Image Updater **v1.1.5**, Helm 차트 argocd-image-updater
  v0.12+ (차트 버전과 앱 버전은 별개)

---

## 1. 왜 Image Updater인가

### 1.1 전형적 워크플로 전환

기존:

```mermaid
flowchart LR
  PUSH[이미지 푸시] --> CI[CI]
  CI --> UPDATE[Git 태그 수정 PR]
  UPDATE --> MERGE[Merge]
  MERGE --> ARGO[ArgoCD sync]
```

Image Updater 도입:

```mermaid
flowchart LR
  PUSH[이미지 푸시] --> REG[레지스트리]
  IU[Image Updater] --> REG
  IU --> ARGO[ArgoCD 업데이트]
```

**이점**:

- CI가 이미지 푸시만 하면 끝, 배포 PR 자동화 불필요
- 스테이징은 `latest` 테스트, 프로덕션은 `semver` 제약 같은 세밀 제어
- patch release 자동 흡수

**트레이드오프**:

- **이미지 태그 결정 = 배포 결정**이 되어 리뷰 단계 사라짐
- 프로덕션 업데이트는 **git 방식**으로 PR 단계 유지 권장
- 레지스트리 API 폴링 부하·rate limit

### 1.2 Image Updater vs Flux Image Automation

| 축 | ArgoCD Image Updater | Flux Image Automation |
|---|---|---|
| 기본 접근 | 태그 감지 → ArgoCD API 또는 Git | 태그 감지 → Git 필수 |
| GitOps 순도 | write-back=git 선택 시 Git 중심 | 설계상 Git 중심 |
| 성숙도 | stable, argoproj-labs | stable, CNCF Graduated |
| ArgoCD 통합 | 네이티브 | Flux 자체 생태계 |
| 권장 | ArgoCD 이미 쓰면 자연스러움 | Flux 기반이면 필수 |

ArgoCD를 쓰고 있다면 Image Updater. 이미지 자동화가 **선언적 GitOps의
핵심**이라고 생각한다면 Flux로 전환 고려.

---

## 2. 설치

### 2.1 Manifest 설치

```bash
kubectl apply -n argocd -f \
  https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/config/install.yaml
```

### 2.2 Helm 설치 (권장)

공식 `argo/argocd-image-updater` 차트의 실제 values 스키마는 계층이 깊다.
아래는 주요 키만 발췌.

```yaml
# values.yaml — 실제 스키마는 차트 공식 values.yaml 참조
image:
  tag: "v1.1.5"

config:
  argocd:
    grpcWeb: true
    serverAddress: "argocd-server.argocd.svc.cluster.local:443"
    insecure: false
    plaintext: false
    # Project role JWT 사용 시
    # token: $ARGOCD_TOKEN  (extraEnv에서 Secret 참조)

  # 여러 namespace의 Application을 watch하려면
  applicationsAPIKind: kubernetes
  # app-in-any-namespace와 연계 (Argo CD 2.5+ / 3.x)
  # extraArgs에 --applications-api=kubernetes,--applications-namespaces=team-*

  # 레지스트리 정의 — 상세는 §5
  registries:
    - name: GHCR
      prefix: ghcr.io
      api_url: https://ghcr.io
      credentials: pullsecret:argocd/ghcr-creds
      defaultns: my-org

  # Git write-back 공통 설정
  git:
    user: argocd-image-updater
    email: image-updater@example.com
    # commitMessageTemplate: |-  # Go template

rbac:
  enabled: true

metrics:
  enabled: true
  serviceMonitor:
    enabled: true

# 폴링·로그는 extraArgs로 주입
extraArgs:
  - --interval=2m
  - --loglevel=info
  - --health-port=8080
```

```bash
helm install argocd-image-updater argo/argocd-image-updater \
  -n argocd -f values.yaml
```

- **Argo CD와 같은 namespace에 배포** 권장 (ServiceAccount 공유 편의)
- 기본 `interval: 2m` — 레지스트리 호출 빈도 고려해 조정

### 2.3 ArgoCD 권한 설정

Image Updater가 Application을 수정하려면 RBAC 필요.

```yaml
# argocd-rbac-cm — Helm configs.rbac에 병합
policy.csv: |
  p, role:image-updater, applications, get, */*, allow
  p, role:image-updater, applications, update, */*, allow
  g, argocd-image-updater, role:image-updater
```

또는 **Project role + JWT 토큰**으로 범위 제한 (더 엄격):

```bash
argocd proj role create-token default image-updater --expires-in 90d
```

토큰을 `argocd-image-updater-secret` Secret의 `argocd.token` 필드에
저장 → Helm values에서 `config.argocd.token: $argocd.token` 또는
`existingSecret` 경로로 참조. Secret 자체는 ExternalSecrets로 Vault·
AWS SM에서 주입 권장.

### 2.4 app-in-any-namespace 지원

ArgoCD 2.5+ `application.namespaces` 기능으로 `argocd` 외 namespace에
Application이 있으면, Image Updater에도 명시해야 watch.

```yaml
extraArgs:
  - --applications-api=kubernetes
  - --applications-namespaces=argocd,team-*
```

Kubernetes API 기반 감시가 켜지면 지정된 namespace의 Application을 모두
수집.

---

## 3. v1.x CRD 방식과 v0.x Annotation 방식

### 3.0 선택 기준

| 방식 | 특징 | 권장 |
|---|---|---|
| **CRD `ImageUpdater` (v1.x)** | 별도 리소스로 선언, 여러 App/image 한 번에 | 신규 배포 |
| **Application annotation (v0.x legacy)** | Application CR에 annotation, 이 글이 상세히 다룸 | 기존 운영 유지 |

v1.x CRD 예시:

```yaml
apiVersion: image-updater.argoproj.io/v1alpha1
kind: ImageUpdater
metadata:
  name: my-app-updater
  namespace: argocd
spec:
  applicationRefs:
    - name: my-app
      namespace: argocd
  images:
    - alias: api
      imageName: ghcr.io/my-org/api-service
      updateStrategy: semver
      allowTags: "^v[0-9]+\\.[0-9]+\\.[0-9]+$"
      constraint: "~1.4"
  writeBackConfig:
    method: git
    gitConfig:
      branch: main
      writeBackTarget: "kustomization:."
```

기존 annotation 기반 조직은 v0 → v1 마이그레이션 가이드를 따라 점진
이동. 상세는 [Migration Guide](https://argocd-image-updater.readthedocs.io/en/stable/configuration/migration/).

아래 섹션은 **annotation 방식(v0.x legacy, 여전히 다수 운영)** 기준.

### 3.1 최소 설정

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    # 관리 대상 이미지 목록 — alias=image[:constraint]
    argocd-image-updater.argoproj.io/image-list: |
      api=ghcr.io/my-org/api-service,
      web=ghcr.io/my-org/web-service
    # alias별 update strategy
    argocd-image-updater.argoproj.io/api.update-strategy: semver
    argocd-image-updater.argoproj.io/web.update-strategy: latest
spec:
  source:
    repoURL: https://github.com/org/gitops
    path: apps/my-app
    # ...
```

### 3.2 Annotation 요약

| Annotation | 역할 |
|---|---|
| `image-list` | 관리할 이미지 목록 (alias 포함) |
| `<alias>.update-strategy` | strategy 지정 (semver/latest/name/digest) |
| `<alias>.allow-tags` | 허용 태그 regex (예: `^v\d+\.\d+\.\d+$`) |
| `<alias>.ignore-tags` | 제외 태그 regex |
| `<alias>.pull-secret` | 레지스트리 자격 (image 전용) |
| `<alias>.platforms` | 허용 플랫폼 (`linux/amd64`) |
| `<alias>.helm.image-name` / `<alias>.helm.image-tag` | Helm values 경로 |
| `<alias>.kustomize.image-name` | Kustomize image name |
| `write-back-method` | `argocd` 또는 `git[:secret-ref]` |
| `write-back-target` | `kustomization:.` 또는 `helmvalues:values.yaml` |
| `git-branch` | write-back 대상 브랜치 |

---

## 4. Update Strategy — 4가지

### 4.1 `semver` — 시맨틱 버전 제약 (프로덕션 표준)

```yaml
metadata:
  annotations:
    argocd-image-updater.argoproj.io/image-list: |
      api=ghcr.io/my-org/api-service:~1.4
    argocd-image-updater.argoproj.io/api.update-strategy: semver
```

- `~1.4` : 1.4.x 범위 (patch release만)
- `^1.4` : 1.x.x 범위 (minor까지)
- `1.4.x` / `>=1.4.0, <2.0.0` : 범위 지정

**프로덕션에는 `semver` + `~` 권장**. patch만 자동, minor는 수동 PR.

### 4.2 `newest-build` (구 `latest`) — 최근 푸시된 태그

```yaml
argocd-image-updater.argoproj.io/api.update-strategy: newest-build
argocd-image-updater.argoproj.io/api.allow-tags: regexp:^build-\d+$
```

- 레지스트리 **push time 기준 최신**
- 빌드마다 태그가 바뀌는 스테이징 환경에 적합
- `allow-tags`로 허용 태그 패턴 제한
- **v0.13+에서 `latest` → `newest-build` 이름 변경**. 구 이름은 경고
  로그 + 향후 제거 예정. 신규 구성은 `newest-build` 사용

### 4.3 `digest` — 고정 태그의 digest 변경 감지

```yaml
argocd-image-updater.argoproj.io/image-list: api=ghcr.io/my-org/api-service:stable
argocd-image-updater.argoproj.io/api.update-strategy: digest
```

- `stable` 태그가 같은 값이어도 **digest가 바뀌면** 업데이트
- 배포 대상이 **이미지 digest로 pin**되는 SRE 원칙과 결합 시 유용
- Image Updater는 mutable tag의 새 digest를 감지해 deployment에 기록

### 4.4 `alphabetical` (구 `name`) — 알파벳 순 최신

```yaml
argocd-image-updater.argoproj.io/api.update-strategy: alphabetical
argocd-image-updater.argoproj.io/api.allow-tags: regexp:^release-[0-9a-f]{7}$
```

- `release-abc1234` 같이 sortable한 commit hash 태그에 적합
- push 시간 대신 이름 순
- v0.13+에서 `name` → `alphabetical` 이름 변경

### 4.5 태그 필터링 조합

```yaml
# 허용 태그만 고려하고 그 중에서 semver 적용
argocd-image-updater.argoproj.io/api.update-strategy: semver
argocd-image-updater.argoproj.io/api.allow-tags: regexp:^v\d+\.\d+\.\d+$
argocd-image-updater.argoproj.io/api.ignore-tags: "*-rc,*-beta"
```

**항상 `allow-tags`로 명시적 범위 지정** 권장. 안 그러면 CI가 실수로
만든 태그가 프로덕션에 자동 반영될 수 있음.

---

## 5. Registry 설정

### 5.1 글로벌 registry 정의

```yaml
# argocd-image-updater-config (ConfigMap)
registries:
  - name: Docker Hub
    prefix: docker.io
    api_url: https://registry-1.docker.io
    defaultns: library
    credentials: pullsecret:argocd/dockerhub-creds

  - name: GHCR
    prefix: ghcr.io
    api_url: https://ghcr.io
    credentials: pullsecret:argocd/ghcr-creds

  - name: ECR
    prefix: 111111111111.dkr.ecr.us-east-1.amazonaws.com
    api_url: https://111111111111.dkr.ecr.us-east-1.amazonaws.com
    credentials: ext:/auth/ecr-login.sh     # 스크립트로 동적 토큰
    credsexpire: 10h
```

### 5.2 인증 4가지 방식

| 방식 | 형식 | 적합 |
|---|---|---|
| pullsecret | `pullsecret:<ns>/<name>` | K8s Secret의 `.dockerconfigjson` 사용 |
| secret field | `secret:<ns>/<name>#<field>` | Secret 내 특정 field |
| env | `env:<ENV_VAR_NAME>` | Pod 환경변수 (KMS 래핑, 로컬 테스트) |
| external | `ext:/path/to/script.sh` | 동적 토큰 (ECR, GCR, ACR) |

### 5.3 ECR helper script

`ext:` 방식은 스크립트가 **stdout에 `username:password` 단일 라인**을
출력해야 Image Updater가 파싱.

```bash
#!/bin/sh
# /auth/ecr-login.sh — 이미지 Pod에 마운트되는 스크립트
echo "AWS:$(aws ecr get-login-password --region us-east-1)"
```

- `credsexpire`로 재실행 주기 (Go duration: `10h`). 해당 시간이 지나야
  스크립트 재호출
- EKS + IRSA 조합이면 `aws` CLI가 자연스럽게 STS 발급
- GAR은 `gcloud auth print-access-token` + Workload Identity 조합,
  ACR은 `az acr login --expose-token`

### 5.4 Image-level pull-secret

글로벌 설정 외에 **이미지별로** override:

```yaml
argocd-image-updater.argoproj.io/api.pull-secret: pullsecret:argocd/my-private-reg
```

### 5.5 멀티 플랫폼 (multi-arch)

```yaml
argocd-image-updater.argoproj.io/api.platforms: linux/amd64,linux/arm64
```

기본은 Image Updater Pod이 **자신이 실행되는 플랫폼 이미지만** 고려
(manifest list 검사). arm64 노드로 배포하는 환경에서는 명시 필수.

---

## 6. Write-Back Methods

### 6.1 `argocd` (기본, imperative)

```yaml
argocd-image-updater.argoproj.io/write-back-method: argocd
```

- Image Updater가 **ArgoCD API로 직접 Application 수정**
- 속도 빠름 (Git 경로 스킵)
- **단점**: Git이 진리가 아님 — Application의 현재 상태와 Git이 불일치

### 6.2 `git` (declarative, 권장)

```yaml
argocd-image-updater.argoproj.io/write-back-method: git:argocd/git-creds
argocd-image-updater.argoproj.io/git-branch: main
# Application source와 다른 리포에 쓰려면
# argocd-image-updater.argoproj.io/git-repository: https://github.com/org/other-gitops
```

- 새 이미지 태그를 **Git 리포에 commit/push**
- 기본 target 리포는 Application의 `spec.source.repoURL` — **다른
  리포로 쓰려면 `git-repository` annotation** 필요
- ArgoCD가 정상 sync 경로로 배포 → GitOps 순수
- commit은 `.argocd-source-<app>.yaml` 파일에 기록됨 (별도 파일)
- commit 메시지 템플릿: `ConfigMap argocd-image-updater-config`의
  `git.commit-message-template` (Go template)

### 6.3 `write-back-target` — Kustomize/Helm 직접 수정

기본 write-back은 별도 `.argocd-source-<app>.yaml`에 기록되지만, **원본
Kustomization/values 파일을 직접 수정**하게 지정 가능. 경로는 Application
`source.path` 기준 상대 또는 절대.

**Kustomize**:

```yaml
argocd-image-updater.argoproj.io/write-back-method: git
argocd-image-updater.argoproj.io/write-back-target: kustomization:.
# 또는 상대 경로로 base 가리키기
# argocd-image-updater.argoproj.io/write-back-target: kustomization:../../base
argocd-image-updater.argoproj.io/api.kustomize.image-name: ghcr.io/my-org/api-service
```

효과: `kustomize edit set image`와 동일한 변경을 해당 `kustomization.yaml`에.

**Helm**:

```yaml
argocd-image-updater.argoproj.io/write-back-method: git
argocd-image-updater.argoproj.io/write-back-target: helmvalues:values.yaml
# 또는 리포 루트 기준 절대 경로
# argocd-image-updater.argoproj.io/write-back-target: helmvalues:/envs/prod/values.yaml
argocd-image-updater.argoproj.io/api.helm.image-name: image.repository
argocd-image-updater.argoproj.io/api.helm.image-tag: image.tag
```

효과: `values.yaml`의 `image.repository`/`image.tag`가 **Git에 직접
수정** — Helm values를 GitOps 리포에서 읽을 때 자연스러움.

### 6.4 GitOps 품질 비교

| 구성 | 순도 | 가시성 | 리뷰 |
|---|---|---|---|
| `argocd` 방식 | 낮음 | Application CR만 | 안 됨 |
| `git` + `.argocd-source-<app>.yaml` | 중 | 별도 파일 commit | 가능 |
| `git` + `kustomize edit`/`helm values` | 높음 | 실제 소스에 반영 | 자연스러움 |

**프로덕션 표준**: `git` + `kustomize`/`helm` 직접 수정.

### 6.5 Git credentials

```yaml
# Secret argocd/git-creds — write-back-method: git:argocd/git-creds
apiVersion: v1
kind: Secret
metadata:
  name: git-creds
  namespace: argocd
stringData:
  username: image-updater-bot
  password: <PAT-or-app-token>
  # 또는 SSH 키
  sshPrivateKey: |
    -----BEGIN OPENSSH PRIVATE KEY-----
    ...
```

- PAT 대신 **GitHub App token** (짧은 만료, 세분화 권한) 권장
- 브랜치 보호가 있는 `main`에는 **PR 생성 경로** — 아직 공식 미지원
  이슈 진행 중, 당분간 별도 branch로 쓰고 수동 PR

---

## 7. 운영 고려사항

### 7.1 Rate limit

- 레지스트리 API 호출이 `interval`마다 발생 — 수백 Application × 여러
  이미지면 빠르게 한계 도달
- Docker Hub는 anonymous 호출에 엄격한 rate limit(구체 수치는 요금제·
  정책에 따라 변동)이 있어 **반드시 인증** 또는 **사내 mirror/proxy
  (Harbor, Artifactory)** 도입
- GHCR, ECR, GAR, ACR은 상대적으로 여유

`interval`을 늘리거나 mirror를 두는 것이 표준 완화책.

### 7.2 메트릭·로그

Image Updater는 `/metrics` 엔드포인트를 `--metrics-bind-address`
(Helm: `containerPorts.metrics`)에서 노출. 주요 메트릭 (정확한 이름·타입은
배포 버전의 `/metrics` 출력으로 확인):

```
argocd_image_updater_applications_watched       # gauge
argocd_image_updater_images_watched             # gauge
argocd_image_updater_images_updated_total       # counter
argocd_image_updater_registry_requests_total    # counter
argocd_image_updater_registry_requests_failed_total
argocd_image_updater_update_errors_total
```

**실패율 모니터** 필수 — 레지스트리 인증 만료·API 변경 즉시 감지.

### 7.3 Dry-run / 이미지 검증

```bash
# 단일 이미지에 대한 태그 검증 (App 이름 아님, 이미지 지정)
argocd-image-updater test ghcr.io/my-org/api-service \
  --semver-constraint "~1.4" \
  --registries-conf /app/config/registries.conf

# 전체 run-once 모드 (바이너리 플래그)
argocd-image-updater run --once
```

- `test`는 **이미지 하나**를 받아 "현재 레지스트리에서 어떤 태그가 선택
  되는가"를 출력. Application 이름을 넣는 형식 아님
- `run --once`로 전체 Application 1회 스캔 후 종료 — 새 환경·새
  annotation 도입 시 디버깅에 유용

### 7.4 알림 연계

Image Updater가 업데이트한 이벤트를 [Notifications](./argocd-notifications.md)
로 알리려면 trigger 조건에 `app.status.operationState.operation.initiatedBy.username == 'admin'`
(Image Updater는 admin 또는 전용 계정으로 업데이트) 또는 commit 메시지
기반 조건 조합.

### 7.5 경합 방지 — selfHeal과의 상호작용

- Image Updater가 ArgoCD API로 spec을 쓰면 (`argocd` 방식), ArgoCD의
  `selfHeal`과 경합 가능
- **`git` 방식으로 전환**하면 selfHeal이 자연스럽게 Git 상태 따라감

### 7.6 롤백

자동 업데이트된 이미지에 문제 발생 시:

1. Git 방식이면 **Git revert**로 이전 태그
2. `argocd` 방식이면 **Application 수동 rollback** (하지만 Image Updater
   가 다시 최신으로 돌림 → `kubectl annotate` 로 업데이터 일시 중지)

**일시 중지**:

```yaml
argocd-image-updater.argoproj.io/update-strategy: ""
# 또는 전체 이미지 비활성
argocd-image-updater.argoproj.io/image-list: ""
```

### 7.7 ApplicationSet과 결합

ApplicationSet generator가 만드는 자식 Application에 Image Updater
annotation을 template으로 전파:

```yaml
template:
  metadata:
    annotations:
      argocd-image-updater.argoproj.io/image-list: |
        app=ghcr.io/my-org/{{.svc_name}}:~1.0
      argocd-image-updater.argoproj.io/app.update-strategy: semver
      argocd-image-updater.argoproj.io/write-back-method: git
```

---

## 8. 안티패턴

| 안티패턴 | 왜 문제 | 교정 |
|---|---|---|
| 프로덕션에 `write-back-method: argocd` | Git이 진리 아님, 감사 불가 | `git` + kustomize/helm target |
| `allow-tags` 없는 `newest-build` strategy | 실수 태그가 프로덕션으로 | regex 필터 필수 |
| `latest`/`name` 이름 그대로 사용 | v0.13+ 경고, 향후 제거 | `newest-build`/`alphabetical` |
| semver 제약 `*` | patch 자동이 아니라 major까지 자동 | `~1.4` 또는 `^1.4` |
| Docker Hub anonymous 호출 | rate limit 즉시 고갈 | 인증 설정, mirror 도입 |
| `write-back-target` 지정 없이 Kustomize | `.argocd-source-<app>.yaml` 만 기록 | `kustomization:.` 명시 |
| ECR credsexpire 누락 | 12시간 후 조용히 실패 | `credsexpire: 10h` |
| multi-arch 클러스터에 `platforms` 미지정 | 실행 플랫폼 외 이미지 무시 | `linux/amd64,linux/arm64` 명시 |
| Git PAT 장기 토큰 | 유출 시 브랜치 전체 영향 | GitHub App token, 짧은 만료 |
| `interval: 10s` | 레지스트리 rate limit | `2m~10m` |
| 업데이트 자동화 후 PR 리뷰 없음 | 프로덕션 거버넌스 이탈 | 프로덕션은 PR 경로 유지, stage만 자동 |
| Image Updater를 ApplicationSet 자식에만 붙임 | 부모 변경 시 annotation 유실 | template에 영구 선언 |
| selfHeal + `argocd` 방식 | 경합 loop | `git` 방식으로 통일 |

---

## 9. 도입 로드맵

1. **스테이징 Application 1개 시험** — `newest-build` + `allow-tags` 정규식
2. **Helm 차트로 배포** — metrics 활성
3. **레지스트리 인증 설정** — GHCR/ECR/Harbor
4. **`once` 모드 검증** — annotation 동작 확인
5. **`semver` + `~`** — 실제 버전 흐름 관찰
6. **`write-back-method: git`** — Git에 커밋되는 것 확인
7. **`write-back-target` kustomize/helm** — 소스 파일 직접 수정
8. **프로덕션은 PR 경로 유지** — main이 아닌 별도 branch write-back 후
   수동 PR
9. **메트릭 대시보드** — 실패율·호출량·업데이트 횟수
10. **Notifications 연계** — 자동 업데이트 Slack 알림
11. **ApplicationSet 템플릿 통합** — 팀별 표준 annotation 세트
12. **v1.x CRD 전환** — 신규 도입은 `ImageUpdater` CR, 기존 annotation
    조직은 [Migration Guide](https://argocd-image-updater.readthedocs.io/en/stable/configuration/migration/)
    따라 단계 이동
13. **장기 전략 평가** — Image Updater vs Flux Image Automation
    재검토

---

## 10. 관련 문서

- [ArgoCD 설치](./argocd-install.md) — HA·Self-management
- [ArgoCD App](./argocd-apps.md) — Application·ApplicationSet
- [ArgoCD Sync](./argocd-sync.md) — selfHeal과 경합 방지
- [ArgoCD 프로젝트](./argocd-projects.md) — Project role·JWT
- [Notifications](./argocd-notifications.md) — 업데이트 알림
- [Harbor / OCI 레지스트리](../artifact/harbor.md) — 사내 mirror
- [Flux Helm](../flux/flux-helm.md) — 대안 생태계

---

## 참고 자료

- [Argo CD Image Updater 공식 문서](https://argocd-image-updater.readthedocs.io/) — 확인: 2026-04-24
- [Installation](https://argocd-image-updater.readthedocs.io/en/stable/install/installation/) — 확인: 2026-04-24
- [Update Strategies](https://argocd-image-updater.readthedocs.io/en/stable/basics/update-strategies/) — 확인: 2026-04-24
- [Update Methods](https://argocd-image-updater.readthedocs.io/en/stable/basics/update-methods/) — 확인: 2026-04-24
- [Application Configuration](https://argocd-image-updater.readthedocs.io/en/stable/configuration/applications/) — 확인: 2026-04-24
- [Images Configuration](https://argocd-image-updater.readthedocs.io/en/stable/configuration/images/) — 확인: 2026-04-24
- [Registry Authentication](https://argocd-image-updater.readthedocs.io/en/stable/basics/authentication/) — 확인: 2026-04-24
- [argocd-image-updater GitHub](https://github.com/argoproj-labs/argocd-image-updater) — 확인: 2026-04-24
- [Mastering ArgoCD Image Updater with Helm (CNCF)](https://www.cncf.io/blog/2024/11/05/mastering-argo-cd-image-updater-with-helm-a-complete-configuration-guide/) — 확인: 2026-04-24
- [Migration Guide (v0.x → v1.x)](https://argocd-image-updater.readthedocs.io/en/stable/configuration/migration/) — 확인: 2026-04-24
- [Container Registries Configuration](https://argocd-image-updater.readthedocs.io/en/stable/configuration/registries/) — 확인: 2026-04-24
- [argo-helm argocd-image-updater values](https://github.com/argoproj/argo-helm/blob/main/charts/argocd-image-updater/values.yaml) — 확인: 2026-04-24
