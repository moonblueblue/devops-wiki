---
title: "Moon Blue's DevOps Wiki"
date: 2026-04-16
tags:
  - index
  - roadmap
  - news
sidebar_label: "홈"
---

# Moon Blue's DevOps Wiki

실무 DevOps 엔지니어가 **글로벌 스탠다드 수준**으로 역량을 키우기 위한 지식 허브.
Google, Netflix, Cloudflare, Stripe 같은 탑티어 엔지니어가 당연하게 아는 개념을
공식 문서·CNCF·SRE Book·Accelerate 기준으로 정리한다.

---

## 📰 업계 동향 (2026년 4월)

### 🗓️ 다가오는 컨퍼런스

| 컨퍼런스 | 날짜 | 장소 |
|---------|-----|------|
| [Open Source Summit NA 2026](https://events.linuxfoundation.org/open-source-summit-north-america/) | 5/18 ~ 5/20 | Minneapolis, MN |
| [SREcon26 EMEA](https://www.usenix.org/conference/srecon) | 10/13 ~ 10/15 | Dublin, Ireland |
| [HashiConf 2026](https://www.hashicorp.com/en/conferences/hashiconf) | 10/26 ~ 10/29 | Atlanta, GA |

### 🚀 최근 주요 릴리즈

- **Kubernetes v1.36** (2026-04-22 예정) — 다수 deprecation, cgroup v1 지원 종료 흐름
  [v1.36 sneak peek](https://kubernetes.io/blog/2026/03/30/kubernetes-v1-36-sneak-peek/)
- **Argo CD 3.3** — PreDelete Hooks, OIDC Token Refresh, Shallow Git Cloning
  [InfoQ 기사](https://www.infoq.com/news/2026/02/argocd-33/)
- **OpenTelemetry Profiles** — Public Alpha (2026-03), GA 목표 Q3
  [OTel 블로그](https://opentelemetry.io/blog/2026/profiles-alpha/)
- **Terraform 1.14.8** (2026-03-25) — list resources, query 명령, actions 블록
- **Linkerd 2.19** — 포스트 양자 암호(ML-KEM-768) 적용
- **Ansible 13.5.0** (2026-03-25)

### 🔐 주목할 보안 이슈

- **CVE-2026-33634 (TeamPCP)** — CVSS 9.4 Critical
  Trivy·KICS·LiteLLM·Telnyx SDK·47+ npm 패키지 침해 (2026-03-19 ~ 03-27)
  K8s 클러스터 감지 시 시크릿 탈취 웜 활성화.
  **해당 기간 CI/CD에서 실행한 경우 시크릿 전면 로테이션 필수.**
  [Hacker News 분석](https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html)

### 🏆 CNCF 프로젝트 변동

- **Lima** → Incubating 진입 (2025-11)
- **KubeVirt** → Graduation 준비 (KubeCon EU 2026 논의)
- **Dapr** → Graduated (2024-10, 현재 유지)

### 📊 2026 주요 트렌드

- **AI × Platform Engineering 융합**: AI 에이전트가 플랫폼 first-class citizen으로
- **FinOps "Value of Technology"**: 클라우드→SaaS·AI로 범위 확장, AI Cost Management 1순위 스킬
- **Pre-deployment Cost Gates**: 배포 전 단위 경제성 임계치 검사
- **cgroup v2 마이그레이션**: K8s v1.35부터 레거시 종료 흐름

> 📄 [자세한 월간 다이제스트](../raw/news/2026-04.md)

---

## 📬 매주 읽을 만한 외부 큐레이션

- **[KubeWeekly](https://www.cncf.io/kubeweekly/)** — CNCF 공식 주간 뉴스 (매주 목요일)
- **[The New Stack](https://thenewstack.io/)** — 클라우드 네이티브 심층 기사
- **[DevOps Weekly](https://www.devopsweekly.com/)** — DevOps 전반 큐레이션
- **[SRE Weekly](https://sreweekly.com/)** — SRE 특화
- **[Kubernetes Podcast by Google](https://kubernetespodcast.com/)** — K8s 심층

---

## 📁 학습 로드맵 (12개 카테고리)

```
[기반 지식]      01-03  Linux → Network → Container
[핵심 운영 기술]  04-07  Kubernetes → IaC → CI/CD → GitOps
[운영 성숙도]    08-10  Observability → Security → SRE
[진화]          11-12  Platform Engineering → FinOps
```

| # | 카테고리 | 범위 |
|:-:|---------|------|
| 01 | [Linux](linux/index.md) | 커널, cgroups, namespaces, 보안, 성능, eBPF |
| 02 | [Network](network/index.md) | TCP/IP, DNS, HTTP/2/3, TLS, BGP, VPN, CDN |
| 03 | [Container](container/index.md) | Docker, OCI, BuildKit, Wasm, 런타임 비교 |
| 04 | [Kubernetes](kubernetes/index.md) | 아키텍처, Operator, 멀티테넌시, AI/ML 워크로드 |
| 05 | [IaC](iac/index.md) | Terraform, OpenTofu, Ansible, Crossplane, Pulumi |
| 06 | [CI/CD](cicd/index.md) | Jenkins, GHA, GitLab CI, Tekton, DORA |
| 07 | [GitOps](gitops/index.md) | ArgoCD, Flux, Argo Rollouts, Secret GitOps |
| 08 | [Observability](observability/index.md) | Prometheus, OpenTelemetry, Profiling, eBPF |
| 09 | [Security](security/index.md) | DevSecOps, Zero Trust, 공급망, 정책 |
| 10 | [SRE](sre/index.md) | SLO, Postmortem, Toil, AI-assisted SRE |
| 11 | [Platform Engineering](platform-engineering/index.md) | IDP, Backstage, Golden Path, AI Platform |
| 12 | [FinOps](finops/index.md) | 비용 가시화, Kubecost, FinOps for AI |

---

## 이 위키의 원칙

- **글로벌 스탠다드**: CNCF, 공식 문서, Google SRE Book, Accelerate 기준
- **중립성**: 특정 벤더·클라우드에 편향되지 않음
- **프로덕션 깊이**: 튜토리얼이 아닌 실무 깊이
- **왜·언제 쓰면 안 되는가**: How만이 아닌 Why와 When Not To 포함
- **최신성**: 학습 데이터 컷오프 이후는 글로벌 리서치로 보완
