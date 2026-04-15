---
title: "컨테이너 데이터 지속성 전략"
date: 2026-04-13
tags:
  - container
  - docker
  - storage
  - backup
  - stateful
sidebar_label: "데이터 지속성"
---

# 컨테이너 데이터 지속성 전략

## 1. 스테이트풀 컨테이너의 원칙

```
컨테이너 = 임시 (종료 시 내부 변경사항 소멸)
데이터  = 외부 볼륨에 분리 보관

앱 이미지 (불변) + 볼륨 (가변) = 스테이트풀 컨테이너
```

| 원칙 | 설명 |
|-----|------|
| 데이터 분리 | 앱 코드와 데이터는 반드시 분리 |
| 멱등성 | 컨테이너 재시작 후 동일한 상태 복원 |
| 백업 자동화 | 수동 백업은 잊어버린다 |
| 복구 테스트 | 백업은 복구 테스트가 완료되어야 의미있다 |

---

## 2. DB 컨테이너 운영 패턴

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: dbuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}   # .env 파일
      POSTGRES_DB: myapp
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dbuser"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G

volumes:
  postgres-data:
```

**운영 시 주의사항:**

| 항목 | 나쁜 예 | 좋은 예 |
|-----|--------|--------|
| 비밀번호 | `-e POSTGRES_PASSWORD=secret` | `--env-file .env` |
| 재시작 정책 | (없음) | `restart: unless-stopped` |
| 헬스체크 | (없음) | `healthcheck` 설정 |
| 리소스 제한 | (없음) | CPU/메모리 상한 설정 |
| 볼륨 | 컨테이너 내부 저장 | Named Volume |

---

## 3. 백업 전략

### 데이터베이스 네이티브 백업 (권장)

```bash
# PostgreSQL
docker exec postgres pg_dump \
  -U dbuser -d myapp \
  > backup-$(date +%Y%m%d).sql

# PostgreSQL 전체 클러스터 (binary)
# ⚠️ pg_basebackup은 REPLICATION 권한 또는 superuser 필요
# 일반 앱 유저(dbuser)로는 "must be superuser or replication role" 오류 발생
docker exec postgres pg_basebackup \
  -U postgres -D /backups/base-$(date +%Y%m%d) \
  -Ft -z

# MySQL
docker exec mysql mysqldump \
  -u root -p${DB_PASSWORD} \
  --all-databases \
  > backup-$(date +%Y%m%d).sql

# MongoDB
docker exec mongodb mongodump \
  --uri="mongodb://admin:${MONGO_PASSWORD}@localhost:27017" \
  --out=/backups/$(date +%Y%m%d)

# Redis (RDB 스냅샷)
docker exec redis redis-cli BGSAVE
```

### 볼륨 레벨 백업

```bash
# 컨테이너 중지 후 백업 (데이터 일관성 보장)
# ⚠️ 다운타임 발생 — 개발/소규모 환경에 적합
# 프로덕션에서는 pg_dump(온라인) 또는 파일시스템 스냅샷(LVM, EBS snapshot) 사용
docker stop postgres

docker run --rm \
  -v postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  tar czf /backup/postgres-$(date +%Y%m%d).tar.gz -C /data .

docker start postgres
```

### 복구

```bash
# SQL 덤프 복구
docker exec -i postgres psql \
  -U dbuser -d myapp \
  < backup-20260413.sql

# 볼륨 복구
docker run --rm \
  -v postgres-data:/data \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  sh -c "cd /data && tar xzf /backup/postgres-20260413.tar.gz"
```

---

## 4. 자동 백업 컨테이너

```yaml
services:
  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  backup:
    image: postgres:15-alpine
    depends_on:
      - postgres
    volumes:
      - backups:/backups
    environment:
      PGPASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USER:-postgres}  # postgres 서비스와 동일한 유저 사용
    entrypoint: |
      sh -c 'while true; do
        pg_dump -h postgres -U ${POSTGRES_USER:-postgres} myapp \
          > /backups/backup-$$(date +%Y%m%d-%H%M%S).sql
        find /backups -name "backup-*" -mtime +7 -delete
        sleep 86400
      done'
    # ⚠️ sleep 루프는 컨테이너 재시작 시 주기 리셋, 실패 감지 불가
    # 프로덕션에서는 Kubernetes CronJob 또는 전용 백업 솔루션 사용 권장

volumes:
  postgres-data:
  backups:
```

---

## 5. 디스크 공간 관리

```bash
# Docker 전체 디스크 사용량 확인
docker system df

# 상세 (볼륨별 크기)
docker system df -v

# 볼륨 내 데이터 크기 확인
docker exec postgres du -sh /var/lib/postgresql/data

# 호스트 볼륨 디렉토리 크기
du -sh /var/lib/docker/volumes/*
```

**정리 정책:**

```bash
# 미사용 볼륨만 정리 (안전)
docker volume prune

# label 기반 선택적 정리
docker volume prune --filter "label=env=dev"

# 전체 미사용 리소스 정리 (볼륨 제외)
docker system prune

# 볼륨 포함 전체 정리 (위험: 데이터 영구 삭제)
docker system prune --volumes
```

---

## 6. 볼륨 마이그레이션

```bash
# 호스트 A: 볼륨 내보내기
docker run --rm \
  -v old-vol:/data \
  -v $(pwd):/backup \
  alpine:latest \
  tar czf /backup/migration.tar.gz -C /data .

# 파일 전송
scp migration.tar.gz user@host-b:/tmp/

# 호스트 B: 볼륨 가져오기
docker volume create new-vol
docker run --rm \
  -v new-vol:/data \
  -v /tmp:/backup \
  alpine:latest \
  tar xzf /backup/migration.tar.gz -C /data
```

---

## 7. 프로덕션 체크리스트

```text
설계:
  [ ] 데이터와 앱 이미지 완전 분리
  [ ] Named Volume 사용 (절대 경로 하드코딩 금지)
  [ ] 민감 정보는 .env 파일 또는 Docker Secrets

운영:
  [ ] 헬스체크 설정
  [ ] restart: unless-stopped 정책
  [ ] CPU/메모리 리소스 제한
  [ ] 로그 드라이버 설정 (max-size, max-file)

백업:
  [ ] 자동화된 정기 백업 (일 1회 이상)
  [ ] 백업 보존 기간 정책 (예: 7일 로컬 + 30일 원격)
  [ ] 복구 절차 문서화 + 정기 테스트

모니터링:
  [ ] 디스크 사용률 알림 (80% 임계값)
  [ ] 백업 성공/실패 알림
```

---

## 참고 문서

- [Docker Storage Overview](https://docs.docker.com/storage/)
- [Docker Volumes](https://docs.docker.com/engine/storage/volumes/)
- [PostgreSQL Backup](https://www.postgresql.org/docs/current/backup.html)
