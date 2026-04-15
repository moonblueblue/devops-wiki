---
title: "Container"
date: 2026-04-16
tags:
  - container
  - docker
  - oci
  - roadmap
sidebar_label: "Container"
---

# 03. Container

현대 배포의 기본 단위. 쿠버네티스 이전에 컨테이너를 제대로 이해해야 한다.
Linux 커널의 cgroups·namespaces 위에서 동작하는 격리 메커니즘부터
OCI 표준, 공급망 보안까지 다룬다.

## 목차

### 기초

- [ ] [컨테이너 vs VM 상세 비교](container-vs-vm.md)
- [ ] [컨테이너 Linux 내부 (cgroups, namespaces, OverlayFS)](container-linux-internals.md)
- [ ] [OCI 표준 (Image Spec, Runtime Spec, Distribution Spec)](oci-standards.md)

### Docker

- [ ] [Docker 설치와 기본 명령어](docker-basics.md)
- [ ] [컨테이너 라이프사이클](container-lifecycle.md)
- [ ] [Docker Desktop 라이선스 이슈 (2022 유료화)](docker-desktop-licensing.md)
- [ ] [Docker Init과 Docker Scout](docker-init-scout.md)

### Dockerfile과 이미지 빌드

- [ ] [Dockerfile 기본과 베스트 프랙티스](dockerfile-best-practices.md)
- [ ] [멀티스테이지 빌드](multistage-build.md)
- [ ] [이미지 레이어와 캐시 최적화](image-layering.md)
- [ ] [이미지 경량화 전략 (Alpine, distroless, scratch)](image-optimization.md)
- [ ] [BuildKit 고급 기능 (cache mount, SSH, secret mount)](buildkit-advanced.md)
- [ ] [SBOM 생성과 Provenance (BuildKit --sbom)](buildkit-sbom.md)

### 대체 빌더

- [ ] [Buildpacks (CNB) - Heroku, Netflix 표준](buildpacks.md)
- [ ] [Jib (Java 이미지)](jib.md)
- [ ] [Ko (Go 이미지)](ko.md)

### 네트워크와 스토리지

- [ ] [Docker 네트워크 모드 (bridge, host, overlay, macvlan)](docker-network.md)
- [ ] [Volume, Bind Mount, tmpfs](docker-storage.md)
- [ ] [데이터 지속성 전략](data-persistence.md)

### 운영

- [ ] [Docker Compose 멀티 컨테이너](docker-compose.md)
- [ ] [리소스 제한 (CPU, Memory, PIDs, GPU)](container-resources.md)
- [ ] [헬스체크와 Restart Policy](healthcheck-restart.md)
- [ ] [로깅 드라이버](logging-drivers.md)

### 보안

- [ ] [Rootless 컨테이너와 User Namespace](rootless-container.md)
- [ ] [컨테이너 Capabilities와 seccomp](container-security-linux.md)
- [ ] [이미지 취약점 스캔 (Trivy, Grype)](image-scanning-basics.md)
- [ ] [이미지 서명 (cosign, Notary v2)](image-signing-basics.md)
- [ ] [Reproducible Builds](reproducible-builds.md)

### 런타임

- [ ] [containerd vs Docker Engine](containerd-vs-docker.md)
- [ ] [CRI-O](crio.md)
- [ ] [runc (low-level runtime)](runc.md)
- [ ] [gVisor, Kata Containers, Firecracker](sandbox-runtime.md)

### WebAssembly (Wasm) 컨테이너

- [ ] [Wasm 컨테이너 개요와 containerd runwasi](wasm-containers.md)
- [ ] [WASI Preview 2와 Component Model](wasi-preview-2.md)
- [ ] [SpinKube와 Kubernetes에서 Wasm 실행](spinkube.md)

### 대안 도구

- [ ] [Podman (데몬리스)](podman.md)
- [ ] [nerdctl (containerd 클라이언트)](nerdctl.md)

### 레지스트리

- [ ] [Docker Hub, GHCR, ECR/GCR/ACR](public-registry.md)
- [ ] [Harbor 프라이빗 레지스트리](harbor.md)
- [ ] [레지스트리 HA와 미러링](registry-ha.md)
- [ ] [OCI Artifacts (Helm, Wasm, 범용 아티팩트)](oci-artifacts.md)

### 관측

- [ ] [cAdvisor로 컨테이너 모니터링](cadvisor.md)
- [ ] [컨테이너 디버깅 (docker exec, nsenter, docker debug)](container-debugging.md)

---

## 참고 레퍼런스

- [Docker Documentation](https://docs.docker.com/)
- [OCI Specifications](https://opencontainers.org/)
- [containerd Documentation](https://containerd.io/docs/)
- [Podman Documentation](https://podman.io/docs)
- [Rootless Containers](https://rootlesscontaine.rs/)
