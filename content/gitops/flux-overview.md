---
title: "Flux 소개와 ArgoCD 비교"
date: 2026-04-14
tags:
  - flux
  - argocd
  - gitops
  - cncf
sidebar_label: "Flux 소개·비교"
---

# Flux 소개와 ArgoCD 비교

## 1. Flux 개요

CNCF Graduated 프로젝트.
**GitOps Toolkit**이라는 모듈식 컨트롤러 집합으로 구성된다.

```
Flux GitOps Toolkit
├── source-controller       Git/Helm/OCI 소스 감시·캐시
├── kustomize-controller    Kustomization CR 처리
├── helm-controller         HelmRelease CR 처리
├── notification-controller 알림·웹훅
└── image-automation        이미지 업데이트 자동화
```

각 컨트롤러가 독립적으로 동작하여 필요한 것만 사용할 수 있다.

---

## 2. ArgoCD vs Flux 비교

| 항목 | ArgoCD | Flux |
|-----|--------|------|
| 아키텍처 | 단일 애플리케이션 | GitOps Toolkit (모듈식) |
| Web UI | 풍부한 대시보드 | 없음 (CLI 중심) |
| 설정 방식 | ArgoCD CRD | Flux CRD |
| 멀티 테넌시 | AppProject | Kustomization 경로 분리 |
| Helm 지원 | Application.spec.source | HelmRelease CRD |
| Kustomize 지원 | 기본 내장 | kustomize-controller |
| 이미지 업데이트 | Image Updater (별도 설치) | image-automation (기본) |
| OCI 레지스트리 | 지원 | 기본 지원 (OCIRepository) |
| 학습 곡선 | 낮음 (UI 덕분) | 보통 (YAML 중심) |
| CNCF 상태 | Graduated | Graduated |
| 시장 점유율 | ~60% | ~30% |

---

## 3. 언제 무엇을 선택하는가

### ArgoCD를 선택할 때

- 개발팀이 배포 상태를 직접 UI에서 확인해야 할 때
- 여러 팀이 앱별로 독립적으로 배포를 관리해야 할 때
- ApplicationSet으로 대규모 마이크로서비스 관리가 필요할 때
- Argo Rollouts와 연동한 고급 배포 전략이 필요할 때

### Flux를 선택할 때

- 인프라 자동화 중심 (클러스터 자체를 GitOps로 관리)
- Helm 릴리즈를 선언적으로 세밀하게 관리해야 할 때
- OCI 레지스트리를 GitOps 소스로 사용할 때
- Platform Engineering: 여러 클러스터를 단일 저장소로 관리

### 함께 사용하는 경우

```
Flux (인프라 레이어)
  → 클러스터 부트스트랩
  → ArgoCD 자체 설치 관리
  → 공통 인프라 (모니터링, 보안)
      ↓
  ArgoCD (애플리케이션 레이어)
    → 앱 배포 관리
    → 팀별 AppProject
```

---

## 4. 멀티 클러스터 관리 패턴 비교

### Flux (단일 저장소 패턴)

```
fleet-infra/
├── clusters/
│   ├── production/
│   │   ├── flux-system/
│   │   └── apps/
│   └── staging/
│       ├── flux-system/
│       └── apps/
└── infrastructure/
    ├── monitoring/
    └── ingress/
```

### ArgoCD (ApplicationSet 패턴)

```yaml
# 클러스터 레이블로 자동 배포
generators:
- clusters:
    selector:
      matchLabels:
        environment: production
```

---

## 참고 문서

- [Flux 공식 문서](https://fluxcd.io/flux/)
- [ArgoCD 공식 문서](https://argo-cd.readthedocs.io/)
- [CNCF Landscape GitOps](https://landscape.cncf.io/gitops)
