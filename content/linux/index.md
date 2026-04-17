---
title: "Linux"
date: 2026-04-16
tags:
  - linux
  - roadmap
sidebar_label: "Linux"
---

# 01. Linux

모든 인프라의 기반. OS를 이해하지 못하면 위에 올라가는
컨테이너·쿠버네티스·네트워크 모두 표면적으로만 다루게 된다.

글로벌 스탠다드 DevOps 엔지니어는 커널, 리소스 격리, 보안,
성능 분석까지 깊이 있게 이해한다.

## 목차

### 배포판과 기초

- [x] [리눅스 배포판 비교 (Ubuntu, RHEL, Alpine, AL2023)](distro-basics/linux-distro-comparison.md)
- [x] [Immutable OS (Flatcar, Bottlerocket, Talos Linux, Fedora CoreOS)](distro-basics/immutable-os.md)
- [x] [파일시스템 계층 구조 (FHS)](distro-basics/filesystem-hierarchy.md)
- [x] [사용자·그룹·퍼미션 (ACL, setuid)](distro-basics/user-group-permission.md)
- [x] [패키지 관리 (apt, dnf, apk, pacman)](distro-basics/package-management.md)
- [x] [Nix와 NixOS (선언적 패키지 관리)](distro-basics/nix-nixos.md)

### 부팅과 시스템 초기화

- [x] [부팅 프로세스 (BIOS/UEFI → GRUB → systemd)](boot-init/boot-process.md)
- [x] [systemd 서비스 관리](boot-init/systemd.md)
- [x] [systemd-timer와 crontab](boot-init/scheduled-tasks.md)
- [x] [커널 파라미터 (sysctl, /proc, /sys)](boot-init/kernel-parameters.md)
- [x] [커널 모듈 관리 (modprobe, lsmod)](boot-init/kernel-modules.md)

### 프로세스와 리소스 격리

- [x] [프로세스 관리와 시그널](process-isolation/process-management.md)
- [x] [리소스 제한 (ulimit, PAM limits)](process-isolation/resource-limits.md)
- [x] [cgroups v1 vs v2](process-isolation/cgroups.md)
- [x] [Linux Namespaces 전종 (PID, Mount, Net, UTS, IPC, User, Cgroup, Time)](process-isolation/namespaces.md)
- [x] [IPC 메커니즘 (pipe, socket, shared memory)](process-isolation/ipc-mechanisms.md)

### Linux 보안

- [x] [Linux Capabilities](linux-security/linux-capabilities.md)
- [x] [SELinux 기본과 운영](linux-security/selinux.md)
- [x] [AppArmor 기본과 운영](linux-security/apparmor.md)
- [ ] [seccomp-bpf와 시스템콜 필터링](linux-security/seccomp.md)
- [ ] [auditd 감사 로깅](linux-security/auditd.md)
- [ ] [PAM (Pluggable Authentication Modules)](linux-security/pam.md)
- [ ] [LUKS/dm-crypt 디스크 암호화](linux-security/luks-dm-crypt.md)

### 파일시스템과 스토리지

- [ ] [파일시스템 선택 (ext4, xfs, btrfs, zfs)](filesystem-storage/filesystem-comparison.md)
- [ ] [LVM 관리 (PV, VG, LV, 스냅샷)](filesystem-storage/lvm.md)
- [ ] [RAID 기초 (소프트웨어/하드웨어)](filesystem-storage/raid.md)
- [ ] [디스크 I/O 스케줄러 (none, mq-deadline, kyber, bfq)](filesystem-storage/io-scheduler.md)
- [ ] [마운트 옵션 튜닝 (noatime, barrier)](filesystem-storage/mount-tuning.md)

### 셸과 자동화

- [ ] [Bash 고급 문법 (배열, 함수, 파라미터 확장)](shell-automation/bash-advanced.md)
- [ ] [텍스트 처리 도구 (awk, sed, grep, cut, sort, uniq)](shell-automation/text-processing.md)
- [ ] [셸 스크립트 베스트 프랙티스 (set -euo pipefail)](shell-automation/shell-best-practices.md)
- [ ] [실무 자동화 스크립트 패턴](shell-automation/automation-patterns.md)

### 네트워크 기초 (Linux 관점)

- [ ] [iproute2 명령어 (ip, ss, tc)](network-basics/iproute2.md)
- [ ] [DNS 설정 (resolv.conf, systemd-resolved, NSS)](network-basics/dns-config.md)
- [ ] [방화벽 (iptables, nftables, firewalld, ufw)](network-basics/firewall.md)
- [ ] [SSH 설정과 키 관리 (ssh-agent, ProxyJump)](network-basics/ssh.md)

### 로깅

- [ ] [syslog, rsyslog, journald](logging/system-logging.md)
- [ ] [로그 로테이션 (logrotate)](logging/log-rotation.md)
- [ ] [대규모 로그 관리 전략](logging/log-management.md)

### 성능 분석

- [ ] [CPU 성능 분석 (perf, top, pidstat, mpstat)](performance/cpu-performance.md)
- [ ] [메모리 관리와 OOM (free, vmstat, slabtop)](performance/memory-oom.md)
- [ ] [디스크 I/O 분석 (iostat, iotop, blktrace)](performance/disk-io-performance.md)
- [ ] [io_uring과 비동기 I/O](performance/io-uring.md)
- [ ] [네트워크 성능 분석 (ss, iftop, nethogs, sar)](performance/network-performance.md)
- [ ] [eBPF 기반 성능 분석 (bpftrace, BCC, libbpf)](performance/ebpf-performance.md)
- [ ] [BPF CO-RE (Compile Once, Run Everywhere)](performance/bpf-co-re.md)
- [ ] [플레임 그래프 (Flame Graph)](performance/flame-graph.md)
- [ ] [USE 방법론과 Brendan Gregg 도구](performance/use-methodology.md)

### 터미널 환경

- [ ] [tmux와 screen](terminal/tmux-screen.md)
- [ ] [셸 환경 개선 (zsh, fish, oh-my-zsh, starship)](terminal/shell-environment.md)

### 가상화와 경량 격리

- [ ] [KVM과 QEMU 개념](virtualization/kvm-qemu.md)
- [ ] [libvirt와 virsh](virtualization/libvirt.md)
- [ ] [systemd-nspawn (경량 격리)](virtualization/systemd-nspawn.md)

---

## 참고 레퍼런스

- [The Linux Programming Interface (Michael Kerrisk)](https://man7.org/tlpi/)
- [Linux Performance (Brendan Gregg)](https://www.brendangregg.com/linuxperf.html)
- [Arch Linux Wiki](https://wiki.archlinux.org/)
- [Red Hat System Administrator's Guide](https://access.redhat.com/documentation/)
