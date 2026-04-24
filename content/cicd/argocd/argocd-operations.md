---
title: "ArgoCD 운영 — 업그레이드·백업·DR·관측·웹훅·성능"
sidebar_label: "ArgoCD 운영"
sidebar_position: 5
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - argocd
  - upgrade
  - backup
  - disaster-recovery
  - metrics
  - webhook
---

# ArgoCD 운영

> **ArgoCD는 "설치하면 끝"이 아니라 "운영하면서 크는" 컴포넌트**다.
> 정기 업그레이드, DR 계획, 메트릭 대시보드, 웹훅 연결, 성능 튜닝이 전부
> 서비스 안정성에 직결된다. 이 글은 2026 기준으로 3.2 → 3.3 업그레이드
> 단계, Helm 차트 self-management 원칙, Velero 기반 백업·DR, Prometheus
> ServiceMonitor + Grafana, 웹훅 보안, 대규모 성능 튜닝까지 실무 체크리스트
> 수준으로 정리한다.

- **주제 경계**: 설치·초기 구성은 [ArgoCD 설치](./argocd-install.md).
  App·Sync·Project의 일상 사용은 각 자매 글. 여기는 **운영자가 ArgoCD
  자체를 관리**하는 관점
- **현재 기준**: ArgoCD 3.2.10 stable / 3.3 GA / 3.4 GA 예정 (2026-05)

---

## 1. 업그레이드

### 1.1 전제 원칙

1. **Minor 한 단계씩**: 3.1 → 3.3 금지. 3.1 → 3.2 → 3.3 순차
2. **release notes의 "Breaking Changes" 필독** — `argo-cd/docs/
   operator-manual/upgrading/<from>-<to>.md`
3. **스테이징 먼저** — 프로덕션 ArgoCD 업그레이드는 staging ArgoCD
   인스턴스에서 선행 검증
4. **CRD는 별도 관리** — Application CRD 자체를 잘못 지우면 전 Application
   CR 소실
5. **Self-management이면 Helm 차트 버전만 올리기** —
   [ArgoCD 설치 §10](./argocd-install.md)

### 1.2 업그레이드 채널

| 채널 | 주기 | 특징 |
|---|---|---|
| stable (latest minor) | quarterly minor | 권장 |
| patch (`3.2.x`) | 격주~월 | 보안·버그 수정만 — 무조건 따라가기 |
| rc (release candidate) | minor 1~2주 전 | 스테이징 검증용 |
| nightly | daily | 검증·개발자 전용 |

patch는 **자동 반영**(self-managed Application에 targetRevision 범위
지정 권장). minor는 PR·승인 절차.

### 1.3 Helm 차트 버전 ≠ ArgoCD 버전

`argo/argo-cd` Helm 차트는 자체 버저닝. 차트 `appVersion` 필드가
실제 ArgoCD 이미지 태그.

```yaml
# Helm values
# 아래 세 값이 반드시 일치하는지 확인
source:
  chart: argo-cd
  repoURL: https://argoproj.github.io/argo-helm
  targetRevision: 9.5.4        # 차트 버전
global:
  image:
    tag: v3.2.10               # 실제 ArgoCD 이미지 (override하지 않으면 chart 기본값)
```

[argo-helm Chart.yaml](https://github.com/argoproj/argo-helm/blob/main/charts/argo-cd/Chart.yaml)
에서 차트 ↔ ArgoCD 버전 매트릭스 확인. 급히 올릴 때도 **patch를 지원하는
차트 범위를 pin**.

### 1.4 3.2 → 3.3 업그레이드 체크리스트

실제 공식 `upgrading/3.2-3.3.md` 기반 주의사항:

- **Kustomize manifest 또는 plain YAML**로 업그레이드 시 `--server-side
  --force-conflicts` 필요 (Helm은 영향 없음):
  ```bash
  kubectl apply -n argocd -f <manifest-url> \
    --server-side --force-conflicts
  ```
- CRD annotation 262144 bytes 초과 에러 → SSA로 해결
- **Helm 3.19 번들링**으로 `helm template`이 **Kubernetes 버전 포맷을
  `vMajor.Minor`에서 `vMajor.Minor.Patch`로 반환**.
  ApplicationSet **Cluster Generator의 `argocd.argoproj.io/kubernetes-version`
  라벨**을 기존 값(`v1.30`) → 새 포맷(`v1.30.5`)으로 업데이트하지 않으면
  generator 매칭 실패
- **`--self-heal-backoff-cooldown-seconds` deprecated** — 대체 파라미터
  릴리즈 노트 확인
- 신규 환경변수 **`ARGOCD_K8S_SERVER_SIDE_TIMEOUT`** 기본값 조정 가능
- PreDelete Hooks 신규 GA — 기존 delete 동작에 영향 없음, 추가 기능
- Agent 관련 3.3 신규 기능은 **argocd-agent 프로젝트와 별도** — 본체
  업그레이드가 agent를 자동으로 수반하지 않음

### 1.5 롤백

```bash
# Helm 롤백 (revision history 유지 필수)
helm history argocd -n argocd
helm rollback argocd <revision> -n argocd --wait

# Self-managed이면 Git revert + Application sync
git revert <commit-of-bump>
git push
# ArgoCD가 자동으로 이전 차트 버전 적용
```

- CRD 필드가 **제거된 minor 업그레이드**는 롤백 시 CR 필드 데이터 손실
  가능 → Velero 스냅샷으로 사전 대비
- `automated: { selfHeal: true }` 가 켜져 있으면 롤백 시에도 자동 수렴
- **PreDelete Hooks** (3.3 신규)을 사용 중이면 3.2 롤백 시 훅 정의 무시
  — 리소스 삭제 동작 다를 수 있음

### 1.6 CRD 관리 전략

대규모 운영의 표준은 **CRD를 별도 Application으로 분리**.

```yaml
# argocd/apps/argocd-crds.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: argocd-crds
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "-100"     # 가장 먼저
spec:
  source:
    chart: argo-cd
    repoURL: https://argoproj.github.io/argo-helm
    targetRevision: 9.5.4
    helm:
      skipTests: true
      # CRD만 렌더링하도록 values에서 컴포넌트 전부 off
      valuesObject:
        crds: {install: true, keep: true}
        controller: {enabled: false}
        server: {enabled: false}
        repoServer: {enabled: false}
        redis: {enabled: false}
  syncPolicy:
    syncOptions:
      # ⚠️ Replace=true 쓰지 말 것 — SSA를 무효화해 CSA로 폴백되면서
      # annotation 262144 bytes 문제 재발. SSA만으로 문제 해결됨
      - ServerSideApply=true
      - SkipDryRunOnMissingResource=true
```

- 본 ArgoCD Application은 컴포넌트만 관리, CRD는 이 별도 Application이
  소유
- **`crds.keep: true`** 로 차트 uninstall 시에도 CRD 유지
- **SSA**가 annotation 262144 bytes 제한의 정답 — `Replace=true`와는
  동시 사용 금지 (Issue [#7131](https://github.com/argoproj/argo-cd/issues/7131))

**트레이드오프**: CRD를 별도 Application으로 분리하는 것은 **대규모·
멀티테넌트·sync-wave 정밀 제어가 필요한 조직의 선택**이지 모든 운영의
필수는 아니다. 공식 Helm 차트의 `crds.install: true, crds.keep: true`
기본 조합만으로도 안전한 케이스가 많다 — 추가 Application 관리 비용
vs 롤백·순서 제어 이득을 저울질.

---

## 2. Self-management 패턴

### 2.1 원칙

"**ArgoCD를 ArgoCD로 관리**"가 GitOps 자체. 최초 Helm install만 수동,
이후 values·버전 전부 Git.

### 2.2 구조 예시

```text
gitops-repo/
├── argocd/
│   ├── bootstrap/
│   │   └── root-app.yaml              # 최초 수동 apply
│   ├── apps/                          # Root이 관리하는 자식 Application
│   │   ├── argocd.yaml                # ArgoCD 자신
│   │   ├── argocd-crds.yaml           # CRD 전용
│   │   ├── platform-monitoring.yaml
│   │   └── platform-ingress.yaml
│   └── projects/                      # AppProject
│       ├── platform.yaml
│       └── team-alpha.yaml
└── platform/
    └── argocd-values/
        ├── values-common.yaml
        ├── values-prod.yaml
        └── values-stage.yaml
```

### 2.3 업그레이드 플로우 (self-managed)

1. PR로 `values-prod.yaml`의 `targetRevision` 변경
2. 스테이징 자동 sync → 관측
3. 프로덕션 PR 머지 → 자동 sync
4. UI 또는 `argocd app get argocd`로 상태 확인

---

## 3. 백업과 DR

### 3.1 무엇을 백업하는가

ArgoCD 상태는 3개 층위:

| 층위 | 저장소 | 백업 필요성 |
|---|---|---|
| **설정·CR** (Application, AppProject, Secret) | K8s etcd | 필수 — 분실 시 재구축 번거로움 |
| **Git** (source of truth) | 외부 Git | **Git 자체 백업이 근본** |
| **런타임 상태** (Redis 캐시) | Redis | 불필요 — 재계산 가능 |

### 3.2 `argocd admin export/import`

공식 CLI가 제공하는 단순 백업 방법.

```bash
# 백업 (YAML 덤프)
argocd admin export > backup-$(date +%F).yaml

# 복원 (빈 ArgoCD에)
argocd admin import - < backup-2026-04-24.yaml
```

포함 대상:

- `Application`, `AppProject`, `ApplicationSet` CR
- `argocd-cm` (ConfigMap), `argocd-rbac-cm`, `argocd-secret`
- Repository/Cluster Secret (`argocd.argoproj.io/secret-type`)
- Notifications ConfigMap/Secret
- GPG keys, known hosts 등

**argocd-secret에는 admin password hash, server TLS key, session key,
Dex clientSecret 등 전부 평문**(또는 base64)으로 포함된다. 백업 파일의
저장소 암호화가 없으면 이것만으로 전체 ArgoCD 침투 가능.

**한계**:

- 단발성 — 스케줄은 별도
- bearer token 같은 시크릿이 평문 — 저장소 암호화 필수
- 복원 시점의 타임스탬프 보존 안 됨 → Application 상태 재계산 필요

### 3.3 Velero — 프로덕션 표준

Velero로 `argocd` namespace 전체를 정기 스냅샷.

```yaml
# Velero Schedule
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: argocd-daily
  namespace: velero
spec:
  schedule: "0 2 * * *"        # 매일 02:00
  template:
    includedNamespaces: [argocd]
    includedResources:
      - applications.argoproj.io
      - appprojects.argoproj.io
      - applicationsets.argoproj.io
      - secrets
      - configmaps
      # CRD는 Git이 진리인 경우 제외, "전체 스냅샷 안전망"이 필요하면 포함
      # - customresourcedefinitions.apiextensions.k8s.io
    ttl: 720h                   # 30일
    storageLocation: default
    snapshotVolumes: false      # ArgoCD는 상태 대부분 CR에 있음
```

**CRD 포함 여부 의사결정**:

- **Git이 CRD 진리**인 Self-managed 환경 → Velero에서 제외, 복원 시
  Application이 CRD부터 sync
- **Git 불가용 시나리오**까지 방어 → Velero 포함 (단 CRD 버전 차이로
  인한 충돌 가능)

- OCP/OpenShift는 **OADP operator**가 Velero 래퍼
- Red Hat ACM·OADP 조합은 `cluster.open-cluster-management.io/backup:
  "argocd"` 라벨로 식별 — custom resource를 반드시 라벨링
- **secret은 기본 포함되지 않으므로 명시** — cluster bearer token,
  OIDC clientSecret 등

### 3.4 DR 시나리오

| 시나리오 | 복구 절차 |
|---|---|
| ArgoCD 네임스페이스 유실 | Velero 복원 → ArgoCD 기동 → Git이 진리이므로 자동 재수렴 |
| 클러스터 전체 loss | 신 클러스터에 Helm install → Velero restore → Application 자동 sync |
| Git 호스트 loss | Git 미러 또는 백업 리포로 repoURL 변경 후 sync |
| Redis 데이터 loss | 별도 복구 불필요 — Controller가 재계산 |

**핵심 통찰**: Git이 건강하면 ArgoCD DR은 "ArgoCD 재설치 + Application
CR 재생성"이다. Velero는 **Application CR + 클러스터 자격증명**만
회복해도 충분.

### 3.5 RTO·RPO 목표

| 항목 | 권장 |
|---|---|
| RTO (복구 시간) | 30분 — 자동화된 restore + sync |
| RPO (데이터 손실) | 24시간 — 일일 Velero + Git은 실시간 |
| 테스트 주기 | 분기 1회 실복원 drill |

DR drill 없이 백업만 있다면 사실상 무방비 — 실제 복원이 되는지 검증
필수.

---

## 4. 관측 — Metrics, Logs, Alerts

### 4.1 메트릭 엔드포인트

| 컴포넌트 | 포트 | 경로 |
|---|---|---|
| `argocd-server` | 8083 | `/metrics` |
| `argocd-application-controller` | 8082 | `/metrics` |
| `argocd-repo-server` | 8084 | `/metrics` |
| `argocd-applicationset-controller` | 8080 | `/metrics` |
| `argocd-notifications-controller` | 9001 | `/metrics` |

Helm에서 일괄 활성:

```yaml
controller:
  metrics: {enabled: true, serviceMonitor: {enabled: true}}
server:
  metrics: {enabled: true, serviceMonitor: {enabled: true}}
repoServer:
  metrics: {enabled: true, serviceMonitor: {enabled: true}}
applicationSet:
  metrics: {enabled: true, serviceMonitor: {enabled: true}}
notifications:
  metrics: {enabled: true, serviceMonitor: {enabled: true}}
```

### 4.2 주요 메트릭

**Application 상태**

| 메트릭 | 의미 |
|---|---|
| `argocd_app_info{sync_status, health_status}` | 상태별 앱 수 |
| `argocd_app_sync_total` | sync 누적 (성공/실패 별) |
| `argocd_app_reconcile` | reconcile 히스토그램 |
| `argocd_app_k8s_request_total` | ns당 K8s API 호출 |

**컴포넌트 건전성**

| 메트릭 | 의미 |
|---|---|
| `argocd_cluster_api_resources` | cluster별 reconcile 리소스 수 |
| `argocd_redis_request_total` | Redis 호출 |
| `argocd_git_request_total` | Git 호출 (fetch/ls-remote) |
| `argocd_git_request_duration_seconds` | Git 호출 latency |
| `controller_workqueue_depth` | reconcile queue 길이 |

### 4.3 대시보드

**Grafana ID 14584** — 공식 추천 ArgoCD 대시보드. Application 상태,
sync 성공률, Git latency, controller queue 등 기본 패널 전부.

대규모 환경은 다음을 **커스터마이즈**:

- 샤드별 `workqueue_depth` (샤드 불균형 감지)
- Git provider별 request latency (rate limit 예측)
- Application별 Long-running sync 탐지

### 4.4 Alerts — SRE 관점

| Alert | 조건 | 권장 threshold |
|---|---|---|
| ArgoCDAppOutOfSync | `argocd_app_info{sync_status="OutOfSync"} > 0` 지속 | 30m |
| ArgoCDAppDegraded | `argocd_app_info{health_status="Degraded"} > 0` | 10m |
| ArgoCDControllerQueueHigh | `controller_workqueue_depth > 100` | 10m |
| ArgoCDRepoServerErrors | `argocd_git_request_total{failed} rate > 0.1` | 5m |
| ArgoCDRedisDown | `up{job="argocd-redis"} == 0` | 1m |
| ArgoCDClusterUnreachable | `argocd_cluster_events_total{type="ERROR"} rate` 또는 cluster connection 실패 | 10m |

SLO와 연계하려면 **Error Budget 관점**으로 환산 — 상세는
[SRE 카테고리](../../sre/).

### 4.5 로그 — JSON 구조

2026 기준 ArgoCD는 기본적으로 **JSON 로그**. `logging-format: json`
파라미터로 명시 권장. Loki/Elasticsearch로 중앙 수집.

주요 필드:

```json
{"time":"2026-04-24T12:00:00Z","level":"info","msg":"Sync successful",
 "application":"platform/redis","namespace":"argocd",
 "revision":"abcd1234","duration":"5.1s"}
```

- `application`, `revision`, `duration` 필드로 Application별 추적
- **감사 필드**: `user`, `source.address` (argocd-server 접근 로그)

### 4.6 트레이싱 — OpenTelemetry

3.x에서 OTel trace export 지원. 대규모 환경에서 sync 흐름 추적·병목
탐지에 유용.

```yaml
# argocd-cmd-params-cm (Helm values: configs.params)
configs:
  params:
    otlp.address: "otel-collector:4317"    # 모든 컴포넌트 공유 단일 키
    otlp.insecure: "false"
    otlp.attrs: "env=prod,region=us-east-1"
```

`otlp.address`는 argocd-server, argocd-repo-server,
argocd-application-controller 전부에 공유되는 단일 키. 컴포넌트별로
분리하는 키는 존재하지 않는다.

Jaeger/Tempo UI에서 "Git fetch → manifest 렌더 → apply → health
reconcile" 전 구간의 span 확인.

---

## 5. Webhook — 이벤트 기반 sync

### 5.1 왜 필요한가

polling 기본 180초는 대규모에서 Git API rate limit·반영 지연의 주범.
webhook으로 **Git push 이벤트 즉시 감지**.

### 5.2 프로바이더 설정

```bash
# GitHub — Settings → Webhooks → Add
# Payload URL: https://argocd.example.com/api/webhook
# Content type: application/json
# Events: Push, Pull Requests
# Secret: <랜덤 문자열>
```

argocd-secret에 공유 시크릿 저장:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: argocd-secret
  namespace: argocd
type: Opaque
stringData:
  webhook.github.secret: "<random>"
  webhook.gitlab.secret: "<random>"
  webhook.bitbucketserver.secret: "<random>"
```

지원 provider별 **secret 키가 다르다**:

| Provider | Secret Key |
|---|---|
| GitHub | `webhook.github.secret` |
| GitLab | `webhook.gitlab.secret` |
| Bitbucket **Cloud** | `webhook.bitbucket.uuid` (UUID 기반) |
| Bitbucket **Server** | `webhook.bitbucketserver.secret` (shared secret) |
| Azure DevOps | `webhook.azuredevops.username` + `webhook.azuredevops.password` |
| Gogs | `webhook.gogs.secret` |
| Gitea | `webhook.gitea.secret` |

Bitbucket Cloud와 Server의 **인증 방식이 완전히 다르니** 주의. Cloud는
webhook 설정 시 생성되는 UUID를 ArgoCD secret에 복사.

### 5.3 보안

- **반드시 HMAC signature 검증** — secret 없는 webhook은 활성 금지
- Ingress 레벨에서 `/api/webhook` 경로만 외부 오픈, 나머지는 내부
- webhook payload 로그 수집 (감사용)

### 5.4 ApplicationSet webhook

Git generator + webhook 조합이 핵심. `requeueAfterSeconds`를 크게
(10~30분) 두고 webhook에 의존하는 설계가 대규모 표준.

```yaml
# ApplicationSet
spec:
  generators:
    - git:
        repoURL: https://github.com/org/gitops
        revision: HEAD
        directories: [{path: "apps/*"}]
        requeueAfterSeconds: 1800   # 30분 — webhook이 있으니까
```

---

## 6. 성능 튜닝

### 6.1 지표 기반 진단

| 증상 | 지표 | 원인 |
|---|---|---|
| sync latency 상승 | `argocd_app_reconcile` p99 ↑ | repo-server·controller 포화 |
| Git timeout | `argocd_git_request_duration` ↑ | rate limit, 네트워크 |
| UI 느림 | `argocd-server` CPU ↑ | API 호출 폭주, 캐시 miss |
| Queue 적체 | `controller_workqueue_depth` ↑ | 샤드 불균형, 리소스 부족 |

### 6.2 튜닝 파라미터

```yaml
configs:
  params:
    # Controller 처리량 (기본 20/10)
    controller.status.processors: "50"
    controller.operation.processors: "25"
    controller.repo.server.timeout.seconds: "120"

    # 반복 주기 — webhook 사용 시 polling을 늘려 Git rate limit 절감
    timeout.reconciliation: "10m"            # 기본 3m
    timeout.hard.reconciliation: "0"
    controller.self.heal.timeout.seconds: "5"

    # Repo-server 병렬성 (기본 0 = 무제한, 대규모는 명시)
    reposerver.parallelism.limit: "20"
    reposerver.git.lsremote.parallelism.limit: "10"
```

### 6.3 샤딩 조정

Controller 레플리카를 늘려 샤드 분산.
[ArgoCD 설치 §5](./argocd-install.md) 참조. **`replicas`와
`ARGOCD_CONTROLLER_REPLICAS` 동기화 필수**.

### 6.4 캐시·압축

repo 캐시 기본 24h, default 캐시 24h는 대부분의 경우 충분. 변경이 필요한
경우는 manifest 생성 비용이 크거나 큰 리포에서 반복 호출이 부담스러울 때.

```yaml
configs:
  params:
    reposerver.repo.cache.expiration: "48h"   # 긴 캐시 (기본 24h)
    redis.compression: "gzip"                  # 기본 gzip, 네트워크/메모리 절감
```

Redis 용량 부족 시 먼저 **Application 수 감소** 또는 **외부 관리형
Redis**로 분리. 단일 Redis로 1000+ Application은 메모리 폭증.

### 6.5 대규모 Application 관리

- ApplicationSet에서 **PullRequest/SCM generator 대신 Git directory
  generator** 선호 — polling·rate limit 부담 최소화
- 반복적 `diff` 부하가 크면 **polling 주기 증가 + webhook**
- Helm chart 렌더링 캐시 (shallow clone + chart cache) 활용

---

## 7. CLI·API 운영 팁

### 7.1 필수 명령

```bash
# 상태 요약
argocd app list                  # 모든 Application
argocd app get <name>            # 상세
argocd app history <name>        # revision 히스토리
argocd app diff <name>           # Git vs live

# 강제 sync·롤백
argocd app sync <name> --prune --server-side
argocd app rollback <name> <revision-id>

# 관리자
argocd admin cluster stats       # 클러스터별 reconcile 통계
argocd admin settings rbac validate
argocd admin settings rbac can <user> <action> <resource>

# 트러블슈팅
argocd app logs <name>           # Pod 로그
argocd app resources <name>      # 관리 리소스 목록
```

### 7.2 API 접근

```bash
# Swagger
https://argocd.example.com/swagger.html

# 인증 (Project role token)
curl -H "Authorization: Bearer $TOKEN" \
  https://argocd.example.com/api/v1/applications
```

---

## 8. 안티패턴

| 안티패턴 | 왜 문제 | 교정 |
|---|---|---|
| 한 번에 minor 여러 단계 업그레이드 | CRD·마이그레이션 실패 | 한 단계씩 |
| Helm 차트 버전만 확인, appVersion 간과 | 이미지·차트 불일치 | 매트릭스 재확인 |
| CRD를 Helm release에 포함 | 롤백 시 CR 소실 | 별도 Application + `keep: true` |
| 백업 없음 — "Git이 진리니까" | 감사·기록 복구 불가 | Velero 일일 + Git 미러 |
| DR drill 없는 백업 | 복원 시점에 실패 발견 | 분기 1회 drill |
| 메트릭 미활성 | 성능·장애 진단 불가 | 모든 컴포넌트 ServiceMonitor |
| webhook 없이 polling 180s 고수 | rate limit·지연 | Provider별 webhook |
| webhook에 secret 없음 | 누구나 sync 트리거 | HMAC signature 검증 |
| Controller 레플리카 늘림 without `ARGOCD_CONTROLLER_REPLICAS` | 일부 클러스터 ghost | 환경변수 동기화 |
| 대규모에서 `ApplyOutOfSyncOnly` 미설정 | API burst | 활성 |
| 로그 수집 안 함 | 감사 불가 | Loki/Elasticsearch 중앙 |
| OTel trace off | sync 병목 추적 불가 | 3.x otlp.address 설정 |
| DR 테스트 없이 "괜찮겠지" | 실제 장애 시 발견 | 실제 복원 drill |

---

## 9. 운영 로드맵

1. **Self-management** — root Application + Git 리포 구조
2. **CRD 분리 Application** — Replace=true + keep:true
3. **Velero 스케줄** — argocd namespace 일일 백업
4. **Prometheus ServiceMonitor** — 모든 컴포넌트 활성
5. **Grafana 14584 + 커스텀 패널** — 샤드·Git latency
6. **Alerts** — OutOfSync·Degraded·Queue·Redis
7. **Webhook 연결** — Git provider별
8. **로그 중앙 수집** — JSON 로그 → Loki
9. **OTel tracing** — otlp.address 설정, Tempo/Jaeger
10. **분기 DR drill** — 실제 restore + sync 검증
11. **성능 튜닝** — processors·parallelism·샤드
12. **업그레이드 정기화** — patch 자동, minor 분기

---

## 10. 관련 문서

- [ArgoCD 설치](./argocd-install.md) — HA·샤딩·self-management
- [ArgoCD App](./argocd-apps.md) — Application·ApplicationSet
- [ArgoCD Sync](./argocd-sync.md) — auto-sync·hooks·pruning
- [ArgoCD 프로젝트](./argocd-projects.md) — RBAC·syncWindows
- [ArgoCD 고급](./argocd-advanced.md) — PreDelete Hooks·CMP
- [SRE 카테고리](../../sre/) — SLO·Error Budget·Runbook

---

## 참고 자료

- [Upgrading Overview](https://argo-cd.readthedocs.io/en/latest/operator-manual/upgrading/overview/) — 확인: 2026-04-24
- [v3.2 to 3.3 Upgrade](https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/3.2-3.3/) — 확인: 2026-04-24
- [Disaster Recovery](https://argo-cd.readthedocs.io/en/stable/operator-manual/disaster_recovery/) — 확인: 2026-04-24
- [Metrics](https://argo-cd.readthedocs.io/en/latest/operator-manual/metrics/) — 확인: 2026-04-24
- [Grafana Dashboard 14584](https://grafana.com/grafana/dashboards/14584-argocd/) — 확인: 2026-04-24
- [Webhook Configuration](https://argo-cd.readthedocs.io/en/stable/operator-manual/webhook/) — 확인: 2026-04-24
- [High Availability (튜닝 파라미터)](https://argo-cd.readthedocs.io/en/stable/operator-manual/high_availability/) — 확인: 2026-04-24
- [argocd admin CLI](https://argo-cd.readthedocs.io/en/stable/operator-manual/upgrading/migration-guide/) — 확인: 2026-04-24
- [Velero](https://velero.io/docs/) — 확인: 2026-04-24
- [OADP + GitOps DR (Red Hat Blog)](https://www.redhat.com/en/blog/argo-cd-disaster-recovery-strategy-using-red-hat-advanced-cluster-management-and-oadp) — 확인: 2026-04-24
