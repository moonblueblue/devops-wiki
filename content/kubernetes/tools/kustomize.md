---
title: "Kustomize — base·overlay, patch, generator"
sidebar_label: "Kustomize"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - kubernetes
  - kustomize
  - overlay
  - patch
  - generator
  - components
---

# Kustomize — base·overlay, patch, generator

> Kustomize는 **템플릿 없는** 구성 관리 도구다. 변수 치환·헬퍼 함수 대신,
> **YAML을 YAML로 덮어쓰는 머지 규칙**만 쓴다. 단순함이 장점이지만, 동작
> 규칙을 모르면 조용한 오버라이드 사고로 이어진다.

- **base + overlay** 계층
- **patch** — strategic merge·JSON 6902·patches 통합 문법
- **generator** — ConfigMap·Secret·Helm 차트 렌더
- **components** — 기능 단위 조합 (overlay 인헤리턴스 대체)
- **replacements**·transformers로 선언적 치환

선행 지식: [Helm](./helm.md)(둘의 선택 기준 비교). GitOps 활용은 `cicd/`에서 상세.

---

## 1. Kustomize가 풀려는 문제

| 접근 | 장점 | 단점 |
|---|---|---|
| 단순 YAML 사본 | 가장 명시적 | 환경 3개만 되어도 복사·드리프트 |
| 템플릿(Helm·Jsonnet) | 재사용 강력 | DSL·디버깅 코스트, 런타임 실수 |
| **Kustomize** | **원본 YAML 유지**, 오버레이로 변경 누적 | 깊은 머지 규칙 숙지 필요 |

k8s `kubectl apply -k` 또는 `kustomize build`가 **kustomization.yaml**을 읽어
결과 YAML을 표준 출력으로 내보낸다. 이후 단계는 일반 `kubectl apply`다.

---

## 2. 버전·현황

| 라인 | 버전·상태 | 비고 |
|---|---|---|
| Kustomize CLI | `v5.8.1` 최신 (`2026-02-09`), `v5.6.0`에서 내부 패키지 통합 | 공식 `kubernetes-sigs/kustomize` |
| kubectl 내장 | `kubectl kustomize` / `kubectl apply -k` | 내장 버전이 독립 CLI보다 **구버전**일 수 있음 |
| Deprecated | `patchesStrategicMerge`, `patchesJson6902`, `commonLabels`, `vars` | `patches`·`labels`·`replacements`로 이주 |

`v5.8.0`에서 replacements 셀렉터가 정규식을 지원하기 시작했고, `v5.8.1`에서는
`namespace transformer`가 `helmCharts`에 namespace를 전파하지 않던 장기 버그가
수정되었다. Helm 차트를 Kustomize로 감싸는 팀이라면 `v5.8.1` 이상이 사실상 필수.

**운영 권장**: 독립 `kustomize` CLI 버전을 CI에 고정하고, kubectl 내장 기능은
**렌더 결과 검토용**으로만 쓴다. 같은 입력이 버전에 따라 다르게 렌더되면
디버깅이 지옥이다.

---

## 3. 기본 단위 — `kustomization.yaml`

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml

labels:
  - pairs:
      app.kubernetes.io/part-of: checkout
    includeSelectors: true     # Deployment selector 등 라벨 셀렉터도 수정

namespace: default
namePrefix: ck-
commonAnnotations:
  owner: platform-team

images:
  - name: myapp
    newName: registry.example.com/myapp
    newTag: "1.4.2"

configMapGenerator:
  - name: app-config
    literals:
      - LOG_LEVEL=info

secretGenerator:
  - name: app-tls
    files:
      - tls.crt=certs/tls.crt
      - tls.key=certs/tls.key
```

### 자주 쓰는 필드

| 필드 | 기능 |
|---|---|
| `resources` | 포함할 YAML·디렉터리·원격 URL |
| `bases` (v1) | **deprecated**, `resources`에 통합 |
| `components` | 조합형 오버레이(아래 상세) |
| `namespace` | 전체 리소스 네임스페이스 강제 |
| `namePrefix` / `nameSuffix` | 이름 충돌 방지, env 태깅 |
| `labels` | 현대적 라벨 주입 (`commonLabels` 대체) |
| `commonAnnotations` | 어노테이션 일괄 |
| `images` | 이미지 이름·태그 치환 (tag drift 안전) |
| `replicas` | 레플리카 수 치환 |
| `patches` | 통합 패치 (SMP·JSON 6902·인라인) |
| `configMapGenerator` / `secretGenerator` | 해시 접미 자동 생성 |
| `generators` / `transformers` | KRM 플러그인(고급) |
| `openapi` | CRD 필드 머지 전략 주입 |
| `replacements` | 선언적 필드 치환(신식 `vars`) |

---

## 4. base·overlay 계층

전형적 구조:

```text
myapp/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml     # resources: [../../base]
    ├── stage/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
namespace: prod
namePrefix: prod-
replicas:
  - name: myapp
    count: 6
images:
  - name: myapp
    newTag: "1.4.2"
patches:
  - path: hpa.yaml
  - target:
      kind: Deployment
      name: myapp
    patch: |-
      - op: add
        path: /spec/template/spec/priorityClassName
        value: high
```

### 오버레이 인헤리턴스의 한계

직렬 오버레이는 **트리(단일 부모)** 구조를 강제한다. "기능 A와 기능 B를
선택적으로 조합"해야 하는 경우, 가능한 조합 수만큼 오버레이가 폭발한다.
이 문제를 해결하려고 들어온 것이 **components**다(§7 참고).

---

## 5. 패치 — strategic merge·JSON 6902·patches

### 통합 문법 `patches:`

`patches:`는 v3 계열에서 도입된 뒤 v4를 거치며 안정화되어 **현행 권장 문법**이다.
과거 `patchesStrategicMerge`·`patchesJson6902`는 **deprecated**이므로 신규
코드는 `patches:`로만 작성한다.

```yaml
patches:
  # Strategic Merge (대상은 selector로 지정, patch는 YAML)
  - target:
      kind: Deployment
      name: myapp
    patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: myapp
      spec:
        template:
          spec:
            containers:
              - name: app
                resources:
                  limits:
                    cpu: "2"

  # JSON 6902 (path 기반 정밀 조작)
  - target:
      group: apps
      version: v1
      kind: Deployment
      name: myapp
    patch: |-
      - op: replace
        path: /spec/template/spec/containers/0/image
        value: registry.example.com/myapp:1.4.2
      - op: add
        path: /spec/template/metadata/annotations/ck.io~1revision
        value: "2026-04-24"

  # 파일 참조
  - path: security-context.yaml
    target:
      kind: Deployment
      labelSelector: "app.kubernetes.io/part-of=checkout"
```

### 두 패치 방식 — 선택 기준

| 기준 | Strategic Merge | JSON 6902 |
|---|---|---|
| 직관성 | ✅ 대상 YAML과 같은 구조 | 낮음 (pointer 문법) |
| 정밀도 | 리스트 `patchMergeKey` 의존 | ✅ 인덱스·경로 단위 |
| 리스트 삭제·재정렬 | 어려움 | ✅ `remove`·`move` op |
| CRD 지원 | `openapi`로 힌트 필요 | ✅ 스키마 무관 |
| 원시 타입 배열 | 부분 머지 버그 잦음 | ✅ 명시적 |
| 가독성 | 높음 | 낮음 |

**원칙**: 덮어쓰기·삽입은 Strategic Merge, 정밀 조작·리스트 순서 변경은 JSON 6902.
한 `patches:` 안에 섞어 써도 된다.

### Strategic Merge의 함정

원시 리스트(`string[]`, `int[]`) 머지는 **스키마 힌트가 없으면 전체 교체**된다.
예컨대 `spec.template.spec.containers[*].command`는 `patchStrategy`가 리스트
합성을 지원하지 않아 **부분 덮어쓰기가 불가능**하다. 이럴 때는 JSON 6902로
`/spec/template/spec/containers/0/command/2` 같은 인덱스를 직접 쓴다.

CRD에 대한 머지 전략은 `openapi.path` 필드로 OpenAPI 스키마를 주입해 힌트를 줄
수 있지만, 관리 비용이 크다. **CRD 조작은 JSON 6902 default가 실무적**이다.

JSON 6902의 `path`는 RFC 6901 JSON Pointer를 따른다. 경로에 등장하는 특수 문자는
**이스케이프 필수**다.

| 원문 | 이스케이프 |
|---|---|
| `/` | `~1` (예: `prometheus.io/scrape` → `prometheus.io~1scrape`) |
| `~` | `~0` |

이스케이프를 빼면 `path not found` 에러가 나고, 잘못된 지점에 값이 생성될 수도
있다(특히 `add` op).

### target 셀렉터

```yaml
target:
  group: apps
  version: v1
  kind: Deployment
  name: "^myapp-.*$"        # 정규식
  labelSelector: "tier=web"
  annotationSelector: "ck.io/manage=true"
  namespace: app
```

정규식·selector 지원으로 "조건을 만족하는 모든 리소스"에 일괄 패치 가능하다.

---

## 6. 제너레이터 — ConfigMap·Secret·Helm

### `configMapGenerator` / `secretGenerator`

```yaml
configMapGenerator:
  - name: app-config
    behavior: merge          # create(기본) | merge | replace
    literals:
      - LOG_LEVEL=info
      - FEATURE_X=true
    files:
      - nginx.conf
    envs:
      - env/prod.env

secretGenerator:
  - name: db
    type: Opaque
    literals:
      - password=REPLACE_ME   # 실제로는 External Secrets 권장

generatorOptions:
  disableNameSuffixHash: false    # 해시 끄기는 신중히
  annotations:
    ck.io/generated: "true"
```

### 해시 접미사의 역할

Kustomize는 생성된 ConfigMap/Secret 이름 뒤에 **콘텐츠 해시 접미사**(`-6h7k8m9g2t`)
를 붙이고, 참조하는 워크로드(`envFrom`·`volumeMounts`)의 이름도 **자동으로**
같이 갱신한다.

결과:
1. 값이 바뀌면 새 ConfigMap이 생성되고, Deployment가 새 이름을 참조.
2. Pod 템플릿 해시가 바뀌어 **자동 롤링 업데이트**.
3. 구형 ConfigMap은 외부 **prune 메커니즘**으로 정리된다 — Kustomize 자체는
   GC를 수행하지 않는다. ArgoCD sync prune, Flux `prune: true`,
   `kubectl apply --prune`/ApplySet이 필요하다. **수동 참조는 깨지니 주의**.

`disableNameSuffixHash: true`를 쓰면 이 장점이 사라진다. **불가피한 경우**
(다른 시스템이 고정 이름을 기대)에만 끈다.

### `helmCharts` — Helm 차트를 Kustomize 안으로

```yaml
helmCharts:
  - name: ingress-nginx
    repo: https://kubernetes.github.io/ingress-nginx
    version: "4.11.0"
    releaseName: ingress
    namespace: ingress
    valuesFile: values-prod.yaml
```

- `--enable-helm` 플래그와 함께 실행(`kustomize build --enable-helm`).
- `valuesFile` 경로가 kustomization 루트 밖을 가리키거나 remote values를 쓰면
  **`--load-restrictor=LoadRestrictionsNone`**를 함께 지정해야 로드된다.
- Helm이 렌더한 YAML 위에 patches·components를 **얹는 방식**으로 조합.
- **알려진 제약**: `helmCharts`가 생성한 ConfigMap/Secret을 `configMapGenerator`의
  `behavior: merge/replace`로 합칠 수 없다. 덮어쓰려면 `patches`로 직접 편집해야 한다.
- **Helm 3 플러그인 보안**: Helm 의존 전체를 CI 이미지에 고정해야 재현성 보장.

GitOps 도구(ArgoCD) 측도 같은 기능을 네이티브로 제공하는 경우가 많아,
**프로덕션에서는 GitOps 쪽으로 렌더링을 위임하는 편**이 일반적이다.

---

## 7. components — 조합형 기능 스위치

### 왜 필요한가

overlay는 인헤리턴스(직계 상속) 구조다. 기능을 **옵션으로 on/off**해야 할 때
(A·B·C를 임의 조합) overlay로는 조합 수만큼 폴더가 필요하다.
**component**는 이런 "기능 단위의 조합"을 선언적으로 풀어준다.

### 구조

```yaml
# components/monitoring/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component

resources:
  - servicemonitor.yaml
  - prometheusrule.yaml

patches:
  - target: { kind: Deployment, name: myapp }
    patch: |-
      - op: add
        path: /spec/template/metadata/annotations/prometheus.io~1scrape
        value: "true"
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

components:
  - ../../components/monitoring
  - ../../components/tls
  - ../../components/canary
```

`components:`는 **순서대로 적용**된다. 동일 필드에 여러 component가 패치를
가하면 나중 것이 우선. 이 때문에 component는 **가급적 직교(orthogonal)**하게
설계한다.

### overlay vs component

| 축 | overlay | component |
|---|---|---|
| 관계 | 부모-자식(상속) | 기능 스위치(합성) |
| 조합 가능성 | 트리 한 경로 | 여러 개 동시 |
| 용도 | 환경(dev/stage/prod) | 모니터링·보안·Canary 같은 옵션 |
| 변이의 소유자 | 환경별 책임 | 기능별 책임 |

실무 조합: **overlay는 환경**, **component는 선택 기능**. 즉 `overlays/prod`에
`components:`로 필요한 기능을 추가한다.

---

## 8. replacements — 선언적 치환

`vars:`(deprecated)를 대체한다. 한 리소스의 필드 값을 다른 리소스에 복사한다.

```yaml
replacements:
  - source:
      kind: ConfigMap
      name: app-config
      fieldPath: data.DOMAIN
    targets:
      - select:
          kind: Ingress
          name: app
        fieldPaths:
          - spec.rules.0.host
```

- `source` 한 곳에서 값을 읽어 여러 `targets`에 주입.
- `v5.8`부터 **replacements selector가 정규식**을 지원해 대상 리소스를 넓게 선택 가능
  (`fieldPath` 자체의 정규식 확장은 아님).
- Helm의 `{{ .Values.x }}` 같은 명시적 변수 대신 **리소스 그래프 자체가 소스**.

**권장 사용처**: Ingress host·Service name 같은 **리소스 간 이름 전파**. 전역
상수는 ConfigMap에 두고 replacements로 뿌리는 편이 깔끔하다.

---

## 9. 원격 리소스·KRM 플러그인·`kustomize edit`

### 원격 source

`resources:`·`components:`는 **Git URL**을 직접 참조할 수 있다.

```yaml
resources:
  - github.com/example/platform-base//overlays/prod?ref=v1.4.2&timeout=30s
components:
  - oci://registry.example.com/kustomize/observability?ref=v2.1.0
```

- `//` 뒤는 repo 내부 경로, `?ref=`는 태그/브랜치/커밋, `?timeout=`은 fetch 제한.
- **재현성 확보를 위해 `ref`는 태그·커밋 SHA로 고정**. branch 참조는 프로덕션에서 금지.
- 네트워크가 끊긴 빌드는 실패한다. 에어갭 환경은 내부 Git 미러 + DNS 조치가 필요.
- 공격면이 확대되므로 **외부 레포 ref 변경이 곧 운영 변경**임을 잊지 말 것. 허용
  호스트를 CI에서 화이트리스트로 제한한다.

### KRM Functions — `generators:` / `transformers:`

Kustomize는 자체 엔진 외에 **KRM Function**(Kubernetes Resource Model) 플러그인으로
임의 변환을 끼워넣을 수 있다. 입력 YAML 스트림을 받아 변환된 YAML 스트림을
내보내는 컨테이너 또는 실행 바이너리다.

| 타입 | 실행 방식 | 특성 |
|---|---|---|
| `container` | OCI 이미지(annotations로 지정) | 격리·재현성 ↑, Docker/containerd 필요 |
| `exec` | 로컬 바이너리 | 빠름. 권한·공급망 노출 커 실무 비권장 |

```yaml
# kustomization.yaml
generators:
  - generator-config.yaml
transformers:
  - transformer-config.yaml
```

```yaml
# generator-config.yaml (KRM Function 호출)
apiVersion: example.com/v1alpha1
kind: FooGenerator
metadata:
  name: foo
  annotations:
    config.kubernetes.io/function: |
      container:
        image: registry.example.com/krm-fn/foo:v0.3.0
spec:
  count: 3
```

`--enable-alpha-plugins` 또는 `--enable-exec`(exec type)이 필요하다. Flux
`KustomizeController`·ArgoCD 이미지에서는 기본적으로 `container` 런타임이 없어
**CI 단계에서 pre-render**해 GitOps 레포에 YAML을 올리는 방식이 흔하다.

### `kustomize edit` — CI에서의 표준 업데이트 수단

kustomization.yaml을 **사람이 편집하지 않고 명령어로 갱신**하려고 쓴다. CI가
이미지 태그 업데이트 PR을 만들 때의 사실상 표준.

```bash
# 이미지 태그 업데이트
kustomize edit set image myapp=registry.example.com/myapp:1.4.3

# 레플리카 변경
kustomize edit set replicas myapp=8

# 네임스페이스·라벨
kustomize edit set namespace prod
kustomize edit add label env=prod

# 리소스 추가·제거
kustomize edit add resource extra.yaml
kustomize edit remove resource old.yaml

# 빌드 메타데이터 플래그 토글
kustomize edit add buildmetadata originAnnotations
```

PR 본문에 diff만 보이므로 리뷰가 쉽다. ArgoCD Image Updater·Renovate 같은
도구도 내부적으로 `kustomize edit set image`를 호출한다.

### `buildMetadata` — 추적성 주석

렌더 결과에 **출처·변환 이력·관리자** 정보를 자동으로 남긴다.

| 값 | 추가되는 정보 |
|---|---|
| `originAnnotations` | `config.kubernetes.io/origin` — 원본 파일/레포/ref |
| `transformerAnnotations` | `config.kubernetes.io/transformations` — 적용된 변환 체인 |
| `managedByLabel` | `app.kubernetes.io/managed-by=kustomize-v5.8.1` |

```yaml
buildMetadata: [originAnnotations, transformerAnnotations, managedByLabel]
```

감사·장애 분석에서 "이 리소스는 어디에서 왔는가"를 즉시 추적할 수 있다.
운영 레포에서는 적어도 `originAnnotations`는 켜두는 편을 권장.

---

## 10. 운영 워크플로

### 기본 명령

```bash
# 렌더 (stdout으로 YAML 출력)
kustomize build overlays/prod

# kubectl로 바로 적용 (kubectl 내장 kustomize)
kubectl apply -k overlays/prod

# dry-run 서버 검증
kustomize build overlays/prod | kubectl apply --dry-run=server -f -

# 차이 비교
kustomize build overlays/prod | kubectl diff -f -

# Helm 포함 렌더
kustomize build overlays/prod --enable-helm
```

### CI·GitOps 패턴

| 단계 | 도구 |
|---|---|
| lint | `kustomize build` → `kubeconform` / `kyverno test` |
| 정책 검사 | OPA·Kyverno로 렌더 결과 검사 |
| 렌더 결과 저장 | 브랜치 커밋 혹은 아티팩트(ArgoCD render) |
| 적용 | ArgoCD Application의 `kustomize:` 소스, Flux `Kustomization` CR |
| 승격 | overlay 경로 스위치 또는 kustomize build output을 복사 |

ArgoCD와 Flux는 모두 Kustomize를 1급 지원한다. **파이프라인에서 미리 렌더**할지,
**ArgoCD가 런타임 렌더**할지가 가장 큰 선택지다. 감사·재현성 우선이면 전자,
값 주입 민첩성 우선이면 후자.

### 문제 진단

| 증상 | 원인 | 대응 |
|---|---|---|
| 패치가 반영 안 됨 | `target` selector 미스매치 | `kustomize build --stack-trace`로 빌드 실패 스택 확인 |
| ConfigMap 이름이 계속 바뀜 | 해시 접미사(의도된 동작) | `disableNameSuffixHash`는 최후 수단 |
| 라벨 셀렉터 깨짐 | `commonLabels`가 selector까지 바꿈 | 신식 `labels`의 `includeSelectors: false` |
| CRD 필드 머지 꼬임 | strategic merge 전략 부재 | JSON 6902로 전환 또는 `openapi:` 힌트 |
| kubectl과 독립 CLI 결과 불일치 | 내장 kustomize 버전 격차 | CI는 독립 CLI 고정 |
| Helm 렌더 실패 | `--enable-helm` 누락, helm 버전 | CI 이미지에 Helm 고정 |

---

## 11. Helm과의 선택 기준

| 기준 | Helm | Kustomize |
|---|---|---|
| 배포 대상 설계 | 재배포 가능한 **패키지** | 환경별 **오버레이** |
| 인자화 | values + 템플릿 | 패치·replacements |
| 외부 공개 | 차트 마켓(Artifact Hub) | 리포지토리 공유 |
| 학습곡선 | 고. DSL·스코프 규칙 | 저. YAML 머지 규칙 |
| 디버깅 | `helm template` | `kustomize build` |
| CRD 배포 | `crds/` 특수 처리 | 일반 리소스와 동일 |
| Secret 주입 | 플러그인·외부 도구 | 외부 도구만(GitOps 레포 금지) |
| 권장 | 외부 공개·재사용 높은 **패키지** | 사내 앱·멀티 환경 변이 |

**실무에서는 둘을 섞어 쓴다**. 예: `helm template`으로 기반 워크로드 렌더 →
Kustomize overlay에서 조직 정책(라벨·리소스·보안) 덮어쓰기. 혹은 `helmCharts`
필드로 Kustomize가 Helm을 직접 호출.

---

## 12. 운영 팁 요약

| 상황 | 권장 |
|---|---|
| 환경 분리 | overlay, 기능 스위치는 component |
| 이미지 태그 관리 | `images:` 필드에 고정, CI가 업데이트 PR |
| Secret 주입 | External Secrets·Vault. 레포에 평문 secret 금지 |
| 레플리카·HPA | `replicas:` 또는 별도 overlay + patch |
| 외부 차트 도입 | `helmCharts` + components, 혹은 ArgoCD 쪽 렌더 |
| kubectl 내장 vs 독립 CLI | CI는 독립 CLI 고정, 로컬은 내장 허용 |
| 렌더 차이 디버그 | `kustomize build --stack-trace`, diff 저장 |
| 정책 강제 | `kustomize build` 결과를 `kyverno test`/OPA gator 파이프로 검증 |
| Deprecated 필드 마이그레이션 | `patches`·`labels`·`replacements`로 일괄 교체 |
| 안전한 prune | ArgoCD sync policy의 prune·`kubectl apply --applyset`(1.27 알파, 1.30 베타)과 조합 |
| Secret 관리 | External Secrets·Vault가 1순위. SOPS/KSOPS 조합도 가능하나 키 운영·감사 부담 검토 |
| 렌더 출처 추적 | `buildMetadata: [originAnnotations]` 항상 ON |
| 원격 base | ref는 태그·SHA 고정, 외부 호스트 화이트리스트 |
| 관련 주제 | ArgoCD ApplicationSet matrix generator·Anthos Config Sync는 `cicd/`에서 |

---

## 참고 자료

- [Kustomize 공식 사이트](https://kustomize.io/) (2026-04-24)
- [Kustomize 저장소](https://github.com/kubernetes-sigs/kustomize) (2026-04-24)
- [Declarative Management with Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) (2026-04-24)
- [Components — KEP 1802](https://github.com/kubernetes/enhancements/tree/master/keps/sig-cli/1802-kustomize-components) (2026-04-24)
- [Components 예제](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/components.md) (2026-04-24)
- [configMap·secret generator 옵션](https://github.com/kubernetes-sigs/kustomize/blob/master/examples/generatorOptions.md) (2026-04-24)
- [Managing Secrets using Kustomize](https://kubernetes.io/docs/tasks/configmap-secret/managing-secret-using-kustomize/) (2026-04-24)
- [Kustomize v5.6.0 릴리스 노트](https://github.com/kubernetes-sigs/kustomize/releases/tag/kustomize%2Fv5.6.0) (2026-04-24)
- [Kustomize v5.8.0 릴리스 노트](https://github.com/kubernetes-sigs/kustomize/releases/tag/kustomize/v5.8.0) (2026-04-24)
- [Flux — Kustomize 사용](https://fluxcd.io/flux/components/kustomize/kustomizations/) (2026-04-24)
