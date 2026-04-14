---
title: "GitOps의 4가지 원칙 (OpenGitOps)"
date: 2026-04-14
tags:
  - gitops
  - opengitops
  - cncf
sidebar_label: "GitOps 4원칙"
---

# GitOps의 4가지 원칙

CNCF OpenGitOps Working Group이 공인한 GitOps의 핵심 원칙.

## 1. 선언적 (Declarative)

원하는 상태를 코드로 표현한다.
"어떻게 배포하라"가 아닌 "이 상태가 되어야 한다"고 정의한다.

```yaml
# 명령형 (GitOps 아님)
kubectl scale deployment my-app --replicas=3

# 선언형 (GitOps)
spec:
  replicas: 3
```

도구: Kubernetes YAML, Helm Chart, Kustomize, Terraform

---

## 2. 버전화·불변 (Versioned & Immutable)

모든 변경사항이 Git에 기록된다.
이전 상태로 언제든 돌아갈 수 있다.

```
Git 커밋 = 배포 이력
→ 누가, 언제, 무엇을, 왜 변경했는지 추적
→ PR 리뷰 프로세스 = 배포 승인 프로세스
→ git revert = 즉시 롤백
```

---

## 3. 자동 반영 (Pulled Automatically)

에이전트가 Git을 지속적으로 감시하며 변경을 자동으로 적용한다.
수동 개입 없이 선언된 상태가 클러스터에 반영된다.

```
Git 변경 감지 (polling or webhook)
  → ArgoCD/Flux가 diff 계산
      → kubectl apply 자동 실행
          → 클러스터 상태 갱신
```

---

## 4. 지속적 조정 (Continuously Reconciled)

에이전트가 실제 상태와 선언된 상태를 **지속적으로 비교**하고,
차이(드리프트)가 생기면 자동으로 복구한다.

```
누군가 kubectl로 직접 변경
    → 에이전트가 즉시 감지 (OutOfSync)
        → Git 상태로 자동 복구 (selfHeal: true)
```

---

## 5. 4원칙 요약

| 원칙 | 핵심 | 실현 도구 |
|-----|------|---------|
| 선언적 | 상태를 코드로 표현 | K8s YAML, Helm, Kustomize |
| 버전화·불변 | Git이 변경 이력 보관 | Git, PR 리뷰 |
| 자동 반영 | Pull 방식 자동 적용 | ArgoCD, Flux |
| 지속적 조정 | 드리프트 자동 수정 | ArgoCD selfHeal, Flux prune |

---

## 참고 문서

- [OpenGitOps Principles](https://opengitops.dev/)
- [CNCF TAG App Delivery](https://github.com/cncf/tag-app-delivery)
