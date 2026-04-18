---
title: "Moon Blue's DevOps Wiki"
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - index
  - roadmap
sidebar_label: "홈"
sidebar_class_name: hidden-sidebar-item
displayed_sidebar: wikiSidebar
---

<!-- @format -->

# Moon Blue's DevOps Wiki

> DevOps 엔지니어를 위한 **글로벌 스탠다드 기술 위키**.

---

## 📰 업계 동향 (2026년 4월)

### 🗓️ 다가오는 컨퍼런스

| 컨퍼런스                                                                                           | 날짜          | 장소            |
| -------------------------------------------------------------------------------------------------- | ------------- | --------------- |
| [Open Source Summit NA 2026](https://events.linuxfoundation.org/open-source-summit-north-america/) | 5/18 ~ 5/20   | Minneapolis, MN |
| [SREcon26 EMEA](https://www.usenix.org/conference/srecon)                                          | 10/13 ~ 10/15 | Dublin, Ireland |
| [HashiConf 2026](https://www.hashicorp.com/en/conferences/hashiconf)                               | 10/26 ~ 10/29 | Atlanta, GA     |

### 🚀 최근 주요 릴리즈

- **Kubernetes v1.36** (2026-04-22 예정) — 다수 deprecation, cgroup v1 지원 종료 흐름
  [v1.36 sneak peek](https://kubernetes.io/blog/2026/03/30/kubernetes-v1-36-sneak-peek/)
- **Argo CD 3.3** — PreDelete Hooks, OIDC Token Refresh, Shallow Git Cloning
  [InfoQ 기사](https://www.infoq.com/news/2026/02/argocd-33/)
- **OpenTelemetry Profiles** — Public Alpha (2026-03), GA 목표 Q3
  [OTel 블로그](https://opentelemetry.io/blog/2026/profiles-alpha/)
- **Terraform 1.14.8** (2026-03-25) — list resources, query 명령, actions 블록
- **Linkerd 2.19** — 포스트 양자 암호 (ML-KEM-768) 적용
- **Ansible 13.5.0** (2026-03-25)

### 🔐 주목할 보안 이슈

- **CVE-2026-33634 (TeamPCP)** — CVSS 9.4 Critical
  Trivy·KICS·LiteLLM·Telnyx SDK·47+ npm 패키지 침해 (2026-03-19 ~ 03-27)
  K8s 클러스터 감지 시 시크릿 탈취 웜 활성화.
  **해당 기간 CI/CD에서 실행한 경우 시크릿 전면 로테이션 필수.**
  [Hacker News 분석](https://thehackernews.com/2026/03/trivy-hack-spreads-infostealer-via.html)

---

## 📬 매주 읽을 만한 외부 큐레이션

- **[KubeWeekly](https://www.cncf.io/kubeweekly/)** — CNCF 공식 주간 뉴스 (매주 목요일)
- **[The New Stack](https://thenewstack.io/)** — 클라우드 네이티브 심층 기사
- **[DevOps Weekly](https://www.devopsweekly.com/)** — DevOps 전반 큐레이션
- **[SRE Weekly](https://sreweekly.com/)** — SRE 특화
- **[Kubernetes Podcast by Google](https://kubernetespodcast.com/)** — K8s 심층

---

## 📁 학습 로드맵 (9개 카테고리, 3-티어)

```
[서브]   01-03  Linux → Network → Container        기반 지식 (필수만)
[메인]   04-06  Kubernetes → Observability → CI/CD  일상 업무 (빠짐없이)
[성장]   07-09  IaC → Security → SRE               역량 확장 (필수만)
```

### 티어 설명

|   티어   | 작성 원칙 | 성격                                                                  |
| :------: | --------- | --------------------------------------------------------------------- |
| **메인** | 빠짐없이  | DevOps 엔지니어의 일상 업무 핵심. 공식 문서 최상위 목차 수준의 완결성 |
| **서브** | 필수만    | 메인을 받쳐주는 기반·선행 지식                                        |
| **성장** | 필수만    | 역량 확장 목표. 미래 메인 승격 가능                                   |

### 카테고리

|  #  | 티어 | 카테고리                                | 범위                                  |
| :-: | :--: | --------------------------------------- | ------------------------------------- |
| 01  | 서브 | [Linux](linux/index.md)                 | 커널, systemd, 성능, 보안, 스토리지   |
| 02  | 서브 | [Network](network/index.md)             | TCP/IP, DNS, TLS, 라우팅, LB          |
| 03  | 서브 | [Container](container/index.md)         | Docker, OCI, BuildKit, 런타임         |
| 04  | 메인 | [Kubernetes](kubernetes/index.md)       | 아키텍처, 리소스, 스케줄링, 운영 전반 |
| 05  | 메인 | [Observability](observability/index.md) | 메트릭, 로그, 트레이스, SLO 도구      |
| 06  | 메인 | [CI/CD](cicd/index.md)                  | GitHub Actions, Jenkins, ArgoCD, Flux |
| 07  | 성장 | [IaC](iac/index.md)                     | Terraform, Ansible, Crossplane        |
| 08  | 성장 | [Security](security/index.md)           | DevSecOps, 공급망, Zero Trust         |
| 09  | 성장 | [SRE](sre/index.md)                     | SLO, 포스트모템, 런북                 |

---

## 이 위키의 원칙

- **글로벌 스탠다드**: CNCF·Linux Foundation, 공식 문서, Google SRE Book, Accelerate 기준
- **중립성**: 특정 벤더·클라우드·온프레미스에 편향되지 않음
- **프로덕션 깊이**: 튜토리얼이 아닌 실무 깊이
- **왜·언제 쓰면 안 되는가**: How만이 아닌 Why와 When Not To 포함
- **최신성**: 학습 데이터 컷오프 이후는 글로벌 리서치로 보완
- **실무 레퍼런스 우선**: 공식 문서와 중복되는 입문 내용은 과감히 제외, 의사결정·트러블슈팅 가치가 있는 내용 중심
