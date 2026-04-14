---
title: "컨테이너 리소스 제한 (CPU, 메모리)"
date: 2026-04-14
tags:
  - container
  - docker
  - cgroups
  - resource-limit
  - oom
sidebar_label: "리소스 제한"
---

# 컨테이너 리소스 제한 (CPU, 메모리)

## 1. 제한 없으면 생기는 문제

```
컨테이너 A가 메모리 누수 → 호스트 메모리 고갈
                               ↓
                    다른 컨테이너도 OOM Kill
                    호스트 프로세스도 영향
```

리소스 제한은 노이지 네이버(noisy neighbor) 문제를 방지하는 기본 방어선이다.

---

## 2. 메모리 제한

```bash
# 메모리 하드 제한 (초과 시 OOM Kill)
docker run --memory=512m myapp:latest

# 메모리 + 스왑 제한
# --memory-swap = 메모리 + 스왑 합계
docker run --memory=512m --memory-swap=1g myapp:latest
# 위 설정: 메모리 512M + 스왑 512M = 총 1G

# 스왑 비활성화
docker run --memory=512m --memory-swap=512m myapp:latest

# 소프트 제한 (메모리 부족 시 우선 회수 대상)
docker run --memory=512m --memory-reservation=256m myapp:latest
```

| 옵션 | 설명 | 기본값 |
|-----|------|--------|
| `--memory` | 하드 메모리 제한 | 무제한 |
| `--memory-swap` | 메모리+스왑 합계 | `--memory`의 2배 |
| `--memory-reservation` | 소프트 제한 | 무제한 |
| `--oom-kill-disable` | OOM Kill 비활성화 | false |

---

## 3. CPU 제한

```bash
# CPU 코어 수 제한 (소수점 가능)
docker run --cpus=1 myapp:latest      # 1코어
docker run --cpus=0.5 myapp:latest    # 0.5코어

# CPU 우선순위 (상대적 가중치, 기본 1024)
docker run --cpu-shares=512 myapp:latest   # 낮은 우선순위
docker run --cpu-shares=2048 myapp:latest  # 높은 우선순위

# 특정 CPU 코어에 고정
docker run --cpuset-cpus="0,1" myapp:latest   # 0번, 1번 코어만
docker run --cpuset-cpus="0-3" myapp:latest   # 0~3번 코어만
```

---

## 4. cgroups v2 원리

```
Docker daemon
    ↓ 컨테이너 생성
cgroup 생성
/sys/fs/cgroup/docker/<container-id>/

memory.max     → --memory 값
cpu.max        → --cpus 기반 (period quota 형식)
```

```bash
# cgroups v2 확인
cat /sys/fs/cgroup/docker/<container-id>/memory.max
cat /sys/fs/cgroup/docker/<container-id>/cpu.max
# 출력 예: "100000 100000" = 100ms 주기에 100ms 사용 (1코어)
# 출력 예: "50000 100000" = 100ms 주기에 50ms 사용 (0.5코어)
```

---

## 5. OOM Killer

메모리 제한 초과 시 흐름:

```
컨테이너가 memory.max 초과 시도
          ↓
  Linux 커널 OOM killer 트리거
          ↓
  컨테이너 내 프로세스 SIGKILL
          ↓
  컨테이너 종료 (exit code 137)
```

```bash
# OOM Kill 여부 확인
docker inspect my-container | grep OOMKilled
# "OOMKilled": true

# exit code 137 = 128 + SIGKILL(9)
docker inspect my-container | grep ExitCode
# "ExitCode": 137

# 호스트 커널 로그 확인
dmesg | grep -i "oom\|kill"
```

---

## 6. docker stats

```bash
# 전체 컨테이너 실시간 모니터링
docker stats

# 특정 컨테이너만
docker stats app db

# 한 번만 스냅샷 (스크립트용)
docker stats --no-stream

# 포맷 지정
docker stats --format \
  "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

| 필드 | 설명 |
|-----|------|
| `CPU %` | CPU 사용률 |
| `MEM USAGE / LIMIT` | 사용 메모리 / 제한 |
| `MEM %` | 제한 대비 사용률 |
| `NET I/O` | 네트워크 송수신 |
| `BLOCK I/O` | 디스크 I/O |
| `PIDS` | 프로세스 수 |

---

## 7. Compose에서 리소스 제한

```yaml
services:
  api:
    image: myapi:latest
    deploy:
      resources:
        limits:
          cpus: "2"       # 최대 2코어
          memory: 2G      # 최대 2GB
        reservations:
          cpus: "1"       # 최소 1코어 예약
          memory: 1G      # 최소 1GB 예약

  worker:
    image: myworker:latest
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M
```

---

## 참고 문서

- [Runtime Resource Constraints](https://docs.docker.com/engine/containers/resource_constraints/)
- [cgroups v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)
- [docker stats](https://docs.docker.com/reference/cli/docker/container/stats/)
