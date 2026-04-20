---
title: "이미지 최적화 (레이어 · 멀티스테이지 · Distroless · Chainguard)"
sidebar_label: "이미지 최적화"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-20
tags:
  - container
  - dockerfile
  - multi-stage
  - distroless
  - chainguard
  - wolfi
---

# 이미지 최적화 (레이어 · 멀티스테이지 · Distroless · Chainguard)

"이미지가 1GB를 넘어요, 이게 정상인가요?" — **거의 항상 비정상**이다.
현대 프로덕션 이미지는 대부분 **10–100MB**로 낮출 수 있다.

이 글은 이미지 크기·공격 표면·빌드 시간을 동시에 줄이는 원칙을 다룬다:
레이어 전략, 멀티스테이지, base 이미지 선택(scratch·Alpine·Distroless·Chainguard),
그리고 2026 기준 **"Zero CVE 이미지"** 트렌드.

> BuildKit·캐시·SBOM은 [BuildKit 기본](./buildkit-basics.md).
> bit-identical 빌드는 [재현 가능 빌드](./reproducible-builds.md).

---

## 1. 최적화의 3가지 축

| 축 | 왜 중요 | 측정 |
|---|---|---|
| **크기** | pull 시간, 레지스트리 비용, 냉시동 | `docker images`, `dive`, `syft` |
| **공격 표면** | shell·패키지 매니저 없으면 exploit chain 차단 | `grype`, `trivy` |
| **빌드 시간** | 배포 속도, CI 비용 | `docker build --progress=plain` |

**세 축은 상관관계가 있다**: 작은 이미지 → 적은 공격 표면 + 빠른 pull.

---

## 2. 레이어의 기본 물리

### 2-1. Dockerfile 한 줄 = 한 레이어

```dockerfile
RUN apt-get update              # 레이어 1
RUN apt-get install -y curl     # 레이어 2
```

vs

```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/* # 레이어 1 (합쳐짐)
```

이유:
- 레이어는 **삭제를 못한다** — 이전 레이어에서 만든 파일은 다음 레이어에서 지워도 이미지에 남음
- `apt-get update` 캐시 파일이 중간 레이어에 **영구히 남는다** (분리 시)

### 2-2. 캐시 무효화 규칙

**한 레이어가 변경되면 이후 모든 레이어가 무효화**된다.

```dockerfile
# 나쁨
COPY . /app                              # 이게 매번 바뀜
RUN pip install -r /app/requirements.txt # 매번 재실행

# 좋음
COPY requirements.txt /app/
RUN pip install -r /app/requirements.txt # 의존성 안 바뀌면 캐시 히트
COPY . /app                              # 마지막에
```

### 2-3. .dockerignore 필수

`COPY . .`의 숨은 함정. 없으면 `.git`, `node_modules`, `.env`가 **이미지에 섞여 들어간다**.

```
.git
node_modules
.env*
*.log
coverage/
dist/
.DS_Store
```

---

## 3. 멀티스테이지 빌드 — 가장 강력한 무기

### 3-1. 기본 패턴

```dockerfile
# Stage 1: 빌드 (무거움)
FROM golang:1.26 AS build
WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app ./cmd/server

# Stage 2: 런타임 (가벼움)
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/app /app
USER 65532:65532
ENTRYPOINT ["/app"]
```

결과: **1GB(golang:1.26) → 10MB(바이너리 + distroless)**.

> **`USER nonroot` vs `USER 65532:65532`**: Kubernetes `runAsNonRoot: true` 검증은
> **숫자 UID**를 요구한다. 문자열 `nonroot`는 PodSecurity `restricted` 정책에서 거부되는
> 사례가 있어 **UID·GID 숫자 지정이 안전**하다.

### 3-2. 언어별 전략

| 언어 | 빌드 스테이지 | 런타임 스테이지 | 크기 |
|---|---|---|---|
| Go (CGO off) | `golang:1.26` | `scratch` 또는 `distroless/static-debian13` | **5–20MB** |
| Rust | `rust:1.85` | `distroless/cc-debian13` 또는 `debian:trixie-slim` | 15–40MB |
| Java (GraalVM native) | `ghcr.io/graalvm/native-image` | `distroless/base-debian13` | 30–80MB |
| Java (JRE) | `eclipse-temurin:21-jdk` | Chainguard JRE 또는 `eclipse-temurin:21-jre-alpine` | 150–300MB |
| Node.js (LTS) | `node:24` | `gcr.io/distroless/nodejs24-debian13` | 150–250MB |
| Python | `python:3.13` | `gcr.io/distroless/python3-debian13` | 50–150MB |

> **Node.js 20은 2026-04-30 EOL**. 신규 프로젝트는 **Node 22 LTS 또는 24 LTS**로 시작하라.
> **Go 1.23·1.24도 공식 지원 중단**이 가까움 — 1.25/1.26 권장.

**Python 주의**: `pip install`이 C 확장 빌드하면 런타임에 **glibc·libstdc++** 필요 → `scratch` 불가.
`distroless/python3` 또는 `python:3.12-slim` 권장.

### 3-3. BuildKit의 최적화

BuildKit은 **target 스테이지만 실행**한다. 여러 산출물을 `bake`로 병렬 빌드.

```bash
docker buildx build --target build-only .   # 테스트 스테이지만
docker buildx build --target prod .         # 프로덕션만
```

---

## 4. Base 이미지 선택 — 4갈래

### 4-1. 비교

| Base | 크기 | shell | 패키지 매니저 | 공격 표면 | 언제 |
|---|---|---|---|---|---|
| `scratch` | **0 byte** | ❌ | ❌ | 최소 | Go·Rust 정적 바이너리 |
| `gcr.io/distroless/static-debian13` | ~2MB | ❌ | ❌ | 최소 | Go 정적, CA 필요 |
| `gcr.io/distroless/base-debian13` | ~20MB | ❌ | ❌ | 낮음 | glibc·libssl 필요 |
| `cgr.dev/chainguard/static` | ~2MB | ❌ | ❌ | 최소 | **알려진 CVE 거의 0 유지** |
| `alpine:3.22` | ~5MB | ✅ `sh` | ✅ apk | 중간 | 작고 디버깅 가능 |
| `debian:trixie-slim` | ~80MB | ✅ | ✅ apt | 중간 | 호환성 우선 |
| `ubuntu:24.04` | ~80MB | ✅ | ✅ | 중간 | 익숙함, 라이선스 |
| `registry.access.redhat.com/ubi9/ubi-micro` | ~30MB | ❌ | ❌ | 낮음 | 엔터프라이즈 |

> 2026-04 기준 Debian 13 "trixie"가 stable, Alpine 3.22가 최신 stable.
> distroless는 `-debian13` 태그로 전환 중 — `-debian12`는 2026 하반기까지 유지.

### 4-2. Alpine의 함정

Alpine은 **musl libc**를 쓴다. glibc 기반 바이너리·Python wheel이 동작하지 않는 경우가 있음.

| 언어 | Alpine 상태 |
|---|---|
| Go (CGO off) | ✅ 완전 호환 |
| Rust (musl target) | ✅ |
| Python wheel | ⚠️ manylinux wheel 미호환 → 소스 컴파일 느림 |
| Node.js | ⚠️ native 모듈 재컴파일 필요 |
| Java | ⚠️ 과거 이슈, 지금은 대부분 OK |

**Python·Node는 Alpine보다 Distroless·Chainguard가 낫다**는 게 2026 컨센서스.

### 4-3. Distroless — Google의 답

```
gcr.io/distroless/<언어>-<debian 버전>[:nonroot]
```

- **shell·패키지 매니저 없음** — exploit chain 끊김
- `:nonroot` 태그 — UID 65532
- `:debug` 태그 — busybox 포함 (디버깅용)

> **디버깅 팁**: 프로덕션은 `:nonroot`, 스테이징은 `:debug`로 한시적 사용.
> `kubectl debug --image=busybox`로 사이드카 접근도 가능.

### 4-4. Chainguard Images — "알려진 CVE 거의 0"

Chainguard가 만든 **Wolfi 리눅스** 기반. 일 단위 재빌드로 **알려진 CVE를 0에 가깝게 유지**한다
(스캐너·DB 갱신 타이밍상 영구 0은 아님 — 신규 CVE가 수 시간 존재 가능).

| 특징 | 내용 |
|---|---|
| OS | Wolfi (undistro, glibc) |
| 크기 | `-static` ~2MB, `-base` 10–30MB |
| 업데이트 | **야간 자동 재빌드** |
| 서명 | **Sigstore(cosign) 자동 서명** |
| SBOM | 모든 이미지에 SPDX 포함 |
| 라이선스 | Developer 태그(`:latest`) 무료 / 버전 pin·FIPS·LTS·Private은 **유료 구독** |

```dockerfile
FROM cgr.dev/chainguard/go:latest AS build
...
FROM cgr.dev/chainguard/static:latest
COPY --from=build /out/app /app
```

**2026 트렌드**: Elastic·Datadog·많은 벤더가 **Chainguard 이미지로 베이스 전환** 중.
"CVE 0개 컨테이너" 조달 요구가 커지고 있음.

---

## 5. 레이어 크기 줄이기 — 체크리스트

### 5-1. 흔한 실수

| 실수 | 교정 |
|---|---|
| `RUN apt-get update; apt-get install X` 분리 | `&&`로 한 줄 + `rm -rf /var/lib/apt/lists/*` |
| `pip install` 후 wheel·cache 남김 | `--no-cache-dir` 플래그 |
| `npm install` 후 dev deps 포함 | `npm ci --omit=dev` 또는 멀티스테이지 |
| `RUN wget X; tar zxf X` 같은 줄 아님 | 한 `RUN`에서 받고 → 압축 해제 → 삭제 |
| `COPY node_modules` | `.dockerignore`로 차단, 빌드 단계에서 생성 |
| `ADD file.tar.gz` (자동 해제) | **`COPY` + `RUN tar`** 명시가 예측 가능 |

### 5-2. 진단 도구

```bash
# 레이어별 크기·변경사항
dive ghcr.io/org/app:v1

# 파일 목록·레이어 분석
docker history --no-trunc ghcr.io/org/app:v1

# SBOM으로 포함 패키지
syft ghcr.io/org/app:v1

# 취약점 스캔
grype ghcr.io/org/app:v1
trivy image ghcr.io/org/app:v1
```

`dive`는 각 레이어 낭비와 **efficiency 퍼센트**를 보여준다 — 목표는 **≥ 95%**.
공식 CI 임계값으로 `CI=true dive --ci --highestUserWastedPercent 0.1` 검증 가능.

**SBOM 포함 베이스 이미지**: Chainguard·UBI·최신 distroless 태그는 이미지에
**SPDX SBOM을 OCI artifact로 첨부**한다 — `cosign download sbom <image>` 또는
`docker buildx imagetools inspect --format "{{ json .SBOM }}"`로 pull 없이 조회 가능.

---

## 6. 안전한 최소 이미지 구성 예

### 6-1. Go 프로덕션 (distroless)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM golang:1.26 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -buildvcs=false \
        -ldflags="-s -w" -o /out/app ./cmd/server

FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=build /out/app /app
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/app"]
```

`-trimpath`·`-buildvcs=false`는 재현 가능 빌드의 기본 플래그
→ [재현 가능 빌드](./reproducible-builds.md).

### 6-2. Python 프로덕션 (chainguard)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM cgr.dev/chainguard/python:latest-dev AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --prefix=/install --no-cache-dir -r requirements.txt

FROM cgr.dev/chainguard/python:latest
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY --from=build /install /usr/
COPY app.py .
USER 65532:65532
ENTRYPOINT ["python", "/app.py"]
```

`PYTHONDONTWRITEBYTECODE=1`은 런타임에 `.pyc` 생성으로 이미지 쓰기 권한·팽창 방지.

### 6-3. Node 프로덕션 (distroless)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY . .

FROM gcr.io/distroless/nodejs24-debian13:nonroot
COPY --from=build /app /app
WORKDIR /app
USER 65532:65532
CMD ["server.js"]
```

---

## 7. 이미지 재빌드 주기 — "Drift"와의 싸움

### 7-1. 왜 주기적 재빌드

- Base 이미지의 **CVE 패치**가 upstream에 들어감
- 애플리케이션 코드가 안 바뀌어도 **베이스는 썩는다**
- 스캐너가 **한 달 뒤 Critical CVE를 보고**

### 7-2. 권장 주기 (3-track)

| 트랙 | 주기 | 내용 |
|---|---|---|
| 스캔 | **매일** | `trivy`·`grype`로 CVE 감지 |
| patch-only rebuild | **CVE 감지 즉시** | base 버전 고정, 패치만 |
| 전체 rebase | **주 1회** | base 이미지 최신 태그로 갱신 |

금요일 배포 금지 원칙과 병행하면 목요일 rebase가 일반적.

### 7-3. 자동화

- Renovate·Dependabot으로 **base 이미지 해시 핀** 업데이트 PR 자동 생성
- Chainguard 이미지는 **자동 재빌드** (야간)
- SLSA 체인은 재빌드마다 provenance 갱신 필요

---

## 8. 실무 체크리스트

- [ ] `.dockerignore`로 `.git`·`.env`·`node_modules` 제외
- [ ] 멀티스테이지로 빌드·런타임 분리
- [ ] Base는 **distroless·chainguard·alpine** 중 하나 — `ubuntu:latest` 금지
- [ ] `USER 65532:65532` 형식으로 **숫자 UID** 지정 (K8s PodSecurity 호환)
- [ ] 패키지 설치 후 `apt` 캐시 정리, `--no-cache-dir`
- [ ] `dive`로 efficiency ≥ 95% 유지 (낭비 5% 이하)
- [ ] `trivy image`로 Critical CVE 0개 확인
- [ ] Renovate·Dependabot으로 base 이미지 자동 갱신
- [ ] **매일 스캔 + CVE 감지 시 즉시 rebuild + 주 1회 전체 rebase** 3-track

---

## 9. 이 카테고리의 경계

- **BuildKit 기능·캐시·시크릿** → [BuildKit 기본](./buildkit-basics.md)
- **bit-identical 재현 빌드** → [재현 가능 빌드](./reproducible-builds.md)
- **cosign 서명·취약점 정책** → `security/supply-chain/`
- **레지스트리 취약점 스캐닝** → [레지스트리 비교](../registry/registry-comparison.md)

---

## 참고 자료

- [Docker — Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Google Distroless (GitHub)](https://github.com/GoogleContainerTools/distroless)
- [Chainguard Images — Overview](https://edu.chainguard.dev/chainguard/chainguard-images/overview/)
- [Chainguard — Minimal container images](https://www.chainguard.dev/unchained/minimal-container-images-towards-a-more-secure-future)
- [dive — Docker layer inspector](https://github.com/wagoodman/dive)
- [Elastic — Reducing CVEs in Elastic container images](https://www.elastic.co/blog/reducing-cves-in-elastic-container-images)

(최종 확인: 2026-04-20)
