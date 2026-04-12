# DevOps Wiki

> **이 위키는 항상 최신 상태를 유지한다.**
> 글 작성·업데이트 시 글로벌 리서치를 통해
> 최신 버전·동향을 확인하고 기존 글과 비교하여 반영한다.

Obsidian + LLM(Claude)으로 운영하는 DevOps 테크 위키.
LLM이 웹 리서치로 자료를 수집하고,
실무 수준의 한국어 위키 글로 정리하여 Quartz로 퍼블리싱한다.

## 디렉토리 구조

```
devops-wiki/
├── content/                 # 최종 발행 글 (Obsidian vault)
│   ├── index.md             # 메인 페이지
│   ├── linux/               # 시스템 관리, 성능분석
│   ├── network/             # DNS, 로드밸런서, VPC
│   ├── container/           # Docker, 이미지 빌드, 런타임
│   ├── kubernetes/          # K8s 운영, 클러스터 관리
│   ├── iac/                 # Terraform, Ansible, Pulumi
│   ├── cicd/                # Jenkins, GitHub Actions
│   ├── gitops/              # ArgoCD, Flux, Helm
│   ├── observability/       # Prometheus, Grafana, ELK
│   ├── security/            # DevSecOps, 시크릿, 공급망 보안
│   └── sre/                 # 장애 대응, SLI/SLO
├── raw/                     # 수집한 원본 소스 (git 추적 제외)
├── quartz/                  # Quartz v4 엔진 (SSG 빌드)
├── .github/                 # GitHub Actions, PR 템플릿
├── CLAUDE.md                # LLM 운영 규칙
└── package.json             # Quartz 의존성
```

## 운영 흐름

1. **수집 (ingest)** — 웹 리서치로 최신 자료를 `raw/`에 저장
2. **작성 (compile)** — `raw/` 기반으로 `content/`에 위키 글 작성
3. **발행 (publish)** — feature 브랜치 → PR → 검수 → merge

## 카테고리 (로드맵 순서)

| 순서 | 카테고리 | 범위 |
|:---:|---------|------|
| 1 | linux | 시스템 관리, 성능분석, 셸 스크립트, systemd |
| 2 | network | DNS, HTTP, 로드밸런서, VPC, CNI |
| 3 | container | Docker, 이미지 빌드/최적화, 런타임, 레지스트리 |
| 4 | kubernetes | API 리소스, 클러스터 관리, 업그레이드, 트러블슈팅 |
| 5 | iac | Terraform, Ansible, Pulumi |
| 6 | cicd | Jenkins, GitHub Actions, 파이프라인, 테스트 자동화 |
| 7 | gitops | ArgoCD, Flux, Kustomize, Helm |
| 8 | observability | Prometheus, Grafana, ELK, OpenTelemetry |
| 9 | security | DevSecOps, IAM, 시크릿, SBOM, 공급망 보안 |
| 10 | sre | 장애 대응, SLI/SLO, 카오스 엔지니어링 |

## 레퍼런스

- [Kubernetes Docs](https://kubernetes.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [Terraform Docs](https://developer.hashicorp.com/terraform)
- [Prometheus Docs](https://prometheus.io/docs/)
- [ArgoCD Docs](https://argo-cd.readthedocs.io/)
- [CNCF Landscape](https://landscape.cncf.io/)
- [roadmap.sh/devops](https://roadmap.sh/devops)
