---
title: "CI/CD 개요와 배포 전략"
date: 2026-04-14
tags:
  - cicd
  - deployment
  - blue-green
  - canary
  - branching
sidebar_label: "CI/CD 개요"
---

# CI/CD 개요와 배포 전략

## 1. CI / CD 구분

| 단계 | 의미 | 특징 |
|-----|------|------|
| **CI** (Continuous Integration) | 코드 통합 자동화 | 빌드·테스트 자동 실행 |
| **CD** (Continuous Delivery) | 배포 준비 자동화 | 인간이 최종 배포 승인 |
| **CD** (Continuous Deployment) | 배포까지 자동화 | 모든 단계 무인 운전 |

```
코드 push
  → CI: 빌드 + 테스트 + 정적 분석
    → Continuous Delivery: 스테이징 자동 배포
      → 사람이 승인
        → Continuous Deployment: 프로덕션 자동 배포
```

---

## 2. 무중단 배포 전략

### Rolling Update

구버전 Pod를 하나씩 신버전으로 교체한다.

```
v1 v1 v1 v1
→ v1 v1 v1 v2
→ v1 v1 v2 v2
→ v1 v2 v2 v2
→ v2 v2 v2 v2
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | 최소 (기존 노드 재사용) |
| 롤백 속도 | 느림 (전체 재전환 필요) |
| 다운타임 | 없음 |
| 쿠버네티스 기본값 | ✓ |

---

### Blue/Green 배포

구버전(Blue)과 신버전(Green) 환경을 동시에 운영 후
트래픽을 한 번에 전환한다.

```
Load Balancer
    ↓ 100% 트래픽
  [Blue] v1     [Green] v2 (준비 완료)
                        ↓
              트래픽 전환 (1분 이내)
Load Balancer
              ↓ 100% 트래픽
  [Blue] v1   [Green] v2
(대기, 롤백용)
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | +100% (두 환경 필요) |
| 롤백 속도 | 1분 이내 |
| 다운타임 | 없음 |
| 적합 케이스 | DB 마이그레이션, 전환 전 테스트 |

---

### Canary 배포

소수의 사용자에게 먼저 신버전을 노출해 검증한다.

```
전체 트래픽 → v1 (95%) + v2 (5%)
메트릭 정상 → v1 (75%) + v2 (25%)
메트릭 정상 → v1 (50%) + v2 (50%)
메트릭 정상 → v2 (100%)
```

| 항목 | 값 |
|-----|---|
| 인프라 비용 | 최소 |
| 롤백 속도 | 즉시 (트래픽 0%로) |
| 실제 트래픽 검증 | ✓ |
| 필요 도구 | 서비스 메시 또는 Ingress 가중치 |

---

### 전략 비교

| 전략 | 비용 | 롤백 | 리스크 | 적합 케이스 |
|-----|------|------|--------|----------|
| Rolling | 낮음 | 보통 | 보통 | 일반적인 앱 |
| Blue/Green | 높음 | 빠름 | 낮음 | 즉시 롤백 필요 |
| Canary | 낮음 | 빠름 | 낮음 | 사용자 검증 필요 |

---

## 3. 브랜치 전략

### GitFlow

```
main ─────────────────────────────────
       ↑ merge         ↑ hotfix
develop ──────────────────────────────
   ↑ feature    ↑ feature
feature/A      feature/B
```

- `main`: 프로덕션 코드
- `develop`: 다음 릴리즈 통합 브랜치
- `feature/*`: 기능 개발
- `release/*`: 릴리즈 준비
- `hotfix/*`: 긴급 패치

**적합**: 주기적 릴리즈, 여러 버전 동시 관리

---

### Trunk-Based Development (TBD)

```
main ─────────────────────────────────
    ↑1일  ↑1일  ↑1일  ↑1일
  feat/A feat/B feat/C feat/D
```

- 단일 브랜치(`main`) 항상 배포 가능 상태 유지
- 기능 브랜치는 1~2일 이내 병합
- 미완성 기능은 **Feature Flag**로 숨김
- 2025년 트렌드: 지속적 배포의 사실상 표준

**적합**: 높은 배포 빈도, CI/CD 성숙 팀

---

### Feature Flag

브랜치 전략과 무관하게 기능 출시를 코드로 제어한다.

```python
if feature_flags.is_enabled("new-checkout-flow", user):
    return new_checkout()
else:
    return legacy_checkout()
```

- 배포와 릴리즈 분리
- A/B 테스트
- 긴급 롤백 (코드 배포 없이)

---

## 4. 2025-2026 트렌드

| 트렌드 | 내용 |
|-------|------|
| AI 기반 최적화 | 위험한 변경 감지, 테스트 선택 자동화 |
| Progressive Delivery | Feature Flag + Canary 결합 |
| Shift-left Security | 파이프라인에 취약점 스캔 내장 |
| GitOps | ArgoCD/Flux로 배포 선언화 |
| OIDC | 장기 자격증명 없이 클라우드 인증 |

---

## 참고 문서

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Jenkins 공식 문서](https://www.jenkins.io/doc/)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
