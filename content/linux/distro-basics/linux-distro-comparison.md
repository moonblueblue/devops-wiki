---
title: "리눅스 배포판 비교 (Ubuntu, RHEL, Alpine, AL2023)"
sidebar_label: "배포판 비교"
sidebar_position: 1
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - ubuntu
  - rhel
  - alpine
  - amazon-linux
---

# 리눅스 배포판 비교 (Ubuntu, RHEL, Alpine, AL2023)

배포판 선택은 단순한 취향 문제가 아니다. 운영 환경, 지원 주기,
libc 호환성, 컨테이너 이미지 크기가 모두 달라진다.
잘못된 선택은 수년 뒤 마이그레이션 비용으로 돌아온다.

## 한눈에 보기

| 배포판 | 최신 버전 | 패키지 관리 | libc | Init | 지원 기간 |
|--------|----------|-----------|------|------|---------|
| Ubuntu LTS | 24.04 / 26.04 | apt / dpkg | glibc 2.39 | systemd | 5년 (Pro 10년) |
| RHEL 10 | 10.x | dnf / rpm | glibc 2.39 | systemd | 10년 |
| Rocky Linux 10 | 10.0 | dnf / rpm | glibc 2.39 | systemd | 10년 |
| AlmaLinux 10 | 10.0 | dnf / rpm | glibc 2.39 | systemd | 10년 |
| Alpine | 3.23 | apk | **musl 1.2.x** | OpenRC | 브랜치당 2년 |
| Amazon Linux 2023 | 2023 | dnf | glibc 2.34+ | systemd | 2029-06 |
| Debian | 13 (Trixie) | apt / dpkg | glibc 2.41 | systemd | 5년 |

---

## Ubuntu LTS

### 특징

2년마다 LTS 출시, 5년 표준 지원 + Ubuntu Pro(무료)로 10년.
패키지 생태계가 가장 넓고(60,000+) 최신 커널 채택이 빠르다.

```
Ubuntu 24.04 LTS "Noble Numbat"     릴리즈: 2024-04-25  EOL: 2029-04
                                    Ubuntu Pro ESM:      2034-04
Ubuntu 26.04 LTS "Resolute Raccoon" 릴리즈: 2026-04-23  EOL: 2031-04
```

### 적합한 환경

- 범용 서버, CI/CD 빌드 에이전트
- Kubernetes 워커 노드 (EKS, GKE 공식 지원)
- glibc 기반 바이너리를 그대로 실행하는 환경

### 주의사항

비 LTS(예: 25.04)는 지원이 9개월에 불과하다.
프로덕션에는 **반드시 LTS만** 사용한다.

---

## RHEL 계열 (RHEL / Rocky / AlmaLinux)

### 버전 현황

```
RHEL 10.0        출시: 2025-05-20   EOL: 2035
Rocky Linux 10.0 출시: 2025-06-11   EOL: 2035
AlmaLinux 10.0   출시: 2025-05-27   EOL: 2035
```

### 세 배포판 비교

| 항목 | RHEL | Rocky Linux | AlmaLinux |
|------|------|-------------|-----------|
| 비용 | 유료 | 무료 | 무료 |
| RHEL 호환성 | 기준 | 1:1 바이너리 호환 | ABI 호환 |
| 구형 HW 지원 (v2) | 없음 | 없음 | **별도 빌드 제공** |
| FIPS 140-3 | 공식 인증 | 별도 설정 | 별도 설정 |
| 기업 지원 | Red Hat | CIQ / 파트너사 | CloudLinux |
| RISC-V 지원 | 없음 | 있음 | 없음 |

> **x86_64-v3 주의**: RHEL 10 / Rocky 10은 Intel Haswell(2013)
> 이후 또는 **AMD Zen 1 이후** CPU만 지원한다.
> AMD Bulldozer / Piledriver / Steamroller / Excavator 계열
> (Ryzen·EPYC 이전 세대) 서버라면 AlmaLinux 10을 선택한다.

### RHEL 10 주요 신기능

- **Image Mode (bootc)**: OS를 컨테이너 이미지로 배포 — 불변 인프라 실현
- **포스트 퀀텀 암호화**: NIST 표준 양자 내성 알고리즘 최초 채택
- **DNF 개선**: zstd 압축으로 메타데이터 속도 향상

### 적합한 환경

- 금융·공공 규제 환경 (RHEL: FIPS, STIG, CC 인증 필요 시)
- 온프레미스 장기 운영 서버 (10년 지원 주기)
- CentOS 7/8 마이그레이션 대상 (Rocky/AlmaLinux)

---

## Alpine Linux

### 특징

컨테이너 베이스 이미지의 사실상 표준.
BusyBox + musl libc 기반으로 이미지가 극단적으로 작다.

```
Alpine 3.23  릴리즈: 2025-12-03  EOL: 2027-11-01
Alpine 3.22  릴리즈: 2025-05     EOL: 2027-05-01
Alpine 3.21  릴리즈: 2024-11     EOL: 2026-11-01
```

5월/11월 릴리즈 주기, 브랜치당 **2년** 지원.
현재 3.21 ~ 3.23 총 **3개** 브랜치 동시 유지.
(3.20은 2026-04-01 EOL)

### 컨테이너 이미지 크기 비교

아래 수치는 Docker Hub 기준 압축(compressed) 크기다.

| 이미지 | 압축 크기 |
|--------|---------|
| `alpine:3.23` | **~3.7 MB** |
| `debian:trixie-slim` | ~28 MB |
| `ubuntu:24.04` | ~29 MB |
| `amazonlinux:2023` | ~60 MB |
| `debian:trixie` | ~117 MB |

### musl libc vs glibc — 실무 함정

Alpine의 최대 주의사항이다.
대부분의 리눅스 바이너리는 glibc를 동적 링크한다.
Alpine의 musl libc는 링커 경로가 달라 **glibc 바이너리가 실행되지 않는다.**

```bash
# glibc 링크 바이너리를 Alpine에서 실행 시 발생하는 오류
/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2: No such file or directory
```

**언어별 Alpine 적합성**

| 언어 / 런타임 | Alpine 권장 | 이유 |
|-------------|-----------|------|
| Go | 최적 | CGO 비활성화 시 정적 바이너리 |
| Rust | 최적 | musl 타겟 크로스컴파일 가능 |
| Python | 주의 | PyPI `manylinux` wheel이 glibc용 |
| Java | 주의 | Alpine 전용 Temurin JDK 필요 |
| Node.js | 주의 | 네이티브 모듈은 소스 컴파일 필요 |

**Kubernetes DNS 이슈**:
musl과 glibc는 DNS 리졸버 동작이 다르다.
musl은 ndots 기준 미달 쿼리에서 search 도메인을 순차 시도하다
FQDN 폴백을 건너뛰는 케이스가 있어 DNS 응답 지연이 발생할 수 있다.
ndots 기본값(5)이 높은 Kubernetes 환경에서 특히 두드러진다.

```yaml
# Pod spec에서 ndots 줄이기
dnsConfig:
  options:
    - name: ndots
      value: "2"
```

### 보안 강화 이미지 대안

공급망 보안(SLSA) 요건이나 CVE 최소화가 중요한 환경에서는
Alpine보다 더 작은 공격 표면을 가진 아래 이미지를 검토한다.

- **Google Distroless**: 셸·패키지 관리자 없이 런타임만 포함
- **Chainguard Images**: Wolfi 기반, CVE 0 유지를 목표로 일별 재빌드

### 적합한 환경

- Go / Rust 정적 바이너리 컨테이너
- 공격 표면을 최소화해야 하는 보안 민감 컨테이너
- 이미지 크기가 중요한 엣지 환경

---

## Amazon Linux 2023 (AL2023)

### AL2 vs AL2023 핵심 차이

| 항목 | Amazon Linux 2 | Amazon Linux 2023 |
|------|---------------|------------------|
| 기반 | RHEL/CentOS 7 계열 | Fedora 기반 |
| 패키지 | yum | **dnf** |
| Python | 2.7 포함 | Python 3 전용 |
| OpenSSL | 1.0.2 | **3.0+** |
| SELinux | disabled | **Permissive 기본 활성화** |
| 네트워크 | ISC dhclient | **systemd-networkd** |
| 커널 | 4.14 / 5.10 | 6.1 / 6.12 / 6.18 |
| 버전 잠금 | 없음 | **기본 활성화** (재현성 보장) |
| EOL | **2026-06-30** | 2029-06-30 |

> **AL2 EOL 임박**: 2026-06-30 종료. EKS AMI는 이미 2025-11-26
> 지원 종료됐다. AL2023으로 마이그레이션이 필요하다.
>
> 마이그레이션 시 주요 장애물:
> - yum → dnf 스크립트/Ansible 플레이북 수정
> - Python 2 의존성 제거 또는 대체
> - ISC dhclient → systemd-networkd 네트워크 설정 재작성

### 주요 특징

- **분기별 릴리즈**: 예측 가능한 업데이트 주기
- **버전 잠금**: AMI 빌드 시점 리포지토리 고정 → 재현 가능한 인프라
- **커널 라이브 패칭**: x86_64 + ARM64 지원
- **AWS 최적화**: EC2 네트워킹, EKS, Lambda에 맞춰 튜닝된 AMI 제공

### 적합한 환경

- AWS EC2 / EKS / ECS 네이티브 워크로드
- AL2에서 마이그레이션하는 기존 AWS 인프라

---

## Debian

### 특징

안정성이 최우선인 배포판. 패키지 버전이 보수적이다.
`stable → testing → unstable(sid)` 세 트리로 운영.

```
Debian 13 "Trixie"   릴리즈: 2025-08-09  EOL: 2030-08 (LTS 포함)
Debian 12 "Bookworm" 릴리즈: 2023-06-10  EOL: 2028-06
```

- 지원 주기: 3년 정규 + 2년 LTS = **총 5년**
- 광범위한 아키텍처 지원 (riscv64 Debian 13부터 공식 추가)
- Ubuntu의 기반 배포판 (`ubuntu:*` 이미지의 upstream)

### 적합한 환경

- 데이터베이스 서버 (안정성 최우선)
- 컨테이너 이미지 (debian:slim 시리즈)
- 최신 기능보다 검증된 패키지가 필요한 환경

---

## 환경별 배포판 선택 가이드

```
어떤 환경인가?
│
├─ AWS 클라우드
│   ├─ AWS 네이티브 워크로드 ──────── Amazon Linux 2023
│   └─ 범용 / 이식성 중시 ──────────── Ubuntu LTS
│
├─ 온프레미스 엔터프라이즈
│   ├─ 규제·인증 필요 (FIPS, STIG) ── RHEL
│   ├─ RHEL 호환 + 무료 (신형 HW) ─── Rocky Linux
│   └─ RHEL 호환 + 무료 (구형 HW) ─── AlmaLinux
│
├─ 컨테이너 베이스 이미지
│   ├─ Go / Rust 정적 바이너리 ──────── Alpine
│   ├─ CVE 최소화 / 공급망 보안 ──────── Distroless / Chainguard
│   ├─ Python / Java / Node.js ───────── Debian slim
│   └─ 범용 (glibc 호환 최우선) ─────── Ubuntu
│
└─ 안정성 최우선 서버
    └─ 데이터베이스, 장기 운영 ─────── Debian stable
```

> Kubernetes 노드 OS로 불변 인프라를 구성할 경우
> Flatcar, Bottlerocket, Talos Linux 같은 컨테이너 특화
> Immutable OS도 선택지다. → [Immutable OS 비교](./immutable-os.md)

---

## EOL 타임라인

```
2026  ██ Alpine 3.20 EOL (2026-04-01, 이미 종료)
      ██ AL2 EOL (2026-06-30) ← 마이그레이션 필요
      ██ Alpine 3.21 EOL (2026-11-01)
2027  ██ Alpine 3.22 EOL (2027-05-01)
      ██ Alpine 3.23 EOL (2027-11-01)
2028  ██ Debian 12 EOL (2028-06)
2029  ██ AL2023 EOL (2029-06-30)
2030  ██ Debian 13 EOL (2030-08)
2031  ██ Ubuntu 26.04 LTS EOL (2031-04)
2032  ██ RHEL/Rocky/AlmaLinux 9 EOL
2034  ██ Ubuntu 24.04 LTS Pro (ESM) EOL (2034-04)
2035  ██ RHEL/Rocky/AlmaLinux 10 EOL
```

---

## 참고 자료

- [Ubuntu 릴리즈 사이클](https://ubuntu.com/about/release-cycle)
  (확인: 2026-04-16)
- [RHEL 10 공식 발표 — Red Hat](https://www.redhat.com/en/about/press-releases/red-hat-introduces-rhel-10)
  (확인: 2026-04-16)
- [Rocky Linux 10.0 GA](https://rockylinux.org/news/rocky-linux-10-0-ga-release)
  (확인: 2026-04-16)
- [Alpine Linux 릴리즈](https://alpinelinux.org/releases/)
  (확인: 2026-04-16)
- [Alpine EOL 일정 — endoflife.date](https://endoflife.date/alpine-linux)
  (확인: 2026-04-16)
- [Debian 13 Trixie 릴리즈](https://www.debian.org/News/2025/20250809)
  (확인: 2026-04-16)
- [Amazon Linux 2023 공식 문서](https://docs.aws.amazon.com/linux/al2023/ug/what-is-amazon-linux.html)
  (확인: 2026-04-16)
- [AL2 vs AL2023 비교](https://docs.aws.amazon.com/linux/al2023/ug/compare-with-al2.html)
  (확인: 2026-04-16)
- [musl libc Functional Differences from glibc](https://wiki.musl-libc.org/functional-differences-from-glibc.html)
  (확인: 2026-04-16)
- [glibc vs musl — Chainguard Academy](https://edu.chainguard.dev/chainguard/chainguard-images/about/images-compiled-programs/glibc-vs-musl/)
  (확인: 2026-04-16)
- [x86_64-v3 for RHEL 10 — Red Hat Developer](https://developers.redhat.com/articles/2024/01/02/exploring-x86-64-v3-red-hat-enterprise-linux-10)
  (확인: 2026-04-16)
