---
title: "Push vs Pull 배포 모델"
date: 2026-04-14
tags:
  - gitops
  - deployment
  - cicd
sidebar_label: "Push vs Pull"
---

# Push vs Pull 배포 모델

## 1. Push 모델 (전통적 CI/CD)

```
Git push
  → CI 파이프라인 실행
      → kubectl apply / helm upgrade
          → 클러스터 변경
```

CI 서버가 클러스터에 **직접 접근**해서 배포한다.

| 항목 | 내용 |
|-----|------|
| 자격증명 | CI 서버에 클러스터 접근 자격증명 저장 |
| 드리프트 감지 | 없음 (변경 시 파이프라인 재실행 필요) |
| 감사 추적 | CI 로그 (불완전) |
| 보안 리스크 | CI 시스템 탈취 시 클러스터 접근 가능 |

---

## 2. Pull 모델 (GitOps)

```
Git push
  → 클러스터 내 에이전트(ArgoCD/Flux)가 감지
      → 에이전트가 직접 kubectl apply
          → 클러스터 변경
```

에이전트가 클러스터 **안에서** Git을 감시한다.
외부에서 클러스터에 접근할 필요가 없다.

| 항목 | 내용 |
|-----|------|
| 자격증명 | 클러스터 내부에만 존재 (외부 노출 없음) |
| 드리프트 감지 | 자동 (실시간 조정) |
| 감사 추적 | Git commit 이력 |
| 보안 | 외부에서 클러스터 직접 접근 불필요 |

---

## 3. 모델 비교

| 항목 | Push 모델 | Pull 모델 (GitOps) |
|-----|----------|------------------|
| 배포 권한 위치 | CI 서버 (외부) | 클러스터 내 에이전트 |
| 자격증명 노출 | CI 환경변수/시크릿 | 없음 |
| 드리프트 감지 | 수동 | 자동 |
| 오프라인 복원력 | 낮음 | 높음 (에이전트가 주기적 재조정) |
| 적합 규모 | 소규모, 단순 파이프라인 | 중대형, 멀티 클러스터 |

---

## 4. 하이브리드 패턴

실무에서는 두 모델을 혼합해서 사용하기도 한다.

```
CI (Push): 빌드 → 테스트 → 이미지 레지스트리 푸시
                              ↓
                   이미지 태그를 GitOps 저장소에 커밋
                              ↓
CD (Pull): ArgoCD/Flux가 변경 감지 → 클러스터 반영
```

CI는 코드를 빌드·검증하고,
CD는 GitOps Pull 방식으로 안전하게 배포한다.

---

## 참고 문서

- [OpenGitOps 4 원칙](https://opengitops.dev/)
- [ArgoCD vs Jenkins (Push vs Pull)](https://argo-cd.readthedocs.io/)
