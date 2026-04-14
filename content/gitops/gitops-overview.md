---
title: "GitOps란 무엇인가"
date: 2026-04-14
tags:
  - gitops
  - devops
  - deployment
sidebar_label: "GitOps란"
---

# GitOps란 무엇인가

Git을 인프라와 애플리케이션의
**단일 진실 소스(Single Source of Truth)**로 사용하는 운영 방식.

## 1. 핵심 개념

```
개발자 → Git commit/PR
    → GitOps 에이전트가 감지
        → 클러스터 상태를 Git에 맞게 자동 조정
```

기존 CI/CD와 달리, **배포 권한이 클러스터 외부에 없다.**
에이전트(ArgoCD, Flux)가 클러스터 안에서 Git을 감시하며 스스로 동기화한다.

---

## 2. GitOps가 해결하는 문제

| 문제 | GitOps 해결 방법 |
|-----|---------------|
| 누가 언제 배포했는지 모름 | 모든 배포 = Git commit (감사 추적) |
| 직접 kubectl로 변경 후 원인 불명 | 드리프트 자동 감지·복구 |
| 롤백이 복잡하고 위험 | `git revert` 한 줄로 즉시 롤백 |
| CI 서버에 클러스터 자격증명 노출 | Pull 모델로 자격증명 내부화 |

---

## 3. GitOps 저장소 구조

```
gitops-repo/
├── apps/              # 애플리케이션 매니페스트
│   ├── frontend/
│   │   ├── base/
│   │   └── overlays/
│   └── backend/
├── infrastructure/    # 인프라 설정
│   ├── monitoring/
│   └── ingress/
└── clusters/          # 클러스터별 설정
    ├── staging/
    └── production/
```

---

## 4. 주요 GitOps 도구

| 도구 | 유형 | UI | 특징 |
|-----|------|-----|------|
| **ArgoCD** | Pull 기반 | 풍부한 웹 UI | 사용성 높음, ~60% 점유율 |
| **Flux** | Pull 기반 | CLI 중심 | 모듈식, 인프라 자동화에 강점 |
| **Jenkins X** | Push+Pull | 있음 | 클라우드 네이티브 CI/CD 통합 |

---

## 참고 문서

- [OpenGitOps](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery)
