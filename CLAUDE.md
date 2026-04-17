# Moon Blue's DevOps - Wiki - Claude 운영 규칙

## 최우선 규칙

**index.md는 절대 임의로 수정하지 않는다.**

각 카테고리의 `index.md`는 호성님이 설계한 학습 로드맵이다.
- `index.md`의 목차 항목 = 반드시 작성해야 할 파일 목록
- 항목을 합치거나 스킵하거나 순서를 바꾸려면 반드시 먼저 물어볼 것
- 글 작성 후 체크박스(`[ ]` → `[x]`)와 링크 추가만 허용

**이 위키는 항상 최신 상태를 유지해야 한다.**

글을 작성하거나 업데이트할 때 반드시 아래를 수행한다:
- 글로벌 리서치로 최신 버전·동향을 확인한다
- 기존 글과 비교하여 변경사항을 반영한다
- 오래된 정보는 발견 즉시 업데이트한다

## 프로젝트 개요

DevOps 엔지니어를 위한 오픈 테크 블로그/위키.
입문자부터 실무자까지, 로드맵 순서대로 학습할 수 있도록 구성한다.

## 디렉토리 구조

- `content/` : 최종 글. LLM이 작성·관리
- `CLAUDE.md` : 운영 규칙 (이 파일)

## 운영 방식

### research & write (리서치 → 작성)
- 글 작성 시 웹 리서치로 공식문서, 릴리즈 노트,
  커뮤니티 글을 직접 조사하여 content/에 작성
- 기존 글과 새 정보를 비교해서 업데이트
- 출처는 글 하단 `## 참고 자료` 섹션에
  URL + 확인 날짜로 기록
- frontmatter에 `last_verified` 필드로
  최신성 관리
- **기술적 깊이는 글로벌 스탠다드(Google, Netflix,
  Cloudflare 등 탑티어 엔지니어 수준)를 목표로 한다**
- 한국어로 작성

### maintain (정보 건강 관리)
- content/의 정보를 주기적으로 점검한다
- 과거에는 맞았지만 현재 틀린 정보를 찾아 교체한다
- 점검 기준:
  - 버전이 EOL된 내용이 있는가
  - deprecated된 도구/기능을 다루고 있는가
  - 최신 릴리즈에서 변경된 사항이 반영되어 있는가
  - `last_verified`가 오래된 글이 있는가

### review (검수)
- `.claude/agents/reviewer.md`의 기준으로 검수한다
- 검수 대상은 개별 글, 카테고리 index.md, 전체 뼈대 세 가지
- **개별 글 작성/수정 시**: 해당 파일의 정확성·깊이 검수
- **카테고리 추가/변경 시**: index.md의 개념 완결성 검수
- **주기적(분기 1회 권장)**: 전체 뼈대 검수 (중복·범위·중립성)

### PR
- 작업 완료 후 feature 브랜치 생성
- GitHub PR 생성
- 호성님이 검수 후 merge 여부 결정

### 커밋 컨벤션 (Conventional Commits)

```
<type>: <subject>
```

| type | 용도 |
|------|------|
| `feat` | 새로운 글 또는 기능 추가 |
| `fix` | 오류 수정, 잘못된 정보 정정 |
| `docs` | 문서 변경 (README, CLAUDE.md 등) |
| `refactor` | 글 구조 개선, 카테고리 재배치 |
| `style` | 포맷팅, 오타, 레이아웃 수정 |
| `chore` | 빌드, 설정, 기타 잡무 |
| `ci` | CI/CD 설정 변경 |

- subject는 한국어로 작성한다
- 예: `feat: kubernetes 1.35 릴리즈 정리 추가`
- 예: `fix: terraform backend 설명 오류 수정`

## 글 형식

- frontmatter 필수: title, date, tags
- 실무 예제 코드 포함
- 공식 문서 링크 첨부

### 중립성 규칙
- 클라우드와 온프레미스 어느 한쪽에 치우치지 않는다
- 개념은 환경에 독립적으로 설명한다
- 예시에서 클라우드/온프레미스 양쪽을 균형 있게 다룬다
- 특정 벤더 서비스만 다루지 않는다
  (예: EKS만이 아닌 K8s 자체를 먼저)

### 제목 규칙
- 페이지 제목(title): 내용을 명확히 설명 (길어도 됨)
- 사이드바 제목(sidebar label): 최대 10자 이내
- 사이드바에서 줄바꿈이 일어나면 안 된다

### 가독성 규칙
- 한 줄은 최대 80자를 넘지 않는다
- 하나의 문장(단락)은 최대 3줄을 넘지 않는다
- 글만 나열하지 않는다
  도표, 다이어그램, 코드 블록 등을 적극 활용한다
- 비교가 필요한 내용은 반드시 표(table)로 정리한다
- 긴 설명보다 짧은 문장 + 시각 자료 조합을 우선한다
- ASCII 도표는 사용하지 않는다

### 다이어그램 사용 기준

시각화 도구를 아래 기준에 따라 선택한다.

**표(table)를 사용하는 경우 — 다이어그램보다 우선**
- 파일 경로, 설정 항목, 명령어 목록 등 단순 나열
- 2개 이상 옵션의 속성 비교
- 수치/벤치마크 비교

**Mermaid 다이어그램을 사용하는 경우**
- 흐름(flow), 순서(sequence), 상태 변화(state)가 있을 때
- 컴포넌트 간 관계/계층이 핵심 내용일 때
- **노드 20개 이하**로 제한한다

**20개 초과 시 반드시 분리**
- 하나의 다이어그램은 하나의 질문에만 답한다
  예) "요청 흐름", "컴포넌트 구조"를 하나에 넣지 않는다
- 계층이 깊으면 레벨별로 다이어그램을 분리한다
  예) 루트 구조 / `/usr` 하위 / `/var` 하위

> **배경**: Mermaid의 레이아웃 엔진(Dagre)은 같은 레벨에
> 노드가 많아지면 수평으로 무한히 펼쳐진다. 이는 구조적
> 한계로 코드로 해결할 수 없다. 노드 수 제한과 분리가
> 유일한 해결책이다.

---

## 카테고리 구조 (DevOps 로드맵 순서)

content/ 하위 12개 카테고리를 학습 로드맵 순서로 운영한다.
기반→운영→성숙도→진화 순서로 배치한다.

### 카테고리 그룹

```
[기반 지식]      01-03  Linux, Network, Container
[핵심 운영 기술]  04-07  Kubernetes, IaC, CI/CD, GitOps
[운영 성숙도]    08-10  Observability, Security, SRE
[진화]          11-12  Platform Engineering, FinOps
```

### 상세 목록

| 순서 | 카테고리 | 범위 | 왜 이 순서인가 |
|:---:|---------|------|-------------|
| 01 | `linux/` | 커널, cgroups, namespaces, 보안, 성능, eBPF | 모든 인프라의 기반 |
| 02 | `network/` | TCP/IP, DNS, HTTP/2/3, TLS, BGP, VPN, CDN | 트러블슈팅의 절반은 네트워크 |
| 03 | `container/` | Docker, OCI, BuildKit, Podman, 런타임 | 현대 배포의 기본 단위 |
| 04 | `kubernetes/` | 아키텍처, 리소스, 스케줄링, Operator, 백업 | 컨테이너 오케스트레이션 |
| 05 | `iac/` | Terraform, OpenTofu, Ansible, Crossplane | 인프라를 코드로 |
| 06 | `cicd/` | Jenkins, GHA, GitLab CI, Tekton, DORA | 코드→배포 자동화 |
| 07 | `gitops/` | ArgoCD, Flux, Argo Rollouts | 선언적 배포, 드리프트 방지 |
| 08 | `observability/` | Prometheus, OTel, Profiling, eBPF | 시스템을 보는 눈 |
| 09 | `security/` | DevSecOps, Zero Trust, 공급망, 정책 | 파이프라인 보안 |
| 10 | `sre/` | SLO, Postmortem, Toil, 카오스, Runbook | 신뢰성 공학 |
| 11 | `platform-engineering/` | IDP, Backstage, Golden Path, DevEx | DevOps의 프로덕트화 |
| 12 | `finops/` | 비용 가시화, 최적화, Kubecost, 지속가능성 | 운영 성숙 단계 |

### 카테고리 경계 원칙

한 주제는 **반드시 한 카테고리가 주인공**이다. 중복 방지를 위해:

- Kustomize/Helm 도구 자체 → `kubernetes/`
  - GitOps 맥락의 활용 → `gitops/`
- Network Policy K8s 리소스 → `kubernetes/`
  - 네트워크 보안 전략 → `security/`
- Docker 네트워크 → `container/`
- CoreDNS → `kubernetes/` (K8s 필수 컴포넌트)
- eBPF 기반 기술 → `linux/`
  - 네트워킹 응용 → `network/`
  - 관측 응용 → `observability/`

### 향후 확장 후보

- `cloud/` : 멀티클라우드 아키텍처 비교
- `data/` : 데이터베이스 운영과 데이터 엔지니어링

---

## 레퍼런스 소스

이 위키는 **글로벌 스탠다드** 수준의 DevOps/SRE 지식을 다룬다.
글 작성·검수 시 아래 레퍼런스를 우선 참조한다.
reviewer는 이 목록을 기준으로 "필수 개념"을 판정한다.

### 1순위: 재단·표준 기관

클라우드 네이티브와 OSS 생태계의 최상위 권위체.

| 기관 | 역할 | 주요 리소스 |
|------|------|------------|
| CNCF | 클라우드 네이티브 프로젝트 관장 | cncf.io, CNCF Landscape, TOC, Graduated/Incubating 분류 |
| Linux Foundation | OSS 표준의 최상위 | linuxfoundation.org, OpenSSF |
| Apache Software Foundation | 대규모 OSS (Kafka, Spark 등) | apache.org |
| OpenInfra Foundation | 인프라 OSS (구 OpenStack) | openinfra.dev |
| OCI (Open Container Initiative) | 컨테이너 표준 | opencontainers.org |

### 2순위: 공식 문서

| 영역 | 소스 |
|------|------|
| Kubernetes | kubernetes.io/docs, SIG 그룹, KEP |
| 컨테이너 | docs.docker.com, containerd, podman.io |
| HashiCorp | developer.hashicorp.com (Terraform, Vault, Consul, Nomad) |
| 관측성 | prometheus.io, grafana.com/docs, opentelemetry.io, jaegertracing.io |
| GitOps | argo-cd.readthedocs.io, fluxcd.io, argoproj.github.io |
| 서비스 메시 | istio.io, linkerd.io, envoyproxy.io |
| 보안 | openpolicyagent.org, falco.org, sigstore.dev, spiffe.io |
| 클라우드 | docs.aws.amazon.com, cloud.google.com/docs, learn.microsoft.com/azure |

### 3순위: 컨퍼런스 (최신 동향·실전 사례)

| 컨퍼런스 | 주최 | 관점 |
|---------|------|------|
| KubeCon + CloudNativeCon | CNCF | 클라우드 네이티브 전반 (연 3회: NA/EU/APAC) |
| SREcon | USENIX | SRE 실무와 운영 철학 |
| Open Source Summit | Linux Foundation | OSS 생태계 전반 |
| PromCon | Prometheus 커뮤니티 | 관측 성능·확장 |
| ArgoCon | Argo 커뮤니티 | GitOps 심화 |
| HashiConf | HashiCorp | IaC와 인프라 자동화 |
| DockerCon | Docker | 컨테이너 |
| FOSDEM | 유럽 OSS 커뮤니티 | 중립적·기술적 |
| DevOpsDays | 지역별 | 현장 실무 사례 |
| AWS re:Invent / Google Cloud Next / MS Ignite | CSP | 클라우드 서비스 |

### 4순위: 정전(Canon) 도서

| 도서 | 저자 | 위상 |
|------|------|------|
| Google SRE Book (3권 시리즈) | Google | sre.google 무료 공개. SRE의 성경 |
| The DevOps Handbook | Gene Kim 외 | DevOps 기본 텍스트 |
| Accelerate | Nicole Forsgren | DORA 메트릭의 근거 |
| The Phoenix Project | Gene Kim | 조직 관점 고전 |
| Kubernetes Patterns | Bilgin Ibryam | K8s 아키텍처 패턴 |
| Production Kubernetes | Josh Rosso 외 | 프로덕션 운영 심화 |
| Database Reliability Engineering | Laine Campbell | 데이터 SRE |

### 5순위: 보안·컴플라이언스 표준

| 표준 | 내용 |
|------|------|
| CIS Benchmarks | Kubernetes, Docker, Linux 하드닝 기준 |
| NSA Kubernetes Hardening Guide | K8s 보안 국가 기관 표준 |
| NIST Cybersecurity Framework | 보안 프레임워크 |
| OWASP Top 10 / ASVS | 애플리케이션 보안 |
| SLSA | 공급망 보안 레벨 |
| OpenSSF Best Practices | OSS 보안 |

### 6순위: 글로벌 탑티어 엔지니어링 블로그

| 회사 | 특징 |
|------|------|
| Google Cloud Blog | 대규모 K8s, Borg 기반 철학 |
| Netflix Tech Blog | 카오스, 마이크로서비스 |
| Cloudflare Blog | 네트워크, eBPF, 보안 |
| Stripe Engineering | API·결제 시스템 SRE |
| Uber Engineering | 대규모 인프라, M3 메트릭 |
| Airbnb Engineering | 데이터·플랫폼 |
| Spotify Engineering | Backstage, 플랫폼 엔지니어링 |
| GitHub Engineering | Git·Actions 내부 |
| Datadog / Grafana Labs | 관측성 |
| HashiCorp Blog | IaC·보안 |

### 7순위: 연구·지표

| 소스 | 내용 |
|------|------|
| DORA State of DevOps Report | 연간 DevOps 성숙도 조사 (DORA 메트릭 출처) |
| ThoughtWorks Technology Radar | 분기별 기술 트렌드 (Adopt/Trial/Assess/Hold) |
| CNCF Annual Survey | 클라우드 네이티브 채택 현황 |
| RedMonk Programming Language Rankings | 언어 동향 |
| StackOverflow Developer Survey | 개발자 도구 사용 |

### 8순위: 뉴스레터·미디어

| 소스 | 특징 |
|------|------|
| KubeWeekly | CNCF 공식 주간 뉴스 |
| The New Stack | 클라우드 네이티브 심층 기사 |
| DevOps Weekly | DevOps 전반 큐레이션 |
| SRE Weekly | SRE 특화 |
| Kubernetes Podcast by Google | K8s 심층 |
| Software Engineering Daily | 폭넓은 주제 팟캐스트 |

### 학습 로드맵 참고

- roadmap.sh/devops
- awesome-devops, awesome-kubernetes, awesome-sre (GitHub)

---

## 작성 우선순위

로드맵 순서(01→12)를 기본으로 하되, 아래 기준으로 조정한다:

1. **기반 지식 우선** — linux, network, container
2. **핵심 운영 기술** — kubernetes, iac, cicd, gitops
3. **운영 성숙도** — observability, security, sre
4. **진화** — platform-engineering, finops
