---
title: "Container"
date: 2026-04-12
tags:
  - container
  - docker
  - roadmap
---

# Container

현대 배포의 기본 단위. 쿠버네티스 전에 컨테이너부터.

## 목차

### 기초

- [x] [컨테이너 vs VM](container-vs-vm.md)
- [x] [컨테이너를 구성하는 리눅스 기술 (cgroup, namespace, OverlayFS)](container-linux-internals.md)
- [x] [Docker 설치와 기본 명령어](docker-basics.md)
- [x] [컨테이너 라이프사이클](container-lifecycle.md)

### 이미지

- [x] [Dockerfile 작성과 베스트 프랙티스](dockerfile-best-practices.md)
- [x] [멀티스테이지 빌드](multistage-build.md)
- [x] [이미지 경량화 전략](image-optimization.md)
- [x] [컨테이너 레지스트리 (Docker Hub, Harbor, 클라우드)](container-registry.md)

### 네트워크·스토리지

- [ ] Docker 네트워크 모드
- [ ] Docker Volume과 Bind Mount
- [ ] 데이터 지속성 전략

### 운영

- [ ] Docker Compose로 멀티 컨테이너 관리
- [ ] 컨테이너 리소스 제한 (CPU, 메모리, 디스크)
- [ ] 컨테이너 모니터링 (cAdvisor)
- [ ] 컨테이너 보안 기초

### 런타임

- [ ] containerd vs Docker Engine
- [ ] OCI 표준 (이미지, 런타임)
- [ ] 컨테이너 런타임 비교
