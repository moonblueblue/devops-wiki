---
title: "실전 케이스: SPOF 장애"
date: 2026-04-14
tags:
  - sre
  - incident-case
  - spof
  - high-availability
sidebar_label: "케이스: SPOF"
---

# 실전 케이스: SPOF 장애

## 1. SPOF란

**Single Point of Failure.**
한 곳이 실패하면 전체 시스템이 중단되는 지점.

```
일반적인 SPOF:
  □ 단일 DB 인스턴스
  □ 단일 인그레스 컨트롤러 Pod
  □ 단일 가용 영역(AZ) 배포
  □ 외부 의존성 (써드파티 API)
  □ 단일 NAT Gateway
```

---

## 2. SPOF 발견 방법

```bash
# 단일 Pod로 실행 중인 Deployment 찾기
kubectl get deployments -A \
  -o custom-columns=\
"NS:.metadata.namespace,\
NAME:.metadata.name,\
REPLICAS:.spec.replicas" | \
  awk '$3 == "1"'

# PodDisruptionBudget 없는 배포 확인
kubectl get pdb -A
# PDB 없는 서비스 = 노드 드레인 시 중단 위험

# 단일 AZ에 배포된 Pod 확인
kubectl get pods -o wide | \
  awk '{print $7}' | sort | uniq -c
```

---

## 3. 단일 DB SPOF 장애

```
발생 상황:
  RDS 단일 인스턴스 → OS 패치 재시작
  → 결제 서비스 전체 중단 (5분)

해결:
  RDS Multi-AZ → 자동 페일오버 60초 이내

온프레미스:
  Patroni + etcd → 자동 페일오버
  드레인 컨트롤러로 무중단 전환
```

---

## 4. SPOF 제거 패턴

### Pod 고가용성

```yaml
# 최소 2개 replicas
spec:
  replicas: 3

# PodDisruptionBudget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-pdb
spec:
  minAvailable: 2    # 항상 최소 2개 유지
  selector:
    matchLabels:
      app: payment
```

### 멀티 AZ 배포

```yaml
# topologySpreadConstraints로 AZ 분산
spec:
  topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: payment
```

### 외부 의존성 SPOF

```yaml
# 써드파티 API 서킷 브레이커
# (Resilience4j 예시 - Java)
resilience4j:
  circuitbreaker:
    instances:
      external-payment:
        slidingWindowSize: 10
        failureRateThreshold: 50
        waitDurationInOpenState: 30s
        permittedNumberOfCallsInHalfOpenState: 3
```

---

## 5. 장애 발생 시 조치

```
즉시 조치:
  □ 영향 받는 서비스 식별
  □ 우회 경로 활성화 (캐시, 폴백)
  □ 다운스트림 서비스 보호
  (서킷 브레이커 수동 활성화)

복구 후 조치:
  □ SPOF 지점 식별 및 문서화
  □ HA 구성으로 전환 계획 수립
  □ 카오스 엔지니어링으로 검증
```

---

## 6. SPOF 점검 체크리스트

```
분기별 SPOF 리뷰:

인프라:
  □ DB HA 구성 (Multi-AZ/Patroni)
  □ 멀티 AZ 노드 배포
  □ NAT Gateway 이중화
  □ 로드밸런서 이중화

애플리케이션:
  □ 핵심 서비스 replicas ≥ 2
  □ PodDisruptionBudget 설정
  □ 단일 온콜 담당자 지양 (버디 시스템)

외부 의존성:
  □ 서킷 브레이커 구성
  □ 대안 서비스 준비 (결제 게이트웨이)
  □ SLA 없는 의존성 제거
```

---

## 참고 문서

- [고가용성 K8s 패턴](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [AWS Multi-AZ](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html)
