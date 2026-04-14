---
title: "Shift-Left 보안"
date: 2026-04-14
tags:
  - security
  - devsecops
  - shift-left
sidebar_label: "Shift-Left 보안"
---

# Shift-Left 보안

## 1. 개념

보안 검사를 개발 수명주기의 **왼쪽(초기)**으로 이동하는 전략.

```
왼쪽 (이른 단계)          오른쪽 (늦은 단계)
─────────────────────────────────────────────→
설계 → 코딩 → 빌드 → 테스트 → 배포 → 운영

전통: 배포 전 보안 검사
Shift-Left: 코딩 단계부터 보안 검사
```

---

## 2. 각 단계별 보안 활동

### 설계 단계

```
- Threat Modeling (위협 모델링)
  → 시스템 설계 시 공격 시나리오 식별
  → STRIDE 방법론: Spoofing, Tampering, Repudiation,
    Information Disclosure, DoS, Elevation of Privilege
- 보안 요구사항 정의
- 인증·인가 설계
```

### 코딩 단계

```
- IDE 플러그인으로 실시간 취약점 감지
  (Snyk IDE, SonarLint, Semgrep)
- 시크릿 하드코딩 금지 (환경 변수 사용)
- Secure Coding Guidelines 준수
- 코드 리뷰 시 보안 체크리스트
```

### 빌드 단계

```
- SAST (정적 분석): Semgrep, CodeQL, SonarQube
- SCA (의존성 스캔): Snyk, OWASP Dependency-Check
- 시크릿 스캔: GitLeaks, TruffleHog
- 이미지 빌드 시 취약점 스캔: Trivy
```

---

## 3. CI/CD에서 자동화

```yaml
# .github/workflows/security.yaml
name: Security Scan

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Semgrep SAST
      uses: returntocorp/semgrep-action@v1
      with:
        config: p/owasp-top-ten

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Snyk SCA
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  secret-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0
    - name: GitLeaks
      uses: gitleaks/gitleaks-action@v2
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  container-scan:
    runs-on: ubuntu-latest
    steps:
    - name: Trivy 이미지 스캔
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'myapp:${{ github.sha }}'
        severity: HIGH,CRITICAL
        exit-code: 1    # CRITICAL 발견 시 빌드 실패
```

---

## 4. 취약점 우선순위

모든 취약점을 즉시 수정할 수 없다. 우선순위 기준:

| 기준 | High Priority | Low Priority |
|-----|--------------|-------------|
| CVSS 점수 | Critical(9~10), High(7~8) | Medium 이하 |
| 공격 가능성 | 외부 노출 서비스 | 내부 전용 |
| 익스플로잇 존재 | 이미 PoC 공개 | 이론적 취약점 |
| 데이터 영향 | 개인정보·자격증명 | 비민감 데이터 |

---

## 5. 개발자 보안 교육

```
핵심 교육 주제:
  □ OWASP Top 10 (웹 취약점 기본)
  □ Secure Coding for 사용 언어
  □ 의존성 관리 및 업데이트
  □ 시크릿 관리 (Vault, 환경변수)
  □ 컨테이너 보안 기본
  □ 피싱·소셜 엔지니어링 인식
```

---

## 참고 문서

- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [STRIDE Threat Modeling](https://learn.microsoft.com/en-us/security/develop/threat-modeling-aiml)
