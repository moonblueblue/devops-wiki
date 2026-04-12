---
title: "리눅스 패키지 관리 비교 가이드 (apt vs dnf vs apk)"
date: 2026-04-12
tags:
  - linux
  - package-management
  - apt
  - dnf
  - apk
  - devops
---
format: md

# 리눅스 패키지 관리

리눅스 배포판마다 패키지 관리자가 다르다. DevOps 엔지니어는 서버 환경(Ubuntu/Debian)과 컨테이너 환경(Alpine)을 오가므로 최소 세 가지는 알아야 한다.

## 핵심 명령어 비교표

| 작업 | APT (Debian/Ubuntu) | DNF (RHEL/Fedora) | APK (Alpine) |
|------|---------------------|---------------------|---------------|
| **패키지 인덱스 갱신** | `apt update` | (자동 갱신) | `apk update` |
| **시스템 업그레이드** | `apt upgrade` | `dnf upgrade` | `apk upgrade` |
| **패키지 설치** | `apt install nginx` | `dnf install nginx` | `apk add nginx` |
| **패키지 삭제** | `apt remove nginx` | `dnf remove nginx` | `apk del nginx` |
| **패키지+설정 삭제** | `apt purge nginx` | - | `apk del --purge nginx` |
| **패키지 검색** | `apt search nginx` | `dnf search nginx` | `apk search nginx` |
| **패키지 정보** | `apt show nginx` | `dnf info nginx` | `apk info nginx` |
| **설치된 패키지 목록** | `apt list --installed` | `dnf list installed` | `apk info` |
| **파일이 속한 패키지** | `dpkg -S /usr/bin/curl` | `dnf provides /usr/bin/curl` | `apk info --who-owns /usr/bin/curl` |
| **캐시 정리** | `apt clean` | `dnf clean all` | `apk cache clean` |
| **패키지 포맷** | `.deb` | `.rpm` | `.apk` |

## APT (Debian / Ubuntu)

가장 널리 쓰이는 패키지 관리자. 전체 리눅스 배포의 약 54%를 차지한다 (2026년 기준).

### 저장소 관리

```bash
# 저장소 설정 파일
/etc/apt/sources.list              # 기본 저장소
/etc/apt/sources.list.d/           # 추가 저장소 (파일별 관리)

# 서드파티 저장소 추가 (예: Docker)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg

cat <<EOF > /etc/apt/sources.list.d/docker.list
deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu noble stable
EOF

apt update
```

### 버전 고정 (Hold)

특정 패키지 버전을 유지하고 업그레이드를 방지한다.

```bash
# 패키지 버전 고정
apt-mark hold kubelet kubeadm kubectl

# 고정된 패키지 확인
apt-mark showhold

# 고정 해제
apt-mark unhold kubelet kubeadm kubectl
```

### APT Pinning (고급)

특정 저장소의 우선순위를 조정하여 패키지 소스를 제어한다.

```bash
# /etc/apt/preferences.d/kubernetes
Package: kubelet kubeadm kubectl
Pin: version 1.30.*
Pin-Priority: 1000
```

Pin-Priority 값:

| 우선순위 | 의미 |
|----------|------|
| 1001+ | 다운그레이드도 허용 |
| 990 | 대상 릴리스가 아닌 경우 기본값 |
| 500 | 일반 기본값 |
| 100 | 이미 설치된 패키지의 기본값 |
| -1 | 절대 설치하지 않음 |

### Dockerfile에서의 APT

```dockerfile
FROM ubuntu:24.04

# 레이어 최적화: update + install + clean 을 하나의 RUN에
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl \
      ca-certificates \
      jq && \
    rm -rf /var/lib/apt/lists/*
#   ^ 이미지 크기 줄이기 위해 캐시 삭제 필수
```

## DNF (Fedora / RHEL / Rocky / Alma)

엔터프라이즈 서버 시장의 약 43%를 차지하는 RHEL 계열의 패키지 관리자. YUM의 후속으로 더 빠른 의존성 해결과 깔끔한 코드베이스를 가진다.

### APT와의 주요 차이점

- **캐시 자동 갱신**: `dnf update`를 별도로 실행할 필요 없이, `dnf install` 시 자동으로 메타데이터를 갱신
- **모듈 스트림**: 같은 패키지의 여러 메이저 버전을 저장소에서 제공 (예: Node.js 18 vs 20)
- **트랜잭션 히스토리**: 설치/삭제 이력 관리 및 롤백 가능

### 저장소 관리

```bash
# 저장소 설정
/etc/yum.repos.d/                  # 저장소 설정 디렉토리

# 활성 저장소 목록
dnf repolist

# 저장소 추가
dnf config-manager --add-repo https://rpm.releases.hashicorp.com/RHEL/hashicorp.repo

# 저장소 활성화/비활성화
dnf config-manager --set-enabled crb
dnf config-manager --set-disabled epel-testing
```

### 버전 고정 (Versionlock)

```bash
# versionlock 플러그인 설치
dnf install python3-dnf-plugin-versionlock

# 현재 설치된 버전으로 고정
dnf versionlock add httpd

# 특정 버전으로 고정
dnf versionlock add httpd-2.4.57-*

# 고정된 패키지 확인
dnf versionlock list

# 고정 해제
dnf versionlock delete httpd

# 전체 해제
dnf versionlock clear
```

> 주의: httpd만 잠그고 httpd-core, mod_ssl 등 의존 패키지를 잠그지 않으면 버전 불일치가 발생할 수 있다. 패키지 패밀리 전체를 잠글 것.

### 트랜잭션 히스토리와 롤백

```bash
# 설치/업데이트 이력 보기
dnf history

# 특정 트랜잭션 상세
dnf history info 15

# 롤백 (해당 트랜잭션을 되돌림)
dnf history undo 15
```

## APK (Alpine Linux)

경량화에 최적화된 패키지 관리자. Docker/Kubernetes 컨테이너 베이스 이미지에서 가장 많이 사용된다.

### 왜 Alpine인가

- **이미지 크기**: `ubuntu:24.04` (~77MB) vs `alpine:3.21` (~7MB)
- **보안**: musl libc + 최소 패키지 = 공격 표면 축소
- **빌드 속도**: 패키지 적으면 설치도 빠름

### 저장소 관리

```bash
# 저장소 설정
/etc/apk/repositories

# 기본 구성 예시
http://dl-cdn.alpinelinux.org/alpine/v3.21/main
http://dl-cdn.alpinelinux.org/alpine/v3.21/community

# edge (최신 불안정) 저장소 추가 - 프로덕션에서는 비권장
http://dl-cdn.alpinelinux.org/alpine/edge/main
http://dl-cdn.alpinelinux.org/alpine/edge/community
http://dl-cdn.alpinelinux.org/alpine/edge/testing
```

### 버전 고정

```bash
# 설치 시 특정 버전 고정
apk add nginx=1.26.2-r0

# 패키지명에 = 포함하면 해당 버전에 고정됨
# /etc/apk/world 파일에 기록

# 업그레이드에서 특정 패키지 제외
apk upgrade --ignore nginx
```

### Dockerfile에서의 APK

```dockerfile
FROM alpine:3.21

# --no-cache: 인덱스를 임시로만 사용 (이미지 크기 절약)
RUN apk add --no-cache \
      curl \
      jq \
      bash

# 빌드 전용 패키지는 virtual로 묶어서 한 번에 삭제
RUN apk add --no-cache --virtual .build-deps \
      gcc \
      musl-dev \
      python3-dev && \
    pip install --no-cache-dir cryptography && \
    apk del .build-deps
```

### Alpine 주의사항

- **musl libc**: glibc 기반 바이너리가 동작하지 않을 수 있음
- **셸**: bash가 기본 설치되어 있지 않음 (`/bin/sh`는 BusyBox)
- **패키지 부족**: 일부 패키지가 없거나 이름이 다를 수 있음

## 보안 관련 공통 베스트 프랙티스

### 자동 보안 업데이트

```bash
# Ubuntu: unattended-upgrades
apt install unattended-upgrades
dpkg-reconfigure unattended-upgrades

# RHEL: dnf-automatic
dnf install dnf-automatic
systemctl enable --now dnf-automatic-install.timer
```

### 취약점 확인

```bash
# Ubuntu: 보안 업데이트만 확인
apt list --upgradable 2>/dev/null | grep -i security

# RHEL: 보안 관련 업데이트만 적용
dnf update --security
```

### GPG 서명 검증

저장소 추가 시 반드시 GPG 키를 검증할 것. `gpgcheck=0`이나 `--allow-unauthenticated`는 프로덕션에서 절대 사용 금지.

## 2025-2026 트렌드

- **APT 2.9+**: 성능 개선, 더 나은 트랜잭션 처리
- **DNF5**: Fedora 41+에서 기본. C++로 재작성되어 속도 대폭 향상
- **Alpine 3.23**: /usr merge 도입, systemd 지원 준비
- **불변 OS**: Fedora CoreOS, Ubuntu Core 등에서 전통적 패키지 관리 대신 이미지 기반 업데이트 확산

## 참고 링크

- [Linux Package Managers Compared (linuxblog.io)](https://linuxblog.io/linux-package-managers-apt-dnf-pacman-zypper/)
- [Linux Package Managers: Apt, Yum, DNF, Pacman, and Apk (cycle.io)](https://cycle.io/learn/linux-package-managers-apt-yum-dnf-packman-apk)
- [DNF Versionlock Plugin 문서](https://dnf-plugins-core.readthedocs.io/en/latest/versionlock.html)
- [Ubuntu Pinning HowTo](https://help.ubuntu.com/community/PinningHowto)
- [DNF Package Version Pinning (nixCraft)](https://www.cyberciti.biz/tips/yum-dnf-pin-package-versions-on-rhel-centos-rocky-oracle-almalinux.html)
