---
title: "Linux 디스크 I/O 성능 분석"
date: 2026-04-13
tags:
  - linux
  - disk
  - io
  - performance
  - iostat
  - fio
sidebar_label: "디스크 I/O"
---

# Linux 디스크 I/O 성능 분석

## 1. I/O 핵심 개념

### 4가지 핵심 지표

| 지표 | 설명 | 도구 |
|------|------|------|
| **IOPS** | 초당 I/O 작업 수 | iostat r/s, w/s |
| **Throughput** | 초당 데이터 전송량 (MB/s) | iostat rkB/s, wkB/s |
| **Latency** | 요청 완료까지 시간 (ms) | iostat r_await, w_await |
| **Queue Depth** | 동시 처리 중인 I/O 수 | iostat aqu-sz |

### 디바이스별 기준값

```
IOPS 기준
  HDD (7200RPM)   :  80 ~ 180 IOPS
  SATA SSD        :  10,000 ~ 100,000 IOPS
  NVMe (PCIe 4.0) :  500,000 ~ 2,000,000 IOPS

Latency 기준 (await)
  HDD             :  5 ~ 20 ms
  SATA SSD        :  0.1 ~ 0.5 ms
  NVMe (로컬)     :  0.02 ~ 0.1 ms
  네트워크 스토리지:  1 ~ 10+ ms
```

### /proc/diskstats 필드

```bash
cat /proc/diskstats | grep sda
#  8  0 sda 12345 234 98765 12000 6789 123 54321 34000 0 45000 89000 ...
```

| 필드 # | 이름 | 설명 |
|--------|------|------|
| 1 | reads_completed | 읽기 완료 횟수 |
| 2 | reads_merged | 병합된 읽기 횟수 |
| 3 | sectors_read | 읽은 섹터 수 (512B 단위) |
| 4 | ms_reading | 읽기 소요 총 ms |
| 5~8 | writes_* | 쓰기 동일 구조 |
| 9 | ios_in_progress | **현재 처리 중인 I/O 수** (실시간) |
| 11 | weighted_ms | 요청 수 × 경과 시간 → **포화도 지표** |

---

## 2. 분석 도구

### iostat -x (주 분석 도구)

```bash
# 1초 간격 확장 통계
iostat -x 1

# 특정 디바이스 + MB 단위
iostat -xm sda nvme0n1 1

# 타임스탬프 포함
iostat -xt 1
```

**출력 필드 해석:**

```
Device   r/s   w/s  rkB/s  wkB/s  r_await  w_await  aqu-sz  %util
sda      0.5  85.2   12.0  1820.0   1.20    28.50    2.43   82.10
nvme0n1 400.0 490.1 4096.0 8192.0   0.08     0.12    0.07    8.30
```

| 필드 | 설명 | 주의사항 |
|------|------|----------|
| `r_await` / `w_await` | 평균 요청 서비스 시간 (ms) | 큐 대기 포함 |
| `aqu-sz` | 평균 큐 깊이 | > 1이면 대기 발생 |
| `%util` | I/O 발행 시간 비율 | **NVMe에서 오해 주의** |
| ~~`svctm`~~ | 서비스 시간 | **sysstat 12.1.2에서 제거됨** |

> `%util`이 낮아도 `aqu-sz`가 크면 NVMe/SSD는 포화 상태일 수 있다.
> HDD는 `%util 80%+` = 포화, SSD/NVMe는 `aqu-sz`로 판단하라.

### iotop (프로세스별 I/O)

```bash
# I/O 발생 프로세스만 표시
sudo iotop -o

# 프로세스 단위 집계 (스레드 제외)
sudo iotop -oP

# 배치 모드 (스크립트용)
sudo iotop -b -n 5 -d 1

# 예시 출력
# TID  PRIO  USER   DISK READ  DISK WRITE  IO>    COMMAND
# 4521 be/4 mysql   0.00 B/s   28.5 M/s  78.23% mysqld
# 2891 be/4 root   12.5 M/s    0.00 B/s   5.20% rsync
```

`IO>` 컬럼이 높은 프로세스가 I/O 병목 주범이다.

### blktrace / blkparse (블록 레이어 추적)

iostat로 병목은 보이지만 원인을 모를 때 사용한다.

```bash
# 60초간 트레이스 수집
sudo blktrace -d /dev/sda -o trace -w 60

# 실시간 분석
sudo blktrace -d /dev/sda -o - | blkparse -i -

# btt로 요약 통계
btt -i trace.blktrace.*
```

**이벤트 코드:**

| 코드 | 의미 |
|------|------|
| `Q` | 큐에 요청 추가 |
| `D` | 드라이버에 디스패치 |
| `C` | 요청 완료 |

```
# Q→D : 큐 대기 시간
# D→C : 실제 디바이스 서비스 시간
```

### fio (벤치마크)

```bash
# 랜덤 읽기 IOPS (DB 워크로드)
fio --name=rand-read \
    --ioengine=libaio \
    --iodepth=32 \
    --rw=randread \
    --bs=4k \
    --size=1G \
    --numjobs=4 \
    --runtime=60 \
    --filename=/dev/nvme0n1 \
    --direct=1

# 순차 쓰기 처리량 (백업/로그)
fio --name=seq-write \
    --ioengine=libaio \
    --iodepth=1 \
    --rw=write \
    --bs=1M \
    --size=4G \
    --filename=/dev/sda \
    --direct=1
```

**fio 출력 핵심 지표:**

```
read: IOPS=45.2k, BW=176MiB/s
  lat (usec): min=89, max=3420, avg=140.2, stdev=45.1
  clat percentiles (usec):
    | 99.00th=[  286]
    | 99.90th=[  644]    ← p99.9 지연이 실무 SLA 기준
    | 99.99th=[ 2507]
```

> p99, p99.9 지연을 반드시 확인하라. 평균만 보면 스파이크를 놓친다.

---

## 3. I/O 스케줄러

### 현재 커널의 스케줄러 (Linux 5.0+)

| 스케줄러 | 특징 | 권장 대상 |
|---------|------|----------|
| `none` | 순서 그대로 처리 | NVMe (자체 최적화) |
| `mq-deadline` | 기아 방지, 읽기 우선 | SATA SSD, HDD |
| `kyber` | 레이턴시 목표 기반 | 저레이턴시 SSD |
| `bfq` | 프로세스별 공정 배분 | 데스크톱, 혼합 워크로드 |

> Linux 5.3에서 cfq / deadline / noop (레거시) 완전 제거됨.

```bash
# 현재 스케줄러 확인
cat /sys/block/sda/queue/scheduler
# [mq-deadline] kyber bfq none

# 런타임 변경
echo mq-deadline > /sys/block/sda/queue/scheduler

# udev 규칙으로 영구 설정
cat /etc/udev/rules.d/60-io-scheduler.rules
# ACTION=="add|change", KERNEL=="sd[a-z]",
#   ATTR{queue/scheduler}="mq-deadline"
# ACTION=="add|change", KERNEL=="nvme[0-9]*",
#   ATTR{queue/scheduler}="none"
```

---

## 4. I/O 문제 진단 절차

### iowait 높을 때

```
%iowait 기준
  > 5%  : 주의
  > 20% : 위험
```

```bash
# 1단계: 어떤 디바이스가 원인인지
iostat -x 1

# 2단계: 어떤 프로세스가 I/O 유발하는지
sudo iotop -oP

# 3단계: D 상태 프로세스 확인
ps aux | awk '$8 ~ /D/ {print}'

# 4단계: PSI로 실질 압박 정도
cat /proc/pressure/io
# some avg10=12.34 avg60=8.90 avg300=3.45
# full avg10=3.21  avg60=1.50 avg300=0.80
```

### await 해석

```
await = 큐 대기 시간 + 실제 서비스 시간
aqu-sz > 1  → 큐에서 대기 발생 중
```

| 상황 | 진단 |
|------|------|
| await 높음 + aqu-sz 높음 | I/O 포화, 큐 대기 |
| await 높음 + aqu-sz 낮음 | 디바이스 자체 느림 |
| %iowait 높음 + aqu-sz 낮음 | 워크로드가 I/O bound (정상적) |

### PSI I/O 압력

```bash
cat /proc/pressure/io
# some avg10=X  avg60=Y  avg300=Z
# full avg10=X  avg60=Y  avg300=Z
```

| 지표 | 위험 기준 |
|------|----------|
| `some avg60` | > 30% 주의 |
| `full avg10` | > 20% 위험 (즉각 조치) |

---

## 5. 컨테이너 I/O 관리

### cgroup v2 io.max

```bash
# I/O 한도 설정 (rbps/wbps: 바이트/s, riops/wiops: IOPS)
echo "8:0 rbps=104857600 wbps=52428800" \
  > /sys/fs/cgroup/<group>/io.max
# 8:0 = major:minor (ls -la /dev/sda 로 확인)

# 현재 통계
cat /sys/fs/cgroup/<group>/io.stat
```

### Kubernetes StorageClass

```yaml
# 고성능 StorageClass (AWS EBS 예시)
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: high-iops
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "16000"
  throughput: "1000"
reclaimPolicy: Retain
allowVolumeExpansion: true
```

```yaml
# PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-data
spec:
  storageClassName: high-iops
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
```

---

## 6. 실무 튜닝

### readahead 설정

```bash
# 현재 readahead 크기 확인 (512B 섹터 단위)
blockdev --getra /dev/sda

# 순차 읽기 워크로드 (백업, 로그): 크게 설정
blockdev --setra 4096 /dev/sda   # 2MB

# 랜덤 I/O 워크로드 (DB): 작게 설정
blockdev --setra 256 /dev/sda    # 128KB

# 영구 설정 (udev 규칙)
echo 'ACTION=="add|change", KERNEL=="sda",
  RUN+="/sbin/blockdev --setra 4096 /dev/sda"' \
  > /etc/udev/rules.d/60-readahead.rules
```

### 파일시스템 마운트 옵션

```bash
# /etc/fstab - noatime으로 읽기 시 불필요한 쓰기 제거
/dev/sda1  /data  ext4  defaults,noatime  0 2
```

| 옵션 | 효과 |
|------|------|
| `noatime` | 파일 읽기 시 atime 업데이트 안 함 → 쓰기 I/O 감소 |
| `data=writeback` | ext4 메타데이터만 저널링 → 성능 향상 (데이터 안전성 ↓) |
| `discard` | SSD TRIM 자동화 (주기적 fstrim도 고려) |

### ext4 vs XFS 선택

| 항목 | ext4 | XFS |
|------|------|-----|
| 대용량 파일 | 보통 | **우수** |
| 메타데이터 집중 | 보통 | **우수** (병렬 처리) |
| 작은 파일 다수 | 보통 | 보통 |
| 축소 (shrink) | 가능 | **불가** |
| 성숙도 | 매우 높음 | 높음 |
| 권장 환경 | 범용, 부팅 디스크 | 데이터 볼륨, DB |

### dirty page 쓰기 타이밍

```bash
# 현재 설정 확인
sysctl vm.dirty_ratio vm.dirty_background_ratio

# 쓰기 워크로드 최적화 예시
sysctl -w vm.dirty_background_ratio=5   # 5%에서 백그라운드 flush 시작
sysctl -w vm.dirty_ratio=15             # 15%에서 강제 flush
```

---

## 7. 진단 체크리스트

```text
[ ] iostat -x 1: %iowait, aqu-sz, await 확인
[ ] iotop -oP: I/O 주범 프로세스 식별
[ ] /proc/pressure/io: PSI full 값 확인
[ ] NVMe라면 %util 무시, aqu-sz로 판단
[ ] D 상태 프로세스 유무 확인 (ps aux | awk '$8~/D/')
[ ] 스케줄러: HDD/SATA→mq-deadline, NVMe→none
[ ] 데이터 볼륨: noatime 마운트 적용
[ ] DB 서버: readahead 줄이기 (128KB~256KB)
[ ] SSD 환경: fstrim 또는 discard 마운트 옵션
```

---

## 참고 문서

- [Kernel Docs - iostats](https://docs.kernel.org/admin-guide/iostats.html)
- [Kernel Docs - Block I/O](https://www.kernel.org/doc/html/latest/block/)
- [Kernel Docs - cgroup v2 I/O](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [Kernel Docs - PSI](https://docs.kernel.org/accounting/psi.html)
- [fio Documentation](https://fio.readthedocs.io/en/latest/fio_doc.html)
- [Brendan Gregg - Linux Performance](https://www.brendangregg.com/linuxperf.html)
- [Kubernetes - VolumeAttributesClass](https://kubernetes.io/docs/concepts/storage/volume-attributes-classes/)
