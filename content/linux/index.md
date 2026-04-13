---
title: "Linux"
date: 2026-04-12
tags:
  - linux
  - roadmap
---
format: md

# Linux

모든 인프라의 기반. OS를 모르면 아무것도 못한다.

## 목차

### 기초

- [x] [리눅스 배포판 비교](linux-distro-comparison.md)
- [x] [파일시스템 구조 (FHS)](filesystem-hierarchy.md)
- [x] [사용자·그룹·퍼미션 관리](user-group-permission.md)
- [x] [패키지 관리 (apt, dnf, apk)](package-management.md)

### 시스템 관리

- [x] [systemd 서비스 관리](systemd.md)
- [x] [부팅 프로세스 이해](boot-process.md)
- [x] [프로세스 관리](process-management.md)
- [x] [crontab과 주기적 작업](crontab.md)
- [x] [디스크·파티션·LVM 관리](disk-lvm.md)

### 네트워크 기초 (리눅스 관점)

- [x] [iproute2 명령어 (ip, ss)](iproute2.md)
- [x] [DNS 설정과 resolv.conf](dns-config.md)
- [x] [방화벽 (iptables, nftables, firewalld)](firewall.md)
- [x] [SSH 설정과 키 관리](ssh.md)

### 셸 스크립트

- [x] [Bash 스크립트 기본 문법](bash-script.md)
- [x] [실무 자동화 스크립트 예제](automation-scripts.md)
- [x] [파이썬으로 리눅스 커맨드 구현](python-linux.md)

### 로깅

- [x] [syslog과 journald](syslog-journald.md)
- [x] [로그 로테이션](log-rotation.md)
- [x] [대규모 로그 관리 전략](log-management.md)

### 성능 분석

- [x] [CPU 성능 분석 도구와 튜닝](cpu-performance.md)
- [x] [메모리 관리와 OOM](memory-oom.md)
- [x] [디스크 I/O 성능 분석](disk-io-performance.md)
- [x] [네트워크 성능 분석](network-performance.md)
- [x] [eBPF 기반 성능 분석 입문](ebpf-performance.md)
