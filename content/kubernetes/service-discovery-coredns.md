---
title: "서비스 디스커버리와 CoreDNS"
date: 2026-04-14
tags:
  - kubernetes
  - coredns
  - dns
  - service-discovery
sidebar_label: "서비스 디스커버리"
---

# 서비스 디스커버리와 CoreDNS

## 1. K8s DNS 구조

```
Pod → CoreDNS (kube-system) → 업스트림 DNS
             ↕
     cluster.local 도메인 담당
```

CoreDNS는 `kube-system` 네임스페이스에서 실행되며,
클러스터 내부 DNS 쿼리를 처리한다.

---

## 2. DNS 이름 규칙

| 리소스 | DNS 이름 |
|-------|---------|
| Service | `<svc>.<ns>.svc.cluster.local` |
| Pod | `<ip-dash>.<ns>.pod.cluster.local` |
| StatefulSet Pod | `<pod>.<svc>.<ns>.svc.cluster.local` |

```bash
# 같은 네임스페이스면 서비스 이름만 사용 가능
curl http://my-api            # → my-api.default.svc.cluster.local
curl http://my-api.production # → my-api.production.svc.cluster.local
```

---

## 3. Headless Service

`clusterIP: None` 설정 시 ClusterIP 없이
개별 Pod IP를 DNS로 직접 조회한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb
spec:
  clusterIP: None   # Headless
  selector:
    app: mongodb
  ports:
  - port: 27017
```

| 구분 | 일반 Service | Headless Service |
|-----|------------|-----------------|
| DNS 응답 | ClusterIP 1개 | Pod IP 목록 전체 |
| 로드밸런싱 | kube-proxy | 클라이언트 직접 |
| 용도 | 일반 앱 | DB, StatefulSet |

---

## 4. StatefulSet DNS

StatefulSet은 각 Pod에 안정적인 고유 DNS를 부여한다.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql-headless  # Headless Service와 연결
  replicas: 3
  ...
```

Pod DNS 예시:
```
mysql-0.mysql-headless.default.svc.cluster.local
mysql-1.mysql-headless.default.svc.cluster.local
mysql-2.mysql-headless.default.svc.cluster.local
```

Pod 재시작 후에도 같은 DNS 이름을 유지한다.

---

## 5. ExternalName Service

외부 호스트명을 클러스터 내 DNS로 매핑한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: production
spec:
  type: ExternalName
  externalName: rds.example.com
```

`external-db.production.svc.cluster.local` 쿼리 시
`rds.example.com` CNAME을 반환한다.

---

## 6. CoreDNS Corefile 설정

```bash
# CoreDNS 설정 확인
kubectl get configmap coredns -n kube-system -o yaml
```

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
        ready
        kubernetes cluster.local in-addr.arpa ip6.arpa {
           pods insecure
           fallthrough in-addr.arpa ip6.arpa
           ttl 30
        }
        prometheus :9153
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }
        cache 30
        loop
        reload
        loadbalance
    }
    # 사내 도메인을 별도 DNS로 포워딩
    internal.company.com:53 {
        forward . 10.0.0.1:53
        cache 30
    }
```

### 주요 플러그인

| 플러그인 | 역할 |
|---------|------|
| `kubernetes` | 클러스터 내부 DNS 처리 |
| `forward` | 외부 DNS로 쿼리 위임 |
| `cache` | DNS 응답 캐싱 |
| `log` | 쿼리 로깅 (디버깅용) |
| `reload` | Corefile 변경 자동 반영 |

---

## 7. ndots 설정

`ndots`는 절대 경로 쿼리 시도 기준 점(`.`) 개수다.
기본값 `5`는 불필요한 DNS 쿼리를 유발한다.

```
# ndots:5 에서 "redis.cache" 쿼리 시도 순서
1. redis.cache.default.svc.cluster.local
2. redis.cache.svc.cluster.local
3. redis.cache.cluster.local
4. redis.cache  ← 실제 도메인
```

```yaml
spec:
  dnsConfig:
    options:
    - name: ndots
      value: "2"   # 불필요한 쿼리 감소
  dnsPolicy: ClusterFirst
```

---

## 8. DNS 디버깅

```bash
# 디버그 Pod 실행
kubectl run -it debug \
  --image=nicolaka/netshoot:latest \
  --rm -- /bin/bash

# DNS 조회
nslookup my-svc.default.svc.cluster.local
dig +short my-svc.default.svc.cluster.local

# CoreDNS 직접 쿼리
dig @10.96.0.10 my-svc.default.svc.cluster.local

# CoreDNS 로그 (일시적으로 log 플러그인 추가 후)
kubectl logs -n kube-system -l k8s-app=kube-dns -f
```

### 자주 발생하는 DNS 문제

| 증상 | 원인 | 해결 |
|-----|------|------|
| `NXDOMAIN` | 서비스 없음, 네임스페이스 오타 | `kubectl get svc -A` 확인 |
| DNS 타임아웃 | CoreDNS 과부하 | CoreDNS 레플리카 증가 |
| 외부 DNS 불가 | forward 설정 누락 | Corefile forward 확인 |
| 느린 응답 | ndots 높음 | ndots 값 낮추기 |

---

## 참고 문서

- [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [Customizing DNS Service](https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/)
- [Debugging DNS Resolution](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/)
