# Moon Blue's DevOps Wiki - Claude 운영 규칙

## 최우선 규칙

**index.md는 절대 임의로 수정하지 않는다.**

각 카테고리의 `index.md`는 메인테이너가 설계한 학습 로드맵이다.
- `index.md`의 목차 항목 = 반드시 작성해야 할 파일 목록
- 항목을 합치거나 스킵하거나 순서를 바꾸려면 반드시 먼저 물어볼 것
- 글 작성 후 체크박스(`[ ]` → `[x]`)와 링크 추가만 허용
- **예외**: 메인테이너의 명시적 재설계 지시가 있을 때만 구조 수정 가능

**이 위키는 항상 최신 상태를 유지해야 한다.**

글을 작성하거나 업데이트할 때 반드시 아래를 수행한다:
- 글로벌 리서치로 최신 버전·동향을 확인한다
- 기존 글과 비교하여 변경사항을 반영한다
- 오래된 정보는 발견 즉시 업데이트한다

---

## 프로젝트 개요

DevOps 엔지니어를 위한 **글로벌 스탠다드 기술 위키**.

- **용도**: 공개 레퍼런스 (누구나 참고 가능한 기술 문서)
- **품질 기준**: 글로벌 스탠다드 (Google, Netflix, Cloudflare 수준)
- **규모 원칙**: 완성도 우선, 폭 우선 아님
- **집필 도구**: Obsidian vault + Claude, 배포는 Docusaurus

---

## 카테고리 구조 (9개, 3-티어)

```
[서브]   01-03  Linux · Network · Container      기반 지식, 필수만
[메인]   04-06  Kubernetes · Observability · CI/CD   일상 업무, 빠짐없이
[성장]   07-09  IaC · Security · SRE             역량 확장, 필수만
```

### 3-티어의 의미

| 티어 | 성격 | 작성 원칙 |
|:-:|---|---|
| **메인 (Main)** | DevOps 엔지니어의 일상 업무 핵심 영역 | **빠짐없이** |
| **서브 (Sub)** | 메인을 받쳐주는 기반·선행 지식 | **필수만** |
| **성장 (Growth)** | 역량 확장 목표 영역 | **필수만** |

**성장 카테고리는 위키의 방향이 확장되면 메인으로 승격 가능하다.**
지금의 "필수만" 기준은 현재 시점 기준이고, 미래 확장 여지는 닫지 않는다.

### 카테고리 상세

| # | 카테고리 | 티어 | 범위 | 왜 이 순서인가 |
|:-:|---|:-:|---|---|
| 01 | `linux/` | 서브 | 커널, systemd, 성능, 보안, 스토리지 | 모든 인프라의 기반, 트러블슈팅 최종 레이어 |
| 02 | `network/` | 서브 | TCP/IP, DNS, TLS, 라우팅, LB | 장애 원인의 절반 |
| 03 | `container/` | 서브 | Docker, OCI, BuildKit, 런타임 | 현대 배포 기본 단위 |
| 04 | `kubernetes/` | 메인 | 아키텍처, 리소스, 스케줄링, 운영 전반 | 컨테이너 오케스트레이션 표준 |
| 05 | `observability/` | 메인 | 메트릭, 로그, 트레이스, SLO 도구 | 장애 대응 = 관측 싸움 |
| 06 | `cicd/` | 메인 | GitHub Actions, Jenkins, ArgoCD, Flux | 배포 자동화 |
| 07 | `iac/` | 성장 | Terraform, Ansible, Crossplane | 환경 의존적, 비중 가변 |
| 08 | `security/` | 성장 | DevSecOps, 공급망, Zero Trust | 각 레이어 교차, 심화는 독립 |
| 09 | `sre/` | 성장 | SLO, 포스트모템, 런북, 카오스 | 방법론·철학 |

---

## 작성 원칙

### "빠짐없이" (메인 카테고리)

다음을 **모두** 포함한다:
- 공식 문서 최상위 목차에 있는 개념 전부
- 프로덕션에서 월 1회 이상 마주치는 시나리오
- 장애 발생 시 참고할 만한 모든 것
- 의사결정 분기점 (A vs B, 언제 쓰면 안 되는가)

### "필수만" (서브·성장 카테고리)

다음 **중 1개 이상** 충족하는 것만 포함:
- 메인 카테고리 이해의 선행 필수 개념
- 트러블슈팅 시 반드시 도달하는 레이어
- 모르면 사고로 이어지는 보안/안정성 최소선
- 다시 찾아볼 가능성이 높은 항목

다음은 **제외**:
- 공식 문서·튜토리얼로 충분한 입문 내용
- 한 번 읽으면 끝나는 개념
- 트렌드성 주제 (1년 후 바뀔 것)

**주의**: "필수만"은 **주제 수를 줄이는 것**이지 **글의 깊이를 낮추는 것이 아니다**.
살아남은 글은 여전히 글로벌 스탠다드 수준으로 작성한다.

---

## 카테고리 경계 원칙

한 주제는 **반드시 한 카테고리가 주인공**이다.

### 기본 경계

- **Kustomize/Helm 도구 자체** → `kubernetes/`
  - GitOps 맥락의 활용 → `cicd/` (참조)
- **Network Policy K8s 리소스** → `kubernetes/`
  - 네트워크 보안 전략 → `security/`
- **Docker 네트워크** → `container/`
- **CoreDNS** → `kubernetes/` (K8s 필수 컴포넌트)
- **eBPF 기반 기술** → `linux/`
  - 네트워킹 응용 → `network/`
  - 관측 응용 → `observability/`
  - 보안 응용 → `security/`

### 중복 방지 (5개 주제 주인공 지정)

- **Secrets 도구 자체** (Vault, ESO, Sealed Secrets, SOPS) → `security/`
  - Terraform 통합 → `iac/` (참조)
  - ArgoCD/Flux 통합 → `cicd/` (참조)

- **Service Mesh 구현** (Istio, Linkerd, Cilium Mesh, Ambient) → `network/`
  - Gateway API·K8s 리소스 매핑 → `kubernetes/`
  - mTLS 정책·Zero Trust 전략 → `security/`

- **Feature Flag 도구** (OpenFeature, LaunchDarkly, Flagsmith, Unleash) → `cicd/`
  - SRE 관점 사용법 → `sre/` (참조만, 도구 설명 금지)

- **배포 전략 개념** (Blue/Green, Canary, Rolling, Shadow) → `cicd/`
  - 도구 구현 (Argo Rollouts, Flagger) → `cicd/`
  - SLO 기반 자동 롤백·에러 버짓 연계 → `sre/`

- **SLO 개념·수학** (Burn Rate, Error Budget) → `sre/`
  - SLO as Code 도구 (Sloth, Pyrra, OpenSLO) → `observability/`
  - Multi-window Burn Rate 알림 구현 → `observability/alerting/`

**원칙**: 한 도구에 대해 "주인공 글"은 한 곳에만 둔다.
다른 카테고리는 해당 글을 링크로 참조한다.

---

## 운영 방식

### research & write (리서치 → 작성)

- 웹 리서치로 공식 문서, 릴리즈 노트, 커뮤니티 글 조사
- 기존 글과 새 정보를 비교해서 업데이트
- 출처는 글 하단 `## 참고 자료` 섹션에 URL + 확인 날짜로 기록
- frontmatter에 `last_verified` 필드로 최신성 관리
- 기술적 깊이는 **글로벌 스탠다드** (Google, Netflix, Cloudflare 등 탑티어 엔지니어 수준)
- 한국어로 작성

### maintain (정보 건강 관리)

- content/의 정보를 주기적으로 점검
- 점검 기준:
  - EOL 버전 사용 여부
  - deprecated 도구/기능 언급 여부
  - 최신 릴리즈에서 변경된 사항 반영 여부
  - `last_verified`가 오래된 글

### review (검수)

- `.claude/agents/reviewer.md` 기준으로 검수
- 검수 대상: 개별 글 / 카테고리 index.md / 전체 뼈대
- 개별 글 작성·수정 시: 해당 파일의 정확성·깊이 검수
- 카테고리 추가·변경 시: index.md 개념 완결성 검수
- 주기적 (분기 1회): 전체 뼈대 검수

### commit

- 작업 완료 후 직접 `main` 브랜치에 커밋
- 단일 메인테이너 운영 방식이므로 PR 없이 직접 커밋
- Conventional Commits 형식 사용

### 커밋 컨벤션

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

- subject는 한국어로 작성
- 예: `feat: kubernetes 1.36 릴리즈 정리 추가`
- 예: `fix: terraform backend 설명 오류 수정`

---

## 글 형식

### frontmatter 필수 필드

```yaml
---
title: "..."
sidebar_label: "..."        # 최대 10자
sidebar_position: N
date: YYYY-MM-DD             # 최초 작성일
last_verified: YYYY-MM-DD    # 최신성 검증일
tags: [...]
draft: true                  # 스텁 상태. 본문 완성 시 제거
---
```

### 중립성 규칙

- 클라우드와 온프레미스 편향 없음
- 개념은 환경 독립적으로 설명
- 예시에서 클라우드·온프레미스 양쪽을 균형 있게
- 특정 벤더 서비스만 다루지 않음 (예: EKS만이 아닌 K8s 자체 먼저)

### 제목 규칙

- 페이지 제목 (`title`): 내용을 명확히 설명
- 사이드바 제목 (`sidebar_label`): 최대 10자
- 사이드바에서 줄바꿈 금지

### 가독성 규칙

- 한 줄 최대 80자
- 한 문장(단락) 최대 3줄
- 글만 나열 금지 — 표·다이어그램·코드 블록 적극 활용
- 비교가 필요한 내용은 반드시 표로
- 긴 설명보다 짧은 문장 + 시각 자료 조합 우선
- **ASCII 도표 사용 금지**

### 다이어그램 사용 기준

**표 (table) 우선**:
- 파일 경로, 설정 항목, 명령어 목록 등 나열
- 2개 이상 옵션의 속성 비교
- 수치·벤치마크 비교

**Mermaid 다이어그램**:
- 흐름(flow), 순서(sequence), 상태(state)가 있을 때
- 컴포넌트 간 관계/계층이 핵심일 때
- **노드 10개 이하**
- **노드 라벨 한국어 10자 이내** 짧은 키워드만
- 라벨에 괄호 `()`, 화살표 `→`, 콜론 `:`, 슬래시 `/`, 중점 `·`, `\n`, `<br/>` 금지
- 부연 설명은 노드 밖 표·텍스트로 분리

**10개 초과 시 반드시 분리**:
- 한 다이어그램은 한 질문에만 답한다
- 계층이 깊으면 레벨별로 다이어그램을 분리한다

---

## 카테고리 확장 정책

현재 9개 카테고리로 유지한다. 다음은 **편입되지 않은 주제**에 대한 처리 원칙:

- **GitOps** → `cicd/`의 한 섹션 (ArgoCD, Flux, Argo Rollouts)
- **Platform Engineering** → 핵심만 `cicd/` 또는 `sre/`에 분산 흡수
- **FinOps** → 실무 관점만 `kubernetes/`·`observability/`·`iac/`에 분산 흡수
- **Cloud (Landing Zone 등)** → `iac/` 하위 또는 `network/` 하위에 필요한 것만

**향후 위키 방향 확장에 따라 독립 카테고리로 승격 가능.**
승격은 반드시 메인테이너의 명시적 지시가 있을 때만 진행한다.

---

## 레퍼런스 소스

→ [REFERENCES.md](./REFERENCES.md) 참고.
글 작성·검수 시 해당 파일의 우선순위 기준을 따른다.
