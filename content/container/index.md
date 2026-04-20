---
title: "Container"
sidebar_label: "Container"
sidebar_position: 3
date: 2026-04-18
last_verified: 2026-04-18
tags:
  - container
  - index
---

# Container

> **티어**: 서브 (기반) — **작성 원칙**: 필수만
>
> 현대 배포의 기본 단위. K8s 학습의 선행 지식.
> 입문 튜토리얼은 공식 문서에 맡기고, **의사결정·실무 깊이**만 다룬다.

---

## 학습 경로

```
개념        컨테이너 vs VM · OCI 표준
빌드        Dockerfile · BuildKit · 이미지 최적화
런타임      containerd · runc · 런타임 비교
레지스트리   Harbor · OCI Artifacts · 서명
```

---

## 목차

### 기본 개념

- [x] [컨테이너 개념](concepts/container-concepts.md) — namespace·cgroup 기반, VM과의 실제 차이

### Docker & OCI

- [x] [Docker 아키텍처](docker-oci/docker-architecture.md) — dockerd, containerd, runc 계층
- [ ] OCI 스펙 — Image Spec, Runtime Spec, Distribution Spec, Referrers

### 이미지 빌드

- [ ] BuildKit 기본 — BuildKit 아키텍처, 캐시 마운트, SBOM 생성
- [ ] 이미지 최적화 — 레이어 전략, 멀티스테이지, Distroless, Chainguard
- [ ] 재현 가능 빌드 — 재현 가능한 빌드, 해시 안정성

### 런타임

- [ ] containerd·runc — containerd 2.x, CRI, sandbox API
- [ ] 런타임 대안 — gVisor, Kata, Firecracker, Wasm 런타임

### 레지스트리

- [ ] 레지스트리 비교 — Harbor, Zot, Distribution, ECR/GCR/ACR
- [ ] OCI Artifacts — OCI Artifacts, Referrers API, SBOM·서명 저장

---

## 이 카테고리의 경계

- K8s 환경의 컨테이너 운영은 `kubernetes/`로
- 이미지 서명·공급망 보안 **전략**은 `security/supply-chain/`으로
- 컨테이너 네트워크 중 CNI는 `network/`로

---

## 참고 표준

- OCI Specifications (image, runtime, distribution)
- containerd, runc 공식 문서
- BuildKit 프로젝트 문서
