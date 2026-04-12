---
title: "디스크·파티션·LVM 관리 완전 가이드"
date: 2026-04-13
tags:
  - linux
  - disk
  - partition
  - lvm
  - filesystem
  - raid
  - devops
sidebar_label: "디스크·LVM"
---
format: md

# 디스크·파티션·LVM 관리

## 1. 블록 디바이스와 파티션

### 블록 디바이스 확인 도구

| 도구 | 용도 | 핵심 옵션 |
|------|------|-----------|
| `lsblk` | 블록 디바이스 트리 표시 | `-f` UUID/FS 포함 |
| `blkid` | UUID·FSTYPE·LABEL 조회 | 디바이스 경로 지정 |
| `fdisk` | MBR/GPT 파티셔닝 (대화형) | `-l` 목록 출력 |
| `parted` | MBR/GPT (스크립트 가능) | `print` 정보 표시 |
| `gdisk` | GPT 전용 파티셔닝 | fdisk 유사 인터페이스 |

```bash
# 전체 디바이스 트리 + 파일시스템 정보
lsblk -f

# 특정 디바이스 UUID 확인
blkid /dev/sda1

# 디스크 파티션 목록
fdisk -l /dev/sda

# 비대화형 파티션 생성 (GPT, 디스크 전체)
parted -s /dev/sdb mklabel gpt \
  mkpart primary ext4 0% 100%
```

### MBR vs GPT

| 항목 | MBR | GPT |
|------|-----|-----|
| 최대 디스크 | 2 TB | 9.4 ZB |
| 최대 파티션 | 4개 (확장 파티션 우회) | 128개 |
| 부팅 방식 | Legacy BIOS | UEFI |
| 데이터 보호 | 단일 헤더 | CRC + 백업 헤더 |
| **권장** | 레거시 호환 시에만 | **모든 신규 디스크** |

> **2025+ 권장:** 모든 신규 디스크에 GPT를 사용한다.
> 2TB 초과 디스크는 GPT가 필수다.

---

## 2. 파일시스템 비교

| 항목 | ext4 | XFS | Btrfs |
|------|------|-----|-------|
| 도입 | 2008 | 1994 (SGI) | 2009 |
| 기본 배포판 | Ubuntu, Debian | RHEL 7+ | Fedora 33+, openSUSE |
| 최대 파일 | 16 TiB | 8 EiB | 16 EiB |
| inode 할당 | 포맷 시 고정 | 동적 할당 | 동적 할당 |
| 스냅샷 | 미지원 (LVM) | 미지원 (LVM) | 네이티브 |
| CoW | 미지원 | 미지원 | 지원 |
| 온라인 축소 | 불가 | 불가 | 가능 |
| 온라인 확장 | 가능 (`resize2fs`) | 가능 (`xfs_growfs`) | 가능 |
| 압축 | 미지원 | 미지원 | zstd, lzo, zlib |

### 성능 벤치마크 요약 (2024-2026)

| 워크로드 | 1위 | 2위 | 3위 |
|----------|-----|-----|-----|
| SQLite 동시 쓰기 | ext4 | XFS | Btrfs |
| 순차 읽기 | XFS | ext4 | Btrfs |
| 랜덤 I/O | ext4 ≈ XFS | - | Btrfs |

**선택 가이드:**

- **ext4** → 범용 서버, 안정성 최우선
- **XFS** → 대용량 파일, 높은 I/O, RHEL 계열
- **Btrfs** → 스냅샷·압축 필요, 데이터 무결성 중시

```bash
# 파일시스템 생성
mkfs.ext4 /dev/sdb1
mkfs.xfs /dev/sdb1
mkfs.btrfs /dev/sdb1

# 파일시스템 타입 확인
blkid /dev/sdb1
```

---

## 3. 마운트와 fstab

### 수동 마운트

```bash
# 기본 마운트
mount /dev/sdb1 /mnt/data

# 읽기 전용 + 실행 금지 (보안)
mount -o ro,noexec,nosuid /dev/sdb1 /mnt/data

# 언마운트
umount /mnt/data

# 사용 중인 프로세스 확인 후 언마운트
fuser -mv /mnt/data
umount -l /mnt/data   # lazy unmount
```

### /etc/fstab 설정

```text title="/etc/fstab"
# <device>       <mount>   <type> <options>       <dump> <pass>
UUID=abc-123     /data     ext4   defaults,noatime  0      2
UUID=def-456     /app      xfs    defaults,nofail   0      2
```

**주요 마운트 옵션:**

| 옵션 | 설명 |
|------|------|
| `defaults` | rw,suid,dev,exec,auto,nouser,async |
| `noatime` | 접근 시간 미갱신 → 성능 향상 |
| `nosuid` | SUID 비트 무시 → 보안 강화 |
| `noexec` | 실행 권한 무시 → 보안 강화 |
| `nofail` | 디바이스 부재 시에도 부팅 진행 |

### UUID vs 디바이스 경로

```bash
# UUID 확인
blkid /dev/sdb1
# 출력: /dev/sdb1: UUID="a1b2c3..." TYPE="ext4"

# fstab에는 반드시 UUID 사용
# /dev/sdX는 디스크 순서 변경 시 바뀔 수 있음
```

> **모범 사례:** `/dev/sdX` 대신 `UUID=` 사용.
> ArchWiki, man fstab 모두 UUID를 공식 권장한다.

```bash
# fstab 변경 후 검증 (재부팅 전 필수)
mount -a
```

---

## 4. LVM 개념과 구조

### 아키텍처 다이어그램

```text
┌─────────────────────────────────────┐
│        Logical Volumes (LV)         │
│ ┌────────┐ ┌────────┐ ┌────────┐   │
│ │ app_lv │ │ log_lv │ │ db_lv  │   │
│ │  50G   │ │  30G   │ │ 100G   │   │
│ └───┬────┘ └───┬────┘ └───┬────┘   │
│     └──────────┼──────────┘         │
│                ▼                    │
│      ┌──────────────────┐           │
│      │ Volume Group(VG) │           │
│      │ data_vg   200G   │           │
│      └────────┬─────────┘           │
│          ┌────┴────┐                │
│          ▼         ▼                │
│   ┌──────────┐ ┌──────────┐        │
│   │PV /sdb   │ │PV /sdc   │        │
│   │ 100G     │ │ 100G     │        │
│   └──────────┘ └──────────┘        │
│      Physical Volumes (PV)          │
└─────────────────────────────────────┘
```

### 핵심 개념

| 용어 | 설명 |
|------|------|
| **PV** | Physical Volume. 물리 디스크/파티션 |
| **VG** | Volume Group. PV를 묶은 스토리지 풀 |
| **LV** | Logical Volume. VG에서 할당된 가상 파티션 |
| **PE** | Physical Extent. 최소 할당 단위 (기본 4 MiB) |

LVM의 핵심 장점은 **유연한 크기 조절**이다.
파티션 재생성 없이 LV를 확장/축소할 수 있고,
새 디스크를 추가해 VG를 온라인으로 확장한다.

---

## 5. LVM 실전 명령어

### 기본 워크플로우

```bash
# ── 1) PV 생성 ──
pvcreate /dev/sdb /dev/sdc
pvs                        # PV 목록 확인
pvdisplay /dev/sdb         # 상세 정보

# ── 2) VG 생성 ──
vgcreate data_vg /dev/sdb /dev/sdc
vgs                        # VG 목록 확인

# ── 3) LV 생성 ──
lvcreate -L 50G -n app_lv data_vg
lvcreate -l 100%FREE -n log_lv data_vg
lvs                        # LV 목록 확인

# ── 4) 파일시스템 생성 + 마운트 ──
mkfs.xfs /dev/data_vg/app_lv
mkdir -p /app
mount /dev/data_vg/app_lv /app

# fstab 등록
echo "$(blkid -s UUID -o value \
  /dev/data_vg/app_lv) /app xfs defaults 0 2" \
  >> /etc/fstab
```

### LV 확장 (온라인)

```bash
# ext4: lvextend + resize2fs
lvextend -L +20G /dev/data_vg/app_lv
resize2fs /dev/data_vg/app_lv

# xfs: lvextend + xfs_growfs (마운트포인트 지정)
lvextend -L +20G /dev/data_vg/app_lv
xfs_growfs /app

# 한 번에 확장 + 리사이즈 (-r 옵션)
lvextend -r -L +20G /dev/data_vg/app_lv
```

### VG 확장 (디스크 추가)

```bash
# 새 디스크를 PV로 초기화
pvcreate /dev/sdd

# 기존 VG에 PV 추가
vgextend data_vg /dev/sdd
vgs  # Free PE 증가 확인

# 늘어난 공간으로 LV 확장
lvextend -r -l +100%FREE /dev/data_vg/app_lv
```

### Thin Provisioning

실제 용량보다 큰 가상 크기를 할당하여
스토리지를 효율적으로 활용하는 기법이다.
데이터가 기록될 때만 실제 공간을 소비한다.

```bash
# Thin Pool 생성 (실제 물리 공간)
lvcreate -L 100G --thinpool thin_pool data_vg

# Thin Volume 생성 (가상 크기 > 풀 크기 가능)
lvcreate -V 200G --thin \
  -n thin_app data_vg/thin_pool
lvcreate -V 300G --thin \
  -n thin_db data_vg/thin_pool

# Thin Pool 사용량 확인
lvs -o+data_percent data_vg/thin_pool

# Thin Pool 확장 (축소 불가)
lvextend -L +50G data_vg/thin_pool
```

### 스냅샷

```bash
# 스냅샷 생성 (CoW 방식, 변경분만 저장)
lvcreate -L 5G -s -n snap_app \
  /dev/data_vg/app_lv

# 스냅샷 마운트 (백업·검증용)
mkdir /mnt/snap
mount -o ro /dev/data_vg/snap_app /mnt/snap

# 스냅샷에서 원본 복원 (merge)
umount /mnt/snap
lvconvert --merge /dev/data_vg/snap_app
# origin이 활성 상태면 다음 재활성화 시 merge
# merge 완료 후 스냅샷 자동 삭제

# 스냅샷 삭제 (복원 불필요 시)
lvremove /dev/data_vg/snap_app
```

---

## 6. 디스크 확장 시나리오

### 시나리오 A: 클라우드 EBS/PD 확장 (LVM 미사용)

```text
[클라우드 콘솔]     [Linux 인스턴스]
볼륨 크기 수정  →  growpart  →  resize2fs/xfs_growfs
```

```bash
# 1) 클라우드에서 볼륨 크기 수정 (콘솔/CLI)
# AWS: aws ec2 modify-volume --volume-id vol-xxx \
#        --size 200
# GCP: gcloud compute disks resize DISK --size=200GB

# 2) 파티션 확장 (growpart)
lsblk                     # 변경된 크기 확인
growpart /dev/xvda 1       # 파티션 1 확장

# 3) 파일시스템 확장
resize2fs /dev/xvda1       # ext4
xfs_growfs /               # xfs

# 재부팅 불필요. AWS EBS는 6시간에 1회 수정 가능
```

### 시나리오 B: 새 디스크 추가 + LVM

```text
신규 디스크 → pvcreate → vgextend → lvextend → resize
```

```bash
# 1) 새 디스크 확인
lsblk
# /dev/sdd  100G  disk

# 2) PV → VG 확장 → LV 확장
pvcreate /dev/sdd
vgextend data_vg /dev/sdd
lvextend -r -L +100G /dev/data_vg/app_lv

# 3) 확인
df -h /app
```

### 시나리오 C: 루트 파티션 확장 (LVM)

```bash
# 1) 클라우드에서 디스크 크기 증가 후
growpart /dev/sda 2          # 파티션 확장
pvresize /dev/sda2           # PV 크기 갱신
lvextend -r -l +100%FREE \
  /dev/centos/root           # LV + FS 확장
```

### 시나리오 D: 디스크 교체 (데이터 마이그레이션)

```bash
# 1) 새 디스크 추가
pvcreate /dev/sde
vgextend data_vg /dev/sde

# 2) 기존 디스크에서 새 디스크로 데이터 이동
pvmove /dev/sdb /dev/sde

# 3) 기존 디스크 제거
vgreduce data_vg /dev/sdb
pvremove /dev/sdb
```

---

## 7. 디스크 모니터링

### df - 파일시스템 사용량

```bash
# 인간 친화적 출력
df -hT
# Filesystem     Type  Size  Used Avail Use% Mounted
# /dev/sda1      xfs    50G   32G   18G  64% /
# /dev/mapper/data_vg-app_lv
#                ext4  100G   75G   25G  75% /app

# inode 사용량 (소파일 다수 시 필수)
df -i
```

### du - 디렉토리별 사용량

```bash
# 특정 디렉토리 크기
du -sh /var/log

# 1단계 깊이별 크기 정렬
du -h --max-depth=1 / 2>/dev/null | sort -rh

# 큰 파일 Top 10
du -ah / 2>/dev/null | sort -rh | head -10
```

### ncdu - 대화형 분석

```bash
# 설치
# RHEL: yum install ncdu
# Debian: apt install ncdu

# 루트부터 스캔 (마운트 포인트 제외)
ncdu -x /

# 조작법: ↑↓ 탐색, Enter 진입, d 삭제
```

### 모니터링 알림 설정

```bash
# 간단 디스크 알림 (cron 등록)
#!/bin/bash
THRESHOLD=80
df -h --output=pcent,target | tail -n +2 | \
while read pct mount; do
  usage=${pct%%%}
  if [ "$usage" -gt "$THRESHOLD" ]; then
    echo "WARN: $mount ${pct} 사용" | \
      mail -s "Disk Alert" admin@example.com
  fi
done
```

**모니터링 모범 사례:**

| 항목 | 권장 |
|------|------|
| 알림 임계값 | 80% (95%는 너무 늦음) |
| inode 모니터링 | `df -i` 포함 필수 |
| 로그 로테이션 | logrotate 설정 필수 |
| 자동 수집 | Prometheus node_exporter |
| 주요 감시 경로 | `/var/log`, `/tmp`, `/home` |

---

## 8. RAID 기초

### RAID 레벨 비교

| 레벨 | 방식 | 최소 디스크 | 용량 효율 | 내결함성 | 성능 |
|------|------|-------------|-----------|----------|------|
| 0 | 스트라이핑 | 2 | 100% | 없음 | 읽기/쓰기 최고 |
| 1 | 미러링 | 2 | 50% | 1개 장애 | 읽기 2배 |
| 5 | 패리티 분산 | 3 | (N-1)/N | 1개 장애 | 읽기 우수 |
| 6 | 이중 패리티 | 4 | (N-2)/N | 2개 장애 | 쓰기 느림 |
| 10 | 미러+스트라이프 | 4 | 50% | 미러당 1개 | 읽기/쓰기 우수|

```text
RAID 0 (스트라이핑)     RAID 1 (미러링)
┌───┬───┐              ┌───┐ ┌───┐
│A1 │A2 │              │ A │ │ A │ (동일)
│B1 │B2 │              │ B │ │ B │
│C1 │C2 │              │ C │ │ C │
└───┴───┘              └───┘ └───┘
Disk1 Disk2            Disk1 Disk2

RAID 5 (패리티 분산)   RAID 10 (미러+스트라이프)
┌───┬───┬───┐        ┌───┬───┐ ┌───┬───┐
│A1 │A2 │Ap │        │A1 │A1 │ │A2 │A2 │
│B1 │Bp │B2 │        │B1 │B1 │ │B2 │B2 │
│Cp │C1 │C2 │        └───┴───┘ └───┴───┘
└───┴───┴───┘        Mirror1   Mirror2
D1   D2   D3           ← Stripe →
```

### mdadm 기본 명령

```bash
# RAID 1 생성
mdadm --create /dev/md0 --level=1 \
  --raid-devices=2 /dev/sdb /dev/sdc

# 상태 확인
cat /proc/mdstat
mdadm --detail /dev/md0

# 설정 저장 (재부팅 유지)
mdadm --detail --scan >> /etc/mdadm.conf

# 장애 디스크 교체
mdadm /dev/md0 --fail /dev/sdc
mdadm /dev/md0 --remove /dev/sdc
mdadm /dev/md0 --add /dev/sdd
# 리빌드 자동 시작, /proc/mdstat로 진행률 확인
```

### RAID 선택 가이드

| 용도 | 권장 레벨 |
|------|-----------|
| 임시 데이터, 캐시 | RAID 0 |
| OS 부트, 소규모 서버 | RAID 1 |
| NAS, 파일 서버 | RAID 5 / RAID 6 |
| DB, 고성능 서버 | RAID 10 |

> **참고:** 클라우드 환경에서는 EBS/PD가
> 내부적으로 복제를 제공하므로
> 소프트웨어 RAID는 일반적으로 불필요하다.

---

## 참고 링크

- [ArchWiki - fstab](https://wiki.archlinux.org/title/Fstab)
- [RHEL - LVM Administration](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/6/html/logical_volume_manager_administration/)
- [AWS - EBS 볼륨 확장](https://docs.aws.amazon.com/ebs/latest/userguide/recognize-expanded-volume-linux.html)
- [ArchWiki - RAID](https://wiki.archlinux.org/title/RAID)
- [man7 - fstab(5)](https://man7.org/linux/man-pages/man5/fstab.5.html)
- [man7 - lvmthin(7)](https://man7.org/linux/man-pages/man7/lvmthin.7.html)
