---
title: "SELinux 기본과 운영"
sidebar_label: "SELinux"
sidebar_position: 2
date: 2026-04-17
last_verified: 2026-04-17
tags:
  - linux
  - security
  - selinux
  - mac
  - rhel
---

# SELinux 기본과 운영

SELinux(Security-Enhanced Linux)는 NSA가 개발한
MAC(Mandatory Access Control) 구현체다.
전통적인 DAC(사용자/그룹 기반 권한)를 우회하는 공격을
커널 수준에서 차단한다. RHEL/CentOS/Fedora의 기본 보안 모듈이다.

---

## DAC vs MAC

| 항목 | DAC (전통적 권한 모델) | MAC (SELinux) |
|------|----------------------|--------------|
| 권한 결정 주체 | 파일 소유자 | 커널 정책 |
| root 권한 | 모든 것 가능 | 정책을 벗어나면 거부 |
| 프로세스 탈취 시 | 전체 권한 획득 | 해당 도메인만 접근 가능 |

---

## 모드 (Mode)

| 모드 | 동작 |
|------|------|
| **Enforcing** | 정책 위반 차단 + 감사 로그 기록 |
| **Permissive** | 차단 없이 로그만 기록 (트러블슈팅용) |
| **Disabled** | SELinux 비활성화 |

```bash
# 현재 모드 확인
getenforce
sestatus

# 런타임 모드 변경 (재부팅 불필요, 영구 아님)
setenforce 0   # Permissive
setenforce 1   # Enforcing

# 영구 설정
# /etc/selinux/config
SELINUX=enforcing    # enforcing | permissive | disabled
SELINUXTYPE=targeted
```

> **절대 Disabled로 설정하지 말 것.**
> Disabled → Enforcing 직접 전환 시 레이블이 없는 파일로 인해
> **부팅 실패**가 발생할 수 있다.
>
> 안전한 전환 절차 (Red Hat 공식 문서 기준):
> 1. `/etc/selinux/config`에서 `SELINUX=permissive` 설정
> 2. `touch /.autorelabel` — 다음 부팅 시 전체 재레이블 트리거
>    (대안: `fixfiles -F onboot` — `.autorelabel`을 `-F`
>    옵션과 함께 생성해 정책 변경 없이도 강제 재레이블)
> 3. 재부팅 — Permissive 상태로 부팅 후 재레이블 자동 수행
>    (대용량 FS는 수분~수십분 소요, `enforcing=0` 커널 옵션으로
>    부트 안전성 추가 확보 가능)
> 4. AVC 거부 로그 확인 (`ausearch -m AVC --start today`)
> 5. 문제 없으면 `SELINUX=enforcing` 변경 → 재부팅

---

## 핵심 개념: 레이블(Label)

SELinux는 모든 파일, 프로세스, 포트에 **레이블(컨텍스트)**을 부여한다.

```mermaid
graph TD
    LABEL["user role type level"]
    LABEL --> U["SELinux 사용자"]
    LABEL --> R["역할"]
    LABEL --> T["타입"]
    LABEL --> L["MLS MCS 레벨"]

    L --> L1["targeted s0"]
    L --> L2["s0 c123 c456"]
```

| 노드 | 의미 |
|------|------|
| LABEL | `user:role:type:level` 형식 |
| 타입 | 정책의 핵심 (TE) |
| targeted s0 | 단일 레벨 |
| s0 c123 c456 | 고유 카테고리 (MCS) |

> **컨테이너/Kubernetes에서 MCS**: 고유 MCS 카테고리 부여는
> kubelet이나 PSA(Pod Security Admission)가 아닌
> **컨테이너 런타임(container-selinux 정책을 사용하는
> CRI-O, Podman, containerd 등)** 이 수행한다.
> 런타임이 파드마다 `s0:c123,c456` 같은 고유 레이블을 할당해
> 파드 간 볼륨·프로세스 접근을 커널 수준에서 차단한다.
> Kubernetes는 파드 `securityContext.seLinuxOptions`를
> 런타임에 전달할 뿐이며, 미지정 시 런타임이 기본값을 할당한다.

```bash
# 파일 레이블 확인
ls -Z /etc/passwd
# system_u:object_r:passwd_file_t:s0

# 프로세스 레이블 확인
ps auxZ | grep nginx
# system_u:system_r:httpd_t:s0  nginx

# 포트 레이블 확인
semanage port -l | grep http
# http_port_t    tcp    80, 443, 8008, 8009, 8443
```

---

## 정책 타입

| 타입 | 설명 | 사용 환경 |
|------|------|---------|
| **targeted** | 주요 서비스만 제한, 나머지는 unconfined | 대부분의 RHEL/Fedora |
| **mls** | Multi-Level Security, 군사급 | 극도로 민감한 환경 |
| **minimum** | targeted의 최소 버전 | 임베디드 |

```bash
# 현재 정책 확인
sestatus | grep "Loaded policy"
```

---

## AVC 거부 (AVC Denial) 이해

SELinux가 접근을 거부하면 AVC(Access Vector Cache) 거부 메시지를
audit 로그에 기록한다.

```bash
# AVC 거부 확인
ausearch -m AVC,USER_AVC --start today
ausearch -m AVC -ts recent | tail -20

# 또는
journalctl -t setroubleshoot -n 20
```

### AVC 메시지 해석

```
type=AVC msg=audit(1713340800.123:456): avc:  denied  { write }
for  pid=1234 comm="nginx" name="myapp.pid"
dev="sda1" ino=78901
scontext=system_u:system_r:httpd_t:s0
tcontext=system_u:object_r:var_run_t:s0
tclass=file permissive=0
```

| 필드 | 의미 |
|------|------|
| `denied { write }` | write 권한이 거부됨 |
| `comm="nginx"` | nginx 프로세스 |
| `scontext=httpd_t` | 소스: httpd 도메인 |
| `tcontext=var_run_t` | 대상: var_run 타입 파일 |
| `tclass=file` | 객체 클래스: 파일 |

```bash
# sealert: 사람이 읽기 쉬운 설명 + 해결책 제시
sealert -a /var/log/audit/audit.log

# 특정 AVC의 해결책 확인
audit2why < /var/log/audit/audit.log
```

---

## 트러블슈팅 흐름

```mermaid
graph TD
    A["AVC 거부 발생"]
    A --> B["ausearch + sealert로 원인 분석"]

    B --> C["레이블 오류?"]
    B --> D["Boolean 필요?"]
    B --> E["포트 레이블 오류?"]
    B --> F["새 정책 필요?"]

    C --> C1["restorecon"]
    D --> D1["setsebool"]
    E --> E1["semanage port"]
    F --> F1["audit2allow"]
```

### 1. 레이블 복원 (restorecon)

파일 컨텍스트가 잘못 설정된 경우.

```bash
# 단일 파일 복원
restorecon -v /var/www/html/index.html

# 디렉토리 재귀 복원
restorecon -Rv /var/www/html/

# 현재 레이블 확인 후 예상 레이블과 비교
matchpathcon /var/www/html/index.html
ls -Z /var/www/html/index.html
```

### 2. SELinux Boolean

사전 정의된 정책 스위치.

```bash
# 모든 boolean 목록
semanage boolean -l
getsebool -a

# 자주 쓰는 boolean
setsebool -P httpd_can_network_connect 1   # nginx → 외부 연결
setsebool -P httpd_use_nfs 1               # NFS 마운트 사용
setsebool -P httpd_read_user_content 1     # 사용자 홈 읽기

# -P: 영구 적용 (재부팅 후에도 유지)
```

### 3. 포트 레이블 (semanage port)

기본 포트 외 포트를 사용하는 경우.

```bash
# nginx를 8080 포트로 실행하려면
semanage port -a -t http_port_t -p tcp 8080

# 현재 포트 레이블 확인
semanage port -l | grep http

# 포트 레이블 삭제
semanage port -d -t http_port_t -p tcp 8080
```

### 4. 파일 컨텍스트 영구 변경 (semanage fcontext)

```bash
# 새 경로를 영구 레이블로 등록
semanage fcontext -a -t httpd_sys_content_t "/data/webroot(/.*)?"

# 적용
restorecon -Rv /data/webroot/

# 등록된 컨텍스트 확인
semanage fcontext -l | grep webroot
```

### 5. 커스텀 정책 (audit2allow)

```bash
# audit2allow: AVC 로그로부터 허용 규칙 생성
# 주의: 검토 없이 무분별하게 적용하면 보안 구멍
ausearch -m AVC --start today | audit2allow -M mymodule

# 생성된 정책 검토 (반드시 먼저 확인!)
cat mymodule.te

# 적용
semodule -i mymodule.pp

# 확인
semodule -l | grep mymodule
```

> **audit2allow 주의사항**: 레이블·Boolean·포트 문제가
> 아닌지 먼저 확인 후 최후 수단으로 사용할 것.
> AVC가 발생하자마자 `audit2allow`로 달려가면
> 정책이 복잡해지고 보안 구멍이 생긴다.
> 생성된 `.te` 파일을 반드시 검토하고,
> `allow httpd_t unconfined_t:*:*;` 같은 과도한 규칙은
> SELinux 보호를 무력화한다.

---

## 실무 운영 패턴

### 새 서비스 배포 시

```bash
# 1단계: 특정 도메인만 Permissive로 전환 (시스템 전체 아님)
# setenforce 0 은 전체 보호 해제 → 프로덕션에서 절대 사용 금지
semanage permissive -a httpd_t   # 해당 도메인만 Permissive

# 적용 확인
semanage permissive -l

# 2단계: 서비스 운영하며 AVC 로그 수집 (충분한 시간)
ausearch -m AVC --start today > avc.log

# 3단계: 필요한 정책 파악
audit2why < avc.log

# 4단계: Boolean/fcontext로 해결 가능하면 그것을 우선
# 레이블 문제 → restorecon / semanage fcontext
# Boolean 문제 → setsebool -P
# 포트 문제 → semanage port
# 그래도 안 되면 audit2allow (최소 정책, 반드시 검토)

# 5단계: 도메인 Permissive 해제 (Enforcing 복원)
semanage permissive -d httpd_t
```

### 파일 레이블 확인 자동화

```bash
#!/bin/bash
# 주요 경로의 SELinux 레이블 이상 감지
PATHS=("/var/www" "/etc/nginx" "/etc/mysql")

for path in "${PATHS[@]}"; do
    echo "=== $path ==="
    ls -Zd "$path"
done
```

---

## 컨테이너 SELinux 도메인

`container-selinux` 정책(Red Hat에서 개발, 대부분의
컨테이너 런타임이 사용)은 컨테이너용 전용 도메인을 정의한다.

| 도메인 | 용도 | 위험도 |
|--------|------|--------|
| `container_t` | 기본 격리 컨테이너 도메인 | 낮음 |
| `container_init_t` | 컨테이너 내 init 프로세스 | 낮음 |
| `spc_t` | super privileged container (`--privileged`) | **매우 높음** |

- `container_t`: 호스트 파일시스템·프로세스와 격리된
  기본 도메인. 대부분의 워크로드가 여기에 해당한다.
- `spc_t`: `--privileged` 플래그 사용 시 적용되며
  사실상 SELinux 보호가 해제된다.

### 런타임 레이블 옵션

```bash
# Docker / Podman: 레이블 지정
podman run --security-opt label=level:s0:c123,c456 alpine

# 레이블 비활성화 (격리 해제 — 권장하지 않음)
podman run --security-opt label=disable alpine

# 호스트 볼륨 공유 시 relabel 지시
# z : 컨테이너 간 공유 (공통 레이블)
# Z : 해당 컨테이너 전용 (고유 MCS 레이블)
podman run -v /data:/data:Z alpine
```

`:Z` 옵션은 호스트 디렉토리를 해당 컨테이너의 MCS
레이블로 재지정한다. 대용량 디렉토리에는 relabel 비용이
크므로 주의한다 (뒤의 Kubernetes 성능 섹션 참조).

### 커스텀 정책 자동 생성 — udica

`audit2allow`는 범용 도구지만 컨테이너 워크로드에 맞는
최소 정책을 만들기에는 과도한 권한을 포함시키기 쉽다.
Red Hat이 개발한 **udica**는 컨테이너 spec(JSON)을
입력받아 실제 마운트·포트·capability에 맞춘 맞춤 정책을
생성한다.

```bash
# 실행 중인 컨테이너 spec → 정책 생성
podman inspect <cid> > container.json
udica -j container.json mycontainer_policy

# 생성된 정책 로드 후 --security-opt label=type:mycontainer_policy.process
```

### Kubernetes 볼륨 relabel 성능

기본적으로 컨테이너 런타임은 마운트된 볼륨 전체를
재귀적으로 relabel한다. RWO(ReadWriteOnce) 볼륨에
파일이 수백만 개면 파드 기동이 수분씩 지연된다.

Kubernetes는 이를 해결하는 `SELinuxMountReadWriteOncePod`
feature gate를 제공한다 (1.27부터 베타, 1.28부터 GA 추진).

- 활성화 시 kubelet이 마운트 시점에 `-o context=<label>`
  옵션을 CSI/볼륨 플러그인에 전달한다
- 커널이 마운트 단위로 레이블을 적용 → 재귀 relabel 불필요
- 수 기가바이트 볼륨도 즉시 마운트 가능

제약: RWO 접근 모드 + SELinux 인식 CSI 드라이버가 필요하다.

---

## 배포판 지원 현황

| 배포판 | SELinux 기본 상태 |
|--------|-----------------|
| RHEL 7/8/9 | Enforcing (targeted) |
| CentOS Stream | Enforcing (targeted) |
| Fedora | Enforcing (targeted) |
| Rocky Linux / AlmaLinux | Enforcing (targeted) |
| Ubuntu / Debian | **AppArmor** (SELinux는 선택) |

> Ubuntu/Debian 환경은 다음 문서
> [AppArmor 기본과 운영](apparmor.md)을 참조.

---

## 참고 자료

- [Using SELinux - Red Hat Documentation](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_selinux/)
  — 확인: 2026-04-17
- [SELinux Project Wiki](https://selinuxproject.org/)
  — 확인: 2026-04-17
- [SELinux Coloring Book (NSA/Red Hat)](https://people.redhat.com/duffy/selinux/selinux-coloring-book_A4-Stapled.pdf)
  — 확인: 2026-04-17
