---
title: "Docker Volume과 Bind Mount"
date: 2026-04-13
tags:
  - container
  - docker
  - volume
  - storage
  - bind-mount
sidebar_label: "Volume·Bind Mount"
---

# Docker Volume과 Bind Mount

## 1. 스토리지 유형 비교

| 유형 | 관리 주체 | 위치 | 지속성 | 사용 시점 |
|-----|---------|------|--------|---------|
| **Volume** | Docker 데몬 | `/var/lib/docker/volumes/` | 영구 | 프로덕션 데이터 |
| **Bind Mount** | 호스트 OS | 호스트 임의 경로 | 영구 | 개발 (소스 코드 공유) |
| **tmpfs** | 메모리 | RAM | 임시 | 민감 정보, 캐시 |

```
Volume:       [Docker 관리 영역] ← 컨테이너 → [앱 데이터]
Bind Mount:   [호스트 디렉토리] ← 컨테이너 → [소스 코드]
tmpfs:        [RAM]            ← 컨테이너 → [세션, 토큰]
```

---

## 2. Volume 명령어

```bash
# 볼륨 생성
docker volume create my-vol

# 목록 조회
docker volume ls

# 상세 정보 (mountpoint 경로 포함)
docker volume inspect my-vol

# 볼륨 마운트 (--mount 권장)
docker run -d \
  --mount type=volume,src=my-vol,target=/data \
  postgres:15

# -v 단축 문법
docker run -d -v my-vol:/data postgres:15

# 읽기 전용 마운트
docker run -d \
  --mount type=volume,src=my-vol,target=/data,readonly \
  myapp:latest

# 볼륨 삭제
docker volume rm my-vol

# 미사용 볼륨 정리
docker volume prune
```

---

## 3. Bind Mount

```bash
# 현재 디렉토리를 컨테이너에 마운트 (개발 환경)
docker run -d \
  --mount type=bind,src=$(pwd)/src,target=/app/src \
  node:20-alpine

# -v 단축 문법
docker run -d -v $(pwd)/src:/app/src node:20-alpine

# 읽기 전용 바인드 마운트 (설정 파일)
docker run -d \
  -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \
  nginx:latest
```

> `-v` 문법: 호스트 경로가 없으면 디렉토리가 자동 생성된다.
> `--mount type=bind`: 호스트 경로가 반드시 사전에 존재해야 한다.
> 경로가 없으면 `bind source path does not exist` 오류 발생.
> 소유권 문제가 발생할 수 있으므로 권한을 미리 확인하라.

---

## 4. tmpfs Mount

```bash
# 메모리 기반 임시 저장소 (tmpfs)
# -v 문법은 tmpfs 미지원

# 방법 1: --tmpfs (간결, 단순 사용에 적합)
docker run -d --tmpfs /run/secrets:size=100m myapp:latest

# 방법 2: --mount (세밀한 옵션 설정 가능)
docker run -d \
  --mount type=tmpfs,target=/run/secrets,tmpfs-size=100m \
  myapp:latest
```

---

## 5. Named Volume 패턴

### 단일 컨테이너 데이터 지속성

```bash
docker volume create db-data

docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=secret \
  -v db-data:/var/lib/postgresql/data \
  postgres:15

# 컨테이너 삭제 후 재실행해도 데이터 유지
docker rm -f postgres
docker run -d --name postgres \
  -v db-data:/var/lib/postgresql/data postgres:15
```

### 볼륨 백업

```bash
# tar 아카이브로 백업
docker run --rm \
  -v db-data:/data \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  tar czf /backup/db-$(date +%Y%m%d).tar.gz -C /data .

# 복구
docker run --rm \
  -v db-data:/data \
  -v $(pwd)/backups:/backup \
  alpine:latest \
  tar xzf /backup/db-20260413.tar.gz -C /data
```

---

## 6. Volume Driver

### NFS (다중 호스트 공유)

```bash
# NFSv4 볼륨 생성
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt device=:/export/docker \
  --opt o=addr=192.168.1.100,vers=4 \
  nfs-vol
```

### AWS EFS (NFS 기반)

```bash
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt device=fs-12345678.efs.ap-northeast-2.amazonaws.com:/ \
  --opt o=addr=fs-12345678.efs.ap-northeast-2.amazonaws.com,vers=4.1 \
  efs-vol
```

---

## 7. Docker Compose에서 볼륨

```yaml
volumes:
  db-data:          # named volume (Docker 관리)
  app-cache:
    driver: local
    driver_opts:    # tmpfs 볼륨
      type: tmpfs
      device: tmpfs
      o: size=256m

services:
  db:
    image: postgres:15
    volumes:
      - db-data:/var/lib/postgresql/data

  app:
    image: myapp:latest
    volumes:
      - ./src:/app/src       # bind mount (개발용)
      - app-cache:/app/cache # named volume
```

---

## 참고 문서

- [Manage Data in Docker](https://docs.docker.com/storage/)
- [Volumes](https://docs.docker.com/engine/storage/volumes/)
- [tmpfs Mounts](https://docs.docker.com/engine/storage/tmpfs/)
