---
title: "보안 스캐닝 자동화 (CI/CD 통합)"
date: 2026-04-14
tags:
  - security-scanning
  - cicd
  - devsecops
  - automation
sidebar_label: "스캐닝 자동화"
---

# 보안 스캐닝 자동화 (CI/CD 통합)

## 1. 보안 스캐닝 계층

```
소스코드:
  SAST (정적 분석) → Semgrep, CodeQL
  의존성 취약점   → Snyk, OWASP Dependency Check

컨테이너 이미지:
  취약점 스캔    → Trivy, Grype
  서명 검증      → Cosign

IaC 코드:
  정책 검사      → Checkov, tfsec, conftest

런타임:
  동적 분석      → DAST (OWASP ZAP)
  행동 탐지      → Falco
```

---

## 2. GitHub Actions 풀 파이프라인

```yaml
name: Security Pipeline

on:
  push:
    branches: [main]
  pull_request:

jobs:
  # 1단계: SAST (소스코드 정적 분석)
  sast:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Semgrep SAST
      uses: semgrep/semgrep-action@v1
      with:
        config: >-
          p/owasp-top-ten
          p/kubernetes
          p/docker

    - name: CodeQL 분석
      uses: github/codeql-action/init@v3
      with:
        languages: go, python

  # 2단계: 의존성 취약점
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Trivy 의존성 스캔
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: fs
        scan-ref: .
        severity: CRITICAL,HIGH
        exit-code: 1

  # 3단계: IaC 정책 검사
  iac-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Checkov IaC 스캔
      uses: bridgecrewio/checkov-action@v12
      with:
        directory: ./terraform
        framework: terraform

    - name: Kyverno 매니페스트 검사
      run: |
        kyverno apply ./policies/ \
          --resource ./k8s/ --detailed-results

  # 4단계: 이미지 빌드 + 취약점 스캔
  image-scan:
    runs-on: ubuntu-latest
    needs: [sast, dependency-scan, iac-scan]
    permissions:
      packages: write
      id-token: write
      security-events: write

    steps:
    - uses: actions/checkout@v4

    - name: 이미지 빌드
      uses: docker/build-push-action@v6
      id: build
      with:
        push: true
        tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

    - name: Trivy 이미지 스캔
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
        severity: CRITICAL,HIGH
        exit-code: 1
        format: sarif
        output: trivy-results.sarif

    - name: SARIF 업로드 (GitHub Security)
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: trivy-results.sarif

    - name: Cosign 서명
      uses: sigstore/cosign-installer@v3

    - name: 이미지 서명
      run: |
        cosign sign --yes \
          ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
```

---

## 3. Semgrep 커스텀 규칙

```yaml
# .semgrep/rules.yaml
rules:
- id: hardcoded-secret
  patterns:
  - pattern: |
      password = "..."
  - pattern: |
      api_key = "..."
  message: "하드코딩된 시크릿 감지 — 환경변수 또는 Vault 사용"
  severity: ERROR
  languages: [python, go, javascript]

- id: k8s-privileged-container
  patterns:
  - pattern: |
      privileged: true
  message: "특권 컨테이너 설정 감지"
  severity: WARNING
  languages: [yaml]
```

---

## 4. DAST (동적 분석)

```yaml
# OWASP ZAP 자동 스캔
  dast:
    runs-on: ubuntu-latest
    needs: deploy-staging
    steps:
    - name: ZAP 기준 스캔
      uses: zaproxy/action-baseline@v0.12.0
      with:
        target: https://staging.example.com
        rules_file_name: .zap/rules.tsv
        fail_action: warn    # warn / true (실패 처리)
```

---

## 5. 스캔 결과 중앙화 (Dependency Track)

SBOM 기반으로 취약점을 지속 추적한다.

```yaml
# SBOM을 Dependency-Track으로 전송
    - name: Syft SBOM 생성
      run: |
        syft ghcr.io/${{ github.repository }}:${{ github.sha }} \
          -o cyclonedx-json > sbom.cdx.json

    - name: Dependency-Track 전송
      run: |
        curl -X POST \
          -H "X-Api-Key: ${{ secrets.DT_API_KEY }}" \
          -F "bom=@sbom.cdx.json" \
          https://dtrack.example.com/api/v1/bom
```

---

## 6. 스캔 게이트 기준

```
PR 차단 조건 (exit-code: 1):
  □ CRITICAL 취약점 1개 이상
  □ 하드코딩된 시크릿 감지
  □ 서명 없는 베이스 이미지 사용

경고 (warn, 머지는 허용):
  □ HIGH 취약점
  □ IaC 정책 위반 (비 필수)
  □ DAST 낮은 등급 발견

수동 검토 필요:
  □ 예외 처리된 취약점 (.trivyignore)
  □ 새로운 의존성 추가
```

---

## 7. 보안 대시보드

```bash
# Grafana에서 스캔 결과 시각화
# Prometheus 메트릭 수집 (Trivy Operator)

kubectl apply -f \
  https://raw.githubusercontent.com/aquasecurity/trivy-operator/main/deploy/helm/trivy-operator/

# VulnerabilityReport CRD
kubectl get vulnerabilityreports -A
kubectl get configauditreports -A
```

---

## 참고 문서

- [Semgrep](https://semgrep.dev/docs/)
- [Trivy Operator](https://aquasecurity.github.io/trivy-operator/)
- [OWASP ZAP](https://www.zaproxy.org/docs/)
- [Dependency-Track](https://docs.dependencytrack.org/)
