---
title: "Docker 설치와 기본 명령어"
date: 2026-04-13
tags:
  - container
  - docker
  - basics
sidebar_label: "Docker 기본"
---

# Docker 설치와 기본 명령어

## 1. Docker 아키텍처

```
CLI (docker)
    ↓ REST API
dockerd (Docker Daemon)
    ↓ gRPC
containerd
    ↓
containerd-shim
    ↓
runc (OCI 런타임)
    ↓
컨테이너 프로세스
```

| 컴포넌트 | 역할 |
|---------|------|
| `docker` (CLI) | 사용자 명령어 인터페이스 |
| `dockerd` | API 서버, 이미지/네트워크 관리 |
| `containerd` | 컨테이너 라이프사이클 관리 |
| `runc` | OCI 표준 컨테이너 런타임 |

---

## 2. 설치

### Ubuntu / Debian

```bash
# 공식 Docker 저장소 추가
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update
sudo apt install docker-ce docker-ce-cli \
  containerd.io docker-buildx-plugin docker-compose-plugin

# 현재 사용자를 docker 그룹에 추가 (sudo 없이 사용)
sudo usermod -aG docker $USER
newgrp docker  # 현재 셸에 즉시 적용 (서브셸 생성). 완전한 적용은 로그아웃 후 재로그인 필요
```

### RHEL / Rocky / AlmaLinux

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo \
  https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf install docker-ce docker-ce-cli \
  containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

```bash
# 설치 확인
docker version
docker info
```

---

## 3. 필수 명령어

### 컨테이너 실행/관리

```bash
# 이미지 다운로드
docker pull nginx:1.27

# 컨테이너 실행 (포그라운드)
docker run nginx

# 백그라운드 실행 (-d) + 이름 지정
docker run -d --name webserver nginx

# 포트 매핑
docker run -d -p 8080:80 nginx

# 환경 변수 전달
docker run -d -e MYSQL_ROOT_PASSWORD=secret mysql:8

# 볼륨 마운트
docker run -d -v /data:/var/lib/mysql mysql:8

# 자동 재시작
docker run -d --restart unless-stopped nginx

# 실행 중인 컨테이너 목록
docker ps

# 모든 컨테이너 (중지 포함)
docker ps -a

# 컨테이너 중지/시작/재시작
docker stop webserver
docker start webserver
docker restart webserver

# 컨테이너 삭제
docker rm webserver
docker rm -f webserver  # 강제 삭제 (실행 중도)
```

### 컨테이너 내부 접근

```bash
# 실행 중인 컨테이너에서 명령 실행
docker exec -it webserver bash
docker exec webserver nginx -s reload

# 로그 확인
docker logs webserver
docker logs -f webserver      # 실시간 팔로우
docker logs --tail 100 webserver

# 리소스 사용량 확인
docker stats
docker stats webserver

# 프로세스 목록
docker top webserver
```

### 이미지 관리

```bash
# 이미지 목록
docker images

# 이미지 상세 정보
docker inspect nginx:1.27

# 이미지 레이어 확인
docker history nginx:1.27

# 이미지 삭제
docker rmi nginx:1.27

# 사용하지 않는 리소스 전체 정리
docker system prune -a
```

---

## 4. docker run 주요 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| `-d` | 백그라운드 실행 | `-d` |
| `-p` | 포트 매핑 (host:container) | `-p 8080:80` |
| `-v` | 볼륨 마운트 | `-v /data:/app/data` |
| `-e` | 환경 변수 | `-e KEY=value` |
| `--name` | 컨테이너 이름 | `--name myapp` |
| `--network` | 네트워크 연결 | `--network mynet` |
| `--restart` | 재시작 정책 | `--restart unless-stopped` |
| `--rm` | 종료 시 자동 삭제 | `--rm` |
| `--memory` | 메모리 제한 | `--memory 512m` |
| `--cpus` | CPU 제한 | `--cpus 0.5` |
| `--user` | 실행 사용자 | `--user 1000:1000` |
| `--read-only` | 루트 FS 읽기 전용 | `--read-only` |

---

## 5. Docker Hub 사용

```bash
# Docker Hub 로그인
docker login

# 이미지 태깅
docker tag myapp:latest myusername/myapp:1.0.0

# 이미지 푸시
docker push myusername/myapp:1.0.0

# 이미지 풀
docker pull myusername/myapp:1.0.0
```

---

## 6. Docker Desktop vs Docker Engine

| 항목 | Docker Desktop | Docker Engine |
|------|--------------|--------------|
| 대상 | 개발자 로컬 환경 | 서버/CI 환경 |
| OS | macOS, Windows, Linux | Linux |
| UI | GUI 포함 | CLI만 |
| 라이선스 | **유료** (250인+ 또는 연매출 $10M+ 기업) | 오픈소스 무료 |
| Kubernetes | 내장 | 별도 설치 필요 |

> Docker Desktop은 2022년부터 250인 이상 **또는** 연매출 $10M 초과 기업의 상업적 사용 시 유료.
> 서버 환경에는 Docker Engine(오픈소스)을 사용한다.

---

## 참고 문서

- [Docker 공식 문서](https://docs.docker.com/)
- [Docker 설치 가이드](https://docs.docker.com/engine/install/)
- [Docker CLI 레퍼런스](https://docs.docker.com/engine/reference/commandline/cli/)
