---
title: "멀티스테이지 빌드"
date: 2026-04-13
tags:
  - container
  - docker
  - dockerfile
  - multistage
  - optimization
sidebar_label: "멀티스테이지 빌드"
---

# 멀티스테이지 빌드

## 1. 개념

빌드 환경과 런타임 환경을 분리하여
최종 이미지에서 컴파일러, 빌드 도구를 제거한다.

```
빌드 스테이지:
  컴파일러 + 소스코드 → 바이너리/아티팩트
      ↓ COPY --from
런타임 스테이지:
  최소 베이스 이미지 + 바이너리만

결과: 이미지 크기 대폭 감소
  Go: 1.1 GB → 8 MB (99% 감소)
  Java: 1.2 GB → 180 MB (85% 감소)
  Node.js: 1.3 GB → 150 MB (87% 감소)
```

---

## 2. 언어별 예시

### Go

```dockerfile
# 빌드 스테이지
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build \
  -ldflags="-w -s" \   # 디버그 정보 제거 (크기 최소화)
  -o /app/server .

# 런타임 스테이지 (distroless 또는 scratch)
FROM gcr.io/distroless/static-debian12
COPY --from=builder /app/server /server
EXPOSE 8080
ENTRYPOINT ["/server"]
```

### Java (Spring Boot)

```dockerfile
# 빌드 스테이지
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline  # 의존성 캐싱
COPY src ./src
RUN mvn package -DskipTests

# 레이어 분리 (Spring Boot 3.x)
FROM eclipse-temurin:21-jre-alpine AS extractor
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
RUN java -Djarmode=layertools -jar app.jar extract

# 런타임 스테이지
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S spring && adduser -S spring -G spring
USER spring
COPY --from=extractor /app/dependencies/ ./
COPY --from=extractor /app/snapshot-dependencies/ ./
COPY --from=extractor /app/spring-boot-loader/ ./
COPY --from=extractor /app/application/ ./
EXPOSE 8080
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

### Node.js

```dockerfile
# 의존성 설치 스테이지
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 빌드 스테이지
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 런타임 스테이지
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER appuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Python

```dockerfile
# 빌드 스테이지 (의존성 컴파일)
FROM python:3.12-slim AS builder
WORKDIR /app
RUN pip install --no-cache-dir --upgrade pip
COPY requirements.txt .
RUN pip install --no-cache-dir --target=/app/packages -r requirements.txt

# 런타임 스테이지
FROM python:3.12-slim
WORKDIR /app
RUN addgroup --system appgroup && adduser --system appuser --ingroup appgroup
COPY --from=builder /app/packages /app/packages
COPY . .
ENV PYTHONPATH=/app/packages
USER appuser
EXPOSE 8000
CMD ["python", "app.py"]
```

---

## 3. 특정 스테이지만 빌드

```bash
# 특정 스테이지까지만 빌드 (CI 테스트용)
docker build --target builder -t myapp:test .

# 테스트 스테이지 별도 정의
FROM builder AS test
RUN go test ./...

# 프로덕션 빌드
FROM builder AS production
RUN go build -o /app/server .
```

---

## 4. BuildKit 고급 기능

```dockerfile
# syntax=docker/dockerfile:1.7

# 캐시 마운트 (빌드 시 캐시 재사용, 이미지에 포함 안 됨)
RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -o /app/server .

RUN --mount=type=cache,target=/var/cache/apt \
    apt update && apt install -y gcc

# 시크릿 마운트 (민감 정보 이미지에 포함 안 됨)
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    npm install

# 빌드 시 시크릿 전달
docker build --secret id=npm_token,src=.npmrc .
```

```bash
# BuildKit 활성화 (Docker 23.0+에서 기본값)
export DOCKER_BUILDKIT=1
docker build .
```

---

## 5. 빌드 캐시 확인

```bash
# 이미지 레이어별 크기 확인
docker history myapp:latest

# 빌드 캐시 확인
docker buildx du

# 빌드 캐시 정리
docker buildx prune
```

---

## 참고 문서

- [Docker 멀티스테이지 빌드](https://docs.docker.com/build/building/multi-stage/)
- [Docker BuildKit](https://docs.docker.com/build/buildkit/)
- [distroless 이미지](https://github.com/GoogleContainerTools/distroless)
