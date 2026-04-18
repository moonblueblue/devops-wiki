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

# Linux

> **티어**: 서브 (기반) — **작성 원칙**: 필수만
>
> 모든 인프라의 기반이자 트러블슈팅의 최종 도달 레이어.
> K8s·Observability 학습의 선행 지식이다.

---

## 학습 경로

```
기본기         Distro → Boot/Init → Shell
컨테이너 기반   cgroups · namespaces · Capabilities
성능·관측      USE 방법론 · perf · eBPF
보안           SELinux · AppArmor · auditd · LUKS
스토리지       Filesystem · LVM · I/O scheduler
```

---

## 목차

### 배포판·기본기

- [ ] linux-distro-comparison — RHEL·Ubuntu·Alpine·SUSE 계열 비교
- [ ] filesystem-hierarchy — `/usr`, `/var`, `/etc`, `/run` 등 표준 구조
- [ ] user-group-permission — rwx, SUID/SGID, sticky, ACL
- [ ] immutable-os — Talos, Bottlerocket, Flatcar, Fedora Silverblue

### Boot & Init

- [ ] boot-process — BIOS/UEFI → shim → GRUB → initramfs → systemd
- [ ] systemd — unit, target, cgroup 통합, journald, systemd-cryptenroll

### Process Isolation (컨테이너 기반)

- [ ] namespaces — pid, mnt, net, user, ipc, uts, cgroup, time
- [ ] cgroups — v1 vs v2, CPU/Memory/IO 컨트롤러, PSI
- [ ] process-management — 상태(R/S/D/Z), fork/exec, SIGTERM/KILL
- [ ] resource-limits — ulimit, PAM limits, RLIMIT_* vs cgroup

### Performance

- [ ] cpu-performance — USE 방법론, run queue, context switch, perf
- [ ] memory-oom — MemAvailable, swap, OOM killer, THP
- [ ] disk-io-performance — iostat, I/O scheduler, fsync 병목
- [ ] ebpf-performance — bpftrace, BPF CO-RE, Brendan Gregg 툴킷

### Filesystem & Storage

- [ ] filesystem-comparison — ext4 · XFS · Btrfs · ZFS · EROFS
- [ ] lvm — PV/VG/LV, Thin Pool, 스냅샷, 온라인 확장
- [ ] io-scheduler — none, mq-deadline, bfq, io_uring

### Security

- [ ] linux-capabilities — CAP_*, 바운딩·앰비언트·인헤리터블
- [ ] seccomp — Mode 1/2, BPF 필터, Docker/K8s 프로파일
- [ ] apparmor-selinux — 두 MAC 모델 비교와 사용 시점
- [ ] pam — 인증 체인, 2FA, pam_faillock
- [ ] luks-dm-crypt — LUKS2, TPM2, Clevis+Tang HA
- [ ] auditd — 규칙 우선순위, audisp-remote, laurel

### Logging

- [ ] system-logging — rsyslog vs journald, 저널 포워딩
- [ ] log-management — 로테이션, 원격 전송, 압축·보존

---

## 이 카테고리의 경계

- Docker/K8s의 namespace·cgroup **사용 사례**는 `container/`·`kubernetes/`에 맡긴다
- eBPF 응용 중 네트워킹은 `network/`, 관측은 `observability/`, 보안은 `security/`로
- 가상화(KVM·vSphere·Proxmox) 심화는 별도 필요 시 추가

---

## 참고 표준

- CIS Linux Benchmarks
- Brendan Gregg, *Systems Performance* (2nd ed.)
- man7.org 공식 man 페이지
- kernel.org 공식 문서
