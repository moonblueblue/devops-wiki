---
title: "Moon Blue's DevOps Wiki"
date: 2026-04-16
tags:
  - index
  - roadmap
sidebar_label: "홈"
---

# Moon Blue's DevOps Wiki

실무 DevOps 엔지니어가 **글로벌 스탠다드 수준**으로 역량을 키우기 위한 개인 지식 베이스.

Google, Netflix, Cloudflare, Stripe 같은 탑티어 엔지니어가 당연하게 아는
개념을 중심으로, 공식 문서·CNCF·SRE Book·Accelerate 등을 근거로 정리한다.

---

## 학습 로드맵 (12 카테고리)

```
[기반 지식]      01-03  Linux → Network → Container
[핵심 운영 기술]  04-07  Kubernetes → IaC → CI/CD → GitOps
[운영 성숙도]    08-10  Observability → Security → SRE
[진화]          11-12  Platform Engineering → FinOps
```

### 📁 카테고리

| # | 카테고리 | 범위 |
|:-:|---------|------|
| 01 | [Linux](linux/index.md) | 커널, cgroups, namespaces, 보안, 성능 분석, eBPF |
| 02 | [Network](network/index.md) | TCP/IP, DNS, HTTP/2/3, TLS, BGP, VPN, CDN |
| 03 | [Container](container/index.md) | Docker, OCI, BuildKit, Podman, 런타임 비교 |
| 04 | [Kubernetes](kubernetes/index.md) | 아키텍처, 리소스, 스케줄링, Operator, 백업 |
| 05 | [IaC](iac/index.md) | Terraform, OpenTofu, Ansible, Crossplane, Pulumi |
| 06 | [CI/CD](cicd/index.md) | Jenkins, GHA, GitLab CI, Tekton, DORA |
| 07 | [GitOps](gitops/index.md) | ArgoCD, Flux, Argo Rollouts, Secret GitOps |
| 08 | [Observability](observability/index.md) | Prometheus, OpenTelemetry, Profiling, eBPF |
| 09 | [Security](security/index.md) | DevSecOps, Zero Trust, 공급망, 정책, 컴플라이언스 |
| 10 | [SRE](sre/index.md) | SLO, Postmortem, Toil, 카오스, Runbook |
| 11 | [Platform Engineering](platform-engineering/index.md) | IDP, Backstage, Golden Path, DevEx |
| 12 | [FinOps](finops/index.md) | 비용 가시화, 최적화, Kubecost, 지속가능성 |

---

## 이 위키의 원칙

- **글로벌 스탠다드**: CNCF, 공식 문서, Google SRE Book, Accelerate 기준
- **중립성**: 특정 벤더·클라우드에 편향되지 않음
- **프로덕션 깊이**: 튜토리얼이 아닌 실무 깊이
- **왜·언제 쓰면 안 되는가**: How만이 아닌 Why와 When Not To 포함
- **최신성**: 학습 데이터 컷오프 이후는 글로벌 리서치로 보완

---

## 운영 방식

이 위키는 Obsidian vault로 작성하고, LLM(Claude)이 리서치·작성·검수한다.
자세한 운영 규칙은 저장소 루트의 `CLAUDE.md`를 참조.
