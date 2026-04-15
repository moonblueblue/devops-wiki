---
title: "CoreDNS"
date: 2026-04-13
tags:
  - kubernetes
  - network
  - dns
  - coredns
sidebar_label: "CoreDNS"
---

# CoreDNS

## 1. CoreDNS란

Kubernetes 1.11+에서 기본 DNS 서버로 사용되며,
클러스터 내부 서비스 디스커버리를 담당한다.

```
Pod
    ↓ DNS 쿼리 (my-service.default.svc.cluster.local)
CoreDNS (kube-system 네임스페이스)
    ├── 내부 서비스 → ClusterIP 반환
    └── 외부 도메인 → 업스트림 DNS 포워딩
```

```bash
# CoreDNS Pod 상태 확인
kubectl get pods -n kube-system -l k8s-app=kube-dns

# 설정 확인
kubectl get configmap coredns -n kube-system -o yaml
```

---

## 2. Corefile 설정

```
.:53 {
    errors                  # 오류 로깅
    health {                # 헬스체크 엔드포인트
        lameduck 5s
    }
    ready                   # 준비 상태 엔드포인트
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure       # Pod DNS 활성화
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153        # Prometheus 메트릭
    forward . /etc/resolv.conf {  # 외부 DNS 포워딩
        max_concurrent 1000
    }
    cache 30                # 30초 캐시
    loop                    # 루프 감지
    reload                  # 설정 자동 리로드
    loadbalance             # 응답 순서 랜덤화
}
```

### 주요 플러그인

| 플러그인 | 기능 |
|---------|------|
| `kubernetes` | 클러스터 서비스/Pod DNS 처리 |
| `forward` | 외부 DNS 서버로 포워딩 |
| `cache` | DNS 응답 캐싱 |
| `health` | `/health` 엔드포인트 |
| `ready` | `/ready` 엔드포인트 |
| `prometheus` | 메트릭 노출 (`:9153`) |
| `reload` | Corefile 변경 자동 반영 |

---

## 3. Pod DNS 정책

```yaml
spec:
  dnsPolicy: ClusterFirst  # 기본값
```

| 정책 | 동작 |
|------|------|
| `ClusterFirst` | 클러스터 내부 도메인은 CoreDNS 처리, 나머지는 upstream 포워딩 |
| `ClusterFirstWithHostNet` | hostNetwork: true Pod에서 ClusterFirst 유지 |
| `Default` | 노드의 DNS 설정 상속 |
| `None` | dnsConfig 직접 지정 |

```yaml
# dnsPolicy: None으로 직접 설정
spec:
  dnsPolicy: None
  dnsConfig:
    nameservers:
      - 8.8.8.8
    searches:
      - default.svc.cluster.local
    options:
      - name: ndots
        value: "2"
```

---

## 4. ndots 최적화

`ndots`는 점(.)의 수가 이 값 미만이면
클러스터 내부 도메인으로 먼저 시도하는 기준이다.

**기본값 ndots: 5 문제:**

```
외부 도메인 api.example.com 쿼리 시 (점 1개 < 5):
  1. api.example.com.default.svc.cluster.local (실패)
  2. api.example.com.svc.cluster.local (실패)
  3. api.example.com.cluster.local (실패)
  4. api.example.com. (성공)
  → 불필요한 쿼리 3회 추가 발생
```

```yaml
# ndots: 2로 최적화
spec:
  dnsConfig:
    options:
      - name: ndots
        value: "2"
# 점의 수가 ndots 값 미만이면 서치 도메인 우선 시도
# api.example.com (점 1개 < 2) → 서치 도메인 먼저 시도
# api.v1.example.com (점 2개 >= 2) → 바로 외부 쿼리
```

---

## 5. 외부 DNS 포워딩

특정 도메인을 별도 DNS 서버로 포워딩한다.

```
# ConfigMap 수정
kubectl edit configmap coredns -n kube-system
```

```
# ⚠️ forward 플러그인은 서버 블록당 1개만 허용
# 두 번 선언 시 CoreDNS CrashLoopBackOff 발생
# 도메인별 포워딩은 별도 서버 블록으로 분리

# 사내 도메인 전용 블록
corp.internal:53 {
    forward . 10.0.0.53
    cache 30
}

# 메인 블록 (나머지 모든 도메인)
.:53 {
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
    }
    forward . 8.8.8.8 1.1.1.1
    cache 30
}
```

---

## 6. 성능 튜닝

```bash
# CoreDNS Deployment 레플리카 증가
kubectl scale deployment coredns -n kube-system --replicas=3

# 캐시 크기 증가 (Corefile)
cache 300  # 기본 30초 → 300초
```

### NodeLocal DNSCache

각 노드에 DNS 캐시 데몬셋을 배포하여
CoreDNS 부하를 줄이고 레이턴시를 낮춘다.

```bash
# NodeLocal DNSCache 설치
# ⚠️ master 브랜치 URL에는 플레이스홀더 변수 미치환 상태의 YAML 포함 → 직접 사용 금지
# 공식 절차 참조: kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/
# 릴리즈별 태그 URL 또는 배포판 제공 방법 사용 권장
```

---

## 7. 트러블슈팅

```bash
# DNS 테스트용 Pod 실행 (agnhost: 공식 K8s 도구 이미지, jessie-dnsutils는 EOL)
kubectl run dnsutils --image=registry.k8s.io/e2e-test-images/agnhost:2.39 \
  --restart=Never -it --rm -- /bin/bash

# 내부 서비스 조회
dig my-service.default.svc.cluster.local

# 외부 도메인 조회
dig google.com

# CoreDNS 로그 확인
kubectl logs -n kube-system -l k8s-app=kube-dns --tail=50

# CoreDNS 메트릭 확인
kubectl port-forward -n kube-system svc/kube-dns 9153:9153
curl localhost:9153/metrics | grep coredns_dns_requests_total
```

### 자주 보는 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| NXDOMAIN for internal service | CoreDNS Pod 다운 | Pod 재시작 확인 |
| 외부 DNS 느림 | ndots: 5 기본값 | ndots 낮추기 |
| DNS 타임아웃 | CoreDNS 과부하 | 레플리카 증가, NodeLocal DNS |
| 간헐적 실패 (conntrack 부족) | conntrack 테이블 고갈 | nf_conntrack_max 증가 |
| 간헐적 실패 (race condition) | UDP A/AAAA 동시 쿼리 충돌 (커널 5.1 미만) | NodeLocal DNSCache 도입 또는 커널 5.1+ 업그레이드 |

---

## 참고 문서

- [CoreDNS 공식 문서](https://coredns.io/manual/toc/)
- [Kubernetes - DNS Pod Service](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/)
- [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)
