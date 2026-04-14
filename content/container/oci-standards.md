---
title: "OCI 표준 (이미지, 런타임, 배포)"
date: 2026-04-14
tags:
  - container
  - oci
  - standards
  - image-spec
  - runtime-spec
sidebar_label: "OCI 표준"
---

# OCI 표준 (이미지, 런타임, 배포)

## 1. OCI란

OCI(Open Container Initiative)는 Linux Foundation 산하의 컨테이너 표준화 프로젝트다.
Docker, Google, Red Hat 등이 참여하여 컨테이너 생태계의 상호운용성을 보장한다.

```
OCI 표준 4종
┌────────────────┬────────────────────────────────┐
│ Image Spec     │ 이미지 레이어, manifest, config │
│ Runtime Spec   │ 컨테이너 실행 방식, 라이프사이클│
│ Distribution   │ 레지스트리 API                 │
│ Spec           │                                │
│ Artifact Spec  │ 이미지 외 아티팩트 저장        │
└────────────────┴────────────────────────────────┘
```

---

## 2. OCI Image Spec

이미지는 레이어 스택 구조다.

```
이미지 = Manifest + Config + Layers

Manifest
├── config (sha256:abc...)     → 이미지 설정 JSON
└── layers
    ├── sha256:def...           → Base OS (Alpine)
    ├── sha256:ghi...           → 라이브러리
    └── sha256:jkl...           → 앱 코드
```

**Config JSON 주요 필드:**

```json
{
  "architecture": "amd64",
  "os": "linux",
  "config": {
    "User": "appuser",
    "Env": ["PATH=/usr/local/bin:/usr/bin:/bin"],
    "Cmd": ["node", "server.js"],
    "WorkingDir": "/app"
  },
  "rootfs": {
    "type": "layers",
    "diff_ids": ["sha256:...", "sha256:..."]
  }
}
```

**레이어 캐싱 원리:**

```
Layer 1: Base OS          → 여러 이미지 공유 (캐시)
Layer 2: Node.js 설치    → Node.js 앱 공통
Layer 3: npm install     → package.json 변경 시만 재빌드
Layer 4: COPY . .        → 코드 변경 시 재빌드
```

의존성 파일을 먼저 복사하는 이유가 바로 이 캐싱 구조 때문이다.

---

## 3. OCI Runtime Spec

런타임은 **Bundle**을 실행한다.

```
Bundle 구조
container/
├── config.json    ← 네임스페이스, cgroup, 마운트 등 모든 설정
└── rootfs/        ← 컨테이너 파일시스템
    ├── bin/
    ├── lib/
    └── app/
```

**컨테이너 라이프사이클:**

```
create → start → running → (pause → resume) → delete
                    ↓
                    kill (강제 종료)
```

```bash
# runc로 OCI Bundle 직접 실행
mkdir -p container/rootfs
docker export $(docker create alpine) | tar -xf - -C container/rootfs

cd container
runc spec              # config.json 생성

runc create mycontainer
runc start mycontainer
runc list
runc state mycontainer
runc delete mycontainer
```

---

## 4. OCI Distribution Spec

레지스트리 HTTP API 표준이다. Docker Hub, ECR, Harbor 등 모든 레지스트리가 구현한다.

```
주요 API 엔드포인트:
GET  /v2/                              → 레지스트리 확인
GET  /v2/<name>/manifests/<ref>        → Manifest 조회
PUT  /v2/<name>/manifests/<tag>        → Manifest 업로드
GET  /v2/<name>/blobs/<digest>         → Layer 다운로드
POST /v2/<name>/blobs/uploads/         → Layer 업로드 시작
GET  /v2/<name>/tags/list              → 태그 목록
```

**Push 흐름:**

```
docker push myimage:1.0
    ↓
1. POST /blobs/uploads/    → 업로드 세션 시작
2. PATCH (데이터 전송)    → Layer 청크 전송
3. PUT (완료)             → Layer 커밋 (digest 반환)
4. PUT /manifests/1.0     → Manifest 등록
```

---

## 5. OCI Artifact

컨테이너 이미지 외 다양한 아티팩트를 레지스트리에 저장할 수 있다.

| 아티팩트 유형 | 용도 |
|------------|------|
| Helm Chart | K8s 앱 패키지 |
| SBOM | 소프트웨어 구성 명세 |
| Cosign 서명 | 이미지 서명·검증 |
| OPA Policy | 정책 파일 |
| Terraform Module | IaC 모듈 |

```bash
# Helm Chart를 OCI 레지스트리에 저장
helm package ./mychart
helm push mychart-1.0.0.tgz oci://registry.example.com/charts

# SBOM 저장 (oras 도구)
syft myapp:latest -o spdx-json > sbom.json
oras push registry.example.com/myapp:latest-sbom \
  --artifact-type application/vnd.sbom.v1+json \
  sbom.json

# 레지스트리에서 이미지 메타데이터 확인 (skopeo)
skopeo inspect docker://nginx:latest
skopeo list-tags docker://docker.io/library/nginx
```

---

## 6. 주요 OCI 구현체

| 범주 | 구현체 | 특징 |
|-----|--------|------|
| High-level 런타임 | containerd | K8s 기본 |
| | CRI-O | CNCF, RHEL |
| | Podman | daemon-less |
| Low-level 런타임 | runc | Go, 가장 널리 사용 |
| | crun | C, 더 빠름 |
| | gVisor | 샌드박스 보안 |
| | Kata Containers | VM 기반 격리 |
| 레지스트리 | Docker Registry | 레퍼런스 구현 |
| | Harbor | 엔터프라이즈 |
| | Distribution | CNCF |
| 도구 | skopeo | 이미지 전송·검사 |
| | crane | 이미지 조작 |
| | oras | Artifact 관리 |

---

## 참고 문서

- [OCI 공식 사이트](https://opencontainers.org/)
- [OCI Image Spec](https://github.com/opencontainers/image-spec)
- [OCI Runtime Spec](https://github.com/opencontainers/runtime-spec)
- [OCI Distribution Spec](https://github.com/opencontainers/distribution-spec)
