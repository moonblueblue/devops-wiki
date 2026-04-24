---
title: "ArgoCD Application·ApplicationSet — 선언·생성·템플릿·점진 배포"
sidebar_label: "ArgoCD App"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - argocd
  - application
  - applicationset
  - generator
  - progressive-sync
---

# ArgoCD Application과 ApplicationSet

> **Application CR이 ArgoCD의 작업 단위**다. 하나의 Application = "이
> Git 경로를 이 클러스터의 이 namespace에 동기화해라". 클러스터·환경이
> 늘면 Application을 **반복해서 찍어내는** 추상이 필요해지고, 그 답이
> **ApplicationSet**이다. 이 글은 Application CR의 전체 스펙, 단일/다중
> 소스, ApplicationSet의 7가지 generator, `goTemplate`·`templatePatch`,
> **RollingSync 기반 Progressive Sync**까지 실전 깊이로 정리한다.

- **주제 경계**: **설치·HA**는 [ArgoCD 설치](./argocd-install.md).
  **Sync 정책·hooks·pruning**은 [ArgoCD Sync](./argocd-sync.md). 여기는
  "**무엇을 배포할지 정의**"하는 리소스 CR에 집중
- **현재 기준**: ArgoCD 3.2.10, 3.3 GA. `goTemplate: true`가 2026 표준.
  Multiple Sources는 **rollback 비지원**이 여전히 핵심 제약

---

## 1. Application 개요

### 1.1 Application이 무엇을 선언하는가

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: guestbook
  namespace: argocd
spec:
  project: default
  source:                     # 단일 소스 (legacy 방식)
    repoURL: https://github.com/argoproj/argocd-example-apps
    targetRevision: HEAD
    path: guestbook
  destination:
    server: https://kubernetes.default.svc
    namespace: guestbook
  syncPolicy:
    automated: {prune: true, selfHeal: true}
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

3가지 축의 선언:

| 축 | 필드 | 의미 |
|---|---|---|
| **어디서** (source) | `repoURL` · `targetRevision` · `path`/`chart` | Git 저장소와 revision |
| **어디로** (destination) | `server` 또는 `name` · `namespace` | Target 클러스터 + namespace |
| **어떻게** (syncPolicy) | `automated` · `syncOptions` · `retry` | 동기화 방식 상세는 [Sync](./argocd-sync.md) |

### 1.2 namespace 제약 — 2026 표준

Application CR은 기본적으로 **`argocd` namespace에만** 생성 가능.
2.5+에서 **app-in-any-namespace**, 2.8+에서 **appset-in-any-namespace**
가 도입되었고 3.x에서 GA. 팀별 namespace 분리 시:

```yaml
configs:
  params:
    application.namespaces: "team-*,platform"          # Application 허용 ns
    applicationsetcontroller.namespaces: "team-*"       # ApplicationSet 허용 ns
```

주의:

- Controller + Server 모두 같은 파라미터를 받아야 함
- AppProject의 `sourceNamespaces`로 허용 목록 매칭 필요 —
  [ArgoCD 프로젝트](./argocd-projects.md)
- **SCM Provider·Pull Request generator는 허용 namespace에서 기본 비활성**.
  `applicationsetcontroller.enable.scm.providers=github.com,gitlab.com`
  식의 allowlist 필요 (토큰 악용 방지)

### 1.3 destination — `server` vs `name`

| 필드 | 예시 | 적합 |
|---|---|---|
| `server` | `https://kubernetes.default.svc` (in-cluster) | URL 직접 지정 |
| `name` | `prod-a` | cluster Secret의 `name` 매칭 (가독성 ↑) |

**권장**: `name` 사용. Server URL이 바뀌어도 Secret 이름만 유지하면
Application 재작성 불필요.

---

## 2. Source — 소스 타입별 옵션

### 2.1 plain directory / Kustomize

```yaml
source:
  repoURL: https://git.example.com/gitops
  targetRevision: main
  path: apps/guestbook
  # Kustomize는 path에 kustomization.yaml만 있으면 자동 감지
  kustomize:
    namespace: guestbook
    namePrefix: prod-
    images:
      - nginx=nginx:1.27
    replicas:
      - name: guestbook-ui
        count: 3
```

**Tool 판별 우선순위** (Argo CD 공식 Tool Detection):

1. `source.chart` 지정 → Helm chart (`repoURL`은 Helm repo 필수, `path` 금지)
2. `source.plugin` 지정 → ConfigManagementPlugin (sidecar CMP)
3. `path` 안에 `kustomization.yaml`/`.yml`/`Kustomization` → Kustomize
4. `path` 안에 `Chart.yaml` → Helm (Git 리포 내 chart)
5. 그 외 → plain YAML Directory

동일 source에 `chart` + `path`는 상호 배타. 혼동 방지를 위해 명시 필드
하나만 설정할 것.

### 2.2 Helm

```yaml
source:
  repoURL: https://charts.bitnami.com/bitnami   # Helm 저장소
  chart: redis
  targetRevision: 20.6.0
  helm:
    releaseName: redis
    values: |
      auth:
        existingSecret: redis-auth
    valuesObject:                # values를 inline YAML로도 가능
      architecture: replication
    valueFiles:
      - values-prod.yaml         # 같은 source 또는 $values refer
    parameters:
      - name: replica.replicaCount
        value: "3"
    skipCrds: false              # CRD 재설치 여부
    passCredentials: false       # HTTP 저장소 인증 전달
    ignoreMissingValueFiles: true
    version: v3                  # Helm binary 버전 (기본 v3)
    kubeVersion: "1.30.0"        # 차트의 kubeVersion 강제 — 3.x 신규
    apiVersions:                 # 차트의 Capabilities.APIVersions
      - apps/v1
      - networking.k8s.io/v1
```

- **ArgoCD는 `helm template`으로 manifest를 만든다** — release는
  Helm client의 것이 아니라 ArgoCD가 관리 (`kubectl` 상당)
- `kubeVersion`·`apiVersions`는 target 클러스터와 **다른 버전으로
  렌더링 강제**할 때 유용 (예: kubeVersion fix로 예측 가능한 결과)
- **Helm chart OCI** 지원 — `repoURL: oci://registry.example.com/charts`.
  Repository Secret에 `type: helm` + `enableOCI: "true"` 설정 필요

### 2.3 Plugin (ConfigManagementPlugin)

Kustomize·Helm 외 tool을 쓰려면 **sidecar CMP**로 확장. Jsonnet, Tanka,
Cue, Timoni 등.

```yaml
source:
  plugin:
    name: cue-1.0                # 설치된 CMP 이름
    env:
      - name: APP_NAME
        value: guestbook
    parameters:
      - name: release
        string: prod
```

**2026 상태**: repo-server의 `--plugins` 마운트 방식은 deprecated. 모든
CMP는 **sidecar 컨테이너**로 등록. 자세한 구성은
[ArgoCD 고급](./argocd-advanced.md).

### 2.4 Directory recurse + jsonnet

```yaml
source:
  path: manifests
  directory:
    recurse: true                 # 하위 디렉터리 스캔
    include: "*.yaml"             # glob
    exclude: "_templates/*"
    jsonnet:
      extVars:
        - {name: region, value: us-east-1}
      tlas:
        - {name: stage, code: false, value: prod}
```

"순수 YAML을 디렉터리 채로" 방식. App-of-Apps에서 자식 Application YAML
다수를 `recurse: true`로 묶는 게 전형적 용례.

---

## 3. Multiple Sources — 다중 소스

### 3.1 동기와 형태

Helm 차트는 공식 OCI 저장소에, **values는 조직 Git 리포**에 두는 경우가
많다. Multiple Sources가 이를 해결.

```yaml
spec:
  sources:
    - chart: redis
      repoURL: https://charts.bitnami.com/bitnami
      targetRevision: 20.6.0
      helm:
        valueFiles:
          - $values/apps/redis/values-prod.yaml
    - repoURL: https://git.example.com/gitops
      targetRevision: main
      ref: values                # ref-only source
  destination:
    server: https://kubernetes.default.svc
    namespace: cache
```

- `ref`가 붙은 소스는 **manifest를 생성하지 않는다** — 다른 소스의
  `$values/...` path 참조용
- 동일 Application에 **여러 Git 리포 manifest 병합**도 가능 (순서대로
  렌더링 → union)

### 3.2 핵심 제약 — Rollback 불가

**Multiple Sources를 쓰는 Application은 UI/CLI의 "Rollback" 기능이
비활성**된다. `argocd app rollback` 거부. 3.3 기준 여전히 미해결이며,
[UI 지원 proposal](https://argo-cd.readthedocs.io/en/stable/proposals/multiple-sources-for-applications-ui/)
이 진행 중.

대안:

| 대안 | 방법 |
|---|---|
| **Git revert** | 이전 commit SHA로 `targetRevision` pin |
| 단일 소스로 재작성 | Helm values를 Git 외 방식으로 (Secret, ConfigMap) |
| `preRollback` script | 자체 파이프라인에서 revert 자동화 |

**의사결정**: rollback이 중요한 비즈니스면 Multiple Sources 보류. 대부분의
팀은 Git revert로 충분하지만, **감사 로그에서 `rollback` 이벤트가 명시적
으로 필요한 조직**은 단일 소스 유지.

### 3.3 ref-only source와 `$values/` syntax

```yaml
sources:
  - repoURL: https://github.com/org/helm-charts
    targetRevision: main
    path: charts/myapp
    helm:
      valueFiles:
        - $env/values-${REGION}.yaml   # ref 이름이 env
  - repoURL: https://github.com/org/envs
    targetRevision: main
    ref: env                           # 이 ref를 $env로 참조
```

`$values`는 관례적 이름일 뿐 자유롭게 지정 가능. 환경별 values 분리에
유용.

---

## 4. syncPolicy 기본만 (상세는 Sync 글)

자주 쓰는 조합만 여기 한 번.

```yaml
syncPolicy:
  automated:
    prune: true
    selfHeal: true
    allowEmpty: false
  syncOptions:
    - CreateNamespace=true
    - ServerSideApply=true
    - ApplyOutOfSyncOnly=true
    - PruneLast=true
    - RespectIgnoreDifferences=true
  retry:
    limit: 5
    backoff: {duration: 5s, factor: 2, maxDuration: 3m}
  managedNamespaceMetadata:
    labels:
      team: platform
    annotations:
      istio-injection: enabled
```

상세 옵션·hooks·pruning 시나리오는 [ArgoCD Sync](./argocd-sync.md).

---

## 5. ignoreDifferences — 드리프트 허용

### 5.1 왜 필요한가

외부 컨트롤러(HPA, Mutating Webhook, Service Mesh sidecar injector)가
live 상태를 수정하면 ArgoCD가 계속 `OutOfSync`로 감지. 의도적으로
**특정 필드를 diff에서 제외**.

```yaml
spec:
  ignoreDifferences:
    - group: apps
      kind: Deployment
      jsonPointers:                # JSON Pointer (RFC 6901)
        - /spec/replicas
    - group: apps
      kind: Deployment
      jqPathExpressions:           # jq 표현식
        - '.spec.template.spec.containers[] | select(.name=="istio-proxy")'
    - group: ""
      kind: Service
      name: my-svc
      namespace: prod
      managedFieldsManagers:       # SSA managed fields 기준
        - cert-manager
  # ⚠️ managedFieldsManagers는 ServerSideApply=true 전제
  # (SSA가 활성 아니면 managed-fields 메타데이터가 없어 매칭 불가)
```

### 5.2 `RespectIgnoreDifferences` 옵션

기본 동작: `ignoreDifferences`는 **diff에만 적용, sync 시에는 무시**.
즉 `ignore` 해둔 필드도 sync가 일어나면 Git 값으로 덮어쓴다.

```yaml
syncOptions:
  - RespectIgnoreDifferences=true
```

이 옵션이 있어야 **sync 시에도 ignore 필드를 건드리지 않는다**. HPA
replicas 같은 외부 관리 필드는 반드시 함께 사용.

### 5.3 글로벌 설정 (argocd-cm)

모든 Application에 적용되는 공통 규칙은 ConfigMap으로.

```yaml
# argocd-cm
data:
  resource.customizations.ignoreDifferences.admissionregistration.k8s.io_MutatingWebhookConfiguration: |
    jqPathExpressions:
      - '.webhooks[]?.clientConfig.caBundle'
```

cert-manager가 관리하는 `caBundle` 같은 자동 주입 필드를 전역으로 ignore.
Application별로 반복 선언하지 않아 유지보수 이득.

---

## 6. sync-wave — 배포 순서 제어

### 6.1 annotation

```yaml
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"     # namespace·CRD 먼저
```

Wave 값(정수, 음수 가능) 오름차순으로 sync. 같은 wave는 병렬. Application
자체에도 동일 annotation 적용 가능 — **App-of-Apps에서 자식 Application
순서 제어**에 필수.

### 6.2 일반 패턴

| Wave | 리소스 |
|---|---|
| `-2` | Namespace, NetworkPolicy |
| `-1` | CRD, ClusterRole/Binding |
| `0` | 기본 워크로드 (ConfigMap, Secret, Deployment 등) |
| `1` | Service, Ingress |
| `2` | Job (migration 등), HorizontalPodAutoscaler |

### 6.3 주의 — hook과 phase의 차이

Sync는 **PreSync → Sync → PostSync** 3단계(phase). Hook은 phase 내에서
실행, wave는 phase 내부 순서. 상세는 [ArgoCD Sync](./argocd-sync.md).

---

## 7. ApplicationSet — 개요

### 7.1 존재 이유

"개발·스테이징·프로덕션 3개 환경 × 5개 클러스터 × 10개 서비스 = 150개
Application을 손으로?" 문제를 푸는 것이 ApplicationSet. Application
**factory**라고 보면 된다.

### 7.2 기본 구조

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: guestbook
  namespace: argocd
spec:
  goTemplate: true                      # 2026 표준 — sprig 함수 포함
  goTemplateOptions: ["missingkey=error"]
  generators:
    - list:
        elements:
          - {cluster: dev,  url: https://1.2.3.4}
          - {cluster: prod, url: https://5.6.7.8}
  template:
    metadata:
      name: "guestbook-{{.cluster}}"
    spec:
      project: default
      source:
        repoURL: https://github.com/org/gitops
        targetRevision: HEAD
        path: "apps/guestbook/overlays/{{.cluster}}"
      destination:
        server: "{{.url}}"
        namespace: guestbook
```

- `generators`가 parameter set의 배열을 생성
- `template`이 각 parameter set으로 **Application을 찍어낸다**
- `goTemplate: true` 설정 필수 (기본 false = fasttemplate, 제약 많음)

### 7.3 `fasttemplate` vs `goTemplate`

| 축 | fasttemplate (기본) | goTemplate |
|---|---|---|
| 문법 | `{{ key }}` | `{{ .key }}` (Go 표준) |
| 함수 | 없음 | sprig + argocd 전용 |
| 조건/반복 | 불가 | `if`/`range`/`with` |
| JSON 이스케이프 | 수동 | `{{ .x \| toJson }}` |
| 권장 | 레거시 | **신규 모두 goTemplate** |

**모든 신규 ApplicationSet에 `goTemplate: true`**. fasttemplate은 이미
존재하는 설정 호환용.

### 7.4 `goTemplateOptions: missingkey=error`

기본적으로 missing key는 `<no value>` 문자열로 렌더링 → 조용한 실수.
`missingkey=error`로 **파이프라인을 즉시 실패시키는** 안전 패턴.

---

## 8. Generator — 8가지 (+ Post-Selector)

### 8.1 List

가장 단순. 정적 배열.

```yaml
generators:
  - list:
      elements:
        - {cluster: dev,  env: dev}
        - {cluster: prod, env: prod}
```

### 8.2 Cluster

ArgoCD에 등록된 **클러스터 Secret을 label selector로 매칭**. 멀티 클러스터
반복의 표준.

```yaml
generators:
  - clusters:
      selector:
        matchLabels:
          env: prod
      values:                     # 추가 파라미터 주입
        deploy-prio: "high"
```

생성되는 parameter:

| key | 출처 |
|---|---|
| `name` | cluster Secret의 `name` 필드 |
| `nameNormalized` | DNS-safe 변환 |
| `server` | 클러스터 URL |
| `metadata.labels.*` | cluster Secret 라벨 |
| `metadata.annotations.*` | cluster Secret annotation |
| `values.deploy-prio` | 위의 custom values |

### 8.3 Git — Files & Directories

두 가지 하위 모드.

**Files mode** — JSON/YAML 파일을 parameter로 읽음.

```yaml
generators:
  - git:
      repoURL: https://github.com/org/gitops
      revision: HEAD
      files:
        - path: "envs/*/config.json"
```

각 파일 내용이 parameter set. 파일 패턴 매칭 = loop 횟수.

**Directories mode** — 디렉터리 이름만으로 반복.

```yaml
generators:
  - git:
      repoURL: https://github.com/org/gitops
      revision: HEAD
      directories:
        - path: "envs/*"
        - path: "envs/secrets"
          exclude: true            # 제외 패턴
```

`{{.path.basename}}`, `{{.path.path}}` 등으로 접근.

### 8.4 Matrix — 2차원 조합

두 generator의 cross product. **환경 × 서비스** 조합.

```yaml
generators:
  - matrix:
      generators:
        - list:
            elements:
              - {env: dev}
              - {env: prod}
        - git:
            repoURL: https://github.com/org/gitops
            revision: HEAD
            directories:
              - path: "apps/*"
```

결과: `{env=dev, path=apps/web}`, `{env=dev, path=apps/api}`,
`{env=prod, path=apps/web}`, `{env=prod, path=apps/api}` 4개.

**주의**: 폭발적 조합 수 — 10 × 20 = 200 Application. 비용·rate limit
관찰.

### 8.5 Merge — 키 기반 병합

두 generator의 parameter set을 **공통 키로 merge**. matrix가 곱셈이면
merge는 join.

```yaml
generators:
  - merge:
      mergeKeys: [cluster]
      generators:
        - clusters: {}             # 베이스: 모든 클러스터
        - list:
            elements:               # 오버라이드: prod-a만 extra value
              - {cluster: prod-a, extra-image: "nginx:latest"}
```

결과: 모든 클러스터 대상 Application + `prod-a`에만 `extra-image`
파라미터 추가.

### 8.6 Pull Request — 프리뷰 환경

PR별로 임시 Application 생성 → 머지 시 자동 삭제. 프리뷰 환경의 표준.

```yaml
generators:
  - pullRequest:
      github:
        owner: my-org
        repo: my-service
        tokenRef: {secretName: github-token, key: token}
      filters:
        - branchMatch: "^feature/.*"
      requeueAfterSeconds: 180
```

parameter: `{{.number}}`, `{{.branch}}`, `{{.head_sha}}`, `{{.target_branch}}`,
`{{.labels}}`.

**반드시 Webhook 전환**: polling은 GitHub rate limit을 수 분 안에 소진.
[ArgoCD 설치 §4.5](./argocd-install.md) 참조.

### 8.7 SCM Provider — 조직 리포 자동 발견

GitHub/GitLab organization·group 전체 스캔 → Jenkinsfile 대신
`.argocd.yml`로 배포 조건 명시.

```yaml
generators:
  - scmProvider:
      github:
        organization: my-org
        tokenRef: {secretName: github-token, key: token}
      filters:
        - repositoryMatch: "^svc-.*"
          pathsExist: [deploy/kustomization.yaml]
```

### 8.8 Cluster Decision Resource

외부 컨트롤러(예: Open Cluster Management의 PlacementDecision)가 내린
**클러스터 선택 결과를 그대로 사용**. 멀티 클러스터 스케줄러 통합.

```yaml
generators:
  - clusterDecisionResource:
      configMapRef: my-configmap-ref
      name: placement-1
      labelSelector:
        matchLabels: {workload: web}
      requeueAfterSeconds: 180
```

- CR의 status.decisions를 parameter로 변환
- OCM · Karmada 등 멀티 클러스터 오케스트레이터와 연동할 때만 필요
- 일반적인 환경에서는 `clusters` generator가 더 단순

### 8.9 Plugin Generator

커스텀 HTTP 엔드포인트가 parameter를 반환. CMDB·내부 API 통합에.

```yaml
generators:
  - plugin:
      configMapRef: {name: my-plugin}
      input:
        parameters:
          foo: bar
      values:
        key1: value1
```

### 8.10 Post-Selector — 후처리 필터

Matrix/Merge로 생성된 parameter set을 후처리 필터링. 환경·서비스
조합 후 특정 프로덕션만 골라낼 때 유용.

```yaml
generators:
  - matrix:
      generators:
        - clusters: {}
        - git:
            directories: [{path: "apps/*"}]
      selector:                     # post-selector
        matchLabels:
          purpose: production
        matchExpressions:
          - {key: path.basename, operator: In, values: [web, api]}
```

---

## 9. Template 고급

### 9.1 Generator별 overrides와 template merge

```yaml
generators:
  - clusters:
      selector:
        matchLabels: {env: prod}
      template:
        metadata:
          annotations:
            notifications.argoproj.io/subscribe.on-sync-failed.slack: prod-alerts
  - clusters:
      selector:
        matchLabels: {env: dev}
template:
  # 공통 template
  metadata: {labels: {managed-by: appset}}
  spec: { ... }
```

generator-level `template`이 spec-level `template`과 **deep-merge**.
env별 annotation만 다르게 줄 때.

### 9.2 `templatePatch` — 조건부 필드

특정 조건에만 나타나는 필드를 패치. 예: prod 환경만 automated sync.

```yaml
spec:
  goTemplate: true
  generators: [...]
  template:
    spec:
      project: default
      source: { ... }
      destination: { ... }
  templatePatch: |
    {{- if eq .env "prod" }}
    spec:
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
    {{- end }}
```

**함정**: `templatePatch`는 최종 Application CR에 **JSON merge patch**
로 적용. `spec.syncPolicy` 하위 일부 필드는 RollingSync 조합 시 적용
누락 버그([#26592](https://github.com/argoproj/argo-cd/issues/26592))
— 2026-04 기준 미해결. RollingSync와 섞을 때 주의.

### 9.3 goTemplate 안전 패턴

```yaml
template:
  metadata:
    name: "{{ .cluster | default \"unknown\" | lower | replace \"_\" \"-\" }}"
  spec:
    source:
      path: "apps/{{ .env }}/{{ .service }}"
      targetRevision: "{{ .ref | default \"HEAD\" }}"
```

- `default`·`lower`·`replace` 등 sprig 함수 활용
- 이름에 `_`·공백·특수문자 들어가면 Kubernetes API가 거부 → 정규화

---

## 10. Progressive Sync (RollingSync)

### 10.1 동기

ApplicationSet이 50개 클러스터에 동일 변경을 한 번에 뿌리면 장애가
**50배로 확산**된다. **단계별 배포**로 blast radius 축소.

### 10.2 활성화 전제조건 — Beta feature

Progressive Syncs는 **Beta**다 (2026-04 기준). 기본 비활성이라 반드시
활성화 플래그를 켜야 한다. 안 켜면 `strategy` 필드는 조용히 무시된다.

```yaml
# argocd-cmd-params-cm
data:
  applicationsetcontroller.enable.progressive.syncs: "true"
# 또는 controller args
applicationSet:
  extraArgs:
    - --enable-progressive-syncs
```

### 10.3 RollingSync 선언

```yaml
spec:
  strategy:
    type: RollingSync
    rollingSync:
      steps:
        - matchExpressions:
            - key: env
              operator: In
              values: [dev]
        - matchExpressions:
            - key: env
              operator: In
              values: [staging]
          maxUpdate: 50%
        - matchExpressions:
            - key: env
              operator: In
              values: [prod]
          maxUpdate: 1            # 한 번에 하나씩
```

동작:

1. **Dev 전체** sync → Healthy 대기
2. **Staging 50%** sync → 나머지 50% sync (두 배치)
3. **Prod 하나씩** sync → 직전 Healthy까지 기다림

### 10.4 암묵적 규칙들 — 꼭 알아야 할 것

- **RollingSync는 각 Application의 `automated` syncPolicy를 강제 비활성**
  한다. 로그에 경고 출력. 개별 Application에 `automated`가 있으면 무시
- **Healthy 판정**이 step 완료 기준. Degraded나 Missing이면 다음 step
  진행 안 됨
- step 내부에서 실패하면 **무한 대기** (timeout 설정 없음) — 수동
  개입 필요
- `maxUpdate`는 정수 또는 `%` 문자열. Kubernetes의 Deployment 전략과 같음
- 라벨은 **Application label**(generator가 template으로 주입)이어야 함 —
  cluster 라벨과 다름

### 10.5 알려진 제한

- **Auto-sync on new commits 미작동** (Issue
  [#22976](https://github.com/argoproj/argo-cd/issues/22976)) — Git 변경이
  다음 step 트리거를 자동으로 잡지 않는 경우 존재
- `templatePatch`와 혼용 시 `syncPolicy` 변경 적용 누락
  ([#26592](https://github.com/argoproj/argo-cd/issues/26592))
- Image SHA 변경 시 out-of-sync 유지
  ([#26585](https://github.com/argoproj/argo-cd/issues/26585))

**실무 권장**: RollingSync는 **인프라 공통 변경**(ConfigMap 업데이트
같은 단순 변경)에만 사용. 복잡한 배포 오케스트레이션은 Argo Rollouts
기반의 [점진적 배포](../progressive-delivery/argo-rollouts.md) 사용.

---

## 11. ApplicationSet 운영

### 11.1 `syncPolicy.preserveResourcesOnDeletion`

ApplicationSet CR을 삭제할 때의 cascade 동작을 제어. **기본값 `false`**.

```yaml
spec:
  syncPolicy:
    preserveResourcesOnDeletion: true
```

| 설정 | AppSet 삭제 시 |
|---|---|
| `false` (기본) | 자식 Application 삭제 → **자식의 resources-finalizer에 따라 워크로드까지 삭제** |
| `true` | 자식 Application 삭제 → **워크로드는 유지** |

**이중 cascade 함정**: 자식 Application에 `resources-finalizer.argoproj.io`
가 붙어 있으면 ApplicationSet 삭제 → Application 삭제 → finalizer가
리소스까지 전부 정리. 이것이 프로덕션 사고의 전형. 관리 주체를
교체하거나 ApplicationSet을 한 번 끊어야 하는 마이그레이션 시에는 **반드시
`preserveResourcesOnDeletion: true` 선행**.

### 11.2 `syncPolicy.applicationsSync` — 자식 Application 수정 범위

ApplicationSet이 자식 Application에 어떤 작업까지 허용할지 제한.

```yaml
spec:
  syncPolicy:
    applicationsSync: create-only
```

| 값 | 생성 | 업데이트 | 삭제 |
|---|:-:|:-:|:-:|
| `sync` (기본) | ✔ | ✔ | ✔ |
| `create-only` | ✔ | ✖ | ✖ |
| `create-update` | ✔ | ✔ | ✖ |
| `create-delete` | ✔ | ✖ | ✔ |

- **`create-only`**: 초기 뼈대만 찍고 이후 Application은 팀이 자유 편집
- **`create-update`**: 삭제 없이 update만 — "관리는 하되 함부로 지우지 마라"
- **`create-delete`**: update 금지, 삭제만 허용 — 실험적 용도

플랫폼 팀 표준 ↔ 팀 자율성 타협점: 대부분 `create-update` 권장.

### 11.3 Dry-run & 검증

```bash
# ApplicationSet CR을 dry-run 으로 렌더링 (생성될 Application 미리보기)
argocd appset create my-appset.yaml --dry-run -o yaml

# 이미 생성된 ApplicationSet의 현재 상태
argocd appset get my-appset

# 개별 Application의 diff
argocd app diff <app-name>
```

CI 파이프라인에서 **ApplicationSet YAML 변경을 PR 단계에서 렌더링 결과
를 diff** 하는 게 안전 관행. `argocd appset create --dry-run`에는 일부
함정이 있어 ([Issue #21911](https://github.com/argoproj/argo-cd/issues/21911)),
프로덕션 환경에서는 staging ArgoCD에서 실제 적용 결과를 비교하는 방식이
더 신뢰할 수 있다.

### 11.4 Namespace·Provider allowlist

ApplicationSet 허용 범위와 SCM 보안 경계는 controller 파라미터
(`argocd-cmd-params-cm`)로 통제.

```yaml
configs:
  params:
    # 허용 namespace (appset-in-any-namespace)
    applicationsetcontroller.namespaces: "team-*,platform"
    # SCM Provider·PR generator의 외부 SCM 호출 allowlist
    applicationsetcontroller.enable.scm.providers: "github.com,gitlab.com"
    applicationsetcontroller.allowed.scm.providers: "https://git.example.com"
```

특히 **SCM Provider / Pull Request generator**는 외부 토큰으로 임의
SCM에 접근할 수 있어 **namespace 오염 + 토큰 오용** 공격 표면. allowlist
없이 appset-in-any-namespace를 켜는 것은 사실상 관리자 권한 위임.
상세는 [ApplicationSet Security](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Security/).

---

## 12. App-of-Apps vs ApplicationSet

### 12.1 비교

| 축 | App-of-Apps | ApplicationSet |
|---|---|---|
| 추상화 | Application이 다른 Application을 담은 Git 디렉터리 가리킴 | CR 하나가 generator로 다수 Application 생성 |
| 반복 표현 | 파일 개수 = Application 개수 | generator parameter 개수 |
| 동적 대상 | 없음 (파일 추가 필요) | 있음 (cluster 라벨, Git 변경) |
| 학습 곡선 | 낮음 | 중 (generator·template 이해) |
| 적합 | 소규모·정적 | 중대규모·동적·멀티 클러스터 |

### 12.2 의사결정

- **5개 이하 Application**: App-of-Apps 충분
- **환경×서비스 조합 10개 초과**: ApplicationSet 권장
- **클러스터 동적 추가·삭제**: ApplicationSet cluster generator 필수
- **PR 프리뷰**: ApplicationSet Pull Request generator만 가능
- **두 방식 혼용 가능**: 루트는 App-of-Apps, 내부는 ApplicationSet

### 12.3 App-of-Apps 주의 — prune cascade

루트 Application의 `prune: true`가 자식 Application을 날리는 사고는
[ArgoCD 설치 §9.1.1](./argocd-install.md)에서 다뤘다. ApplicationSet
에서 대응되는 것은 `preserveResourcesOnDeletion`.

---

## 13. 안티패턴

| 안티패턴 | 왜 문제 | 교정 |
|---|---|---|
| `goTemplate: false` (기본) 사용 | sprig 함수·조건 불가 | `goTemplate: true` + `missingkey=error` |
| Multiple Sources + rollback 기대 | 2026 현재 rollback 비지원 | Git revert 또는 단일 소스 |
| `RespectIgnoreDifferences` 누락 | ignore 필드가 sync에서 덮어써짐 | syncOptions에 추가 |
| Pull Request generator + polling | Rate limit 즉시 소진 | Webhook 전환 |
| RollingSync + 개별 automated sync | RollingSync가 무시, 혼동 | automated 제거, strategy만 신뢰 |
| `matrix` 조합 폭발 무대책 | 수백 Application 동시 생성 | `requeueAfterSeconds` 늘리고 규모 모니터 |
| ApplicationSet을 argocd 외 ns에 | CR 위치 제약 위반 | `argocd` namespace에 유지 |
| SCM/PR generator에 long-lived PAT | 유출 시 조직 전체 영향 | GitHub App + 짧은 만료 |
| 라벨에 `cluster` key 충돌 | generator label vs K8s label 혼재 | prefix (`argocd.argoproj.io/...`) |
| `preserveResourcesOnDeletion` 없이 AppSet 삭제 | 프로덕션 삭제 사고 | 시작부터 true 설정 |
| `values.yaml` 인라인 + 다중 환경 | 분기 복잡, 실수 유발 | Multiple Sources 또는 파일 분리 |
| `ignoreDifferences`에 globalscope 필드 | 관리 주체 불분명 | argocd-cm 전역 등록 |

---

## 14. 도입 로드맵

1. **단일 Application**부터 — plain directory + manual sync
2. **automated + selfHeal** 켜기 — 드리프트 자동 수렴
3. **sync-wave** 로 CRD → Namespace → 워크로드 순서
4. **Multiple Sources** 테스트 — Helm + values 리포 분리 (rollback 불가
   수용 가능 시)
5. **ApplicationSet List**: 3~5개 정적 대상부터
6. **Cluster generator**: cluster 라벨 설계 (env, team, region)
7. **Matrix / Merge**: 조합 폭발 주의
8. **Pull Request + Webhook**: 프리뷰 환경 도입
9. **RollingSync**: dev → staging → prod 단계 배포
10. **templatePatch + goTemplate**: 환경 조건부 필드

---

## 15. 관련 문서

- [ArgoCD 설치](./argocd-install.md) — HA·샤딩·멀티 클러스터
- [ArgoCD 프로젝트](./argocd-projects.md) — AppProject, RBAC, namespace 제약
- [ArgoCD Sync](./argocd-sync.md) — hooks, pruning, SyncOptions
- [ArgoCD 고급](./argocd-advanced.md) — PreDelete Hooks, ConfigManagementPlugin
- [Argo Rollouts](../progressive-delivery/argo-rollouts.md) — Canary·Analysis
- [GitOps 개념](../concepts/gitops-concepts.md) — pull-based 배포 원칙

---

## 참고 자료

- [Application Specification Reference](https://argo-cd.readthedocs.io/en/latest/user-guide/application-specification/) — 확인: 2026-04-24
- [Multiple Sources for an Application](https://argo-cd.readthedocs.io/en/latest/user-guide/multiple_sources/) — 확인: 2026-04-24
- [Diff Customization](https://argo-cd.readthedocs.io/en/stable/user-guide/diffing/) — 확인: 2026-04-24
- [Sync Phases and Waves](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/) — 확인: 2026-04-24
- [ApplicationSet Specification](https://argo-cd.readthedocs.io/en/latest/operator-manual/applicationset/applicationset-specification/) — 확인: 2026-04-24
- [ApplicationSet Generators](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators/) — 확인: 2026-04-24
- [Matrix Generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Matrix/) — 확인: 2026-04-24
- [Merge Generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Merge/) — 확인: 2026-04-24
- [Pull Request Generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Pull-Request/) — 확인: 2026-04-24
- [SCM Provider Generator](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-SCM-Provider/) — 확인: 2026-04-24
- [ApplicationSet Templates](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Template/) — 확인: 2026-04-24
- [Progressive Syncs](https://argo-cd.readthedocs.io/en/latest/operator-manual/applicationset/Progressive-Syncs/) — 확인: 2026-04-24
- [Controlling Resource Modification](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Controlling-Resource-Modification/) — 확인: 2026-04-24
- [Issue #22976 — RollingSync auto-sync on new commits](https://github.com/argoproj/argo-cd/issues/22976) — 확인: 2026-04-24
- [Issue #26592 — templatePatch syncPolicy not applied](https://github.com/argoproj/argo-cd/issues/26592) — 확인: 2026-04-24
- [ApplicationSet in any namespace](https://argo-cd.readthedocs.io/en/latest/operator-manual/applicationset/Appset-Any-Namespace/) — 확인: 2026-04-24
- [ApplicationSet Security](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Security/) — 확인: 2026-04-24
- [Generators-Cluster-Decision-Resource](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Cluster-Decision-Resource/) — 확인: 2026-04-24
- [Generators-Post-Selector](https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/Generators-Post-Selector/) — 확인: 2026-04-24
- [Tool Detection](https://argo-cd.readthedocs.io/en/stable/user-guide/tool_detection/) — 확인: 2026-04-24
- [argocd appset Command Reference](https://argo-cd.readthedocs.io/en/latest/user-guide/commands/argocd_appset/) — 확인: 2026-04-24
- [Feature Maturity](https://argo-cd.readthedocs.io/en/stable/operator-manual/feature-maturity/) — 확인: 2026-04-24
