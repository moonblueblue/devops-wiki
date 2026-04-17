---
title: "LVM 관리 (PV, VG, LV, 스냅샷)"
sidebar_label: "LVM"
sidebar_position: 2
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - lvm
  - storage
  - filesystem
  - snapshot
---

# LVM 관리 (PV, VG, LV, 스냅샷)

LVM(Logical Volume Manager)은 물리 디스크를 추상화하여
유연한 스토리지 풀을 구성하는 Linux 표준 블록 스토리지 계층이다.
RHEL 9 / Ubuntu 22.04 기준, LVM2 2.03.x 버전을 다룬다.

---

## 1. LVM 계층 구조

```
┌─────────────────────────────────────────────────────────┐
│                      애플리케이션                        │
├─────────────────────────────────────────────────────────┤
│              파일시스템 (ext4 / xfs / btrfs)            │
├─────────────────────────────────────────────────────────┤
│         LV (Logical Volume)   /dev/vg0/lv_data          │
│  ┌────────────┬───────────────┬──────────────────────┐  │
│  │  LE (LE0)  │   LE (LE1)   │   LE (LE2) ...       │  │
│  └────────────┴───────────────┴──────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│         VG (Volume Group)         vg0                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │  PE Pool: 물리 익스텐트(PE) 전체를 하나로 묶음   │    │
│  └─────────────────────────────────────────────────┘    │
├──────────────┬──────────────────┬───────────────────────┤
│  PV (sda1)   │   PV (sdb1)      │   PV (sdc1)           │
│  /dev/sda1   │   /dev/sdb1      │   /dev/sdc1           │
└──────────────┴──────────────────┴───────────────────────┘
```

| 계층 | 역할 | 핵심 단위 |
|------|------|-----------|
| **PV** (Physical Volume) | 실제 블록 디바이스를 LVM에 등록 | PE (Physical Extent) |
| **VG** (Volume Group) | 여러 PV를 하나의 스토리지 풀로 통합 | PE 집합 |
| **LV** (Logical Volume) | VG에서 할당받는 논리 볼륨 | LE (Logical Extent) |

> **PE/LE 크기**: 기본 4 MiB. VG 생성 시 `-s` 옵션으로 변경 가능.
> 최대 LV 크기 = PE 수 × PE 크기.

---

## 2. 기본 명령어 빠른 참조

### 2.1 초기 구성 흐름

```bash
# 1. PV 생성
pvcreate /dev/sdb /dev/sdc

# 2. VG 생성 (PE 크기 4 MiB 기본)
vgcreate vg0 /dev/sdb /dev/sdc

# 3. LV 생성 (100 GiB 선형 볼륨)
lvcreate -L 100G -n lv_data vg0

# 4. 파일시스템 생성 및 마운트
mkfs.xfs /dev/vg0/lv_data
mkdir -p /mnt/data
mount /dev/vg0/lv_data /mnt/data

# 5. /etc/fstab 영구 등록 (재부팅 후에도 마운트 유지)
# UUID 기반 권장
UUID=$(blkid -s UUID -o value /dev/vg0/lv_data)
echo "UUID=${UUID} /mnt/data xfs defaults 0 2" >> /etc/fstab
```

### 2.2 조회 명령어

| 명령어 | 출력 | 주요 옵션 |
|--------|------|-----------|
| `pvs` | PV 요약 | `--units g`, `-o +pv_pe_count` |
| `pvdisplay` | PV 상세 | `-v` |
| `vgs` | VG 요약 | `-o +vg_free_count` |
| `vgdisplay` | VG 상세 | `-v` |
| `lvs` | LV 요약 | `-o +lv_layout,lv_health_status` |
| `lvdisplay` | LV 상세 | `-m` (매핑 출력) |

```bash
# 실무에서 자주 쓰는 one-liner
lvs -o lv_name,lv_size,lv_layout,data_percent,metadata_percent vg0
```

### 2.3 확장 명령어

```bash
# VG에 디스크 추가
pvcreate /dev/sdd
vgextend vg0 /dev/sdd

# LV 확장 + 파일시스템 동시 확장
lvextend -L +50G -r /dev/vg0/lv_data   # -r: resize2fs / xfs_growfs 자동 실행

# LV를 VG 여유 공간 100%로 확장
lvextend -l +100%FREE -r /dev/vg0/lv_data
```

---

## 3. LV 타입

LVM2는 여러 LV 레이아웃을 지원한다.
용도에 맞는 타입을 선택하는 것이 성능과 안정성의 핵심이다.

### 3.1 타입 비교

| 타입 | 구성 | 용도 | 특징 |
|------|------|------|------|
| **Linear** | 순차 배치 | 일반 데이터 | 기본값, 단순 |
| **Striped** | RAID 0 방식 | 고성능 I/O | 디스크 수 = 스트라이프 수 |
| **Mirrored** | RAID 1 방식 | 내구성 | dm-mirror 기반 |
| **RAID** | RAID 1/5/6/10 | 내구성 + 성능 | dm-raid 기반 (권장) |
| **Thin Pool** | 씬 프로비저닝 | 스냅샷, 클라우드 | 오버프로비저닝 가능 |
| **VDO** | 중복 제거 + 압축 | 백업, 아카이브 | kvdo 모듈 필요 |
| **Cache** | SSD 캐시 계층 | 혼합 스토리지 | dm-cache 기반 |

### 3.2 Striped LV 생성

```bash
# 2개 PV, 스트라이프 크기 256 KiB
lvcreate -L 200G -i 2 -I 256K -n lv_stripe vg0
```

### 3.3 RAID LV 생성 (권장)

```bash
# RAID 1 (미러 2개)
lvcreate --type raid1 -m 1 -L 100G -n lv_raid1 vg0

# RAID 5: -i N은 데이터 스트라이프 수, parity 1개 자동 추가
# -i 3 → 필요 PV = 3(data) + 1(parity) = 4개
lvcreate --type raid5 -i 3 -L 300G -n lv_raid5 vg0

# RAID 6: parity 2개 자동 추가
# -i 4 → 필요 PV = 4(data) + 2(parity) = 6개
lvcreate --type raid6 -i 4 -L 400G -n lv_raid6 vg0

# RAID 10: -i 2(스트라이프) × -m 1(미러) → 필요 PV = 4개
lvcreate --type raid10 -m 1 -i 2 -L 200G -n lv_raid10 vg0
```

---

## 4. Thin Provisioning

씬 프로비저닝은 실제 물리 공간보다 큰 논리 공간을 할당한다.
스냅샷과 효율적인 공간 활용에 핵심적으로 사용된다.

### 4.1 Thin Pool 구조

```
VG (vg0) - 물리 용량: 1 TiB
└── Thin Pool (tp0) - 500 GiB
    ├── Thin LV (lv_a) - 200 GiB 할당 (실제 50 GiB 사용)
    ├── Thin LV (lv_b) - 200 GiB 할당 (실제 30 GiB 사용)
    └── Thin LV (lv_c) - 200 GiB 할당 (실제 20 GiB 사용)
    ← 총 할당: 600 GiB > 물리 500 GiB (오버프로비저닝)
```

### 4.2 Thin Pool 생성 및 사용

```bash
# Thin Pool 생성 (메타데이터 자동 계산)
lvcreate -L 500G --thinpool tp0 vg0

# 메타데이터 크기 명시 (대규모 환경 권장)
lvcreate -L 500G --poolmetadatasize 1G --thinpool tp0 vg0

# Thin LV 생성 (--virtualsize: 논리 크기)
lvcreate -V 200G --thin -n lv_a vg0/tp0

# 파일시스템 생성
mkfs.xfs /dev/vg0/lv_a
mount /dev/vg0/lv_a /mnt/a
```

### 4.3 오버프로비저닝 위험 관리

**data_percent**가 80%를 초과하면 즉시 조치가 필요하다.

```bash
# 사용률 모니터링
lvs -o lv_name,data_percent,metadata_percent vg0

# 출력 예시
# LV   Data%  Meta%
# tp0  72.00  1.23
```

```bash
# Thin Pool 공간 부족 시 확장
lvextend -L +100G vg0/tp0

# 자동 확장 설정 (lvm.conf)
# thin_pool_autoextend_threshold = 80
# thin_pool_autoextend_percent = 20
```

> **운영 원칙**: data_percent > 80% → 알림, > 95% → 즉시 확장.
> 100% 도달 시 Thin LV에 쓰기 불가(I/O 에러) 발생.
>
> **metadata_percent 100%는 더 치명적이다**: pool corrupt → 데이터
> 손실 가능. metadata_percent > 80% 시 즉시 pool 확장 필수.
> `lvs -o name,data_percent,metadata_percent` 로 항상 양쪽 모니터링.

---

## 5. 스냅샷

### 5.1 COW(Copy-on-Write) 방식 (일반 스냅샷)

```
스냅샷 생성 시점:
┌─────────────────┐
│   Origin LV     │  ← 원본 데이터
│  (lv_data)      │
└────────┬────────┘
         │ COW 참조
┌────────▼────────┐
│   Snapshot LV   │  ← 변경된 블록만 저장
│  (lv_data_snap) │
└─────────────────┘

쓰기 발생 시:
1. 원본 블록을 스냅샷 공간으로 복사
2. 원본 LV에 새 데이터 기록
3. 스냅샷은 복사된 구 블록을 참조
```

```bash
# 일반(COW) 스냅샷 생성
# Origin LV 크기의 20~30% 권장
lvcreate -s -L 20G -n lv_data_snap /dev/vg0/lv_data

# 스냅샷 마운트 (읽기 전용)
mount -o ro /dev/vg0/lv_data_snap /mnt/snap

# 스냅샷으로 복원
lvconvert --merge /dev/vg0/lv_data_snap
# 마운트 해제 후 reboot 또는 unmount된 LV면 즉시 적용
```

**주의사항**:
- 스냅샷 공간이 가득 차면 스냅샷이 무효화된다.
- 원본이 활발히 쓰이는 경우 충분한 스냅샷 크기 확보 필수.

### 5.2 Thin 스냅샷 (권장)

Thin LV에서 생성하는 스냅샷은 별도 크기 지정이 불필요하다.
Thin Pool을 공유하므로 스냅샷 공간 고갈 걱정이 없다.

```bash
# Thin 스냅샷 생성 (크기 지정 불필요)
lvcreate -s -n lv_a_snap vg0/lv_a

# 스냅샷 마운트
mount -o ro /dev/vg0/lv_a_snap /mnt/snap_a

# 스냅샷에서 특정 파일 복원
cp /mnt/snap_a/important.conf /mnt/a/important.conf

# 스냅샷 삭제
lvremove /dev/vg0/lv_a_snap
```

### 5.3 스냅샷 방식 비교

| 항목 | COW 스냅샷 | Thin 스냅샷 |
|------|-----------|------------|
| LV 타입 | 일반 LV | Thin LV |
| 크기 지정 | 필요 (20~30%) | 불필요 |
| 공간 공유 | 독립 | Thin Pool 공유 |
| 스냅샷 체인 | 단일 레벨 권장 | 다중 체인 가능 |
| 성능 오버헤드 | 높음 | 낮음 |
| 권장 용도 | 단기 백업 | 운영 환경 |

---

## 6. LVM RAID vs mdadm

### 6.1 구조 비교

```
mdadm RAID:
/dev/sda + /dev/sdb → /dev/md0 (RAID 1) → pvcreate → VG

lvmraid:
/dev/sda + /dev/sdb → PV → VG → lvcreate --type raid1 → RAID LV
```

### 6.2 특성 비교

| 항목 | lvmraid | mdadm |
|------|---------|-------|
| 관리 도구 | lvm2 단일 | mdadm 별도 |
| 스냅샷 | LVM 스냅샷 통합 | LVM 위에 별도 |
| 씬 프로비저닝 | 통합 | 불가 |
| RAID 레벨 | 1/4/5/6/10 | 0/1/4/5/6/10 |
| 메타데이터 | LVM 메타에 통합 | /dev/md 별도 |
| 리빌드 우선순위 | `lvchange --resync` | `sync_action` |
| 성숙도 | 중간 | 높음 (수십 년) |

> **실무 권고**: lvmraid는 관리 통합(단일 도구)이 유리하나,
> RAID 메타데이터가 LVM VG 메타데이터에 결합되어
> 복구 시 독립적인 mdadm 도구로 접근이 불가능하다.
> 신규 구성 시 트러블슈팅 경험이 충분하다면 lvmraid,
> 프로덕션 안정성을 최우선으로 한다면 mdadm+LVM 계층 구조를
> 고려할 것.

### 6.3 RAID 상태 확인

```bash
# RAID LV 동기화 상태 확인
lvs -o lv_name,lv_health_status,sync_percent vg0

# 리빌드 강제 시작
lvchange --resync /dev/vg0/lv_raid1

# RAID 디바이스 교체 절차
# 1. 장애 디바이스 확인
lvs -o lv_name,devices,lv_health_status vg0

# 2. 장애 PV를 새 PV로 교체
pvmove /dev/sdb   # 데이터 이동
vgreduce vg0 /dev/sdb
pvremove /dev/sdb

# 3. 새 디스크 추가
pvcreate /dev/sde
vgextend vg0 /dev/sde
# RAID LV가 자동으로 새 PV를 사용하여 리빌드
```

---

## 7. pvmove로 디스크 무중단 교체

`pvmove`는 서비스 중단 없이 데이터를 다른 PV로 이동한다.

### 7.1 교체 절차

```
Before:
VG(vg0): [sdb(old)] [sdc] [sdd]
         LV 데이터가 sdb에 분산

After:
VG(vg0): [sdc] [sdd] [sde(new)]
         sdb 제거 완료
```

```bash
# Step 1: 신규 디스크 PV 등록 및 VG 추가
pvcreate /dev/sde
vgextend vg0 /dev/sde

# Step 2: 특정 PV의 데이터 전체 이동 (백그라운드)
pvmove /dev/sdb &

# Step 3: 진행 상황 모니터링
watch -n 5 "pvs -o pv_name,pv_used,pv_free"

# 특정 LV만 이동 (선택적)
pvmove -n /dev/vg0/lv_data /dev/sdb /dev/sde

# Step 4: 이동 완료 후 VG에서 제거
vgreduce vg0 /dev/sdb

# Step 5: PV 레이블 삭제 (디스크 재활용 시)
pvremove /dev/sdb
```

### 7.2 pvmove 중단 및 재개

```bash
# 중단 (서버 재시작 등 긴급 상황)
# pvmove는 중단 후 자동으로 재개 가능

# 중단된 pvmove 재개: 인자 없이 pvmove 재실행
pvmove

# 작업 취소(롤백)가 필요한 경우에만 --abort 사용
pvmove --abort
```

> **주의**: pvmove 중 전원 차단 시 VG가 손상될 수 있다.
> 반드시 UPS 환경에서 실행하거나 백업 후 진행할 것.

---

## 8. /etc/lvm/lvm.conf 주요 설정

```bash
# 설정 파일 위치
/etc/lvm/lvm.conf

# 프로파일 디렉토리
/etc/lvm/profile/
```

### 8.1 핵심 설정 항목

```ini
# --- devices 섹션 ---
devices {
    # LVM이 스캔할 디바이스 필터 (화이트리스트/블랙리스트)
    # "a" = accept, "r" = reject
    # 예: /dev/sd*, /dev/nvme*만 허용하고 나머지 거부
    filter = [ "a|^/dev/sd|", "a|^/dev/nvme|", "r|.*|" ]

    # 특정 디바이스 타입 제외 (예: multipath 환경)
    global_filter = [ "r|^/dev/dm-|" ]

    # 디바이스 목록 캐시 파일
    use_devicesfile = 1   # LVM2 2.03.17+, RHEL 9 기본값
}

# --- activation 섹션 ---
activation {
    # udev와 통합 여부 (기본 활성화)
    udev_sync = 1
    udev_rules = 1

    # 씬 풀 자동 확장 임계값 (%)
    thin_pool_autoextend_threshold = 80
    # 임계값 초과 시 확장 비율 (%)
    thin_pool_autoextend_percent = 20
}

# --- backup 섹션 ---
backup {
    # VG 메타데이터 자동 백업
    backup = 1
    backup_dir = "/etc/lvm/backup"

    # 이전 버전 아카이브
    archive = 1
    archive_dir = "/etc/lvm/archive"
    retain_min = 10    # 최소 보관 개수
    retain_days = 30   # 최소 보관 일수
}

# --- log 섹션 ---
log {
    level = 3        # 0=quiet, 7=verbose
    syslog = 1
    overwrite = 0
}
```

### 8.2 디바이스 필터 설정 (SAN/multipath 환경)

```bash
# SAN 환경: multipath 디바이스만 허용
filter = [ "a|^/dev/mapper/mpath|", "r|.*|" ]

# 로컬 NVMe만 허용
filter = [ "a|^/dev/nvme|", "r|.*|" ]

# 설정 변경 후 검증
lvm dumpconfig --type diff   # 기본값과 차이 확인
lvm dumpconfig --type full   # 전체 설정 확인
```

---

## 9. 실무 운영 명령어

### 9.1 스캔 및 활성화

```bash
# 시스템의 모든 PV 스캔
pvscan

# 시스템의 모든 VG 스캔
vgscan

# VG 활성화 (부팅 후 또는 디스크 교체 후)
vgchange -a y vg0

# 특정 LV만 활성화
lvchange -a y /dev/vg0/lv_data

# 외부에서 가져온 VG 임포트 (디스크 이동 후)
vgimport vg0        # 구 방식 (LVM2 2.03.17 이전)
vgimportdevices vg0 # 신 방식 (devices file 사용)
```

### 9.2 VG 메타데이터 복구

```bash
# VG 메타데이터 백업 확인
ls /etc/lvm/backup/
ls /etc/lvm/archive/

# 메타데이터 복원
vgcfgrestore -f /etc/lvm/archive/vg0_00001-1234567890.vg vg0

# UUID로 누락된 PV 복구
pvcreate --restorefile /etc/lvm/backup/vg0 \
  --uuid "xxxx-xxxx-xxxx-xxxx" /dev/sdb
```

### 9.3 LV 이름 변경 및 삭제

```bash
# LV 이름 변경
lvrename vg0 lv_old lv_new

# LV 삭제 (마운트 해제 후)
umount /mnt/data
lvremove /dev/vg0/lv_data

# VG 삭제 (LV 전체 삭제 후)
vgchange -a n vg0
vgremove vg0

# PV 레이블 삭제
pvremove /dev/sdb
```

---

## 10. 디스크 교체 시나리오 (전체 흐름)

### 시나리오: /dev/sdb 고장, /dev/sde로 교체

```bash
#!/bin/bash
# 1단계: 새 디스크 준비
pvcreate /dev/sde
vgextend vg0 /dev/sde

# 2단계: 데이터 이동 (무중단)
pvmove /dev/sdb
# 완료까지 대기 (진행률 모니터링)
# watch -n 10 "pvmove" 또는 lvs로 확인

# 3단계: 이동 완료 확인
pvs /dev/sdb   # PV Used = 0 확인

# 4단계: VG에서 제거
vgreduce vg0 /dev/sdb

# 5단계: PV 레이블 삭제
pvremove /dev/sdb

# 6단계: 검증
vgs vg0
pvs
lvs vg0
```

```
Before:  vg0 = [sdb(장애)] + [sdc] + [sdd]
Step 1:  vg0 = [sdb(장애)] + [sdc] + [sdd] + [sde(신규)]
Step 2:  pvmove: sdb → sde 데이터 이동 중
Step 3:  vg0 = [sdb(빈)] + [sdc] + [sdd] + [sde]
Step 4:  vg0 = [sdc] + [sdd] + [sde]
After:   sdb 물리 교체 가능
```

---

## 11. LVM 필터 설정 심화

### 11.1 devices file (RHEL 9 / LVM2 2.03.17+)

RHEL 9부터 `filter` 대신 devices file 방식이 기본이다.

```bash
# 현재 devices file 확인
cat /etc/lvm/devices/system.devices

# 특정 디바이스를 devices file에 추가
lvmdevices --adddev /dev/sde

# 디바이스 제거
lvmdevices --deldev /dev/sdb

# devices file 전체 갱신
lvmdevices --update
```

### 11.2 컨테이너/VM 환경 필터링

```bash
# Docker/LXC 루프백 디바이스 제외 예시
filter = [ "r|^/dev/loop|", "a|^/dev/sd|", "r|.*|" ]

# 설정 변동 후 스캔 갱신
vgscan --mknodes
vgchange -a y
```

---

## 12. 모니터링

### 12.1 dmeventd (LVM 이벤트 데몬)

```bash
# dmeventd 상태 확인
systemctl status dm-event.service

# Thin Pool 이벤트 모니터링 등록
lvchange --monitor y /dev/vg0/tp0

# 모니터링 상태 확인
lvs -o lv_name,lv_kernel_minor,dmeventd_monitor_flags vg0
```

### 12.2 LV 상태 모니터링 명령어

```bash
# 전체 상태 한눈에 보기
lvs -a -o lv_name,lv_size,lv_layout,lv_health_status,\
data_percent,metadata_percent,sync_percent vg0

# Thin Pool 사용률 경고 스크립트 예시
lvs --noheadings -o data_percent vg0/tp0 | \
awk '{ if ($1+0 > 80) print "WARNING: tp0 " $1 "% used" }'
```

### 12.3 Prometheus 연동 (prometheus-lvm-exporter)

```bash
# node_exporter의 LVM 메트릭 (기본 내장 아님)
# prometheus-lvm-exporter 설치 권장
# https://github.com/hansmi/prometheus-lvm-exporter

# 주요 메트릭 예시
# lvm_lv_data_percent{lv="tp0",vg="vg0"}
# lvm_pv_free_bytes{pv="/dev/sdc",vg="vg0"}
# lvm_vg_free_bytes{vg="vg0"}
```

### 12.4 모니터링 체크리스트

| 항목 | 임계값 | 조치 |
|------|--------|------|
| VG free space | < 20% | LV 확장 or 디스크 추가 |
| Thin Pool data_percent | > 80% | Pool 확장 |
| Thin Pool metadata_percent | > 80% | 메타데이터 LV 확장 |
| RAID sync_percent | < 100% | 리빌드 완료 대기 |
| lv_health_status | `partial` | 즉시 디스크 교체 |

---

## 참고 자료

- [LVM2 공식 문서 - Red Hat](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_and_managing_logical_volumes/)
  (확인일: 2026-04-17)
- [Ubuntu LVM Guide - ubuntu.com](https://ubuntu.com/server/docs/about-lvm)
  (확인일: 2026-04-17)
- [LVM2 소스코드 및 릴리즈 - sourceware.org](https://sourceware.org/lvm2/)
  (확인일: 2026-04-17)
- [Device Mapper Thin Provisioning - kernel.org](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/thin-provisioning.html)
  (확인일: 2026-04-17)
- [lvmraid(7) man page](https://man7.org/linux/man-pages/man7/lvmraid.7.html)
  (확인일: 2026-04-17)
- [lvmthin(7) man page](https://man7.org/linux/man-pages/man7/lvmthin.7.html)
  (확인일: 2026-04-17)
