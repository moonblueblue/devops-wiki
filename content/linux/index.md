---
title: "Linux"
sidebar_label: "Linux"
sidebar_position: 1
date: 2026-04-18
last_verified: 2026-04-18
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

- [ ] linux-distro-comparison — RHEL·Ubuntu·Alpine·SUSE 계열 비교
- [ ] filesystem-hierarchy — `/usr`, `/var`, `/etc`, `/run` 등 표준 구조
- [ ] user-group-permission — rwx, SUID/SGID, sticky, ACL
- [ ] immutable-os — Talos, Bottlerocket, Flatcar (K8s 노드 OS)

### 부팅·초기화

- [ ] boot-process — BIOS/UEFI → shim → GRUB → initramfs → systemd
- [ ] systemd — unit, target, cgroup 통합, journald

### 프로세스·리소스 격리

- [ ] namespaces — pid, mnt, net, user, ipc, uts, cgroup, time
- [ ] cgroups — v1 vs v2, CPU/Memory/IO 컨트롤러, PSI
- [ ] process-management — 상태(R/S/D/Z), fork/exec, SIGTERM/KILL
- [ ] resource-limits — ulimit, PAM limits, RLIMIT\_\* vs cgroup

### 성능 분석

- [ ] cpu-performance — USE 방법론, run queue, context switch, perf
- [ ] memory-oom — MemAvailable, swap, OOM killer, THP
- [ ] disk-io-performance — iostat, I/O scheduler, fsync 병목
- [ ] ebpf-performance — bpftrace, BPF CO-RE, Brendan Gregg 툴킷

### 파일시스템·스토리지

- [ ] filesystem-comparison — ext4 · XFS · Btrfs · ZFS · EROFS
- [ ] lvm — PV/VG/LV, Thin Pool, 스냅샷, 온라인 확장

### 보안

- [ ] linux-capabilities — CAP\_\*, 바운딩·앰비언트·인헤리터블
- [ ] seccomp — Mode 1/2, BPF 필터, Docker/K8s 프로파일
- [ ] apparmor — 프로파일 기반 MAC (Ubuntu/SUSE)
- [ ] selinux — 레이블 기반 MAC (RHEL 계열)

### 로깅

- [ ] system-logging — rsyslog vs journald, 저널 포워딩
- [ ] log-management — 로테이션, 원격 전송, 압축·보존

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
