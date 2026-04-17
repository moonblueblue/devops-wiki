---
title: "LUKS/dm-crypt 디스크 암호화"
sidebar_label: "LUKS"
sidebar_position: 7
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - security
  - luks
  - dm-crypt
  - encryption
  - storage
---

# LUKS/dm-crypt 디스크 암호화

dm-crypt는 Linux 커널의 device mapper 서브시스템에 내장된
암호화 타겟이다. LUKS(Linux Unified Key Setup)는 그 위에서
메타데이터와 키 관리를 표준화한 포맷이다.

데이터 도난·폐기 서버 유출·컴플라이언스(FIPS, PCI-DSS)
시나리오에서 At-Rest 암호화의 사실상 표준이다.

---

## 아키텍처 개요

### 계층 구조

```
┌──────────────────────────────────────────────────────┐
│  Application / Filesystem                            │
│  (ext4, xfs, btrfs, LVM PV...)                       │
├──────────────────────────────────────────────────────┤
│  /dev/mapper/NAME                                    │
│  (decrypted virtual block device)                    │
├──────────────────────────────────────────────────────┤
│  dm-crypt  (kernel device mapper)                    │
│  Cipher: AES-XTS, ChaCha20...                        │
├──────────────────────────────────────────────────────┤
│  LUKS Header  (disk front area)                      │
│  Magic | UUID | Cipher params | Keyslot 0~31         │
├──────────────────────────────────────────────────────┤
│  Physical Block Device                               │
│  (/dev/sda, /dev/nvme0n1p2)                          │
└──────────────────────────────────────────────────────┘
```

**핵심 개념**:
- **dm-crypt**: 커널 모듈. 블록 단위 암호화/복호화만 담당
- **LUKS**: 헤더 포맷 + 키슬롯 관리. dm-crypt를 쓰기 쉽게 감쌈
- **Master Key (MK)**: 실제 데이터 암호화에 쓰이는 키.
  LUKS 헤더 안의 키슬롯에 암호화되어 저장됨

---

## LUKS1 vs LUKS2

| 항목 | LUKS1 | LUKS2 |
|------|-------|-------|
| 헤더 포맷 | 바이너리 고정 구조 | JSON 메타데이터 |
| KDF | PBKDF2 | **Argon2id** (기본값) |
| 키슬롯 수 | 8개 | 32개 |
| 헤더 크기 | 1 MiB | 16 MiB (기본) |
| 헤더 백업 | 단일 | **헤더 복사본 내장** |
| Integrity | 미지원 | **dm-integrity 연동 가능** |
| TPM2/FIDO2 | 미지원 | **systemd-cryptenroll 지원** |
| Secure Boot | 제한적 | **Measured Boot 지원** |
| 최소 cryptsetup | 1.x | **2.1+** |

> LUKS2는 cryptsetup 2.1(2018)부터 기본 포맷이다.
> 신규 시스템은 LUKS2를 사용하라.
> Argon2id KDF는 GPU 브루트포스 공격에 강하다.

---

## Plain dm-crypt vs LUKS 선택 기준

| 선택 기준 | LUKS2 | Plain dm-crypt |
|---------|:-----:|:--------------:|
| 일반 서버 / 노트북 / 스토리지 | ✅ | - |
| 다중 패스프레이즈 (키슬롯 여러 개) | ✅ | - |
| 헤더 손상 복구 가능 | ✅ | - |
| TPM2 / FIDO2 바인딩 | ✅ | - |
| 표준 도구(cryptsetup) 생태계 | ✅ | - |
| 헤더 존재 자체를 숨김 (Plausible Deniability) | - | ✅ |
| 임베디드 / 특수 환경 | - | ✅ |
| 헤더 오버헤드 없는 원시 블록 암호화 | - | ✅ |

**운영 관점**: 대부분의 서버 환경에서 LUKS2를 선택한다.
Plain dm-crypt는 키 관리가 어렵고,
헤더 손상 복구 수단이 없다.

---

## LUKS2 파티션 설정

### 기본 워크플로

```
luksFormat → open → mkfs → mount → (운영) → close
```

### 1단계: LUKS2 포맷

```bash
# 기본 권장 설정 (AES-256-XTS + Argon2id)
cryptsetup luksFormat \
  --type luks2 \
  --cipher aes-xts-plain64 \
  --key-size 512 \
  --hash sha256 \
  --pbkdf argon2id \
  --pbkdf-memory 1048576 \
  --pbkdf-parallel 4 \
  --iter-time 3000 \
  /dev/sdb1

# 인터랙티브 확인 프롬프트가 나옴
# "YES" (대문자)를 입력해야 진행
```

**파라미터 설명**:

| 파라미터 | 값 | 설명 |
|---------|-----|------|
| `--cipher` | `aes-xts-plain64` | AES-XTS 모드. 디스크 암호화 표준 |
| `--key-size` | `512` | AES-256-XTS에서 키 256×2=512비트 |
| `--pbkdf` | `argon2id` | 메모리/CPU 하드 KDF |
| `--pbkdf-memory` | `1048576` | Argon2id 메모리 (1 GiB, KiB 단위) |
| `--pbkdf-parallel` | `4` | 병렬 스레드 수 |
| `--iter-time` | `3000` | KDF 최소 시간 ms |

> `--pbkdf-memory`를 높게 설정할수록 GPU 브루트포스에 강하다.
> 서버에서 1 GiB(1048576)를 권장한다.
> 저사양 장치는 64MiB(65536)부터 시작한다.

### 2단계: 열기 (open)

```bash
# 패스프레이즈 입력으로 열기
cryptsetup open /dev/sdb1 mydata
# /dev/mapper/mydata 가 생성됨

# 키파일로 열기
cryptsetup open --key-file /root/keys/mydata.key \
  /dev/sdb1 mydata

# 상태 확인
cryptsetup status mydata
# type:    LUKS2
# cipher:  aes-xts-plain64
# keysize: 512 bits
# ...
```

### 3단계: 파일시스템 생성 및 마운트

```bash
# 파일시스템 생성 (복호화된 가상 디바이스 위에)
mkfs.xfs /dev/mapper/mydata

# 마운트
mkdir -p /data/mydata
mount /dev/mapper/mydata /data/mydata

# 운영 후 닫기
umount /data/mydata
cryptsetup close mydata
```

---

## 키슬롯 관리

LUKS2는 **32개의 키슬롯**을 제공한다.
각 슬롯은 동일한 Master Key를 서로 다른 방식으로 열 수 있다.

```
키슬롯 0: 관리자 패스프레이즈
키슬롯 1: 백업 패스프레이즈 (에스크로)
키슬롯 2: 키파일 (자동화/배치)
키슬롯 3: TPM2 바인딩
키슬롯 4: FIDO2 하드웨어 키
```

### 키슬롯 조작

```bash
# 현재 키슬롯 상태 확인
cryptsetup luksDump /dev/sdb1
# Keyslots:
#   0: luks2
#      Key:  512 bits
#      AF stripes: 4000
#      ...

# 키슬롯 추가 (기존 패스프레이즈 필요)
cryptsetup luksAddKey /dev/sdb1
# Enter any existing passphrase:
# Enter new passphrase for key slot:

# 특정 슬롯에 키파일 추가 (키파일은 positional arg로 전달)
cryptsetup luksAddKey /dev/sdb1 /root/keys/backup.key

# 슬롯 제거 (번호로)
cryptsetup luksKillSlot /dev/sdb1 2

# 패스프레이즈로 해당 슬롯 제거
cryptsetup luksRemoveKey /dev/sdb1

# 패스프레이즈 변경 (슬롯 재암호화)
cryptsetup luksChangeKey /dev/sdb1
```

### luksDump — 헤더 정보 확인

```bash
cryptsetup luksDump /dev/sdb1
```

```
LUKS header information
Version:        2
Epoch:          4
Metadata area:  16384 [bytes]
Keyslots area:  16744448 [bytes]
UUID:           a1b2c3d4-e5f6-7890-abcd-ef1234567890
Label:          (no label)
Subsystem:      (no subsystem)
Flags:          (no flags)

Data segments:
  0: crypt
        offset: 16777216 [bytes]
        length: (whole device)
        cipher: aes-xts-plain64
        sector: 512 [bytes]

Keyslots:
  0: luks2
        Key:        512 bits
        Priority:   normal
        Cipher:     aes-xts-plain64
        Cipher key: 512 bits
        PBKDF:      argon2id
        Time cost:  6
        Memory:     1048576
        Threads:    4
        Salt:       ...
        AF stripes: 4000
        AF hash:    sha256
        Area offset:32768 [bytes]
        Area length:258048 [bytes]
        Digest ID:  0
```

---

## dm-integrity 연동

dm-integrity는 블록 단위로 체크섬을 저장하여
데이터 위변조를 탐지한다.

### Authenticated Encryption

```
기존 dm-crypt: 암호화만 (Confidentiality)
  - 데이터 복호화는 되지만 위변조 탐지 불가
  - Bit-flip 공격에 취약

dm-crypt + dm-integrity: 암호화 + 인증 (Confidentiality + Integrity)
  - 블록 위변조 시 I/O 오류 반환
  - AEAD(Authenticated Encryption with Associated Data) 구현
```

### integrity 모드 비교

| 모드 | 알고리즘 | 성능 | 보안 |
|------|---------|------|------|
| `hmac-sha256` | HMAC-SHA256 | 중간 | 높음 |
| `hmac-sha512` | HMAC-SHA512 | 낮음 | 높음 |
| `poly1305` | Poly1305 (ChaCha20, nonce 충돌 위험) | **높음** | 주의 |
| `aes-cmac` | AES-CMAC | 중간 | 높음 |

### 설정 방법

```bash
# integrity 포함 포맷 (디스크 공간 추가 소요)
cryptsetup luksFormat \
  --type luks2 \
  --cipher aes-xts-plain64 \
  --key-size 512 \
  --integrity hmac-sha256 \
  /dev/sdb1

# poly1305 (성능 우선 — 소용량 전용, 아래 주의사항 참고)
cryptsetup luksFormat \
  --type luks2 \
  --cipher chacha20-random \
  --key-size 512 \
  --integrity poly1305 \
  /dev/sdb1
```

> **성능 영향**: dm-integrity는 각 블록(4KB)당 별도의
> 태그 데이터를 저장하므로 디스크 용량 5~10% 추가 소모.
> I/O 레이턴시도 10~30% 증가한다.

> **poly1305 nonce 충돌 경고**: `chacha20-random` + `poly1305`
> 조합은 96비트 랜덤 nonce를 사용하므로 birthday bound에 의해
> 섹터 수가 많아질수록 nonce 충돌 확률이 증가한다.
> 대용량 디스크(수 TB 이상)에서는 사용하지 말 것.
> 범용 권장 조합은 `aes-xts-random + hmac-sha256`이다.

---

## /etc/crypttab 와 systemd 통합

### crypttab 문법

```
# /etc/crypttab
# <name>    <device>           <keyfile>    <options>

mydata      /dev/sdb1          none         luks
backupvol   /dev/sdc1          /root/k.key  luks,discard
tmpvol      /dev/sdd1          none         luks,nofail,timeout=30
```

| 필드 | 설명 |
|------|------|
| `name` | `/dev/mapper/<name>` 으로 생성될 이름 |
| `device` | 물리 디바이스 경로 또는 `UUID=...` |
| `keyfile` | 키파일 경로. `none` 이면 패스프레이즈 입력 |
| `options` | 쉼표 구분 옵션 목록 |

### crypttab 주요 옵션

| 옵션 | 설명 |
|------|------|
| `luks` | LUKS 포맷임을 명시 |
| `discard` | SSD TRIM 허용 (성능↑, 보안 약화) |
| `nofail` | 장치 없어도 부팅 계속 |
| `timeout=N` | 패스프레이즈 입력 대기 시간 (초) |
| `no-read-workqueue` | 읽기 I/O 워크큐 우회 (성능↑) |
| `no-write-workqueue` | 쓰기 I/O 워크큐 우회 (성능↑) |
| `keyfile-timeout=N` | 키파일 적용 대기 시간 |

> **discard 옵션 보안 고려사항**: TRIM은 SSD 수명을 연장하지만
> 어떤 블록이 사용 중인지 노출한다.
> 민감 데이터 환경에서는 discard를 비활성화한다.

### UUID로 안전하게 참조

```bash
# 디바이스 UUID 확인
blkid /dev/sdb1
# /dev/sdb1: UUID="a1b2c3d4-..." TYPE="crypto_LUKS"

# crypttab에서 UUID 사용 (권장)
# /etc/crypttab
mydata  UUID=a1b2c3d4-e5f6-7890-abcd-ef1234567890  none  luks
```

### /etc/fstab 연동

```bash
# 복호화된 디바이스의 UUID 확인
cryptsetup open /dev/sdb1 mydata
blkid /dev/mapper/mydata
# /dev/mapper/mydata: UUID="f1e2d3c4-..." TYPE="xfs"

# /etc/fstab
UUID=f1e2d3c4-...  /data/mydata  xfs  defaults,nofail  0  2
```

---

## systemd-cryptenroll: TPM2 및 FIDO2 연동

cryptsetup 2.4+ / systemd 248+ 에서 지원한다.

### TPM2 바인딩

```
부팅 시 흐름:
  UEFI → Secure Boot → GRUB → initramfs
  → systemd-cryptsetup
  → TPM2 PCR 값 검증
  → 자동 잠금 해제
  → 루트 마운트 → 시스템 부팅
```

```bash
# TPM2 디바이스 확인
ls /dev/tpm*
# /dev/tpm0   /dev/tpmrm0

# TPM2 키슬롯 등록
# PCR7 = Secure Boot 상태 바인딩 (권장)
systemd-cryptenroll \
  --tpm2-device=auto \
  --tpm2-pcrs=7 \
  /dev/sdb1

# PCR 조합 (더 강한 바인딩)
# 0: 펌웨어 코드, 7: Secure Boot, 14: Shim
systemd-cryptenroll \
  --tpm2-device=auto \
  --tpm2-pcrs=0+7+14 \
  /dev/sdb1

# 등록된 키슬롯 확인
cryptsetup luksDump /dev/sdb1 | grep -A5 "systemd-tpm2"
```

**PCR(Platform Configuration Register) 바인딩**:

| PCR | 측정 대상 |
|-----|---------|
| 0 | 펌웨어 (UEFI 코드) |
| 1 | 펌웨어 설정 |
| 4 | 부트로더 코드 |
| 7 | Secure Boot 상태·정책 |
| 9 | GRUB 설정, initramfs |
| 14 | MOK(Shim) 데이터베이스 |

### FIDO2 하드웨어 키 바인딩

```bash
# FIDO2 키 등록 (YubiKey, SoloKey 등)
systemd-cryptenroll \
  --fido2-device=auto \
  /dev/sdb1

# HMAC-Secret 확장 사용 (핀 없이)
systemd-cryptenroll \
  --fido2-device=auto \
  --fido2-with-client-pin=no \
  /dev/sdb1

# 자동 열기 위한 crypttab 설정
# /etc/crypttab
mydata  /dev/sdb1  -  fido2-device=auto
```

### crypttab에 TPM2 설정

```bash
# /etc/crypttab
mydata  /dev/sdb1  -  tpm2-device=auto
# 또는 PCR 명시
mydata  /dev/sdb1  -  tpm2-device=auto,tpm2-pcrs=7
```

---

## 전체 디스크 암호화 (FDE)

### /boot 분리 구조 (일반적)

```
┌─────────────────────────────────────────────────┐
│  디스크 레이아웃                                  │
│                                                 │
│  /dev/sda1  →  /boot/efi (EFI 파티션, 평문)      │
│  /dev/sda2  →  /boot (커널·initramfs, 평문)      │
│  /dev/sda3  →  LUKS2 암호화                     │
│                  └── LVM PV                     │
│                       ├── / (루트)               │
│                       ├── /home                 │
│                       └── swap                  │
└─────────────────────────────────────────────────┘
```

- `/boot`는 initramfs와 GRUB이 패스프레이즈 입력 전에
  접근해야 하므로 기본적으로 평문
- GRUB 2.06+는 LUKS2 헤더 읽기를 지원하지만
  Argon2id는 GRUB에서 미지원 (PBKDF2만 지원)

### GRUB 2.06+ /boot 암호화

```bash
# GRUB에서 LUKS 지원 활성화
# /etc/default/grub
GRUB_ENABLE_CRYPTODISK=y

# /boot 파티션을 LUKS1 또는 PBKDF2 기반 LUKS2로 포맷
# (GRUB이 Argon2id 미지원)
cryptsetup luksFormat \
  --type luks2 \
  --pbkdf pbkdf2 \
  /dev/sda2
```

> **운영 권장**: `/boot` 암호화는 복잡도 대비 이점이 작다.
> 공격자가 부트로더를 변조하려면 물리 접근이 필요하고,
> Secure Boot가 이를 탐지한다.
> 대부분의 실무에서는 `/boot`를 평문으로 두고
> Secure Boot + TPM2 측정 부팅을 사용한다.

### Measured Boot + LUKS (권장 FDE 패턴)

```
펌웨어 부팅
     │
     ▼
Secure Boot (서명 검증)
     │  실패 → 부팅 중단
     ▼
GRUB 부트로더
     │
     ▼
커널 + initramfs 로드
     │
     ▼
systemd-cryptsetup
     │
     ├─ TPM2에 PCR 값 요청
     │    └─ 펌웨어·Secure Boot 상태가 등록 시와 다름
     │         → TPM2 잠금 (자동 해제 실패)
     │         → 패스프레이즈 수동 입력 fallback
     │
     └─ PCR 일치 → 자동 잠금 해제
          │
          ▼
       루트 마운트 → 시스템 부팅
```

---

## 파일시스템과 LVM 위에서의 LUKS

### LVM on LUKS (권장: 단일 암호화 컨테이너)

```
물리 디스크
  └── LUKS2 암호화 컨테이너 (/dev/sda3)
       └── LVM PV (/dev/mapper/cryptlvm)
            └── VG (vg0)
                 ├── LV root  → /
                 ├── LV home  → /home
                 └── LV swap  → swap
```

```bash
# 설정 절차
cryptsetup luksFormat --type luks2 /dev/sda3
cryptsetup open /dev/sda3 cryptlvm

# LVM 구성
pvcreate /dev/mapper/cryptlvm
vgcreate vg0 /dev/mapper/cryptlvm
lvcreate -L 50G vg0 -n root
lvcreate -L 100G vg0 -n home
lvcreate -L 16G vg0 -n swap

# 파일시스템
mkfs.xfs /dev/vg0/root
mkfs.xfs /dev/vg0/home
mkswap /dev/vg0/swap
```

**장점**: 패스프레이즈 한 번으로 전체 잠금 해제
**단점**: 단일 LUKS 컨테이너 손상 시 전체 데이터 접근 불가

### LUKS on LVM (각 볼륨 독립 암호화)

```
물리 디스크
  └── LVM PV (/dev/sda3)
       └── VG (vg0)
            ├── LV data1  → LUKS2 → /data/prod
            └── LV data2  → LUKS2 → /data/archive
```

```bash
# LVM 먼저 구성
pvcreate /dev/sda3
vgcreate vg0 /dev/sda3
lvcreate -L 200G vg0 -n data1
lvcreate -L 500G vg0 -n data2

# 각 LV를 독립적으로 암호화
cryptsetup luksFormat --type luks2 /dev/vg0/data1
cryptsetup luksFormat --type luks2 /dev/vg0/data2
```

**장점**: 볼륨별 독립 키, 부분 잠금 해제 가능
**단점**: 볼륨마다 별도 패스프레이즈 관리 필요

### 레이아웃 비교

| 항목 | LVM on LUKS | LUKS on LVM |
|------|-------------|-------------|
| 패스프레이즈 수 | 1개 | LV 수만큼 |
| 볼륨 확장 | 자유로움 | 자유로움 |
| 독립 접근 제어 | 불가 | 가능 |
| 복구 복잡도 | 낮음 | 높음 |
| 권장 환경 | 노트북/일반 서버 | 민감 데이터 분리 환경 |

---

## 실무 운영

### 헤더 백업 및 복원

> **LUKS 헤더가 손상되면 데이터 복구가 불가능하다.**
> 포맷 직후 반드시 헤더를 백업한다.

```bash
# 헤더 백업 (오프라인 저장 필수)
cryptsetup luksHeaderBackup /dev/sdb1 \
  --header-backup-file /secure-backup/sdb1-luks-header.img

# 헤더 복원 (손상 시)
# 주의: 복원 후 데이터 영역은 그대로이므로
# 동일한 암호화 키가 필요함
cryptsetup luksHeaderRestore /dev/sdb1 \
  --header-backup-file /secure-backup/sdb1-luks-header.img

# 헤더 검증
cryptsetup -v isLuks /dev/sdb1
# /dev/sdb1 is a valid LUKS device.
```

### 온라인 재암호화 (cryptsetup-reencrypt)

cryptsetup 2.4+에서 지원한다.
운영 중인 데이터를 재암호화할 수 있다.

```bash
# 온라인 재암호화: active mapping이 존재해야 함
# 먼저 LUKS 디바이스를 열어야 한다
cryptsetup open /dev/sdb1 mydata
# (마운트되어 사용 중이어도 가능)

cryptsetup reencrypt \
  --cipher aes-xts-plain64 \
  --key-size 512 \
  /dev/sdb1

# 오프라인 재암호화: active mapping 없이 직접 실행
umount /data/mydata
cryptsetup close mydata

cryptsetup reencrypt \
  --pbkdf argon2id \
  --pbkdf-memory 2097152 \
  /dev/sdb1
# active mapping 없으면 자동으로 오프라인 모드로 동작

# 재암호화 진행 상태 확인
cryptsetup luksDump /dev/sdb1 | grep -A3 "reencrypt"
```

> 온라인 재암호화 중 전원 차단 시 체크포인트에서
> 재개 가능하다. 하지만 재암호화 전 헤더 백업은 필수다.

### 헤더 손상 시 복구 절차

```bash
# 1단계: LUKS 시그니처 확인
cryptsetup -v isLuks /dev/sdb1
# 오류 발생 시 헤더 손상

# 2단계: 백업 헤더로 복원 시도
cryptsetup luksHeaderRestore /dev/sdb1 \
  --header-backup-file ./sdb1-luks-header.img

# 3단계: 별도 헤더 파일 지정 (헤더가 없는 경우)
cryptsetup open \
  --header ./sdb1-luks-header.img \
  /dev/sdb1 mydata_recovered

# 4단계: 데이터 추출 (즉시 백업)
dd if=/dev/mapper/mydata_recovered of=/backup/data.img bs=4M
```

### 원격 잠금 해제: Clevis + Tang

서버는 물리 접근 없이 네트워크를 통해 잠금을 해제한다.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  서버 (암호화 디스크)        Tang 서버 (키 배포)           │
│                                                          │
│  Clevis 클라이언트           /usr/bin/tangd               │
│       │                          │                       │
│       │  1. 잠금 해제 요청        │                       │
│       │ ─────────────────────────►                       │
│       │  2. JWK(JSON Web Key)     │                       │
│       │ ◄─────────────────────────                       │
│       │                           │                       │
│       │  3. 로컬 바인딩 데이터와   │                       │
│       │     복합하여 Master Key 복원                       │
│       │  4. LUKS 잠금 해제        │                       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

```bash
# Tang 서버 설정 (별도 서버)
dnf install tang
systemctl enable --now tangd.socket
# 키 생성 확인
tang-show-keys /var/db/tang

# 클라이언트 설정 (Clevis)
dnf install clevis clevis-luks clevis-dracut

# Tang 서버에 LUKS 디스크 바인딩
clevis luks bind -d /dev/sdb1 tang \
  '{"url":"http://tang.example.com"}'
# 지문 확인 후 y 입력

# HA 구성: 복수 Tang 서버 바인딩 (SPOF 방지)
# Tang 단일 서버 장애 시 재부팅된 모든 서버가 잠김
# sss 핀으로 Shamir Secret Sharing 조합 사용
clevis luks bind -d /dev/sdb1 sss \
  '{"t":1,"pins":{"tang":[
    {"url":"http://tang1.example.com"},
    {"url":"http://tang2.example.com"}
  ]}}'
# t=1: 두 서버 중 하나만 응답해도 잠금 해제

# initramfs 업데이트
dracut -fv

# 바인딩 확인
clevis luks list -d /dev/sdb1
# 1: tang '{"url":"http://tang.example.com",...}'

# 바인딩 해제
clevis luks unbind -d /dev/sdb1 -s 1
```

---

## 클라우드 및 컨테이너 환경

### AWS EBS 암호화 vs LUKS

| 항목 | AWS EBS 암호화 | LUKS |
|------|--------------|------|
| 키 관리 | AWS KMS (외부) | 로컬 / KMIP |
| 적용 위치 | 스토리지 레이어 | 블록 디바이스 레이어 |
| 투명 암호화 | O (OS 설정 불필요) | X (명시적 설정 필요) |
| 성능 영향 | 거의 없음 | 1~5% (AES-NI 하드웨어 가속 기준) |
| 벤더 종속 | AWS | 없음 |
| 온프레미스 적용 | 불가 | **가능** |
| 키 로테이션 | KMS 정책 | cryptsetup reencrypt |
| 규정 준수 | FIPS 140-2 (KMS) | 커널 crypto API 의존 |

> 온프레미스 환경에서는 LUKS가 유일한 표준 선택지다.
> 클라우드에서는 EBS 암호화 + KMS 고객 관리 키를 우선 고려하고
> 추가 레이어 필요 시 LUKS를 병행한다.

### Kubernetes에서 암호화된 PV 활용

```
┌───────────────────────────────────────────────────────┐
│                   Kubernetes 노드                      │
│                                                       │
│  Pod (앱)                                             │
│   └── PVC → PV → StorageClass                        │
│                    └── 암호화 옵션                     │
│                         │                            │
│          ┌──────────────┴──────────────┐              │
│          │                             │              │
│    CSI 레벨 암호화               노드 레벨 LUKS         │
│  (rook-ceph encryption,         (PV가 암호화된         │
│   OpenEBS cStor 등)             블록 위에 위치)         │
└───────────────────────────────────────────────────────┘
```

**rook-ceph + 암호화**:

```yaml
# StorageClass에 암호화 활성화
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ceph-block-encrypted
provisioner: rook-ceph.rbd.csi.ceph.com
parameters:
  # Ceph CSI가 LUKS를 직접 관리
  encrypted: "true"
  encryptionKMSID: "secrets-metadata-kms"
  ...
```

> rook-ceph는 CSI 레벨에서 자동으로 LUKS 포맷·열기를
> 처리한다. 각 PV는 고유한 LUKS 패스프레이즈를 가지며
> Kubernetes Secret 또는 외부 KMS(Vault 등)에 저장된다.

---

## 성능 최적화

### AES-NI 하드웨어 가속 확인

```bash
# CPU AES-NI 지원 확인
grep -m1 aes /proc/cpuinfo
# flags: ... aes ...

# 암호화 벤치마크
cryptsetup benchmark
# #     Algorithm |       Key |      Encryption |      Decryption
#        aes-cbc   128b   1234.5 MiB/s   1234.5 MiB/s
#        aes-xts   256b   1234.5 MiB/s   1234.5 MiB/s
#    serpent-xts   256b    234.5 MiB/s    234.5 MiB/s
```

### 성능 최적화 옵션

```bash
# crypttab에 워크큐 우회 옵션 추가 (커널 5.9+)
# /etc/crypttab
mydata  /dev/sdb1  none  luks,no-read-workqueue,no-write-workqueue

# 섹터 크기 최적화 (NVMe에서 4096 권장)
cryptsetup luksFormat \
  --type luks2 \
  --sector-size 4096 \
  /dev/nvme0n1p2
```

**dm-crypt 성능 튜닝 옵션**:

| 옵션 | 효과 | 주의사항 |
|------|------|---------|
| `no-read-workqueue` | 읽기 동기화 처리 | 일부 경우 레이턴시 증가 |
| `no-write-workqueue` | 쓰기 동기화 처리 | 커널 5.9+ 필요 |
| `--sector-size 4096` | I/O 최적화 | 포맷 시에만 설정 가능 |
| `discard` | SSD 성능 유지 | 보안 트레이드오프 |

---

## 운영 체크리스트

```
초기 설정
├── [ ] LUKS2 포맷 시 Argon2id + AES-256-XTS 적용
├── [ ] pbkdf-memory >= 1048576 (1 GiB) 확인
├── [ ] 포맷 직후 luksHeaderBackup 실행
├── [ ] 헤더 백업을 오프라인(별도 미디어)에 보관
└── [ ] luksDump로 파라미터 검증

키슬롯 관리
├── [ ] 키슬롯 0: 주 패스프레이즈
├── [ ] 키슬롯 1: 백업 패스프레이즈 (에스크로 보관)
├── [ ] 키슬롯 2+: TPM2/FIDO2/자동화 키파일
└── [ ] 사용하지 않는 키슬롯 제거

자동 잠금 해제
├── [ ] crypttab에 UUID로 디바이스 참조
├── [ ] fstab에 nofail 옵션 설정
├── [ ] TPM2/Tang 바인딩 시 fallback(수동 입력) 테스트
└── [ ] initramfs 업데이트 (dracut -fv / update-initramfs -u)

모니터링
├── [ ] systemd-cryptsetup 실패 알림 설정
├── [ ] 헤더 백업 주기적 최신화 (키슬롯 변경 시)
└── [ ] AES-NI 하드웨어 가속 활성화 확인

정기 점검
├── [ ] cryptsetup benchmark로 성능 기준선 유지
├── [ ] 키파일 접근 권한 (600, root만 읽기) 확인
└── [ ] Tang 서버 가용성 모니터링 (Clevis 환경)
```

---

## 참고 자료

- [cryptsetup FAQ — gitlab.com/cryptsetup](https://gitlab.com/cryptsetup/cryptsetup/-/wikis/FrequentlyAskedQuestions)
  — 확인: 2026-04-17
- [cryptsetup(8) man page — man7.org](https://man7.org/linux/man-pages/man8/cryptsetup.8.html)
  — 확인: 2026-04-17
- [LUKS2 On-Disk Format Specification — gitlab.com/cryptsetup](https://gitlab.com/cryptsetup/LUKS2-docs)
  — 확인: 2026-04-17
- [systemd-cryptenroll(1) — systemd.io](https://www.freedesktop.org/software/systemd/man/latest/systemd-cryptenroll.html)
  — 확인: 2026-04-17
- [crypttab(5) — man7.org](https://man7.org/linux/man-pages/man5/crypttab.5.html)
  — 확인: 2026-04-17
- [Clevis & Tang: Network-Bound Disk Encryption — github.com/latchset](https://github.com/latchset/clevis)
  — 확인: 2026-04-17
- [NBDE (Network Bound Disk Encryption) — Red Hat Docs](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/security_hardening/configuring-automated-unlocking-of-encrypted-volumes-using-policy-based-decryption_security-hardening)
  — 확인: 2026-04-17
- [dm-crypt — kernel.org](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/dm-crypt.html)
  — 확인: 2026-04-17
- [dm-integrity — kernel.org](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/dm-integrity.html)
  — 확인: 2026-04-17
- [Arch Linux Wiki: dm-crypt](https://wiki.archlinux.org/title/dm-crypt)
  — 확인: 2026-04-17
- [rook-ceph: OSD Encryption](https://rook.io/docs/rook/latest/CRDs/Cluster/ceph-cluster-crd/#osd-configuration-settings)
  — 확인: 2026-04-17
