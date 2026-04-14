---
title: "DevSecOps란 무엇인가"
date: 2026-04-14
tags:
  - devsecops
  - security
  - devops
sidebar_label: "DevSecOps란"
---

# DevSecOps란 무엇인가

## 1. 개념

개발(Dev), 보안(Sec), 운영(Ops)의 통합.
보안을 소프트웨어 개발 수명주기(SDLC) 전체에 자동화하고 녹여넣는다.

```
전통적 접근:
  개발 → 테스트 → 보안 감사 → 배포
  (보안은 마지막에, 느리고 비쌈)

DevSecOps:
  코드 작성 → 보안 검사 자동화 → 빌드 → 스캔 → 배포
  (보안이 파이프라인 전체에 통합)
```

---

## 2. 왜 필요한가

```
문제:
  배포 직전에 보안 취약점 발견
  → 수정 비용 매우 높음 (전체 재설계 필요)
  → 출시 지연

DevSecOps 해결:
  코드 작성 시 즉시 발견
  → 수정 비용 낮음 (작은 변경)
  → 보안이 출시 속도를 늦추지 않음
```

취약점 발견 시점별 수정 비용:
- 개발 중: 1x
- QA 중: 10x
- 배포 후: 100x

---

## 3. DevSecOps 파이프라인

```
코드 커밋
  → SAST (정적 분석): 코드 내 취약점
  → SCA (의존성 스캔): 취약한 패키지
  → 시크릿 스캔: 하드코딩된 자격증명
  ↓
빌드·컨테이너
  → 이미지 스캔 (Trivy): CVE 취약점
  → 이미지 서명 (Cosign): 출처 검증
  ↓
배포·런타임
  → 정책 검사 (OPA/Kyverno): 보안 정책 준수
  → 런타임 탐지 (Falco): 이상 행동 감지
  → 지속적 컴플라이언스 스캔
```

---

## 4. 주요 보안 도구 생태계

| 단계 | 도구 | 역할 |
|-----|------|------|
| 코드 | Semgrep, CodeQL | SAST (정적 분석) |
| 의존성 | Snyk, Dependabot | SCA (취약한 패키지) |
| 시크릿 | GitLeaks, TruffleHog | 자격증명 노출 감지 |
| 이미지 | Trivy, Grype | 컨테이너 CVE 스캔 |
| 서명 | Cosign, Notary | 이미지 무결성 |
| 런타임 | Falco, Sysdig | 이상 행동 탐지 |
| 정책 | OPA, Kyverno | 배포 정책 강제 |
| 시크릿 관리 | Vault, External Secrets | 자격증명 안전 저장 |

---

## 5. 조직 문화 변화

```
기존:
  보안팀이 개발팀 결과물을 검사
  → 보안 = 장애물

DevSecOps:
  개발자가 직접 보안 책임
  보안팀은 가이드·도구 제공
  → 보안 = 개발 속도와 함께 가는 것
```

**Security Champion** 프로그램:
각 개발팀에 보안 전문 담당자를 두어
보안팀과 개발팀 사이 다리 역할을 수행한다.

---

## 참고 문서

- [OWASP DevSecOps Guideline](https://owasp.org/www-project-devsecops-guideline/)
- [CNCF Security Whitepaper](https://github.com/cncf/tag-security)
