---
title: "DNS 설정과 resolv.conf"
date: 2026-04-13
tags:
  - linux
  - dns
  - network
  - kubernetes
  - devops
sidebar_label: "DNS 설정"
---

# DNS 설정과 resolv.conf

리눅스 시스템에서 DNS 해석이 동작하는 원리와
주요 설정 파일, 트러블슈팅 도구, 컨테이너 환경에서의
DNS 구성을 다룬다.

## 1. DNS 기본 동작

리눅스에서 도메인 이름 해석은
여러 설정 파일과 서비스가 협력하여 동작한다.

### 해석 흐름

```text
애플리케이션
  → glibc (getaddrinfo)
    → /etc/nsswitch.conf (해석 순서 결정)
      → /etc/hosts (로컬 정적 매핑)
      → /etc/resolv.conf (DNS 서버 질의)
        → systemd-resolved (캐시/포워딩)
          → 외부 DNS 서버
```

### 관련 파일 요약

| 파일 | 역할 |
|------|------|
| `/etc/resolv.conf` | DNS 서버 주소, 검색 도메인 |
| `/etc/hosts` | 정적 호스트명-IP 매핑 |
| `/etc/nsswitch.conf` | 이름 해석 순서 결정 |
| `/etc/systemd/resolved.conf` | systemd-resolved 설정 |

## 2. /etc/resolv.conf

DNS 리졸버 라이브러리(glibc)가 참조하는
핵심 설정 파일이다.

### 주요 지시어

```bash title="/etc/resolv.conf"
# DNS 서버 지정 (최대 3개, 나열 순서대로 질의)
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1

# 검색 도메인 (짧은 호스트명에 자동 추가)
search example.com dev.example.com

# 옵션
options timeout:2 attempts:3 rotate ndots:1
```

`nameserver`는 glibc의 `MAXNS=3` 상수로 최대 3개까지 지정 가능하며,
첫 번째 서버가 응답하지 않을 때 순서대로 다음 서버에 질의한다.
systemd-resolved나 dnsmasq 같은 로컬 캐싱 리졸버를 앞단에 두면
이 제한을 우회할 수 있다.

`search`는 도트가 `ndots` 값 미만인 호스트명에
지정된 도메인을 순차 붙여서 질의한다.
glibc 2.26+ 에서는 search 도메인 수 제한이 없다.
단, 검색 도메인이 많을수록 DNS 질의 횟수가 선형 증가하므로
3개 이하를 권장한다.

### options 상세

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `ndots:n` | 절대 질의 전 도트 임계값 | 1 |
| `timeout:n` | 서버 응답 대기 시간(초) | 5 |
| `attempts:n` | 실패 전 재시도 횟수 | 2 |
| `rotate` | 네임서버 라운드로빈 | 비활성 |
| `single-request` | A/AAAA 질의 순차 실행 | 비활성 |
| `edns0` | EDNS0 확장 활성화 | 비활성 |
| `trust-ad` | DNSSEC AD 비트 신뢰 | 비활성 |

`rotate` 옵션은 여러 네임서버 간
부하를 분산할 때 유용하다.

`single-request`는 일부 방화벽 환경에서
A와 AAAA 동시 질의가 실패할 때 사용한다.

### 주의사항

systemd-resolved나 NetworkManager가 활성화된 시스템에서는
`/etc/resolv.conf`를 직접 편집하면
서비스 재시작 시 덮어쓰기된다.

```bash
# 현재 resolv.conf가 심볼릭 링크인지 확인
ls -la /etc/resolv.conf

# 일반적인 심볼릭 링크 대상
# ../run/systemd/resolve/stub-resolv.conf
```

## 3. systemd-resolved

대부분의 최신 리눅스 배포판에서 기본 활성화된
로컬 DNS 리졸버 서비스다.

### 동작 원리

```text
애플리케이션
  → 127.0.0.53:53 (스텁 리스너)
    → systemd-resolved (캐시 확인)
      → 업스트림 DNS 서버
```

systemd-resolved는 127.0.0.53에서
스텁 DNS 리스너로 동작하며,
로컬 캐시와 DNSSEC 검증을 제공한다.

### 주요 파일

| 파일 | 용도 |
|------|------|
| `/run/systemd/resolve/stub-resolv.conf` | 127.0.0.53 포인트 (권장) |
| `/run/systemd/resolve/resolv.conf` | 실제 업스트림 DNS 포함 |
| `/etc/systemd/resolved.conf` | 서비스 설정 파일 |

`/etc/resolv.conf`는 보통
`stub-resolv.conf`로의 심볼릭 링크다.

### 설정 예시

```ini title="/etc/systemd/resolved.conf"
# /etc/systemd/resolved.conf
[Resolve]
DNS=8.8.8.8 1.1.1.1
FallbackDNS=8.8.4.4
Domains=~.
DNSSEC=allow-downgrade
DNSOverTLS=opportunistic
Cache=yes
```

`Domains=~.`는 모든 DNS 질의를
이 설정의 DNS 서버로 라우팅한다.

### resolvectl 명령

```bash
# 현재 DNS 설정 확인
resolvectl status

# 특정 도메인 질의
resolvectl query example.com

# DNS 캐시 플러시
resolvectl flush-caches

# 캐시 통계 확인
resolvectl statistics

# 인터페이스별 DNS 서버 설정
resolvectl dns eth0 8.8.8.8

# DNSSEC 상태 확인
resolvectl dnssec
```

설정 변경 후에는 서비스를 재시작한다.

```bash
sudo systemctl restart systemd-resolved
```

## 4. /etc/hosts와 nsswitch.conf

### /etc/hosts

DNS 서버 질의 없이 호스트명을 해석하는
정적 매핑 파일이다.

```bash title="/etc/hosts"
# /etc/hosts
127.0.0.1   localhost
::1         localhost
192.168.1.10  db-master.internal db-master
192.168.1.11  db-replica.internal db-replica
```

DNS 장애 시에도 동작하므로
핵심 인프라 호스트를 등록해 두면 유용하다.

### /etc/nsswitch.conf

이름 해석 순서를 결정하는 설정 파일이다.

```bash title="/etc/nsswitch.conf"
# 기본 설정 (대부분의 배포판)
hosts: files dns myhostname

# systemd-resolved 사용 시
hosts: mymachines resolve [!UNAVAIL=return] files myhostname dns
```

| 모듈 | 역할 |
|------|------|
| `files` | `/etc/hosts` 참조 |
| `dns` | `/etc/resolv.conf` DNS 질의 |
| `resolve` | systemd-resolved 사용 |
| `myhostname` | 로컬 호스트명 해석 |
| `mymachines` | systemd-machined 컨테이너 |

`[!UNAVAIL=return]`은 resolve 모듈이 서비스 불능(UNAVAIL) 상태가
아닌 결과(성공 또는 미발견)를 반환하면 즉시 결과를 확정하고
이후 모듈(files, dns)을 건너뛴다는 의미다.

### 해석 순서 확인

```bash
# getent으로 실제 해석 결과 확인
getent hosts example.com

# strace로 해석 과정 추적
strace -e trace=openat getent hosts example.com 2>&1 \
  | grep -E "(hosts|resolv)"
```

## 5. DNS 트러블슈팅 도구

### dig

가장 강력한 DNS 진단 도구다.
`dnsutils` 또는 `bind-utils` 패키지에 포함된다.

```bash
# 기본 질의
dig example.com

# 특정 DNS 서버로 질의
dig @8.8.8.8 example.com

# 레코드 타입 지정
dig example.com MX
dig example.com NS
dig example.com AAAA
dig example.com TXT

# 간결 출력 (IP만)
dig +short example.com

# 전체 해석 경로 추적
dig +trace example.com

# 역방향 조회
dig -x 1.2.3.4

# DNSSEC 검증
dig +dnssec example.com

# 응답 시간만 확인
dig example.com | grep "Query time"
```

### nslookup

간단한 DNS 조회에 적합하다.

```bash
# 기본 질의
nslookup example.com

# 특정 서버 지정
nslookup example.com 8.8.8.8

# 레코드 타입 지정
nslookup -type=MX example.com
nslookup -type=NS example.com
```

### host

가장 간결한 출력을 제공한다.

```bash
# 기본 질의
host example.com

# 역방향 조회
host 1.2.3.4

# 상세 출력
host -v example.com

# 특정 서버 지정
host example.com 8.8.8.8
```

### 도구 비교

| 기능 | dig | nslookup | host |
|------|-----|----------|------|
| 출력 상세도 | 높음 | 중간 | 낮음 |
| +trace 지원 | O | X | X |
| DNSSEC 검증 | O | X | X |
| 역방향 조회 | O | O | O |
| 패키지 | bind-utils | bind-utils | bind-utils |

실무에서는 `dig`를 기본으로 사용하고,
빠른 확인에는 `host`를 활용한다.

### 일반적인 DNS 문제 진단

```bash
# DNS 해석 지연 확인
time dig example.com

# 캐시와 실제 응답 비교
dig example.com           # 로컬 리졸버
dig @8.8.8.8 example.com  # 외부 DNS 직접

# TCP 폴백 테스트
dig +tcp example.com

# DNS 서버 응답 여부 확인
dig @10.0.0.2 example.com +timeout=2 +tries=1
```

## 6. 컨테이너/쿠버네티스 DNS

### Docker DNS

기본 브리지 네트워크에서는 호스트의 `/etc/resolv.conf`를 복사하고,
사용자 정의 브리지 네트워크에서는 Docker 내장 DNS(127.0.0.11)를
통해 컨테이너 이름 기반 서비스 디스커버리를 처리한다.

```bash
# 커스텀 DNS 서버 지정
docker run --dns=8.8.8.8 \
  --dns-search=example.com nginx

# Docker 데몬 기본 DNS 설정
```

```json title="/etc/docker/daemon.json"
{
  "dns": ["8.8.8.8", "8.8.4.4"],
  "dns-search": ["example.com"]
}
```


### Kubernetes CoreDNS

쿠버네티스 클러스터의 기본 DNS 서비스다.
`kube-system` 네임스페이스에 배포된다.

```yaml
# CoreDNS ConfigMap (기본 Corefile)
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health { lameduck 5s }
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
            ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf
        cache 30
        loop
        reload
        loadbalance
    }
```

### Pod의 resolv.conf

Pod는 기본적으로 다음과 같은
`/etc/resolv.conf`를 갖는다.

```text title="/etc/resolv.conf"
nameserver 10.96.0.10
search default.svc.cluster.local svc.cluster.local cluster.local
options ndots:5
```

### ndots:5 성능 문제

`ndots:5`는 도트가 5개 미만인 도메인에 대해
검색 도메인을 먼저 시도한다.

```text
# api.internal.example.com (도트 3개, ndots:5 미만) 질의 시 실제 DNS 질의 순서:
1. api.internal.example.com.default.svc.cluster.local  ← 실패
2. api.internal.example.com.svc.cluster.local          ← 실패
3. api.internal.example.com.cluster.local              ← 실패
4. api.internal.example.com                            ← 최종 성공
# 도트가 ndots:5 미만이면 search 도메인을 모두 소진한 뒤 FQDN 시도
# → 외부 도메인 질의마다 3~4회 불필요한 DNS 라운드트립 발생
```

외부 도메인 질의마다 불필요한 DNS 질의가
3~4회 추가 발생하여 지연이 생긴다.

**해결 방법:**

```yaml
# 방법 1: Pod dnsConfig로 ndots 조정
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
  containers:
    - name: app
      image: my-app:latest
```

```yaml
# 방법 2: FQDN 사용 (끝에 점 추가)
# 코드에서 api.example.com. 으로 호출
```

### Pod DNS 정책

| dnsPolicy | 동작 |
|-----------|------|
| `ClusterFirst` | 클러스터 DNS 우선 (기본값) |
| `Default` | 노드의 DNS 설정 상속 |
| `ClusterFirstWithHostNet` | hostNetwork 시 사용 |
| `None` | dnsConfig으로 수동 설정 |

### 스텁 도메인 설정

내부 도메인을 별도 DNS 서버로
포워딩하는 예시다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns
  namespace: kube-system
data:
  Corefile: |
    .:53 {
        errors
        health { lameduck 5s }
        kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
            ttl 30
        }
        forward . 172.16.0.1
        cache 30
        loop
        reload
        loadbalance
    }
    consul.local:53 {
        errors
        cache 30
        forward . 10.150.0.1
    }
```

CoreDNS ConfigMap 변경 후
적용까지 최대 2분이 소요될 수 있다.

## 7. 클라우드 DNS

### AWS Route 53 Resolver

VPC 내 인스턴스는 기본적으로
VPC CIDR의 +2 주소를 DNS 서버로 사용한다.

```text
# 예: VPC CIDR 10.0.0.0/16
# DNS 서버: 10.0.0.2
```

| 구성 요소 | 역할 |
|-----------|------|
| 인바운드 엔드포인트 | 온프레미스 → VPC DNS 질의 |
| 아웃바운드 엔드포인트 | VPC → 온프레미스 DNS 포워딩 |
| 포워딩 규칙 | 조건부 DNS 라우팅 |

하이브리드 DNS 구성 시 VPN 또는
Direct Connect 연결이 필요하다.

```bash
# AWS CLI로 아웃바운드 엔드포인트 생성
aws route53resolver create-resolver-endpoint \
  --creator-request-id my-outbound \
  --name "to-onprem" \
  --direction OUTBOUND \
  --security-group-ids sg-xxx \
  --ip-addresses SubnetId=subnet-xxx,Ip=10.0.1.100 \
  --ip-addresses SubnetId=subnet-yyy,Ip=10.0.2.100
```

### GCP Cloud DNS

VPC 네트워크별 DNS 정책을 설정할 수 있다.

| 기능 | 설명 |
|------|------|
| 프라이빗 존 | VPC 내부 전용 DNS |
| DNS 피어링 | VPC 간 DNS 해석 |
| 인바운드 포워딩 | 온프레미스 → GCP DNS |
| 아웃바운드 포워딩 | GCP → 온프레미스 DNS |

```bash
# gcloud로 프라이빗 존 생성
gcloud dns managed-zones create internal-zone \
  --dns-name="internal.example.com." \
  --visibility=private \
  --networks=my-vpc \
  --description="Internal DNS zone"
```

### 크로스 클라우드 DNS

AWS와 GCP 간 하이브리드 DNS 구성 시
양쪽 모두 DNS 포워딩 설정이 필요하다.

```text
AWS VPC                        GCP VPC
  Route 53                       Cloud DNS
  아웃바운드 엔드포인트  ←VPN→  서버 정책
  포워딩 규칙                    인바운드 포워딩
```

---

**참고 문서:**

- [resolv.conf(5) - Linux manual page](https://man7.org/linux/man-pages/man5/resolv.conf.5.html)
- [systemd-resolved - ArchWiki](https://wiki.archlinux.org/title/Systemd-resolved)
- [Customizing DNS Service - Kubernetes](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)
- [Debugging DNS Resolution - Kubernetes](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/)
- [AWS Route 53 Resolver](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resolver.html)
- [GCP Cloud DNS](https://cloud.google.com/dns/docs/overview)
- [RHEL 9 DNS Configuration](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/configuring-the-order-of-dns-servers_configuring-and-managing-networking)
