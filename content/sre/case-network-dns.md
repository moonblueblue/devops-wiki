---
title: "실전 케이스: 네트워크 장애 (DNS)"
date: 2026-04-14
tags:
  - sre
  - incident-case
  - dns
  - network
sidebar_label: "케이스: DNS 장애"
---

# 실전 케이스: 네트워크 장애 (DNS)

## 1. 장애 개요

```
증상: 서비스 간 통신 간헐적 실패
      외부 API 호출 타임아웃
      "dial tcp: lookup <hostname>: no such host" 오류

영향: 전체 서비스 응답 속도 저하 (평균 5초)
```

---

## 2. 진단 흐름

```bash
# 1단계: DNS 해석 확인
kubectl run dns-test --rm -it \
  --image=busybox -- nslookup kubernetes.default

# CoreDNS Pod 상태 확인
kubectl get pods -n kube-system \
  -l k8s-app=kube-dns

# CoreDNS 로그 확인
kubectl logs -n kube-system \
  -l k8s-app=kube-dns --tail=100

# 2단계: DNS 응답 시간 측정
kubectl run dns-perf --rm -it \
  --image=gcr.io/k8s-dns-node-cache/k8s-dns-perf:1.0.1 -- \
  /dns-perf --server kubernetes.default.svc.cluster.local

# 3단계: ndots 설정 확인
kubectl exec -it payment-xxx -- cat /etc/resolv.conf
# ndots:5 → 짧은 이름 검색 시 5번 쿼리 발생
```

---

## 3. 일반적인 원인과 해결

### CoreDNS 과부하

```yaml
# CoreDNS 리소스 증가
kubectl -n kube-system patch configmap coredns \
  --patch '{"data":{"Corefile": "...\n"}}'

# CoreDNS HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: coredns
  namespace: kube-system
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: coredns
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### ndots 최적화

```yaml
# Pod의 DNS 검색 최적화
spec:
  dnsConfig:
    options:
    - name: ndots
      value: "2"    # 기본 5에서 2로 줄임
    - name: single-request-reopen
  dnsPolicy: ClusterFirst
```

### NodeLocal DNSCache

```bash
# 노드별 DNS 캐시 (CoreDNS 부하 감소)
kubectl apply -f \
  https://raw.githubusercontent.com/kubernetes/kubernetes/master/cluster/addons/dns/nodelocaldns/nodelocaldns.yaml
```

---

## 4. 모니터링 지표

```yaml
# CoreDNS 메트릭 알림
- alert: CoreDNSHighLatency
  expr: |
    histogram_quantile(0.99,
      rate(coredns_dns_request_duration_seconds_bucket[5m])
    ) > 1
  for: 5m
  annotations:
    summary: "CoreDNS p99 레이턴시 1초 초과"

- alert: CoreDNSHighErrorRate
  expr: |
    rate(coredns_dns_responses_total{rcode="SERVFAIL"}[5m]) > 0.01
  annotations:
    summary: "CoreDNS SERVFAIL 응답 비율 높음"
```

---

## 5. 사후 조치

```
단기:
  □ CoreDNS replicas 증가
  □ NodeLocal DNSCache 활성화
  □ ndots 값 최적화

중기:
  □ CoreDNS 리소스 limit 조정
  □ DNS 요청 수 모니터링 추가
  □ 서비스 디스커버리 패턴 검토

장기:
  □ 서비스 간 직접 IP 통신 검토
  □ 서비스 메시 도입 고려
```

---

## 참고 문서

- [CoreDNS 트러블슈팅](https://kubernetes.io/docs/tasks/administer-cluster/dns-debugging-resolution/)
- [NodeLocal DNSCache](https://kubernetes.io/docs/tasks/administer-cluster/nodelocaldns/)
