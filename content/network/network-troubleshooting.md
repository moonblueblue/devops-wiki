---
title: "네트워크 트러블슈팅 도구와 기법"
date: 2026-04-13
tags:
  - network
  - troubleshooting
  - tcpdump
  - kubernetes
  - debugging
sidebar_label: "네트워크 트러블슈팅"
---

# 네트워크 트러블슈팅 도구와 기법

## 1. 레이어별 접근법

```
증상: 연결 안 됨
    ↓
L1 물리: NIC 링크 상태?
  → ip link show | grep "state UP"
    ↓
L2 데이터링크: ARP 테이블? MAC 충돌?
  → ip neigh / arp -n
    ↓
L3 네트워크: IP 도달? 라우팅?
  → ping, traceroute, ip route
    ↓
L4 트랜스포트: 포트 열림? 방화벽?
  → ss -tnlp, nc, telnet
    ↓
L7 애플리케이션: HTTP 응답? TLS?
  → curl -v, openssl s_client
```

---

## 2. Connection refused vs Timeout

| 현상 | 의미 | 원인 |
|------|------|------|
| `Connection refused` | 포트가 닫혀있음 | 앱 미실행, 잘못된 포트 |
| `Connection timed out` | 패킷이 도달 안 함 | 방화벽, 라우팅 문제, 호스트 다운 |
| `No route to host` | 라우팅 테이블 없음 | 네트워크 설정 오류 |

```bash
# 포트 연결 테스트
nc -zv 10.0.0.1 8080
# Connection to 10.0.0.1 8080 port [tcp] succeeded!

# 타임아웃 지정 테스트
nc -zv -w 3 10.0.0.1 8080
```

---

## 3. 핵심 도구

### ping / mtr

```bash
# 기본 연결 테스트
ping -c 4 10.0.0.1

# 경로별 레이턴시/손실 (mtr = traceroute + ping)
mtr --report --report-cycles 50 8.8.8.8

# 출력:
# Host              Loss%  Snt  Last  Avg  Best  Wrst
# 1. 192.168.1.1    0.0%    50   0.5  0.6   0.4   1.2
# 2. 10.0.0.1       2.0%    50   2.1  2.3   1.9   5.4  ← 손실 발생
```

### dig

```bash
# A 레코드 조회
dig example.com A

# 특정 DNS 서버에 직접 질의 (캐시 우회)
dig @8.8.8.8 example.com

# DNS 전파 확인
for ns in 8.8.8.8 1.1.1.1 9.9.9.9; do
  echo "=== $ns ==="; dig +short @$ns example.com
done

# 역방향 조회
dig -x 93.184.216.34
```

### curl

```bash
# 상세 연결 정보
curl -v https://api.example.com/health

# TLS 정보 포함
curl -vI --http2 https://example.com 2>&1 | grep -E "SSL|HTTP"

# 응답 시간 측정
curl -o /dev/null -s -w \
  "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n" \
  https://example.com

# 특정 IP로 강제 연결 (DNS 우회)
curl --resolve example.com:443:93.184.216.34 https://example.com
```

### tcpdump

```bash
# 특정 호스트 트래픽 캡처
tcpdump -i eth0 -nn host 10.0.0.1

# 포트 필터링
tcpdump -i eth0 -nn port 443

# SYN 패킷만 (연결 시도 추적)
tcpdump -i eth0 'tcp[tcpflags] & tcp-syn != 0'

# RST 패킷 (강제 종료)
tcpdump -i eth0 'tcp[tcpflags] & tcp-rst != 0'

# 파일로 저장 후 Wireshark 분석
tcpdump -i eth0 -w /tmp/capture.pcap -c 10000
```

**Wireshark 유용한 필터:**

```
tcp.flags.reset == 1           → RST 패킷
tcp.analysis.retransmission    → 재전송 패킷
http.response.code >= 500      → HTTP 5xx 오류
dns.flags.rcode != 0           → DNS 오류 응답
ssl.alert_message.desc         → TLS 경고
```

### openssl

```bash
# TLS 인증서 확인
openssl s_client -connect example.com:443 -brief

# 인증서 만료일
echo | openssl s_client -connect example.com:443 2>/dev/null \
  | openssl x509 -noout -dates

# 인증서 체인 확인
openssl s_client -connect example.com:443 -showcerts 2>/dev/null \
  | grep -E "subject|issuer"
```

---

## 4. Kubernetes 네트워크 트러블슈팅

### netshoot (올인원 디버깅 컨테이너)

```bash
# 임시 디버깅 Pod 실행
kubectl run netshoot --rm -it \
  --image nicolaka/netshoot \
  --restart=Never -- /bin/bash

# 특정 Pod의 네트워크 네임스페이스 공유
kubectl debug -it <pod-name> \
  --image=nicolaka/netshoot \
  --target=<container-name>
```

### DNS 트러블슈팅

```bash
# dnsutils Pod로 DNS 테스트
kubectl run dnsutils --rm -it \
  --image=registry.k8s.io/e2e-test-images/jessie-dnsutils:1.3 \
  --restart=Never -- /bin/bash

# 내부 서비스 조회
dig my-service.default.svc.cluster.local

# CoreDNS 로그 확인
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# Pod DNS 설정 확인
kubectl exec <pod> -- cat /etc/resolv.conf
```

### 서비스 연결 확인

```bash
# Service → Pod 엔드포인트 확인
kubectl get endpoints my-service

# Pod에서 Service 연결 테스트
kubectl exec <pod> -- curl -v http://my-service/health

# iptables 규칙 확인 (kube-proxy)
sudo iptables -t nat -L KUBE-SERVICES -n | grep my-service

# NetworkPolicy 확인
kubectl get networkpolicy -A
```

---

## 5. 일반 문제 패턴

| 증상 | 확인 사항 | 명령어 |
|------|---------|--------|
| DNS 해석 실패 | CoreDNS 상태 | `kubectl get pods -n kube-system` |
| TLS 인증서 오류 | 만료일, CN 일치 | `openssl s_client -connect` |
| iptables 충돌 | 규칙 충돌 | `iptables -L -n -v` |
| Pod 간 통신 불가 | NetworkPolicy | `kubectl get networkpolicy` |
| 간헐적 DNS 실패 | ndots 설정 | `/etc/resolv.conf` 확인 |
| 외부 연결 불가 | NAT/SecurityGroup | `ping 8.8.8.8`, 클라우드 방화벽 |

---

## 6. 트러블슈팅 체크리스트

```text
L1~L2:
  [ ] ip link show: NIC 상태 UP 확인
  [ ] ip neigh: ARP 테이블 확인

L3:
  [ ] ping: IP 도달 여부
  [ ] traceroute/mtr: 경로 확인, 손실 위치
  [ ] ip route: 라우팅 테이블 확인

L4:
  [ ] ss -tnlp: 포트 열림 확인
  [ ] nc -zv: 포트 연결 테스트
  [ ] iptables -L: 방화벽 규칙 확인

L7:
  [ ] curl -v: HTTP 응답 확인
  [ ] openssl s_client: TLS 인증서 확인
  [ ] dig: DNS 해석 확인

K8s:
  [ ] kubectl get endpoints: 서비스 엔드포인트
  [ ] kubectl logs: 앱 로그
  [ ] kubectl describe pod: 이벤트 확인
  [ ] CoreDNS 로그: DNS 문제
```

---

## 참고 문서

- [Kubernetes 네트워크 디버깅](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [netshoot GitHub](https://github.com/nicolaka/netshoot)
- [Brendan Gregg - tcpdump](https://www.brendangregg.com/blog/2021-07-25/how-to-use-tcpdump.html)
- [Wireshark 필터 레퍼런스](https://www.wireshark.org/docs/dfref/)
