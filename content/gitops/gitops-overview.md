---
title: "GitOps란 무엇인가"
date: 2026-04-14
tags:
  - gitops
  - argocd
  - flux
  - deployment
sidebar_label: "GitOps 개요"
---

# GitOps란 무엇인가

## 1. 개요

Git을 인프라와 애플리케이션의 **단일 진실 소스(Single Source of Truth)**로 사용하는
운영 방식.

```
개발자 → Git commit/PR
    → GitOps 에이전트가 감지
        → 클러스터 상태를 Git에 맞게 자동 조정
```

---

## 2. OpenGitOps 4원칙 (CNCF 공인)

| 원칙 | 내용 |
|-----|------|
| **선언적 (Declarative)** | 원하는 상태를 코드로 표현 (YAML, Helm, Kustomize) |
| **버전화·불변 (Versioned & Immutable)** | Git이 변경 이력과 감사 추적 제공 |
| **자동 반영 (Pulled Automatically)** | 에이전트가 Git을 감시하며 변경을 자동 적용 |
| **지속적 조정 (Continuously Reconciled)** | 실제 상태와 선언된 상태를 지속적으로 동기화 |

---

## 3. Push vs Pull 배포 모델

### Push 모델 (전통적 CI/CD)

```
Git push
  → CI 파이프라인 실행
      → kubectl apply / helm upgrade
          → 클러스터 변경
```

| 항목 | 내용 |
|-----|------|
| 자격증명 | CI 서버에 클러스터 접근 자격증명 저장 |
| 드리프트 감지 | 없음 (변경 시 파이프라인 재실행 필요) |
| 감사 추적 | CI 로그 (불완전) |
| 보안 리스크 | CI 시스템 탈취 시 클러스터 접근 가능 |

### Pull 모델 (GitOps)

```
Git push
  → 클러스터 내 에이전트(ArgoCD/Flux)가 감지
      → 에이전트가 직접 kubectl apply
          → 클러스터 변경
```

| 항목 | 내용 |
|-----|------|
| 자격증명 | 클러스터 내부에만 존재 (외부 노출 없음) |
| 드리프트 감지 | 자동 (실시간 조정) |
| 감사 추적 | Git commit 이력 |
| 보안 | 외부에서 클러스터 직접 접근 불필요 |

---

## 4. 주요 이점

### 드리프트 자동 수정

```
누군가 kubectl로 직접 변경
    → ArgoCD/Flux가 즉시 감지
        → Git 상태로 자동 복구 (selfHeal)
```

### 즉각적인 롤백

```bash
# 이전 커밋으로 롤백
git revert HEAD
git push

# → 에이전트가 자동으로 이전 버전 재배포
```

### 감사 추적

```
모든 배포 = Git commit
→ 누가, 언제, 무엇을 변경했는지 추적
→ PR 리뷰 프로세스 적용 가능
```

---

## 5. GitOps 도구 비교

| 도구 | 유형 | UI | 특징 |
|-----|------|-----|------|
| **ArgoCD** | Pull 기반 | 풍부한 웹 UI | 사용하기 쉬움, 60% 시장 점유율 |
| **Flux** | Pull 기반 | CLI 중심 | 모듈식 툴킷, 인프라 자동화에 강점 |
| **Jenkins X** | Push+Pull | 있음 | 클라우드 네이티브 CI/CD 통합 |

---

## 6. GitOps 저장소 구조

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

## 참고 문서

- [OpenGitOps](https://opengitops.dev/)
- [CNCF GitOps Working Group](https://github.com/cncf/tag-app-delivery)
- [ArgoCD](https://argo-cd.readthedocs.io/)
- [Flux](https://fluxcd.io/)
