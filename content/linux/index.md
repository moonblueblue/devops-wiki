---
title: "Linux"
sidebar_label: "Linux"
sidebar_position: 1
date: 2026-04-18
last_verified: 2026-04-23
tags:
  - linux
  - index
---

<!-- @format -->

# Linux

> **티어**: 서브 (기반) — **작성 원칙**: 필수만
>
> Kubernetes · Observability · CI/CD 메인 카테고리를 받쳐주는 기반 지식.
> 트러블슈팅 시 반드시 도달하는 레이어와, 컨테이너·보안 이해의 선행 개념들로 구성.

---

## 학습 경로

| 단계 | 영역 | 핵심 주제 |
|:-:|---|---|
| 1 | 배포판·기본기 | RHEL·Ubuntu·Alpine · FHS · 퍼미션 · Immutable OS |
| 2 | 부팅·초기화 | systemd · 부팅 프로세스 · journald |
| 3 | 프로세스·격리 | namespace · cgroup · 시그널 · 리소스 제한 |
| 4 | 성능 분석 | CPU · 메모리·OOM · 디스크 I/O · eBPF |
| 5 | 파일시스템·스토리지 | ext4·XFS·Btrfs·ZFS · LVM |
| 6 | 보안 | Capabilities · seccomp · AppArmor · SELinux |
| 7 | 로깅 | syslog/rsyslog · 대규모 로그 관리 |

---

## 메인 카테고리와의 연결

| 이 카테고리의 글                               | 받쳐주는 메인                      |
| ---------------------------------------------- | ---------------------------------- |
| namespaces, cgroups                            | Kubernetes (Pod·컨테이너 기반)     |
| performance 4종, logging 2종                   | Observability (노드 메트릭·로그)   |
| systemd, boot-process                          | Kubernetes (kubelet·부팅 장애)     |
| linux-capabilities, seccomp, apparmor, selinux | Security (Pod securityContext)     |
| memory-oom, process-management                 | 장애 대응 (K8s에서 가장 흔한 증상) |

---

## 목차

### 배포판·기본기

- [x] [배포판 비교](./distro-basics/linux-distro-comparison.md) — RHEL·Ubuntu·Alpine·SUSE 계열 비교
- [x] [FHS](./distro-basics/filesystem-hierarchy.md) — `/usr`, `/var`, `/etc`, `/run` 등 표준 구조
- [x] [사용자·그룹·퍼미션](./distro-basics/user-group-permission.md) — rwx, SUID/SGID, sticky, ACL
- [x] [Immutable OS](./distro-basics/immutable-os.md) — Talos, Bottlerocket, Flatcar (K8s 노드 OS)

### 부팅·초기화

- [x] [부팅 프로세스](./boot-init/boot-process.md) — BIOS/UEFI → shim → GRUB → initramfs → systemd
- [x] [systemd 서비스 관리](./boot-init/systemd.md) — unit, target, cgroup 통합, journald

### 프로세스·리소스 격리

- [x] [Namespaces](./process-isolation/namespaces.md) — pid, mnt, net, user, ipc, uts, cgroup, time
- [x] [cgroups](./process-isolation/cgroups.md) — v1 vs v2, CPU/Memory/IO 컨트롤러, PSI
- [x] [프로세스·시그널](./process-isolation/process-management.md) — 상태(R/S/D/Z), fork/exec, SIGTERM/KILL
- [x] [리소스 제한](./process-isolation/resource-limits.md) — ulimit, PAM limits, RLIMIT\_\* vs cgroup

### 성능 분석

- [x] [CPU 성능 분석](./performance/cpu-performance.md) — USE 방법론, run queue, context switch, perf
- [x] [메모리 관리·OOM](./performance/memory-oom.md) — MemAvailable, swap, OOM killer, THP
- [x] [디스크 I/O 분석](./performance/disk-io-performance.md) — iostat, I/O scheduler, fsync 병목
- [x] [eBPF 성능 분석](./performance/ebpf-performance.md) — bpftrace, BPF CO-RE, Brendan Gregg 툴킷

### 파일시스템·스토리지

- [x] [파일시스템](./filesystem-storage/filesystem-comparison.md) — ext4 · XFS · Btrfs · ZFS · EROFS
- [x] [LVM](./filesystem-storage/lvm.md) — PV/VG/LV, Thin Pool, 스냅샷, 온라인 확장

### 보안

- [x] [Capabilities](./linux-security/linux-capabilities.md) — CAP\_\*, 바운딩·앰비언트·인헤리터블
- [x] [seccomp-bpf](./linux-security/seccomp.md) — Mode 1/2, BPF 필터, Docker/K8s 프로파일
- [x] [AppArmor](./linux-security/apparmor.md) — 프로파일 기반 MAC (Ubuntu/SUSE)
- [x] [SELinux](./linux-security/selinux.md) — 레이블 기반 MAC (RHEL 계열)

### 로깅

- [x] [syslog/rsyslog](./logging/system-logging.md) — rsyslog vs journald, 저널 포워딩
- [x] [대규모 로그 관리](./logging/log-management.md) — 로테이션, 원격 전송, 압축·보존

---

## 이 카테고리의 경계

- Docker/K8s의 namespace·cgroup **사용 사례**는 `container/`·`kubernetes/`에 맡긴다
- eBPF 응용 중 네트워킹은 `network/`, 관측은 `observability/`, 보안은 `security/`로
- 네트워크 도구(iproute2, firewall, DNS, SSH)는 `network/` 카테고리로
- 가상화·쉘 스크립트 심화·커널 개발 영역은 범위 밖

---

## 참고 표준

- CIS Linux Benchmarks
- Brendan Gregg, _Systems Performance_ (2nd ed.)
- man7.org 공식 man 페이지
- kernel.org 공식 문서
