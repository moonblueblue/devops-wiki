---
title: "Dockerfile 작성과 베스트 프랙티스"
date: 2026-04-13
tags:
  - container
  - docker
  - dockerfile
  - best-practices
sidebar_label: "Dockerfile"
---

# Dockerfile 작성과 베스트 프랙티스

## 1. 주요 인스트럭션

| 인스트럭션 | 용도 |
|-----------|------|
| `FROM` | 베이스 이미지 지정 |
| `RUN` | 빌드 시 명령 실행 (레이어 생성) |
| `COPY` | 파일/디렉토리 복사 |
| `ADD` | COPY + URL 다운로드 + tar 자동 압축 해제 |
| `CMD` | 컨테이너 기본 실행 명령 (재정의 가능) |
| `ENTRYPOINT` | 컨테이너 진입점 (재정의 어려움) |
| `ENV` | 환경 변수 설정 |
| `ARG` | 빌드 시 변수 (런타임에 없음) |
| `EXPOSE` | 문서화용 포트 명시 |
| `WORKDIR` | 작업 디렉토리 설정 |
| `USER` | 실행 사용자 변경 |
| `HEALTHCHECK` | 컨테이너 상태 확인 |
| `LABEL` | 메타데이터 추가 |

---

## 2. CMD vs ENTRYPOINT

| 항목 | CMD | ENTRYPOINT |
|------|-----|-----------|
| 재정의 | `docker run` 인수로 재정의 가능 | `--entrypoint` 플래그 필요 |
| 용도 | 기본 명령, 인수 | 고정 진입점 |
| 조합 | ENTRYPOINT의 기본 인수로 사용 | |

```dockerfile
# CMD만 사용 (명령 전체 재정의 가능)
CMD ["nginx", "-g", "daemon off;"]

# ENTRYPOINT만 사용 (고정 진입점)
ENTRYPOINT ["python", "app.py"]

# 조합 (권장 패턴 - 실행 파일 고정, 인수만 재정의)
ENTRYPOINT ["python", "app.py"]
CMD ["--port", "8080"]
# docker run myimage --port 9090  → python app.py --port 9090
```

---

## 3. 레이어 최소화

```dockerfile
# 나쁜 예: 레이어 3개 생성
RUN apt update
RUN apt install -y curl wget
RUN rm -rf /var/lib/apt/lists/*

# 좋은 예: 레이어 1개, 캐시 제거 포함
RUN apt update && apt install -y \
    curl \
    wget \
  && rm -rf /var/lib/apt/lists/*
```

---

## 4. 빌드 캐시 최적화

변경이 잦은 레이어는 뒤로, 드문 레이어는 앞으로 배치한다.

```dockerfile
# 나쁜 예: 코드 복사 후 의존성 설치 (코드 변경마다 캐시 무효화)
COPY . .
RUN npm install

# 좋은 예: 의존성 파일 먼저 복사 (package.json 변경 시에만 재설치)
COPY package*.json ./
RUN npm ci --omit=dev  # --only=production은 npm 8.3+ deprecated

COPY . .
```

---

## 5. 베스트 프랙티스 예시

```dockerfile
# ─── Node.js 앱 예시 ───────────────────────────────
FROM node:20-alpine AS builder

# 메타데이터
LABEL maintainer="team@example.com"
LABEL version="1.0.0"

# 작업 디렉토리 설정
WORKDIR /app

# 의존성 먼저 복사 (캐시 최적화)
# builder는 devDependencies 포함 전체 설치 (빌드 도구 필요)
COPY package*.json ./
RUN npm ci

# 소스 복사
COPY . .

# 빌드
RUN npm run build

# ─── 런타임 이미지 ───────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# 비root 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# tini 설치 (PID 1 init 프로세스)
RUN apk add --no-cache tini

# 빌드 결과물만 복사
COPY --from=builder /app/dist ./dist
# 프로덕션 의존성만 재설치 (--omit=dev, npm 8.3+ 권장)
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# 사용자 변경 (root로 실행 금지)
USER appuser

# 문서화 포트
EXPOSE 3000

# 헬스체크 (Alpine BusyBox wget: HTTP만 지원)
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# 초기화 프로세스 사용 (Alpine: /sbin/tini)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

---

## 6. COPY vs ADD

```dockerfile
# COPY: 로컬 파일만 복사 (권장)
COPY src/ /app/src/

# ADD: URL 다운로드, tar 자동 압축 해제 (특수한 경우만)
ADD https://example.com/file.tar.gz /tmp/
# 위와 동일한 효과지만 명시적으로:
RUN curl -fsSL https://example.com/file.tar.gz | tar -xz -C /tmp/
```

> `ADD`보다 `COPY`를 사용하라.
> URL 다운로드는 `RUN curl`로 명시적으로 처리하는 것이 더 명확하다.

---

## 7. .dockerignore

```
# .dockerignore
.git
node_modules
*.log
.env
.DS_Store
coverage/
dist/          # 빌드 아티팩트 (컨테이너에서 빌드)
README.md
```

---

## 8. 보안 체크리스트

```text
[ ] 비root USER 설정 (USER 1000:1000 또는 appuser)
[ ] 베이스 이미지 태그 고정 (alpine:3.19, latest 금지)
[ ] .dockerignore로 민감 파일 제외 (.env, .git)
[ ] 패키지 캐시 제거 (rm -rf /var/lib/apt/lists/*)
[ ] --no-install-recommends 옵션 사용
[ ] HEALTHCHECK 설정
[ ] 민감 정보를 ENV에 넣지 않기 (ARG + secret mount 사용)
[ ] 멀티스테이지로 빌드 도구 런타임에서 제외
```

---

## 참고 문서

- [Docker 공식 Dockerfile 레퍼런스](https://docs.docker.com/engine/reference/builder/)
- [Docker 베스트 프랙티스](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
