---
title: "Linux 부트 프로세스 완벽 가이드"
date: 2026-04-13
tags: [linux, boot, grub2, uefi, bios, systemd,
  initramfs, dracut, cloud-init, devops]
sidebar_label: "부트 프로세스"
---

# Linux 부트 프로세스

전원 버튼을 누른 순간부터 로그인 프롬프트까지,
Linux 시스템이 어떤 단계를 거쳐 부팅되는지
DevOps 실무 관점에서 정리한다.

## 1. 부팅 시퀀스 전체 흐름

```text
전원 ON
  │
  ▼
┌─────────────────────────────────┐
│  펌웨어 (BIOS/UEFI)            │
│  POST → 하드웨어 초기화        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  부트로더 (GRUB2)               │
│  커널 + initramfs 로드          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  커널 (vmlinuz)                 │
│  하드웨어 초기화, initramfs 마운트│
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  initramfs                      │
│  루트 파일시스템 마운트          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  systemd (PID 1)                │
│  서비스 시작 → target 도달      │
└─────────────────────────────────┘
```

### BIOS vs UEFI 비교

| 항목 | BIOS (Legacy) | UEFI |
|---|---|---|
| **출시** | 1981년 (IBM PC) | 2006년 (UEFI 2.0) |
| **비트 모드** | 16비트 리얼 모드 | 32/64비트 |
| **디스크 지원** | MBR, 최대 2.2TB | GPT, 최대 9.4ZB |
| **파티션 수** | 최대 4개 (기본) | 최대 128개 |
| **부트 방식** | MBR 부트코드 실행 | ESP에서 .efi 실행 |
| **Secure Boot** | 미지원 | 지원 |
| **네트워크 부팅** | PXE (별도 ROM) | 내장 네트워크 스택 |

```bash
# 현재 부팅 모드 확인
[ -d /sys/firmware/efi ] && echo "UEFI" || echo "BIOS"

# UEFI 부트 엔트리 관리
efibootmgr -v
efibootmgr -o 0001,0002,0003

# Secure Boot 상태 확인
mokutil --sb-state
```

---

## 2. GRUB2 부트로더

### 설정 파일 구조

| 파일/디렉토리 | 설명 |
|---|---|
| `/etc/default/grub` | 사용자 설정 (주요 수정 대상) |
| `/etc/grub.d/` | 메뉴 생성 스크립트 |
| `/boot/grub2/grub.cfg` | 최종 설정 (RHEL 계열, 직접 수정 금지) |
| `/boot/grub/grub.cfg` | 최종 설정 (Debian 계열, 직접 수정 금지) |
| `/boot/efi/EFI/<distro>/` | UEFI GRUB 바이너리 위치 |

### /etc/default/grub 주요 설정

```bash title="/etc/default/grub"
GRUB_DEFAULT=0                    # 기본 부트 엔트리
GRUB_TIMEOUT=5                    # 메뉴 타임아웃 (초)

# 모든 부트 엔트리에 전달되는 커널 파라미터
GRUB_CMDLINE_LINUX="crashkernel=256M rd.lvm.lv=rhel/root"

# 일반 부트에만 추가 (recovery에는 미포함)
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash"

GRUB_DISABLE_RECOVERY=false       # recovery 메뉴 활성화
```

### GRUB 설정 재생성

```bash
# RHEL/CentOS/Rocky
sudo grub2-mkconfig -o /boot/grub2/grub.cfg

# Ubuntu/Debian
sudo update-grub

# UEFI 시스템인 경우 (RHEL)
sudo grub2-mkconfig \
  -o /boot/efi/EFI/redhat/grub.cfg
```

### grubby로 커널 파라미터 관리 (RHEL 계열)

```bash
# 현재 기본 커널 확인
sudo grubby --default-kernel

# 모든 커널에 파라미터 추가
sudo grubby --update-kernel=ALL \
  --args="net.ifnames=0"

# 특정 커널에서 파라미터 제거
sudo grubby \
  --update-kernel=/boot/vmlinuz-$(uname -r) \
  --remove-args="quiet"

# 현재 커널의 부트 파라미터 확인
sudo grubby --info=ALL
```

### 부트 파라미터 임시 수정 (1회성)

1. GRUB 메뉴에서 `e` 키로 편집 모드 진입
2. `linux` 또는 `linuxefi` 줄 끝에 파라미터 추가
3. `Ctrl+X` 또는 `F10`으로 부팅

---

## 3. 커널 파라미터

### 현재 파라미터 확인

```bash
cat /proc/cmdline
```

### DevOps 필수 커널 파라미터

| 파라미터 | 용도 | 예시 |
|---|---|---|
| `console=` | 시리얼 콘솔 (원격 서버) | `console=ttyS0,115200n8` |
| `net.ifnames=` | NIC 이름 규칙 제어 | `net.ifnames=0` |
| `biosdevname=` | Dell BIOS NIC 이름 | `biosdevname=0` |
| `crashkernel=` | kdump 메모리 예약 | `crashkernel=256M` |
| `rd.lvm.lv=` | LVM 볼륨 활성화 | `rd.lvm.lv=rhel/root` |
| `selinux=` | SELinux 활성화 | `selinux=0` (**프로덕션 사용 금지**, 트러블슈팅 전용) |
| `enforcing=` | SELinux 모드 | `enforcing=0` (permissive) |
| `rd.break` | initramfs 중단 | root 패스워드 리셋 시 |
| `systemd.unit=` | 부팅 target 지정 | `rescue.target` |
| `init=` | 대체 init 프로세스 | `init=/bin/bash` |

### 성능/보안 관련 파라미터

| 파라미터 | 용도 | 주의사항 |
|---|---|---|
| `transparent_hugepage=` | THP 설정 | DB 환경에서 `never` 권장 |
| `mitigations=` | CPU 취약점 완화 | `off` 시 보안 위험 |
| `intel_iommu=` | IOMMU (가상화) | GPU 패스스루 시 `on` |
| `numa=` | NUMA 설정 | 소규모 VM에서 `off` |
| `nomodeset` | 그래픽 드라이버 | 디스플레이 문제 시 |

> **참고**: 커널 파라미터 전체 목록은
> [kernel.org 공식 문서](https://docs.kernel.org/admin-guide/kernel-parameters.html)
> 에서 확인할 수 있다.

---

## 4. systemd Target

### 주요 target 목록

| Target | Runlevel | 설명 |
|---|---|---|
| `poweroff.target` | 0 | 시스템 종료 |
| `rescue.target` | 1 | 단일 사용자, 기본 서비스 |
| `multi-user.target` | 3 | CLI 다중 사용자 (서버 기본) |
| `graphical.target` | 5 | GUI 포함 다중 사용자 |
| `reboot.target` | 6 | 재부팅 |
| `emergency.target` | - | 최소 부팅, 루트 셸만 |

### rescue.target vs emergency.target

```text
rescue.target
├── sysinit.target (마운트, 스왑, udev 등)
├── 기본 서비스 로드
└── 파일시스템 정상일 때 사용

emergency.target
├── sulogin 셸만 실행
├── 루트 파일시스템 읽기 전용
└── rescue도 실패할 때 사용
```

### target 관리 명령어

```bash
# 현재 기본 target 확인
systemctl get-default

# 기본 target 변경 (서버에서 GUI 제거)
sudo systemctl set-default multi-user.target

# 런타임에 target 즉시 전환 (재부팅 없이)
sudo systemctl isolate rescue.target

# GRUB에서 1회성 target 지정
# linux 줄 끝에 추가:
# systemd.unit=rescue.target
```

> **참고**: target 관리에 대한 자세한 내용은
> [RHEL 공식 문서](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_systemd_unit_files_to_customize_and_optimize_your_system/booting-into-a-target-system-state)
> 를 참조한다.

---

## 5. 부트 트러블슈팅

### 부팅이 멈추는 경우

```bash
# GRUB에서 디버그 파라미터 추가
systemd.unit=multi-user.target   # GUI 문제 확인
systemd.log_level=debug          # 상세 로그

# 부팅 후 실패 서비스 확인
systemctl list-units --state=failed
journalctl -xeu <service-name>

# 문제 서비스 차단
sudo systemctl mask <problematic-service>
```

### 커널 패닉 대응

```bash
# 원인: 손상된 initramfs, 잘못된 root=,
#       누락된 커널 모듈

# 1. GRUB에서 이전 커널로 부팅
#    Advanced options → 이전 커널 선택

# 2. initramfs 재빌드 (RHEL/Fedora)
sudo dracut -f \
  /boot/initramfs-$(uname -r).img $(uname -r)

# 2. initramfs 재빌드 (Debian/Ubuntu)
sudo update-initramfs -u
```

### 파일시스템 체크 실패

```bash
# emergency 모드 진입 후
mount -o remount,rw /

# 파일시스템 체크
fsck -y /dev/sda1        # ext4
xfs_repair /dev/sda1     # XFS

# fstab UUID 불일치 확인
blkid                    # 실제 UUID
cat /etc/fstab           # 설정된 UUID
```

### GRUB 복구

```bash
# grub> 프롬프트에서 수동 부팅
grub> set root=(hd0,1)
grub> linux /vmlinuz root=/dev/sda2
grub> initrd /initramfs.img
grub> boot

# grub rescue> 프롬프트에서 복구
# 경로는 파티션 구성에 따라 다름:
#   RHEL (별도 /boot 파티션): (hd0,1)/grub2
#   Debian (/boot가 루트에 포함):  (hd0,1)/boot/grub
grub rescue> set prefix=(hd0,1)/grub2
grub rescue> insmod normal
grub rescue> normal
```

### 라이브 USB로 GRUB 재설치

```bash
# ⚠️ BIOS(Legacy) 환경 전용
sudo mount /dev/sda2 /mnt
sudo mount /dev/sda1 /mnt/boot
sudo grub2-install --boot-directory=/mnt/boot /dev/sda
sudo grub2-mkconfig -o /mnt/boot/grub2/grub.cfg
```

> **UEFI 환경**에서는 `grub2-install`로 부트로더 재설치 불가.
> Secure Boot 체인(shim → grubx64.efi)이 깨진다.
> UEFI + RHEL 계열:
> ```bash
> dnf reinstall grub2-efi-x64 shim-x64
> grub2-mkconfig -o /boot/efi/EFI/redhat/grub.cfg
> ```

### rd.break로 root 패스워드 리셋

```bash
# GRUB linux 줄에 rd.break 추가 후 부팅
mount -o remount,rw /sysroot
chroot /sysroot
passwd root

# SELinux 재레이블링 (RHEL 8+ 권장 방식)
fixfiles -F onboot
# 레거시: touch /.autorelabel (전체 재레이블 → 대용량 서버에서 수십분 소요)
exit
exit
```

---

## 6. 클라우드 인스턴스 부트 (cloud-init)

클라우드 환경에서는 하이퍼바이저가
가상 펌웨어를 제공하고,
cloud-init이 인스턴스 초기 설정을 자동화한다.

### 물리 서버와의 차이

| 항목 | 물리 서버 | 클라우드 인스턴스 |
|---|---|---|
| 펌웨어 | 실제 BIOS/UEFI | 가상 펌웨어 |
| 콘솔 | VGA/KVM | 시리얼 (`console=ttyS0`) |
| 네트워크 | 수동/DHCP | metadata + DHCP |
| 스토리지 | 물리 디스크 | 가상 블록 디바이스 |
| 초기 설정 | kickstart 등 | cloud-init |

### cloud-init 5단계

| 단계 | systemd 서비스 | 역할 |
|---|---|---|
| Generator | - | cloud-init 실행 여부 결정 |
| Local | `cloud-init-local` | 로컬 데이터소스, 네트워크 설정 |
| Network | `cloud-init` | 네트워크 설정 후 init 모듈 실행 |
| Config | `cloud-config` | 부트에 영향 없는 설정 모듈 실행 |
| Final | `cloud-final` | user-data 스크립트 실행 |

### 메타데이터 서비스 접근

```bash
# AWS EC2 (IMDSv2)
TOKEN=$(curl -s -X PUT \
  "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

curl -s \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id

# GCP
curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/\
instance/machine-type

# Azure
curl -s -H "Metadata:true" \
  "http://169.254.169.254/metadata/instance\
?api-version=2021-02-01"
```

### cloud-init 디버깅

```bash
# 상태 확인
cloud-init status --long

# 로그 확인
cat /var/log/cloud-init.log
cat /var/log/cloud-init-output.log

# 단계별 소요 시간 분석
cloud-init analyze blame

# cloud-init 재실행 (테스트)
sudo cloud-init clean --logs
sudo cloud-init init
sudo cloud-init modules --mode=config
sudo cloud-init modules --mode=final
```

> **참고**: cloud-init 공식 문서는
> [docs.cloud-init.io](https://docs.cloud-init.io/en/latest/)
> 에서 확인할 수 있다.

---

## 7. 부팅 성능 분석 (systemd-analyze)

### 기본 분석 명령어

```bash
# 전체 부팅 시간 요약
$ systemd-analyze
Startup finished in 1.5s (firmware) + 1.2s (loader)
  + 2.3s (kernel) + 8.1s (userspace) = 13.1s

# 서비스별 소요 시간 (느린 순)
systemd-analyze blame

# 크리티컬 패스 체인 표시
systemd-analyze critical-chain

# 부팅 시각화 SVG 생성
systemd-analyze plot > boot.svg
```

### 크리티컬 패스 체인 예시

```text
multi-user.target @8.1s
└─ NetworkManager.service @3.2s +1.8s
   └─ network-pre.target @3.1s
      └─ firewalld.service @1.5s +1.5s
         └─ basic.target @1.4s
            └─ sockets.target @1.4s
```

### dmesg로 커널 부팅 분석

```bash
# 타임스탬프 포함 커널 메시지
dmesg -T

# 에러/경고만 필터링
dmesg --level=err,warn

# 하드웨어별 검색
dmesg | grep -i "eth\|net\|nic"   # 네트워크
dmesg | grep -i "sda\|nvme"       # 스토리지
dmesg | grep -i "oom\|memory"     # 메모리
```

### journalctl 부트 로그 분석

```bash
# 현재 부트 로그
journalctl -b

# 이전 부트 로그 (장애 분석 필수)
journalctl -b -1

# 부트 목록 확인
journalctl --list-boots

# 커널 메시지만 (이전 부트)
journalctl -k -b -1

# 에러 이상만 필터
journalctl -b -p err
```

### 부트 로그 영구 저장

```bash
# /etc/systemd/journald.conf 수정
# [Journal]
# Storage=persistent

sudo systemctl restart systemd-journald

# 또는 디렉토리 직접 생성
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles \
  --create --prefix /var/log/journal
```

기본값은 `Storage=auto`이며, `/var/log/journal/` 디렉토리가
존재하면 영구 저장, 없으면 재부팅 시 삭제된다.
RHEL 계열은 기본적으로 persistent인 경우가 많다.
장애 분석을 위해 `Storage=persistent` 설정을
프로덕션 서버에 명시적으로 적용하는 것을 권장한다.

---

## 8. 부트로더 최신 동향 (2025-2026)

### systemd-boot

GRUB2 대신 systemd가 제공하는 경량 UEFI 부트로더.
Fedora 37+에서 기본 채택, RHEL 10 로드맵에 포함됐다.

| 항목 | GRUB2 | systemd-boot |
|------|-------|-------------|
| 설정 | `/etc/default/grub` | `/boot/efi/loader/loader.conf` |
| 부트 엔트리 | 스크립트 기반 자동 생성 | `.conf` 파일 하나씩 |
| Secure Boot | shim 경유 | shim 또는 직접 서명 |
| 관리 도구 | `grubby`, `grub2-mkconfig` | `bootctl` |

```bash
# systemd-boot 상태 확인
bootctl status

# 부트 엔트리 목록
bootctl list
```

### UKI (Unified Kernel Image)

커널 + initramfs + cmdline을 하나의 `.efi` 바이너리로 묶는 방식.
TPM PCR 측정으로 무결성 검증이 가능해 보안이 강화된다.

```bash
# UKI 생성 (dracut)
dracut --uefi /boot/efi/EFI/Linux/linux.efi

# TPM2 + LUKS 연동 (systemd-cryptenroll)
systemd-cryptenroll --tpm2-device=auto /dev/sda3
```

---

## 참고 자료

- [Arch Wiki: Boot Process](https://wiki.archlinux.org/title/Arch_boot_process)
- [SUSE: Boot Process](https://documentation.suse.com/sles/15-SP7/html/SLES-all/cha-boot.html)
- [GNU GRUB Manual](https://www.gnu.org/software/grub/manual/grub/grub.html)
- [Kernel Parameters](https://docs.kernel.org/admin-guide/kernel-parameters.html)
- [RHEL: Kernel CLI Parameters](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/configuring-kernel-command-line-parameters_managing-monitoring-and-updating-the-kernel)
- [RHEL: systemd Targets](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_systemd_unit_files_to_customize_and_optimize_your_system/booting-into-a-target-system-state)
- [cloud-init Docs](https://docs.cloud-init.io/en/latest/)
