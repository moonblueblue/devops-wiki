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

- [ ] [리눅스 배포판 비교 (Ubuntu, RHEL, Alpine, AL2023)](linux-distro-comparison.md)
- [ ] [Immutable OS (Flatcar, Bottlerocket, Talos Linux, Fedora CoreOS)](immutable-os.md)
- [ ] [파일시스템 계층 구조 (FHS)](filesystem-hierarchy.md)
- [ ] [사용자·그룹·퍼미션 (ACL, setuid)](user-group-permission.md)
- [ ] [패키지 관리 (apt, dnf, apk, pacman)](package-management.md)
- [ ] [Nix와 NixOS (선언적 패키지 관리)](nix-nixos.md)

### 부팅과 시스템 초기화

- [ ] [부팅 프로세스 (BIOS/UEFI → GRUB → systemd)](boot-process.md)
- [ ] [systemd 서비스 관리](systemd.md)
- [ ] [systemd-timer와 crontab](scheduled-tasks.md)
- [ ] [커널 파라미터 (sysctl, /proc, /sys)](kernel-parameters.md)
- [ ] [커널 모듈 관리 (modprobe, lsmod)](kernel-modules.md)

### 프로세스와 리소스 격리

- [ ] [프로세스 관리와 시그널](process-management.md)
- [ ] [리소스 제한 (ulimit, PAM limits)](resource-limits.md)
- [ ] [cgroups v1 vs v2](cgroups.md)
- [ ] [Linux Namespaces 전종 (PID, Mount, Net, UTS, IPC, User, Cgroup, Time)](namespaces.md)
- [ ] [IPC 메커니즘 (pipe, socket, shared memory)](ipc-mechanisms.md)

### Linux 보안

- [ ] [Linux Capabilities](linux-capabilities.md)
- [ ] [SELinux 기본과 운영](selinux.md)
- [ ] [AppArmor 기본과 운영](apparmor.md)
- [ ] [seccomp-bpf와 시스템콜 필터링](seccomp.md)
- [ ] [auditd 감사 로깅](auditd.md)
- [ ] [PAM (Pluggable Authentication Modules)](pam.md)
- [ ] [LUKS/dm-crypt 디스크 암호화](luks-dm-crypt.md)

### 파일시스템과 스토리지

- [ ] [파일시스템 선택 (ext4, xfs, btrfs, zfs)](filesystem-comparison.md)
- [ ] [LVM 관리 (PV, VG, LV, 스냅샷)](lvm.md)
- [ ] [RAID 기초 (소프트웨어/하드웨어)](raid.md)
- [ ] [디스크 I/O 스케줄러 (none, mq-deadline, kyber, bfq)](io-scheduler.md)
- [ ] [마운트 옵션 튜닝 (noatime, barrier)](mount-tuning.md)

### 셸과 자동화

- [ ] [Bash 고급 문법 (배열, 함수, 파라미터 확장)](bash-advanced.md)
- [ ] [텍스트 처리 도구 (awk, sed, grep, cut, sort, uniq)](text-processing.md)
- [ ] [셸 스크립트 베스트 프랙티스 (set -euo pipefail)](shell-best-practices.md)
- [ ] [실무 자동화 스크립트 패턴](automation-patterns.md)

### 네트워크 기초 (Linux 관점)

- [ ] [iproute2 명령어 (ip, ss, tc)](iproute2.md)
- [ ] [DNS 설정 (resolv.conf, systemd-resolved, NSS)](dns-config.md)
- [ ] [방화벽 (iptables, nftables, firewalld, ufw)](firewall.md)
- [ ] [SSH 설정과 키 관리 (ssh-agent, ProxyJump)](ssh.md)

### 로깅

- [ ] [syslog, rsyslog, journald](system-logging.md)
- [ ] [로그 로테이션 (logrotate)](log-rotation.md)
- [ ] [대규모 로그 관리 전략](log-management.md)

### 성능 분석

- [ ] [CPU 성능 분석 (perf, top, pidstat, mpstat)](cpu-performance.md)
- [ ] [메모리 관리와 OOM (free, vmstat, slabtop)](memory-oom.md)
- [ ] [디스크 I/O 분석 (iostat, iotop, blktrace)](disk-io-performance.md)
- [ ] [io_uring과 비동기 I/O](io-uring.md)
- [ ] [네트워크 성능 분석 (ss, iftop, nethogs, sar)](network-performance.md)
- [ ] [eBPF 기반 성능 분석 (bpftrace, BCC, libbpf)](ebpf-performance.md)
- [ ] [BPF CO-RE (Compile Once, Run Everywhere)](bpf-co-re.md)
- [ ] [플레임 그래프 (Flame Graph)](flame-graph.md)
- [ ] [USE 방법론과 Brendan Gregg 도구](use-methodology.md)

### 터미널 환경

- [ ] [tmux와 screen](tmux-screen.md)
- [ ] [셸 환경 개선 (zsh, fish, oh-my-zsh, starship)](shell-environment.md)

### 가상화와 경량 격리

- [ ] [KVM과 QEMU 개념](kvm-qemu.md)
- [ ] [libvirt와 virsh](libvirt.md)
- [ ] [systemd-nspawn (경량 격리)](systemd-nspawn.md)

---

## 참고 레퍼런스

- [The Linux Programming Interface (Michael Kerrisk)](https://man7.org/tlpi/)
- [Linux Performance (Brendan Gregg)](https://www.brendangregg.com/linuxperf.html)
- [Arch Linux Wiki](https://wiki.archlinux.org/)
- [Red Hat System Administrator's Guide](https://access.redhat.com/documentation/)
