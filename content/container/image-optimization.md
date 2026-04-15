---
title: "이미지 경량화 전략"
date: 2026-04-13
tags:
  - container
  - docker
  - image
  - optimization
  - security
sidebar_label: "이미지 경량화"
---

# 이미지 경량화 전략

## 1. 베이스 이미지 선택

| 베이스 이미지 | 크기 | 특징 | 권장 상황 |
|------------|------|------|---------|
| `ubuntu:24.04` | ~78 MB | 풍부한 도구 | 개발/디버깅 |
| `debian:12-slim` | ~75 MB | 최소화된 Debian | 범용 |
| `alpine:3.21` | **~8 MB** | musl libc, busybox | 경량화 우선 |
| `distroless/static` | **~2 MB** | 셸 없음, 정적 바이너리 | Go, Rust |
| `distroless/base` | ~20 MB | glibc만 포함 | C/C++ |
| `distroless/java21` | ~130 MB | JRE 최소화 | Java |
| `distroless/python3` | ~50 MB | Python 런타임 | Python |
| `scratch` | **0 MB** | 완전 빈 이미지 | 정적 바이너리 |

```dockerfile
# Go 정적 바이너리 → scratch
FROM scratch
COPY --from=builder /app/server /server
ENTRYPOINT ["/server"]
```

---

## 2. Alpine 주의사항

```
Alpine 장점:
  - ~5.3 MB (ubuntu 대비 약 93% 작음)
  - 최소 공격 표면
  - apk 패키지 관리자

Alpine 단점:
  - musl libc (glibc와 다름)
    → Python, Java 일부 라이브러리 호환 문제
  - 일부 C 확장 모듈 재컴파일 필요
  - DNS 동작이 glibc와 다를 수 있음 (ndots 등)
```

```dockerfile
# Alpine에서 glibc 필요 패키지 설치
FROM alpine:3.21
RUN apk add --no-cache libc6-compat
```

---

## 3. distroless 이미지

셸, 패키지 관리자, 불필요한 바이너리가 없는 최소 이미지다.
공격 표면이 극도로 작다.

```dockerfile
# Node.js with distroless
# gcr.io/distroless → Artifact Registry로 이전됨
# 현재 권장 경로: gcr.io가 Artifact Registry로 프록시되어 동작
# 최신 경로는 https://github.com/GoogleContainerTools/distroless 확인
FROM gcr.io/distroless/nodejs20-debian12
COPY --from=builder /app /app
WORKDIR /app
CMD ["server.js"]

# Python with distroless
FROM gcr.io/distroless/python3-debian12
COPY --from=builder /app /app
WORKDIR /app
CMD ["app.py"]
```

> distroless는 셸이 없어 `docker exec` 접속 불가.
> 디버깅 시 `:debug` 태그(busybox 포함) 사용:
> `gcr.io/distroless/static-debian12:debug`

---

## 4. 패키지 최소화

```dockerfile
# apt: 추천 패키지 제외 + 캐시 제거
RUN apt update && apt install -y --no-install-recommends \
    curl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# apk: 캐시 비활성화
RUN apk add --no-cache curl ca-certificates

# yum/dnf: 캐시 제거
RUN dnf install -y curl && dnf clean all
```

---

## 5. dive로 이미지 레이어 분석

```bash
# 설치
brew install dive  # macOS

# Ubuntu/Debian: dive는 공식 APT 저장소에 없음 → .deb 직접 설치
DIVE_VERSION=$(curl -sL "https://api.github.com/repos/wagoodman/dive/releases/latest" \
  | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
curl -fOL "https://github.com/wagoodman/dive/releases/download/v${DIVE_VERSION}/dive_${DIVE_VERSION}_linux_amd64.deb"
sudo apt install ./dive_${DIVE_VERSION}_linux_amd64.deb

# 이미지 레이어 분석
dive myapp:latest

# CI에서 낭비 검사
dive --ci myapp:latest
# 낭비율이 임계값 초과 시 실패

# Docker 이미지 직접 빌드 후 분석
dive build -t myapp:latest .
```

dive에서 확인할 것:
- 각 레이어의 추가 크기
- 불필요하게 큰 레이어 식별
- 삭제 후에도 이전 레이어에 남은 파일

---

## 6. 이미지 취약점 스캔

```bash
# Trivy (오픈소스, 권장)
brew install trivy  # macOS
apt install trivy

# 이미지 스캔
trivy image nginx:1.27

# 고위험 이상만 표시
trivy image --severity HIGH,CRITICAL myapp:latest

# CI 파이프라인에서 빌드 후 자동 스캔
docker build -t myapp:latest .
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

```bash
# Docker Scout (Docker 내장)
docker scout cves myapp:latest
docker scout recommendations myapp:latest
```

---

## 7. 이미지 크기 최적화 체크리스트

```text
베이스 이미지:
  [ ] 목적에 맞는 최소 베이스 이미지 선택
  [ ] 태그 고정 (latest 금지)

빌드:
  [ ] 멀티스테이지 빌드로 빌드 도구 제외
  [ ] 정적 바이너리 언어(Go, Rust) → scratch/distroless

패키지:
  [ ] --no-install-recommends 사용
  [ ] 패키지 캐시 같은 RUN에서 삭제

레이어:
  [ ] RUN 명령 &&로 합치기 (레이어 최소화)
  [ ] .dockerignore로 불필요 파일 제외

검증:
  [ ] dive로 레이어 낭비 확인
  [ ] trivy로 취약점 스캔
  [ ] docker history로 크기 확인
```

---

## 참고 문서

- [distroless GitHub](https://github.com/GoogleContainerTools/distroless)
- [dive GitHub](https://github.com/wagoodman/dive)
- [Trivy 공식 문서](https://aquasecurity.github.io/trivy/)
- [Docker Scout](https://docs.docker.com/scout/)
