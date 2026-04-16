---
title: "패키지 관리 (apt, dnf, apk, pacman)"
sidebar_label: "패키지 관리"
sidebar_position: 5
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - apt
  - dnf
  - apk
  - package-management
---

# 패키지 관리 (apt, dnf, apk, pacman)

패키지 매니저는 단순한 설치 도구가 아니다.
재현 가능한 빌드, 보안 공급망, 컨테이너 이미지 크기 최적화가
모두 패키지 관리 방식에서 결정된다.

## 패키지 매니저 현황 (2026)

| 매니저 | 최신 버전 | 배포판 | 비고 |
|--------|---------|--------|------|
| apt | 3.2 | Ubuntu 26.04 (Resolute) | 트랜잭션 히스토리 추가 |
| apt | 3.0 | Debian 13 (Trixie) | 컬럼형 출력, 색상 표시 |
| dnf4 | 4.x | RHEL 9, Rocky/Alma 9 | Python 구현, 안정판 |
| dnf5 | 5.x | Fedora 41+, RHEL 10+, Rocky/Alma 10+ | C++ 재작성, 기본값 |
| apk | v3 (v2 포맷 유지) | Alpine 3.23+ | Zstd, 새 서명 알고리즘 |
| pacman | 7.1 | Arch Linux | SigLevel 기본 Required 강화 |

---

## 핵심 명령어 비교

| 작업 | apt | dnf | apk | pacman |
|------|-----|-----|-----|--------|
| 설치 | `apt install pkg` | `dnf install pkg` | `apk add pkg` | `pacman -S pkg` |
| 제거 | `apt remove pkg` | `dnf remove pkg` | `apk del pkg` | `pacman -R pkg` |
| 제거+설정 | `apt purge pkg` | `dnf remove pkg` | `apk del pkg` | `pacman -Rns pkg` |
| 업그레이드 | `apt upgrade` | `dnf upgrade` | `apk upgrade` | `pacman -Syu` |
| 인덱스 갱신 | `apt update` | _(자동)_ | `apk update` | `pacman -Sy` |
| 검색 | `apt search pkg` | `dnf search pkg` | `apk search pkg` | `pacman -Ss pkg` |
| 정보 | `apt show pkg` | `dnf info pkg` | `apk info pkg` | `pacman -Si pkg` |
| 설치 목록 | `apt list --installed` | `dnf list installed` | `apk list -I` | `pacman -Q` |
| 불필요 패키지 제거 | `apt autoremove` | `dnf autoremove` | `apk autoremove` | `pacman -Rns $(pacman -Qdtq)` |
| 캐시 정리 | `apt clean` | `dnf clean all` | `apk cache clean` | `pacman -Sc` |
| 특정 버전 설치 | `apt install pkg=1.2.3` | `dnf install pkg-1.2.3` | `apk add pkg=1.2.3-r0` | `pacman -U pkg.tar.zst` |

---

## apt (Debian / Ubuntu)

### 현황

APT 3.2 (Ubuntu 26.04 "Resolute Raccoon" 탑재)의 핵심 신기능:
- **트랜잭션 히스토리**: 모든 install/upgrade/remove를 고유 ID와 함께 기록
- `apt history-list`, `apt history-info <ID>` 로 히스토리 조회
- `apt history-undo <ID>`, `apt history-redo <ID>`,
  `apt history-rollback <ID>` 로 작업 롤백/재실행
- APT 3.0 (Debian 13 "Trixie"): 컬럼형 출력, 색상 표시 도입

### 리포지토리 관리 — DEB822 형식

Ubuntu 23.10+부터 **DEB822 형식**이 표준이다.
`apt-key`는 Debian 13에서 완전 제거됐다.

```
기존 one-line (.list 파일):
deb [signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable

DEB822 (.sources 파일):
Enabled: yes
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Signed-By: /usr/share/keyrings/docker.gpg
```

| 항목 | one-line `.list` | DEB822 `.sources` |
|------|-----------------|------------------|
| 비활성화 | 파일 삭제/주석 | `Enabled: no` |
| 여러 타입 | 파일 2개 필요 | `Types: deb deb-src` |
| 키 직접 내장 | 불가 | 가능 (ASCII PGP) |
| Ubuntu 기본 | 구버전 | 23.10+ |

**Third-party 리포지토리 추가 (현대적 방법)**:

```bash
# GPG 키 저장
curl -fsSL https://pkg.example.com/gpg.key \
  | gpg --dearmor \
  | tee /etc/apt/keyrings/example.gpg > /dev/null
chmod 644 /etc/apt/keyrings/example.gpg

# DEB822 sources 파일 작성
cat > /etc/apt/sources.list.d/example.sources << 'EOF'
Enabled: yes
Types: deb
URIs: https://pkg.example.com/ubuntu
Suites: resolute
Components: main
Signed-By: /etc/apt/keyrings/example.gpg
EOF
```

### 패키지 버전 고정

```bash
# apt-mark hold: 업그레이드 방지
apt-mark hold nginx
apt-mark unhold nginx
apt-mark showhold

# APT 핀닝 (/etc/apt/preferences.d/nginx)
Package: nginx
Pin: version 1.24.*
Pin-Priority: 1001
```

핀 우선순위:
- `< 0`: 절대 설치 안 함
- `100`: 현재 버전 유지
- `500`: 리포지토리 기본값
- `> 1000`: 다운그레이드도 강제

---

## dnf (Fedora / RHEL)

### DNF4 vs DNF5

| 항목 | DNF4 | DNF5 |
|------|------|------|
| 구현 | Python | **C++** (libdnf5) |
| 설치 크기 | ~165 MB | ~114 MB |
| Python 의존성 | 필수 | 없음 |
| `repoquery` 속도 | 4.06s | **1.42s** |
| 메타데이터 | 전체 다운로드 | ~60% 감소 |
| 기본 배포판 | RHEL 9, Rocky/Alma 9 | **Fedora 41+, RHEL 10+, Rocky/Alma 10+** |

**DNF5 호환성 주의사항** (DNF4 스크립트 마이그레이션 시):

| 변경 항목 | DNF4 | DNF5 |
|----------|------|------|
| 캐시 경로 | `/var/cache/dnf/` | `/var/cache/libdnf5/` |
| 다운로드 옵션 | `--downloaddir` | `--destdir` |
| 보안 정보 | `dnf updateinfo` | `dnf5 advisory` |
| 설치 추적 | `dnf history userinstalled` | `dnf5 repoquery --userinstalled` |
| 셸 모드 | `dnf shell` | `dnf5 do` |
| alias | 지원 | **제거됨** |
| versionlock 설정 파일 | `/etc/yum/pluginconf.d/versionlock.list` | `/etc/dnf/versionlock.toml` |

### 리포지토리 관리

```ini
# /etc/yum.repos.d/example.repo
[example]
name=Example Repository
baseurl=https://pkg.example.com/rhel/$releasever/$basearch/
enabled=1
gpgcheck=1
gpgkey=https://pkg.example.com/RPM-GPG-KEY-example
```

### 패키지 버전 고정

```bash
# RHEL 9 / Rocky 9 / Alma 9 (DNF4 — 플러그인 별도 설치 필요)
dnf install python3-dnf-plugin-versionlock
dnf versionlock add nginx
dnf versionlock list
dnf versionlock delete nginx
# 설정 파일: /etc/dnf/plugins/versionlock.list

# RHEL 10 / Rocky 10 / Alma 10 / Fedora 41+ (DNF5 — 내장)
dnf5 versionlock add nginx
dnf5 versionlock list
dnf5 versionlock delete nginx
# 설정 파일: /etc/dnf/versionlock.toml (TOML 형식)

# /etc/dnf/dnf.conf 전역 제외 (DNF4/5 공통)
exclude=nginx*
```

---

## apk (Alpine Linux)

### 현황

Alpine 3.23.0 (2025-12-03)에 **APK v3** 포함:
- Zstd 압축 지원
- 새로운 서명 알고리즘 (SHA-256 이상)
- 현재 패키지/인덱스 포맷은 v2 유지 (점진적 전환 예정)

### 버전 고정 주의사항

Alpine은 **구버전 패키지를 리포지토리에서 삭제**한다.
특정 버전이 필요하면 해당 Alpine 릴리즈 리포지토리를 직접 지정해야 한다.

```bash
# semver 호환 범위 고정 (~= : >=1.24.0 <1.25.0, 패치만 허용)
apk add nginx~=1.24

# 정확한 버전 고정
apk add nginx=1.24.0-r1

# 구버전이 현재 리포에 없을 때 — 특정 릴리즈 리포 지정
apk add \
  --repository=https://dl-cdn.alpinelinux.org/alpine/v3.21/main \
  nginx=1.24.0-r1
```

고정된 버전은 `/etc/apk/world` 파일에 기록된다.

---

## pacman (Arch Linux)

### 보안 강화 (7.1)

pacman 7.1 (2025-11-01)부터 `SigLevel`의 기본값이
**Required**로 변경됐다. 미서명 패키지는 기본적으로 거부된다.

```bash
# /etc/pacman.conf
[options]
SigLevel = Required DatabaseOptional

# 패키지 설치/업그레이드
pacman -S nginx
pacman -Syu          # 전체 시스템 업그레이드

# 캐시에서 직접 설치 (다운그레이드)
pacman -U /var/cache/pacman/pkg/nginx-1.24.0-1-x86_64.pkg.tar.zst
```

---

## 컨테이너 환경 베스트 프랙티스

### Dockerfile 패턴

```dockerfile
# apt (Debian/Ubuntu)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl=7.88.* \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# dnf (RHEL 9 / Rocky 9 — DNF4)
RUN dnf install -y nginx-1.24.0 \
    && dnf clean all \
    && rm -rf /var/cache/dnf/*

# dnf (RHEL 10 / Rocky 10 — DNF5, 캐시 경로 다름)
RUN dnf install -y nginx-1.24.0 \
    && dnf clean all \
    && rm -rf /var/cache/libdnf5/*

# apk (Alpine) — --no-cache 권장
RUN apk add --no-cache \
    curl \
    nginx~=1.24

# apk — 빌드 의존성 일시 설치 후 제거
RUN apk add --no-cache --virtual .build-deps \
    gcc musl-dev \
    && make \
    && apk del .build-deps
```

**핵심 원칙**:

| 원칙 | apt | dnf | apk |
|------|-----|-----|-----|
| update + install 동일 RUN | **필수** | 불필요 (자동) | 불필요 |
| 캐시 정리 | `rm -rf /var/lib/apt/lists/*` | `dnf clean all` | `--no-cache` 플래그 |
| 권장 패키지 제외 | `--no-install-recommends` | 기본 제외 | 기본 제외 |
| 버전 고정 | `pkg=1.2.*` | `pkg-1.2.3` | `pkg~=1.2` |

> `apt-get update`와 `apt-get install`을 **별도 RUN**으로 나누면
> Docker 레이어 캐시가 stale 상태로 고정되어 구버전 패키지가
> 설치될 수 있다. 반드시 같은 RUN에서 실행한다.

### GPG 서명 검증

```bash
# apt: Signed-By 필드로 리포지토리별 키 신뢰
# dnf: gpgcheck=1 + gpgkey 필드
# apk: --allow-untrusted 사용 금지
# pacman: SigLevel = Required (7.1+ 기본값)
```

보안 공급망에서 서명 없는 패키지 설치(`--allow-unauthenticated`,
`--nogpgcheck`)는 CI에서도 사용하지 않는다.

---

## 프록시 환경 설정

```bash
# apt (/etc/apt/apt.conf.d/99proxy)
Acquire::http::Proxy "http://proxy.corp.example.com:3128";
Acquire::https::Proxy "http://proxy.corp.example.com:3128";
Acquire::http::No-Proxy "internal.example.com";

# dnf (/etc/dnf/dnf.conf [main])
proxy=http://proxy.corp.example.com:3128
proxy_auth_method=basic

# apk (/etc/apk/repositories + 환경변수)
export http_proxy=http://proxy.corp.example.com:3128
export https_proxy=http://proxy.corp.example.com:3128
```

### 오프라인/에어갭 미러 구성

| 도구 | 용도 |
|------|------|
| apt-cacher-ng | apt 투명 프록시 캐시 (소규모) |
| Nexus Repository | APT/YUM/APK 통합 (엔터프라이즈) |
| Artifactory | 에어갭 양방향 이관 지원 |
| createrepo_c | 로컬 DNF 리포지토리 생성 |

```bash
# 로컬 DNF 리포 생성
mkdir -p /srv/localrepo
cp *.rpm /srv/localrepo/
createrepo_c /srv/localrepo/

# /etc/yum.repos.d/local.repo
[local]
name=Local Repository
baseurl=file:///srv/localrepo
enabled=1
gpgcheck=0          # 내부 패키지만 있을 때만 0으로 설정
```

---

## 참고 자료

- [APT 3.2 릴리즈](https://pbxscience.com/apt-3-2-released-package-management-enters-the-traceable-era/)
  (확인: 2026-04-16)
- [Fedora DNF5 전환](https://fedoraproject.org/wiki/Changes/SwitchToDnf5)
  (확인: 2026-04-16)
- [DNF4→DNF5 변경사항](https://manpages.opensuse.org/Tumbleweed/dnf5/dnf5-changes-from-dnf4.7.en.html)
  (확인: 2026-04-16)
- [Alpine 3.23.0 APK v3 출시](https://alpinelinux.org/posts/Alpine-3.23.0-released.html)
  (확인: 2026-04-16)
- [pacman 7.1 — Phoronix](https://www.phoronix.com/news/Archinstall-3.0.12-Pacman-7.1)
  (확인: 2026-04-16)
- [Docker Dockerfile 베스트 프랙티스](https://docs.docker.com/build/building/best-practices/)
  (확인: 2026-04-16)
- [APT DEB822 형식 — Ubuntu Discourse](https://discourse.ubuntu.com/t/spec-apt-deb822-sources-by-default/29333)
  (확인: 2026-04-16)
- [Alpine Package Keeper 공식 문서](https://wiki.alpinelinux.org/wiki/Alpine_Package_Keeper)
  (확인: 2026-04-16)
