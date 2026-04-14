---
title: "이미지 취약점 스캔 (Trivy, Grype)"
date: 2026-04-14
tags:
  - trivy
  - grype
  - security
  - container
sidebar_label: "이미지 스캔"
---

# 이미지 취약점 스캔 (Trivy, Grype)

## 1. 컨테이너 이미지 취약점

```
이미지 레이어:
  베이스 이미지 (ubuntu, alpine 등)   ← CVE 발생 가능
      + OS 패키지 (apt, apk 설치)      ← CVE 발생 가능
          + 앱 의존성 (npm, pip, etc.) ← CVE 발생 가능
              + 앱 코드
```

CVE(Common Vulnerabilities and Exposures): 공개된 보안 취약점.
이미지 스캔 도구는 이 취약점 데이터베이스와 이미지를 대조한다.

---

## 2. Trivy

Aqua Security에서 개발한 종합 보안 스캐너.
CNCF 프로젝트.

### 기본 스캔

```bash
# 이미지 스캔
trivy image nginx:latest

# 심각도 필터 (HIGH, CRITICAL만)
trivy image --severity HIGH,CRITICAL nginx:latest

# CRITICAL 발견 시 exit code 1 (CI 빌드 실패)
trivy image --exit-code 1 --severity CRITICAL myapp:latest

# 파일시스템 스캔 (로컬 코드)
trivy fs ./

# 의존성 스캔 (package.json, requirements.txt 등)
trivy fs --scanners vuln .

# Kubernetes 클러스터 전체 스캔
trivy k8s --report summary cluster
```

### 출력 형식

```bash
# JSON 출력 (CI 파이프라인용)
trivy image --format json --output results.json myapp:latest

# SARIF 형식 (GitHub Code Scanning 연동)
trivy image --format sarif --output trivy-results.sarif myapp:latest

# 테이블 (사람이 읽기 좋은 형식)
trivy image --format table myapp:latest
```

---

## 3. GitHub Actions 통합

```yaml
jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write    # SARIF 업로드 권한

    steps:
    - uses: actions/checkout@v4

    - name: Docker 빌드
      run: docker build -t myapp:${{ github.sha }} .

    - name: Trivy 스캔
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: 'myapp:${{ github.sha }}'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'HIGH,CRITICAL'
        exit-code: '1'

    # GitHub Security 탭에 결과 업로드
    - uses: github/codeql-action/upload-sarif@v3
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'
```

---

## 4. Grype

Anchore에서 개발한 경량 이미지 스캔 도구.

```bash
# 설치
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh \
  | sh -s -- -b /usr/local/bin

# 스캔
grype myapp:latest

# SBOM 파일 스캔
grype sbom:./sbom.json

# CRITICAL만 실패 처리
grype --fail-on critical myapp:latest
```

---

## 5. Trivy vs Grype 비교

| 항목 | Trivy | Grype |
|-----|-------|-------|
| 스캔 속도 | 빠름 | 빠름 |
| 취약점 DB | GitHub, NVD, OS 별 | NVD, GitHub |
| SBOM 생성 | 지원 | 별도 Syft 필요 |
| Kubernetes 스캔 | 지원 | 미지원 |
| CI/CD 통합 | 우수 | 우수 |
| 설정 유연성 | 높음 | 보통 |

---

## 6. 취약점 예외 처리 (.trivyignore)

실제로 영향이 없거나 허용된 취약점을 제외한다.

```
# .trivyignore
# 형식: CVE-ID [만료날짜] [이유]

# 영향 없는 취약점 (특정 기능 미사용)
CVE-2021-44228 exp:2026-12-31

# 아직 패치 없음, 추후 해결 예정
CVE-2023-12345
```

---

## 7. 레지스트리 통합

이미지 푸시 시 자동 스캔을 트리거한다.

```
ECR (AWS):
  → 이미지 푸시 → 자동 스캔 (Basic 또는 Enhanced with Inspector)
  → Console에서 취약점 목록 확인

Harbor (셀프 호스팅):
  → Trivy 내장 스캔
  → 취약점 초과 시 pull 차단 가능
```

---

## 참고 문서

- [Trivy 공식 문서](https://aquasecurity.github.io/trivy/)
- [Grype GitHub](https://github.com/anchore/grype)
- [CNCF Security Whitepaper](https://github.com/cncf/tag-security/blob/main/security-whitepaper/CNCF_cloud-native-security-whitepaper-May2022-v2.pdf)
