---
title: "컨테이너 레지스트리 (Docker Hub, Harbor, 클라우드)"
date: 2026-04-13
tags:
  - container
  - registry
  - docker-hub
  - harbor
  - ecr
  - security
sidebar_label: "컨테이너 레지스트리"
---

# 컨테이너 레지스트리

## 1. 레지스트리 개념

컨테이너 이미지를 저장, 관리, 배포하는 서버다.

```
개발자 → docker push → 레지스트리
                           ↓ docker pull
                       서버/K8s 클러스터
```

---

## 2. 주요 레지스트리 비교

| 레지스트리 | 유형 | 특징 | 비용 |
|-----------|------|------|------|
| Docker Hub | SaaS | 가장 널리 사용, rate limit 있음 | 무료/유료 |
| Harbor | 온프레미스 | 엔터프라이즈 기능, CNCF Graduated | 오픈소스 |
| AWS ECR | 클라우드 | AWS 통합, IAM 인증 | 사용량 기반 |
| GCP Artifact Registry | 클라우드 | GCP 통합, 멀티 포맷 | 사용량 기반 |
| Azure ACR | 클라우드 | Azure 통합 | 사용량 기반 |
| GitHub Container Registry | SaaS | GitHub Actions 통합 | 무료/유료 |

---

## 3. Docker Hub

```bash
# 로그인
docker login

# 이미지 태깅 및 푸시
docker tag myapp:1.0.0 myusername/myapp:1.0.0
docker push myusername/myapp:1.0.0

# 조직 레포지토리
docker tag myapp:1.0.0 myorg/myapp:1.0.0
docker push myorg/myapp:1.0.0
```

### Rate Limit (2026년 기준)

| 계정 유형 | Rate Limit |
|---------|-----------|
| 익명 | 100 pulls / 6시간 / IP |
| 무료 인증 | 200 pulls / 6시간 |
| Pro/Team | 무제한 |

> CI/CD에서 Docker Hub rate limit를 피하려면
> 인증 후 pull하거나, 미러 레지스트리를 설정하라.

---

## 4. Harbor (온프레미스 엔터프라이즈)

CNCF Graduated 프로젝트. 기업 내부 레지스트리로 가장 많이 사용된다.

```bash
# Helm으로 설치
helm repo add harbor https://helm.goharbor.io
helm install harbor harbor/harbor \
  --namespace harbor \
  --set expose.tls.enabled=true \
  --set externalURL=https://harbor.example.com
```

**주요 기능:**

| 기능 | 설명 |
|------|------|
| 취약점 스캔 | Trivy/Clair 내장 |
| 이미지 복제 | 다른 레지스트리로 동기화 |
| 콘텐츠 신뢰 | Notary 서명 |
| Robot 계정 | CI/CD 전용 계정 |
| 웹훅 | 이벤트 기반 자동화 |
| Proxy Cache | Docker Hub 미러 |

---

## 5. 클라우드 레지스트리

### AWS ECR

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS \
    --password-stdin \
    123456789012.dkr.ecr.ap-northeast-2.amazonaws.com

# 이미지 태깅 및 푸시
docker tag myapp:1.0.0 \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:1.0.0
docker push \
  123456789012.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:1.0.0
```

### 클라우드 레지스트리 비교

| 항목 | AWS ECR | GCP Artifact Registry | Azure ACR |
|------|---------|---------------------|-----------|
| 인증 | IAM | Google IAM | Azure AD |
| 취약점 스캔 | Enhanced Scanning | Artifact Analysis | Defender |
| 지역 복제 | 수동 | 자동 | 자동 (Geo-replication) |
| OCI 아티팩트 | 지원 | 지원 | 지원 |

---

## 6. 이미지 태깅 전략

```bash
# 나쁜 예: latest 사용 (언제 어떤 버전인지 불명확)
docker tag myapp:latest myregistry/myapp:latest

# 좋은 예: 시맨틱 버저닝 + Git SHA
docker tag myapp myregistry/myapp:1.2.3
docker tag myapp myregistry/myapp:1.2
docker tag myapp myregistry/myapp:1
docker tag myapp myregistry/myapp:1.2.3-$(git rev-parse --short HEAD)

# CI에서 자동 태깅 (GitHub Actions)
# github.sha: 커밋 SHA
# github.ref_name: 브랜치/태그명
```

| 태그 패턴 | 예시 | 용도 |
|---------|------|------|
| 시맨틱 버전 | `1.2.3` | 릴리즈 |
| Git SHA | `1.2.3-abc1234` | 정확한 추적 |
| 브랜치 | `main-latest` | 최신 브랜치 빌드 |
| `latest` | `latest` | 지양 (불명확) |

---

## 7. 이미지 서명 (Cosign/Sigstore)

```bash
# Cosign 설치
brew install cosign

# 키 생성
cosign generate-key-pair

# 이미지 서명
cosign sign --key cosign.key myregistry/myapp:1.0.0

# 서명 검증
cosign verify --key cosign.pub myregistry/myapp:1.0.0

# 키리스 서명 (OIDC 기반, CI/CD 권장)
# GitHub Actions에서:
cosign sign --identity-token=$(
  curl -sLS -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
  "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=sigstore" \
  | jq -r .value) \
  myregistry/myapp:1.0.0
```

---

## 8. 미러 레지스트리 설정

Docker Hub rate limit 우회 및 내부망 환경을 위한 미러 설정.

```json
// /etc/docker/daemon.json
{
  "registry-mirrors": [
    "https://mirror.example.com"
  ]
}
```

```bash
# Harbor Proxy Cache 설정 (Docker Hub 미러)
# Harbor 관리 콘솔 → 레지스트리 → 신규 엔드포인트
# Provider: Docker Hub, Name: docker-hub-mirror
# → 프로젝트 생성 시 Proxy Cache 활성화
```

---

## 참고 문서

- [Harbor 공식 문서](https://goharbor.io/docs/)
- [AWS ECR 문서](https://docs.aws.amazon.com/ecr/latest/userguide/)
- [Cosign 문서](https://docs.sigstore.dev/cosign/overview/)
- [OCI Distribution Spec](https://github.com/opencontainers/distribution-spec)
