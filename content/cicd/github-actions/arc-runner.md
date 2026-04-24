---
title: "ARC — Actions Runner Controller on Kubernetes"
sidebar_label: "ARC 러너"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - github-actions
  - arc
  - kubernetes
  - self-hosted-runner
---

# ARC (Actions Runner Controller)

> **ARC는 GitHub Actions 셀프호스티드 러너를 Kubernetes 위에서
> 자동 확장·자동 소멸로 운영하기 위한 공식 컨트롤러**. 잡이 큐에
> 들어오면 러너 Pod을 생성하고, 잡이 끝나면 즉시 제거한다.
> 본 글은 2026-04 기준 **Runner Scale Set 모드(GA)**를 중심으로
> 설치·인증·오토스케일·컨테이너 모드(dind/kubernetes)·레거시 대비
> 구조 차이·운영 체크리스트를 글로벌 스탠다드 깊이로 정리한다.

- **프로젝트**: [`actions/actions-runner-controller`](https://github.com/actions/actions-runner-controller)
  — GitHub 공식, 2024년부터 GitHub가 직접 유지보수
- **현재 기준**: `gha-runner-scale-set` Helm 차트 **0.14.x 계열**
  (0.14.0 = 2025-03 / 0.14.1 = 2025-04, multilabel 정식 지원,
  scaleset 클라이언트 라이브러리 전환). 러너 이미지는
  **`ghcr.io/actions/actions-runner:v2.333.x`** 권장 — GitHub의
  **self-hosted runner minimum version enforcement** 정책으로
  구버전은 잡 거절 가능
- **정식 모드**: **Runner Scale Set (`actions.github.com` API 그룹)**.
  구 `actions.summerwind.dev` 계열은 **legacy**(커뮤니티 유지보수)
- **경계**: GitHub 호스티드 러너·기본 워크플로 문법은
  [GHA 기본](./gha-basics.md), OIDC·권한은 [GHA 보안](./gha-security.md)
- **주제**: public repo에 self-hosted 러너 금지는 GHA 공통 원칙 —
  ARC는 **private·Enterprise 환경의 전용 러너 풀** 운영에 쓴다

---

## 1. 왜 ARC인가

### 1.1 호스티드 vs 셀프호스티드 vs ARC

| 축 | GitHub-hosted | 전통 self-hosted | ARC |
|---|---|---|---|
| 인프라 관리 | GitHub | 내 VM | 내 K8s |
| 스케일 | 무제한 (쿼터 내) | 수동 | **자동 K8s 스케일** |
| Ephemeral | 기본 | 수동 설정 | 기본 (Pod 1잡 1회) |
| Private 네트워크 접근 | 제한적 | 완전 | 완전 |
| 비용 모델 | 분당 과금 | VM 상주 | Pod 단위, K8s 리소스 공유 |
| 상태 오염 리스크 | 없음 | 있음 (상주) | 없음 (ephemeral) |

**ARC 선택 이유**:

- **내부망 리소스 접근**: 사내 DB·K8s API·이미지 레지스트리에 직접
- **특수 하드웨어**: GPU·ARM·대용량 디스크·고사양 빌드
- **규제 준수**: 클라우드 외부로 코드·secret 유출 차단
- **비용 최적화**: 기존 K8s 유휴 자원 활용, 피크 시만 확장

### 1.2 ARC의 구조

```mermaid
flowchart TB
  GH[GitHub Actions] --> LSN[Listener]
  LSN --> CTL[ARC Controller]
  CTL --> ARS[AutoscalingRunnerSet]
  ARS --> ERS[EphemeralRunnerSet]
  ERS --> P1[Runner Pod]
  ERS --> P2[Runner Pod]
```

- **ARC Controller**: Scale Set 상태 관리·Pod 생명주기 제어
- **AutoscalingRunnerSet (ARS)**: Helm 설치 단위, 레포·조직·
  Enterprise 스코프의 러너 그룹
- **EphemeralRunnerSet → EphemeralRunner**: 실제 Pod 관리 CR
- **Listener Pod**: Scale Set별로 1개, GitHub와 **long-polling**
  유지하며 큐 상태 수신 → Pod 개수 조정
- **HPA 미사용**: ARC는 Kubernetes HorizontalPodAutoscaler를 쓰지
  않는다. 스케일 신호는 **GitHub Scale Set 서비스 → Listener →
  Controller** 경로 전용
- **Listener 장애 영향**: 해당 Scale Set의 **신규 스케일만 멈추고**
  이미 실행 중인 잡은 그대로 완료. Listener가 CrashLoop면 새 잡만
  pickup 안 됨 → 컨트롤러가 자동 재시작

---

## 2. 레거시 vs Runner Scale Set

| 축 | Legacy (`actions.summerwind.dev`) | Modern Runner Scale Set (`actions.github.com`) |
|---|---|---|
| CRD | `RunnerDeployment`·`HorizontalRunnerAutoscaler` | `AutoscalingRunnerSet`·`EphemeralRunner` |
| 인증 | PAT 또는 GitHub App (공유) | **JIT 토큰**(per-runner, GitHub 생성) |
| 스케일 신호 | webhook 서버(비동기) 또는 pull(주기) | **long-polling**(즉시) |
| 유지보수 | 커뮤니티 | GitHub 공식 |
| 신규 선택 | ❌ | ✅ 표준 |

**마이그레이션 결정**: 2025 이후 신규는 무조건 Scale Set. 레거시
운영 중이면 **병렬 배포 후 워크플로의 `runs-on` 라벨 전환** 패턴
권장. Helm 릴리스를 지우고 재설치하는 방식은 **runner group 삭제
리스크** 있음(issue #3372).

---

## 3. 설치

### 3.1 사전 요구

| 항목 | 권장 |
|---|---|
| Kubernetes | 1.28+ |
| 노드 | Linux amd64 또는 arm64 (러너 이미지 호환) |
| cert-manager | **불필요** (Scale Set 모드에서 webhook 없음) |
| 인증 수단 | GitHub App (권장) 또는 PAT |
| 네트워크 | GitHub API 아웃바운드 HTTPS |

### 3.2 1단계 — 컨트롤러 설치

```bash
NAMESPACE=arc-systems

helm install arc \
  --namespace "$NAMESPACE" --create-namespace \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --version 0.14.1            # 실제 운영은 릴리스 노트 최신 확인
```

- `arc-systems` 네임스페이스에 컨트롤러 1개 (글로벌)
- HA를 원하면 `replicas: 2` + `leaderElection`
- cert-manager 불필요 — 레거시와 가장 큰 운영상 차이

### 3.3 2단계 — Runner Scale Set 설치

```bash
NAMESPACE=arc-runners
SCALE_SET_NAME=my-runners
GITHUB_CONFIG_URL=https://github.com/my-org      # 조직
# 또는: https://github.com/my-org/my-repo         (레포)
# 또는: https://github.com/enterprises/my-ent     (Enterprise)

helm install "$SCALE_SET_NAME" \
  --namespace "$NAMESPACE" --create-namespace \
  --set githubConfigUrl="$GITHUB_CONFIG_URL" \
  --set githubConfigSecret.github_token="$GITHUB_PAT" \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.14.1
```

- **Scale Set의 Helm 릴리스 이름이 `runs-on:` 라벨**이 됨
  (예: `my-runners`)
- 네임스페이스는 컨트롤러와 **분리** 권장 — 러너 네임스페이스는
  NetworkPolicy·ResourceQuota로 격리

### 3.4 GitHub App 인증 (PAT 대신 권장)

```yaml
# values.yaml
githubConfigSecret:
  github_app_id: "123456"
  github_app_installation_id: "78910"
  github_app_private_key: |
    -----BEGIN RSA PRIVATE KEY-----
    ...
```

또는 Secret 참조:

```bash
kubectl create secret generic gh-app-secret -n arc-runners \
  --from-literal=github_app_id=123456 \
  --from-literal=github_app_installation_id=78910 \
  --from-file=github_app_private_key=./private-key.pem

helm install my-runners ... \
  --set githubConfigSecret=gh-app-secret
```

**권장 이유**:

- PAT는 **사용자 계정에 종속** — 퇴사 시 파이프라인 중단
- GitHub App은 조직 수준 엔티티, **fine-grained 권한**,
  감사 로그 독립
- JIT 토큰은 Scale Set이 앱 자격증명으로 **per-runner 단기 토큰**
  을 받아 개별 Pod에 주입 → 장기 비밀 노출 최소

### 3.5 값 파일 주요 키

```yaml
# gha-runner-scale-set values.yaml 발췌
githubConfigUrl: https://github.com/my-org
githubConfigSecret: gh-app-secret

minRunners: 1                    # 최소 유휴
maxRunners: 50                   # 상한
runnerGroup: "default"           # 조직 Runner groups에 매칭

# 0.14+: 다중 라벨 지원 — 워크플로에서 runs-on: [linux, x64, arc]로 매칭
runnerScaleSetName: "my-runners"
runnerScaleSetLabels:
  - "linux"
  - "x64"
  - "arc"

containerMode:
  type: "kubernetes"             # dind · kubernetes · (empty)
  # kubernetesModeWorkVolumeClaim: ...
  # kubernetesModeServiceAccount: ...

template:
  spec:
    nodeSelector:
      node-role: "ci"
    tolerations:
      - key: "ci-only"
        operator: Exists
        effect: NoSchedule
    containers:
      - name: runner
        image: ghcr.io/actions/actions-runner:2.333.1
        resources:
          requests: { cpu: "500m", memory: "1Gi" }
          limits:   { cpu: "4",    memory: "8Gi" }
        env:
          - name: http_proxy
            value: "http://proxy.internal:3128"

proxy:
  http: http://proxy.internal:3128
  https: http://proxy.internal:3128
  noProxy: "kubernetes.default.svc,.svc.cluster.local"

listenerTemplate:
  spec:
    containers:
      - name: listener
        resources:
          requests: { cpu: "100m", memory: "128Mi" }
```

### 3.6 워크플로에서 호출

```yaml
jobs:
  build:
    runs-on: my-runners           # 단일 이름 매칭
    steps:
      - uses: actions/checkout@v5
      - run: make build

  gpu-build:
    runs-on: [linux, gpu, arc]    # 0.14+ multilabel AND 매칭
    steps:
      - run: nvidia-smi
```

**매칭 규칙**:

- 기본: **Helm 릴리스 이름(`runnerScaleSetName`)**이 라벨이 된다
- 0.14부터 `runnerScaleSetLabels`로 **다중 라벨 지정**. 워크플로는
  `runs-on: [a, b, c]` 배열로 **AND 매칭** — 모든 라벨 포함하는
  Scale Set에 할당
- 여러 Scale Set이 조건을 동시에 만족하면 **GitHub가 라운드로빈** 분배

---

## 4. 오토스케일 메커니즘

### 4.1 Listener 기반 Long-Polling

- 각 Scale Set은 **Listener Pod 1개**를 띄운다
- Listener가 GitHub API에 **long-polling** (연결 유지, 큐 상태 푸시)
- 잡 큐잉 수신 → 컨트롤러가 `EphemeralRunner` CR 생성 → 스케줄러가
  Pod 배치 → 러너 등록 → 잡 pickup

```mermaid
sequenceDiagram
  participant GH as GitHub
  participant L as Listener
  participant C as Controller
  participant P as Runner Pod
  GH->>L: 잡 큐잉 알림
  L->>C: 스케일 요청
  C->>P: Pod 생성
  P->>GH: 등록
  GH->>P: 잡 할당
  P->>P: 실행
  P->>GH: 완료 등록 해제
  C->>P: Pod 삭제
```

webhook 서버를 별도로 띄울 필요 없고, 추가 Ingress·인증 고민도
사라진다. 2~3초 내 스케일 시작 — pull 방식의 분 단위 지연 대비
체감 차이가 크다.

### 4.2 min/max와 스케일 정책

- **`minRunners`**: 유휴 보장 수. 0이면 완전 serverless, 1~N이면
  콜드 스타트 완화
- **`maxRunners`**: 상한. K8s 노드·쿼터 고려해 현실적으로 설정
- 큐가 비면 **ephemeral**이므로 Pod는 완료 후 자동 소멸
- 스케일 속도는 GitHub Scale Set 서비스가 관장 — ARC는 요청만 받는다

### 4.3 Runner groups (조직·Enterprise)

```
Org
├─ Runner group: ci-general   → my-runners Scale Set
├─ Runner group: ci-gpu       → gpu-runners Scale Set
└─ Runner group: ci-prod      → prod-runners (보호 레포만 접근)
```

- 레포 단위 허용 목록·브랜치 제한 지정 가능
- Values의 `runnerGroup`으로 매칭. GitHub UI에서 그룹을 미리 생성

---

## 5. 컨테이너 모드

### 5.1 선택지

| 모드 | Docker-in-Job | 보안 | 성능 |
|---|---|---|---|
| 비활성(empty) | 불가 | 최고 | 가장 가벼움 |
| `dind` | 가능 | 특권 컨테이너 필요 | 중간 |
| `dind-rootless` | 가능 | 여전히 `--privileged` 필요하지만 daemon 비 root | 중간 |
| `kubernetes` | 가능 (container hooks) | 중간 | 가장 가벼움 |

### 5.2 dind 모드

```yaml
containerMode:
  type: dind
```

- 기본 `docker:dind` 사이드카 + `--privileged`
- GHA 워크플로의 `container:`·`services:`·`docker build`가 그대로 동작
- **프로덕션 주의**: 특권 컨테이너 = 노드 커널 접근 가능 →
  **전용 노드풀 + taint·nodeSelector로 격리** 필수
- rootless: `docker:dind-rootless` 이미지로 daemon을 non-root화.
  `--privileged`는 여전히 요구되지만 공격 표면 축소

### 5.3 kubernetes 모드 (container hooks)

```yaml
containerMode:
  type: kubernetes
  kubernetesModeWorkVolumeClaim:
    accessModes: ["ReadWriteOnce"]
    storageClassName: "fast"
    resources:
      requests:
        storage: 10Gi
```

- 워크플로의 `container:`·`services:`를 보면 러너가 **같은 네임스페이스에
  새 Pod을 생성**해 실행
- `--privileged` 불필요 → 멀티테넌트에 안전
- **제약**: `docker build` 같은 Docker CLI 의존 스텝은 Buildx +
  K8s driver 또는 **Kaniko**·**BuildKit daemon-less**로 대체
- Workflow 공유 볼륨은 PVC로 자동 생성·정리

### 5.4 실무 선택 가이드

| 워크로드 | 권장 모드 |
|---|---|
| 일반 빌드·테스트 (Docker 불필요) | **비활성** |
| `container:`·`services:` 사용, 이미지 빌드 있음 | **kubernetes + Kaniko/BuildKit** |
| 레거시 Docker CLI 스크립트 다수 | dind-rootless (전용 노드풀) |
| 최고 격리 필요 | gVisor/Kata + kubernetes 모드 |

---

## 6. 운영 관점

### 6.1 리소스·스케줄링

```yaml
template:
  spec:
    affinity:
      nodeAffinity:
        requiredDuringSchedulingIgnoredDuringExecution:
          nodeSelectorTerms:
            - matchExpressions:
                - key: workload
                  operator: In
                  values: ["ci"]
    priorityClassName: "low-preempt"
    containers:
      - name: runner
        resources:
          requests: { cpu: "1", memory: "2Gi", ephemeral-storage: "10Gi" }
          limits:   { cpu: "8", memory: "16Gi", ephemeral-storage: "50Gi" }
```

- **전용 노드풀** 권장 — 일반 워크로드와 분리 (taint)
- **ephemeral-storage** 상한은 반드시 — 무한 이미지 빌드로 노드가 꽉 참
- **PriorityClass**: CI는 낮은 우선순위로 두어 프로덕션 Pod에 양보
- **Karpenter/Cluster Autoscaler**: 피크 시 노드 자동 증설

### 6.2 네트워크 정책

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: arc-runners-egress
  namespace: arc-runners
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system   # DNS
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32   # AWS/GCP 인스턴스 메타데이터
              - 169.254.170.2/32     # ECS task metadata
              - 10.0.0.0/8           # 내부망 (필요 시 별도 규칙으로 허용)
      ports:
        - { port: 443, protocol: TCP }
```

- **메타데이터 서비스(169.254.169.254·169.254.170.2) 차단** —
  클라우드 IAM 크리덴셜 탈취 방어(ACSC 사건 이후 표준 권장)
- 내부망 접근은 별도 allow 규칙으로 세밀히 화이트리스트

### 6.3 관측

```yaml
metrics:
  controllerManagerAddr: "0.0.0.0:8080"
  listenerAddr: "0.0.0.0:8080"
  listenerEndpoint: "/metrics"
```

| 메트릭 | 의미 |
|---|---|
| `gha_runner_scale_set_available_jobs` | 큐에 대기중 |
| `gha_runner_scale_set_assigned_jobs` | 할당됨 |
| `gha_runner_scale_set_running_jobs` | 실행중 |
| `gha_runner_scale_set_desired_runners` | 원하는 Pod 수 |
| `gha_runner_scale_set_registered_runners` | 등록된 Pod 수 |

Prometheus + Grafana 대시보드로 큐 대기시간·콜드 스타트를 모니터링.
SLO: "잡 큐잉 → pickup 95p < 60초" 같은 수치 관리.

### 6.4 업그레이드

- **0.12 이전**은 Helm이 CRD 업그레이드를 지원 안 해 릴리스 전체를
  재설치해야 했다. **0.12+** 부터 CRD 차트 분리와 서버사이드 apply
  개선으로 **in-place 업그레이드가 상당 부분 가능**하다. 단 마이너
  버전을 건너뛰는 점프(예: 0.10 → 0.14)는 여전히 재설치 권장
- 표준 절차:
  1. `kubectl get ephemeralrunner -A`로 진행 중 잡이 없는 시점 확인
  2. 컨트롤러 차트 업그레이드(`helm upgrade arc ...`)
  3. Scale Set 차트 순차 업그레이드 — 릴리스별로
  4. 실패 시 `helm rollback` 가능 (CRD 스키마 호환되는 범위 내)
- **canary 클러스터 → 스테이징 → 프로덕션** 순 롤아웃
- 잡 진행 중 강제 업그레이드는 금지(잡 유실) — maintenance window 사용
- 마이그레이션 가이드는 레포의 `MIGRATION_GUIDE.md` 최신본 필수 참조

### 6.5 Secret·Vault 연동

- 0.12부터 **Vault 기반 GitHub App 자격증명 동적 발급** 지원
- ESO(External Secrets Operator)로 AWS SM·Azure KV에서 주입해도 OK
- `githubConfigSecret`에 Secret 이름을 지정하면 values에 평문 불필요
- 상세는 [security/secrets](../../security/) 참조

---

## 7. 보안 하드닝

### 7.1 Public repo 금지

Public repo의 PR은 **포크에서 임의 코드 실행**이 가능하다. ARC는
**private 레포·조직 전용**으로만 운영. `runner group`의 "Selected
repositories"로 명시 허용 목록.

### 7.2 격리 레이어

- **네임스페이스별 Scale Set** — 팀·서비스 단위로 분리
- **전용 노드풀** + taint — 다른 워크로드와 분리
- **NetworkPolicy** — egress 제한
- **RBAC 최소** — 러너 SA는 자신이 속한 네임스페이스만 접근
- **PodSecurity**: `restricted` 프로파일 (dind 모드는 전용 NS에서 `baseline`)

### 7.3 secrets와 OIDC

- Scale Set의 **JIT 토큰은 잡 1회에 한해 유효**. 장기 PAT 대비 노출
  리스크 최소
- 클라우드 자격증명은 워크플로에서 **GitHub OIDC → AWS/Azure/GCP
  AssumeRole** (상세는 [GHA 보안](./gha-security.md))

### 7.4 공급망

- 러너 이미지(`ghcr.io/actions/actions-runner`)는 GitHub 공식
  — 외부 포크 이미지 주의
- 커스텀 이미지 사용 시 **CVE 스캔**·**서명 검증** 필수
- `template.spec.initContainers`로 도구 프리-인스톨 시에도 서명된
  베이스 이미지 고수

---

## 8. 비용·대안 비교

| 축 | ARC + 자체 K8s | GitHub Larger Runners | 타사 SaaS(Runsons·Blacksmith 등) |
|---|---|---|---|
| 인프라 관리 | 운영 팀 부담 | GitHub | SaaS |
| 커스터마이징 | 완전 자유 | 제한 | 중간 |
| 네트워크 접근 | 내부망 | 퍼블릭·VNet 페어링 | 퍼블릭 |
| 비용 | K8s 노드 상각 | 분당 과금(배수) | 저렴한 분당 과금 |
| 규제 | 완전 통제 | Microsoft/GitHub 신뢰 | 제3자 신뢰 필요 |

**결정 분기**: 내부망 연결·대규모 상시 빌드·규제 강함 → ARC.
간헐적·외부망으로 충분·관리 부담 회피 → GitHub Larger 또는 SaaS.
하이브리드(ARC + Larger)도 흔함.

---

## 9. 흔한 문제와 해결

| 증상 | 원인 | 해결 |
|---|---|---|
| 잡이 pickup 안 됨 | Scale Set 이름 ≠ `runs-on` | Helm 릴리스 이름 확인 |
| Listener Pod CrashLoop | 인증 실패 | App ID·Installation ID·PEM 형식 확인 |
| 러너가 등록 후 즉시 종료 | 잡 없음 + ephemeral | 정상. `minRunners`로 유지 가능 |
| Docker 빌드 실패 | containerMode 비활성 | `dind` 또는 kubernetes+Kaniko |
| 노드 디스크 Full | ephemeral-storage 미설정 | 리소스 limit·dockersock GC |
| 업그레이드 후 Scale Set 소실 | CRD 재설치 순서 오류 | 공식 uninstall 절차 준수 |
| DNS 이슈 | CoreDNS + NetworkPolicy | kube-system egress 허용 |

---

## 10. 학습 체크포인트

- [ ] Runner Scale Set과 레거시 RunnerDeployment 구조 차이를 설명한다
- [ ] Listener 기반 long-polling과 webhook/pull 차이를 안다
- [ ] GitHub App vs PAT 인증을 비교하고 App을 선택하는 이유를 안다
- [ ] dind·dind-rootless·kubernetes 모드의 보안·성능 트레이드오프를 안다
- [ ] 전용 노드풀·NetworkPolicy·RBAC로 멀티테넌트 격리를 구성한다
- [ ] Prometheus 메트릭으로 큐 SLO를 수립한다
- [ ] Helm CRD 업그레이드 공식 절차를 준수한다
- [ ] Public repo에 ARC를 붙이지 않는 이유를 설명한다

---

## 참고 자료

- [Actions Runner Controller — GitHub Docs](https://docs.github.com/en/actions/concepts/runners/actions-runner-controller) (2026-04 확인)
- [Deploying runner scale sets with ARC](https://docs.github.com/en/actions/tutorials/use-actions-runner-controller/deploy-runner-scale-sets)
- [actions/actions-runner-controller — 공식 레포](https://github.com/actions/actions-runner-controller)
- [gha-runner-scale-set README](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/README.md)
- [Migration Guide (Legacy to Modern)](https://github.com/actions/actions-runner-controller/blob/master/docs/gha-runner-scale-set-controller/MIGRATION_GUIDE.md)
- [Autoscaling runners docs](https://github.com/actions/actions-runner-controller/blob/master/docs/automatically-scaling-runners.md)
- [ARC 0.12.0 release (2025-06)](https://github.blog/changelog/2025-06-13-actions-runner-controller-0-12-0-release/)
- [ARC release notes — 0.14.x](https://github.com/actions/actions-runner-controller/releases)
- [Self-hosted runner minimum version enforcement (2026-02)](https://github.blog/changelog/2026-02-05-github-actions-self-hosted-runner-minimum-version-enforcement-extended/)
- [Using dind-rootless, kubernetes mode configurations](https://github.com/actions/actions-runner-controller/discussions/3117)
