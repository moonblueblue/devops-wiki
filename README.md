# DevOps Wiki

> **이 위키는 항상 최신 상태를 유지한다.** 글 작성·업데이트 시 글로벌 리서치를 통해 최신 버전·동향을 확인하고 기존 글과 비교하여 반영한다.

Obsidian + LLM(Claude)으로 운영하는 DevOps 테크 위키.
웹 검색·공식문서·교육자료 등을 수집하고, LLM이 실무 수준의 한국어 위키 글로 정리하여 Quartz로 퍼블리싱한다.

## 디렉토리 구조

```
devops-wiki/
├── content/                 # 최종 발행 글 (Obsidian vault)
│   ├── index.md             # 메인 페이지
│   ├── kubernetes/          # K8s 운영, 클러스터 관리, EKS
│   ├── container/           # Docker, 이미지 빌드, 런타임
│   ├── linux/               # 시스템 관리, 성능분석, 셸 스크립트
│   ├── network/             # DNS, 로드밸런서, VPC, 서비스 메시
│   ├── cicd/                # Jenkins, GitHub Actions, 파이프라인
│   ├── gitops/              # ArgoCD, Flux, Kustomize, Helm
│   ├── iac/                 # Terraform, Ansible, Pulumi
│   ├── observability/       # Prometheus, Grafana, ELK, 트레이싱
│   ├── security/            # DevSecOps, IAM, 시크릿, 공급망 보안
│   └── sre/                 # 장애 대응, SLI/SLO, 카오스 엔지니어링
├── raw/                     # 수집한 원본 소스 (git 추적 제외)
├── quartz/                  # Quartz v4 엔진 (SSG 빌드)
├── .github/                 # GitHub Actions, PR 템플릿
├── CLAUDE.md                # LLM 운영 규칙
└── package.json             # Quartz 의존성
```

## 운영 흐름

1. **수집 (ingest)** — 최신 DevOps 자료를 `raw/`에 저장
2. **작성 (compile)** — `raw/` 소스를 기반으로 `content/`에 위키 글 작성
3. **발행 (publish)** — feature 브랜치 → PR → 리뷰 → merge → Quartz 빌드

## 카테고리

| 카테고리 | 범위 |
|---------|------|
| kubernetes | K8s 운영, API 리소스, 클러스터 관리, EKS |
| container | Docker, 이미지 빌드/최적화, 런타임, 레지스트리 |
| linux | 시스템 관리, 성능분석, 셸 스크립트, systemd |
| network | DNS, 로드밸런서, VPC, CNI, 서비스 메시 |
| cicd | Jenkins, GitHub Actions, 파이프라인, 테스트 자동화 |
| gitops | ArgoCD, Flux, Kustomize, Helm |
| iac | Terraform, Ansible, Packer, Pulumi |
| observability | Prometheus, Grafana, ELK, OpenTelemetry |
| security | DevSecOps, IAM, 시크릿 관리, 공급망 보안 |
| sre | 장애 대응, SLI/SLO, 카오스 엔지니어링, 인시던트 관리 |

## 레퍼런스

- [Kubernetes Docs](https://kubernetes.io/docs/)
- [Docker Docs](https://docs.docker.com/)
- [Terraform Docs](https://developer.hashicorp.com/terraform)
- [Prometheus Docs](https://prometheus.io/docs/)
- [ArgoCD Docs](https://argo-cd.readthedocs.io/)
- [CNCF Landscape](https://landscape.cncf.io/)
- [roadmap.sh/devops](https://roadmap.sh/devops)
