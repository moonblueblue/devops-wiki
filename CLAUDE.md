# Moon Blue's DevOps Wiki - Claude 운영 규칙

## 최우선 규칙

**1. `index.md`는 임의 수정 금지.**
- 각 카테고리의 `index.md` = 메인테이너가 설계한 학습 로드맵
- 목차 항목 = 반드시 작성해야 할 파일 목록
- 합치기·스킵·순서 변경은 먼저 물어볼 것
- 허용: 체크박스(`[ ]` → `[x]`), 링크 추가
- 예외: 메인테이너의 명시적 재설계 지시

**2. 항상 최신 상태 유지.**
- 글로벌 리서치로 최신 버전·동향 확인
- 기존 글과 비교하여 변경사항 반영
- 오래된 정보는 발견 즉시 업데이트

---

## 프로젝트 개요

DevOps 엔지니어를 위한 **글로벌 스탠다드 공개 기술 위키**.

- **품질 기준**: Google, Netflix, Cloudflare 수준
- **규모 원칙**: 완성도 우선, 폭 우선 아님
- **집필 도구**: Obsidian vault + Claude, 배포는 Docusaurus
- **언어**: 한국어

---

## 카테고리 구조 (9개, 3-티어)

```
[서브]   01-03  Linux · Network · Container        기반 지식, 필수만
[메인]   04-06  Kubernetes · Observability · CI/CD  일상 업무, 빠짐없이
[성장]   07-09  IaC · Security · SRE                역량 확장, 필수만
```

| # | 카테고리 | 티어 | 범위 |
|:-:|---|:-:|---|
| 01 | `linux/` | 서브 | 커널, systemd, 성능, 보안, 스토리지 |
| 02 | `network/` | 서브 | TCP/IP, DNS, TLS, 라우팅, LB |
| 03 | `container/` | 서브 | Docker, OCI, BuildKit, 런타임 |
| 04 | `kubernetes/` | 메인 | 아키텍처, 리소스, 스케줄링, 운영 |
| 05 | `cicd/` | 메인 | GitHub Actions, Jenkins, ArgoCD, Flux |
| 06 | `observability/` | 메인 | 메트릭, 로그, 트레이스, SLO 도구 |
| 07 | `iac/` | 성장 | Terraform, Ansible, Crossplane |
| 08 | `security/` | 성장 | DevSecOps, 공급망, Zero Trust |
| 09 | `sre/` | 성장 | SLO, 포스트모템, 런북, 카오스 |

**성장 카테고리는 위키 방향 확장 시 메인으로 승격 가능** (메인테이너 지시 시).

---

## 작성 원칙

### "빠짐없이" (메인 카테고리) — 모두 포함
- 공식 문서 최상위 목차 개념 전부
- 프로덕션에서 월 1회 이상 마주치는 시나리오
- 장애 발생 시 참고할 만한 모든 것
- 의사결정 분기점 (A vs B, 언제 쓰면 안 되는가)

### "필수만" (서브·성장) — 1개 이상 충족 시 포함
- 메인 이해의 선행 필수 개념
- 트러블슈팅 시 반드시 도달하는 레이어
- 모르면 사고로 이어지는 보안/안정성 최소선
- 다시 찾아볼 가능성 높은 항목

**제외**: 공식 문서·튜토리얼로 충분한 입문, 한 번 읽고 끝, 트렌드성 주제.

**주의**: "필수만"은 주제 수를 줄이는 것. **깊이는 여전히 글로벌 스탠다드**.

---

## 카테고리 경계 원칙

한 주제는 **반드시 한 카테고리가 주인공**. 다른 곳은 링크로 참조.

### 기본 경계

- **Kustomize/Helm 도구 자체** → `kubernetes/` (GitOps 맥락은 `cicd/` 참조)
- **Network Policy 리소스** → `kubernetes/` (네트워크 보안 전략은 `security/`)
- **Docker 네트워크** → `container/`
- **CoreDNS** → `kubernetes/`
- **eBPF** → `linux/` (응용: `network/`·`observability/`·`security/`)

### 중복 방지 (주인공 지정)

- **Secrets 도구** (Vault, ESO, Sealed Secrets, SOPS) → `security/`
  - Terraform/ArgoCD 통합은 각 카테고리에서 참조
- **Service Mesh 구현** (Istio, Linkerd, Cilium, Ambient) → `network/`
  - Gateway API → `kubernetes/`, mTLS 전략 → `security/`
- **Feature Flag 도구** (OpenFeature, LaunchDarkly, Flagsmith, Unleash) → `cicd/`
  - SRE 관점은 `sre/` 참조만 (도구 설명 금지)
- **배포 전략** (Blue/Green, Canary, Rolling, Shadow) → `cicd/`
  - SLO 기반 자동 롤백·에러 버짓 연계 → `sre/`
- **SLO 개념·수학** (Burn Rate, Error Budget) → `sre/`
  - SLO as Code 도구 (Sloth, Pyrra, OpenSLO) → `observability/`

---

## 운영 방식

### research & write
- 웹 리서치 (공식 문서, 릴리즈 노트, 커뮤니티)
- 기존 글과 비교·업데이트
- 출처는 글 하단 `## 참고 자료` 섹션에 URL + 확인 날짜
- frontmatter `last_verified` 필드로 최신성 관리
- 한국어, 글로벌 스탠다드 깊이

### maintain (주기적 점검)
- EOL 버전·deprecated 기능 언급 여부
- 최신 릴리즈 변경사항 반영 여부
- `last_verified` 오래된 글

### review
- `.claude/agents/reviewer.md` 기준
- 개별 글 작성·수정 시: 정확성·깊이 검수
- 카테고리 변경 시: index.md 완결성 검수
- 분기 1회: 전체 뼈대 검수

### commit (PR 없이 `main` 직접 커밋 & 푸시까지 진행)

Conventional Commits (subject는 한국어):

| type | 용도 |
|------|------|
| `feat` | 새로운 글 또는 기능 추가 |
| `fix` | 오류 수정, 잘못된 정보 정정 |
| `docs` | 문서 변경 (README, CLAUDE.md 등) |
| `refactor` | 글 구조 개선, 카테고리 재배치 |
| `style` | 포맷팅, 오타, 레이아웃 |
| `chore` | 빌드, 설정, 기타 |
| `ci` | CI/CD 설정 변경 |

---

## 글 형식

### frontmatter

```yaml
---
title: "..."
sidebar_label: "..."        # 최대 10자
sidebar_position: N
date: YYYY-MM-DD
last_verified: YYYY-MM-DD
tags: [...]
draft: true                 # 스텁. 본문 완성 시 제거
---
```

### 중립성
- 클라우드·온프레미스 편향 없음, 개념은 환경 독립적으로
- 예시는 양쪽 균형, 특정 벤더 서비스만 다루지 않음 (EKS보다 K8s 먼저)

### 제목
- `title`: 내용을 명확히 설명
- `sidebar_label`: 최대 10자
  - 예외: 업계 표준 고유명사는 원형 유지 허용 (`Immutable OS`, `seccomp-bpf`, `systemd 서비스 관리`)
  - 축약이 의미를 훼손하지 않으면 축약 우선
  - 사이드바 가로폭 초과·줄바꿈 금지

### 가독성
- 한 줄 80자, 한 단락 3줄 이내
- 글만 나열 금지 — 표·다이어그램·코드 블록 적극 활용
- 비교는 반드시 표로
- **ASCII 도표 사용 금지**

### 다이어그램 기준

**표 우선**: 경로·설정·명령어 나열, 속성 비교, 수치 비교.

**Mermaid**: 흐름·순서·상태·관계·계층이 있을 때.
- 노드 10개 이하
- 노드 라벨 한국어 10자 이내
- 라벨 금지 문자: `()`, `→`, `:`, `/`, `·`, `\n`, `<br/>`
- 부연 설명은 노드 밖 표·텍스트로 분리
- 10개 초과 시 반드시 분리 (한 다이어그램은 한 질문에만)

---

## 카테고리 확장 정책

현재 9개 유지. 편입되지 않은 주제 처리:

- **GitOps** → `cicd/`의 한 섹션
- **Platform Engineering** → `cicd/` 또는 `sre/`에 분산
- **FinOps** → `kubernetes/`·`observability/`·`iac/`에 분산
- **Cloud (Landing Zone 등)** → `iac/` 또는 `network/` 하위

**독립 카테고리 승격은 메인테이너 명시적 지시 시에만.**

---

## 레퍼런스 소스

→ [REFERENCES.md](./REFERENCES.md). 글 작성·검수 시 우선순위 기준.
