# DevOps Wiki - Claude 운영 규칙

## 최우선 규칙

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
- `raw/` : 수집한 원본 소스. 절대 수정하지 말 것
- `CLAUDE.md` : 운영 규칙 (이 파일)

## 운영 방식

### ingest (수집)
- Claude가 웹 리서치로 공식문서, 릴리즈 노트, 커뮤니티 글 수집
- raw/ 폴더에 마크다운으로 저장
- 주제별 서브폴더 사용 (raw/kubernetes/ 등)
- 수집 시 출처 URL과 수집 날짜를 반드시 기록

### maintain (정보 건강 관리)
- raw/와 content/의 정보를 주기적으로 점검한다
- 과거에는 맞았지만 현재 틀린 정보를 찾아 교체한다
- 오래되어 가치가 없는 raw/ 소스는 정리(삭제)한다
- raw/는 무한히 쌓지 않는다. 꼭 필요한 소스만 유지한다
- 점검 기준:
  - 버전이 EOL된 내용이 있는가
  - deprecated된 도구/기능을 다루고 있는가
  - 최신 릴리즈에서 변경된 사항이 반영되어 있는가

### compile (작성)
- raw/의 소스를 읽고 content/에 위키 글 작성
- 기존 글과 새 정보를 비교해서 업데이트
- 최신 여부 확인이 필요하면 글로벌 리서치로 보완
- 기술적 깊이는 실무 DevOps 엔지니어 수준 유지
- 한국어로 작성

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

### 가독성 규칙
- 한 줄은 최대 80자를 넘지 않는다
- 하나의 문장(단락)은 최대 3줄을 넘지 않는다
- 글만 나열하지 않는다
  도표, 다이어그램, 코드 블록 등을 적극 활용한다
- 복잡한 개념은 mermaid 다이어그램이나
  ASCII 도표로 시각화한다
- 비교가 필요한 내용은 반드시 표(table)로 정리한다
- 긴 설명보다 짧은 문장 + 시각 자료 조합을 우선한다

---

## 카테고리 구조 (DevOps 로드맵 순서)

content/ 하위 10개 카테고리를 학습 로드맵 순서로 운영한다.
입문자가 1번부터 순서대로 학습할 수 있도록 배치한다.

| 순서 | 카테고리 | 범위 | 왜 이 순서인가 |
|:---:|---------|------|-------------|
| 1 | `linux/` | 시스템 관리, 성능분석, 셸 스크립트, systemd | 모든 인프라의 기반 |
| 2 | `network/` | DNS, HTTP, 로드밸런서, VPC, CNI | 트러블슈팅의 절반은 네트워크다 |
| 3 | `container/` | Docker, 이미지 빌드/최적화, 런타임, 레지스트리 | 현대 배포의 기본 단위 |
| 4 | `kubernetes/` | API 리소스, 클러스터 관리, 업그레이드, 트러블슈팅 | 컨테이너 오케스트레이션 |
| 5 | `iac/` | Terraform, Ansible, Pulumi | 인프라를 코드로 관리 |
| 6 | `cicd/` | Jenkins, GitHub Actions, 파이프라인, 테스트 자동화 | 코드 → 배포 자동화 |
| 7 | `gitops/` | ArgoCD, Flux, Kustomize, Helm | 선언적 배포와 드리프트 방지 |
| 8 | `observability/` | Prometheus, Grafana, ELK, OpenTelemetry | 배포 후 시스템을 보는 눈 |
| 9 | `security/` | DevSecOps, IAM, 시크릿, SBOM, 공급망 보안 | 파이프라인 전체에 보안을 녹여넣기 |
| 10 | `sre/` | 장애 대응, SLI/SLO, 카오스 엔지니어링 | 위 모든 것을 종합하는 운영 철학 |

### 향후 확장 후보

- `platform-engineering/` : IDP, 골든패스, 셀프서비스
- `cloud/` : 멀티클라우드 아키텍처 비교

---

## 레퍼런스 소스

글 작성 시 아래 소스를 우선 참조한다.

### 1순위: 공식 문서
- kubernetes.io/docs
- docs.docker.com
- developer.hashicorp.com/terraform
- prometheus.io/docs
- argo-cd.readthedocs.io
- istio.io/latest/docs
- docs.aws.amazon.com
- cloud.google.com/docs
- learn.microsoft.com/azure

### 2순위: CNCF 및 커뮤니티
- CNCF Blog (cncf.io/blog)
- KubeWeekly (CNCF 공식 주간 뉴스레터)
- The New Stack (thenewstack.io)
- DevOps Weekly (devopsweekly.com)

### 3순위: GitHub & 로드맵
- roadmap.sh/devops
- awesome-devops, awesome-kubernetes, awesome-sre
- KubeCon 발표 (CNCF YouTube)

---

## 작성 우선순위

로드맵 순서(1→10)를 기본으로 하되, 아래 기준으로 조정한다:

1. **기반 지식 우선** — linux, network, container
2. **핵심 운영 기술** — kubernetes, iac, cicd, gitops
3. **운영 성숙도** — observability, security, sre
