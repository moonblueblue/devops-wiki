---
title: "Docker Compose로 멀티 컨테이너 관리"
date: 2026-04-14
tags:
  - container
  - docker
  - compose
  - multi-container
sidebar_label: "Docker Compose"
---

# Docker Compose로 멀티 컨테이너 관리

## 1. Compose v2 vs v1

| 항목 | v1 (Deprecated) | v2 (현행) |
|-----|----------------|---------|
| 명령어 | `docker-compose` | `docker compose` |
| 언어 | Python | Go |
| 컨테이너 이름 | `project_web_1` | `project-web-1` |
| 포함 방식 | 별도 바이너리 | Docker CLI 플러그인 |

v2가 2026년 기준 표준이다. `version:` 최상위 필드는 선언 시 경고(warning)가
출력되며, Compose v2는 이를 무시한다. 삭제가 맞다.

---

## 2. compose.yml 구조

```yaml
# version: 선언 불필요 (2024+ 권장)

services:
  app:
    image: myapp:latest
    ports:
      - "3000:3000"
    environment:
      DB_HOST: db
      LOG_LEVEL: ${LOG_LEVEL:-info}  # .env에서 읽기
    depends_on:
      db:
        condition: service_healthy
    networks:
      - backend

  db:
    image: postgres:15-alpine
    env_file:
      - .env
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

networks:
  backend:
    driver: bridge
    internal: true   # 외부 인터넷 차단

volumes:
  db-data:
```

---

## 3. depends_on + healthcheck

`depends_on`만 쓰면 컨테이너 시작만 기다린다.
`condition: service_healthy`로 실제 준비 완료를 기다려야 한다.

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy  # healthcheck 통과 대기
      cache:
        condition: service_started  # 시작만 대기 (기본값)

  db:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s   # 최초 체크 전 대기 시간

  cache:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
```

---

## 4. 환경 변수 관리

```bash
# .env (Compose 파일 변수 보간 + 컨테이너 환경변수)
DB_PASSWORD=secret123
APP_PORT=3000
LOG_LEVEL=debug
```

```yaml
# 방법 1: .env에서 보간 (Compose 파일 변수 치환)
services:
  app:
    environment:
      - DB_PASSWORD=${DB_PASSWORD}
```

```yaml
# 방법 2: env_file로 파일 통째로 주입
# 나중에 선언된 파일이 앞 파일을 덮어씀 (순서 = 우선순위)
# .env.local은 자동 로딩되지 않음 — env_file에 명시해야 적용됨
services:
  app:
    env_file:
      - .env
      - .env.local  # .env보다 나중에 선언 → 우선순위 높음
```

```yaml
# 방법 3: 직접 값 명시
services:
  app:
    environment:
      DB_HOST: db
      DB_PORT: "5432"
```

---

## 5. profiles (서비스 선택 실행)

```yaml
services:
  app:
    image: myapp:latest
    # profile 없음 → 항상 실행

  worker:
    image: myworker:latest
    profiles: [worker]

  debug-tools:
    image: alpine:latest
    profiles: [debug]

  monitoring:
    image: prom/prometheus:latest
    profiles: [monitoring, debug]
```

```bash
# 기본 (profiles 없는 서비스만)
docker compose up -d

# worker 추가
docker compose --profile worker up -d

# 여러 profile
docker compose --profile debug --profile monitoring up -d
```

---

## 6. 환경별 분리 (Override 패턴)

```
compose.yml          # 공통 설정
compose.override.yml # 개발 (자동 적용)
compose.prod.yml     # 프로덕션
```

```yaml
# compose.yml (공통)
services:
  app:
    image: myapp:latest
    environment:
      DB_HOST: db

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

```yaml
# compose.override.yml (개발 - 자동 병합)
services:
  app:
    ports: ["3000:3000"]
    environment:
      DEBUG: "true"
    volumes:
      - ./src:/app/src  # 핫 리로드

  db:
    ports: ["5432:5432"]  # 로컬 접근용
```

```yaml
# compose.prod.yml (프로덕션)
services:
  app:
    image: registry.example.com/myapp:v1.2.0
    restart: always
    deploy:
      resources:
        limits:
          cpus: "2"
          memory: 2G
```

```bash
# 개발
docker compose up -d

# 프로덕션
docker compose -f compose.yml -f compose.prod.yml \
  --env-file .env.prod up -d
```

---

## 7. 주요 명령어

```bash
# 실행
docker compose up -d
docker compose up --build    # 이미지 재빌드 후 실행

# 종료
docker compose down
docker compose down -v       # 볼륨도 삭제

# 상태
docker compose ps
docker compose logs -f app   # 특정 서비스 실시간 로그

# 제어
docker compose restart app
docker compose stop db

# 디버깅
docker compose exec app sh   # 실행 중 컨테이너 접속
docker compose run --rm app env  # 일회성 실행

# 설정 확인
docker compose config        # 병합된 최종 설정 출력
```

---

## 참고 문서

- [Docker Compose File Reference](https://docs.docker.com/reference/compose-file/)
- [Environment Variables](https://docs.docker.com/compose/how-tos/environment-variables/)
- [Compose v1 → v2 Migration](https://docs.docker.com/compose/releases/migrate/)
