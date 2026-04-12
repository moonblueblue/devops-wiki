# DevOps Wiki - Claude 운영 규칙

## 최우선 규칙

**이 위키는 항상 최신 상태를 유지해야 한다.**
글을 작성하거나 업데이트할 때, 반드시 글로벌 리서치(공식문서, 릴리즈 노트, CNCF 블로그 등)를 통해 현재 최신 버전·동향을 확인하고 기존 글과 비교하여 반영한다.
이미 작성된 글이라도 버전이 오래되었거나 정보가 변경된 경우 즉시 업데이트한다.

## 프로젝트 개요
DevOps 엔지니어를 위한 오픈 테크 블로그/위키.
쿠버네티스, 네트워크, 옵저버빌리티, 컨테이너, 리눅스 등을 다룬다.

## 디렉토리 구조
- `raw/` : 수집한 원본 소스. 절대 수정하지 말 것
- `content/` : 최종 글. LLM이 작성·관리
- `CLAUDE.md` : 운영 규칙 (이 파일)

## 운영 방식

### ingest (수집)
- 웹 검색으로 최신 DevOps 관련 글, 공식문서, 릴리즈 노트 수집
- raw/ 폴더에 마크다운으로 저장
- 주제별 서브폴더 사용 (raw/kubernetes/, raw/network/ 등)

### compile (작성)
- raw/ 의 소스를 읽고 content/ 에 글 작성
- 기존 글과 새 정보를 비교해서 업데이트
- 기술적 깊이는 실무 DevOps 엔지니어 수준 유지
- 한국어로 작성

### PR
- 작업 완료 후 feature 브랜치 생성
- GitHub PR 생성
- 호성님이 검토 후 merge

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

### 가독성 규칙
- 한 줄은 최대 80자를 넘지 않는다
- 하나의 문장(단락)은 최대 3줄을 넘지 않는다
- 글만 나열하지 않는다. 도표, 다이어그램, 코드 블록 등을 적극 활용한다
- 복잡한 개념은 mermaid 다이어그램이나 ASCII 도표로 시각화한다
- 비교가 필요한 내용은 반드시 표(table)로 정리한다
- 긴 설명보다 짧은 문장 + 시각 자료 조합을 우선한다

---

## 카테고리 구조

content/ 하위 10개 카테고리로 운영한다.

### 핵심 카테고리 (기존 6개)

| 카테고리 | 범위 |
|---------|------|
| `kubernetes/` | K8s 운영, API 리소스, 클러스터 관리, EKS, 업그레이드, 트러블슈팅 |
| `container/` | Docker, 이미지 빌드/최적화, 런타임, 레지스트리, compose |
| `linux/` | 시스템 관리, 성능분석(CPU/메모리/디스크/네트워크), 셸 스크립트, systemd |
| `network/` | DNS, 로드밸런서, VPC, CNI, 서비스 메시, eBPF |
| `cicd/` | Jenkins, GitHub Actions, 파이프라인 설계, 테스트 자동화 |
| `observability/` | Prometheus, Grafana, ELK, OpenTelemetry, 분산 트레이싱, 알림 |

### 확장 카테고리 (신규 4개)

| 카테고리 | 범위 |
|---------|------|
| `iac/` | Terraform, Ansible, Packer, Pulumi, CloudFormation |
| `gitops/` | ArgoCD, Flux, Kustomize, Helm, 선언적 인프라 관리 |
| `security/` | DevSecOps, IAM, 시크릿 관리, SBOM, 공급망 보안, OPA/Kyverno |
| `sre/` | 장애 대응, SLI/SLO/SLA, 에러 버짓, 카오스 엔지니어링, 인시던트 관리 |

### 향후 확장 후보

- `platform-engineering/` : IDP, 골든패스, 셀프서비스 인프라
- `cloud/` : AWS/GCP/Azure 아키텍처 (현재는 각 카테고리 내에서 AWS 예시로 커버)

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

## raw/ 소스 커버리지

현재 raw/에 패스트캠퍼스 교육과정 PDF 5개가 있다.
PDF는 "어떤 토픽을 다뤄야 하는지"의 가이드로만 활용하고, 실제 내용은 공식문서 + 웹 리서치로 작성한다.

### 카테고리별 커버리지

| 카테고리 | PDF 커버 | 보완 필요 |
|---------|---------|---------|
| kubernetes | O (EKS 중심) | 바닐라 K8s, GKE/AKS |
| container | O (Docker 기초~고급) | containerd, 런타임 비교 |
| linux | O (27시간, 성능분석까지) | - |
| network | △ (VPC/DNS 수준) | CNI, eBPF, 서비스 메시 심화 |
| cicd | O (Jenkins, GitHub Actions, 71시간) | GitLab CI, CircleCI |
| observability | △ (Prometheus/Grafana 기초) | OpenTelemetry, 분산 트레이싱 |
| iac | △ (Terraform/Ansible 파트) | Pulumi, CDK, 모듈 설계 패턴 |
| gitops | △ (ArgoCD 파트) | Flux, Image Updater 심화 |
| security | X (AWS 보안 파트만) | SBOM, SLSA, OPA, Falco, 시크릿 관리 전반 |
| sre | O (장애 대응 35시간, 케이스 8개) | Google SRE 모델, 에러 버짓 |

---

## 작성 우선순위

1단계: PDF 커버리지가 충분한 영역부터 작성
- kubernetes, container, linux, cicd, sre

2단계: PDF + 공식문서 보완이 필요한 영역
- iac, gitops, observability

3단계: 웹 리서치 중심으로 작성
- security, network 심화
