---
title: "대규모 트래픽 대응 전략 (KEDA, Karpenter)"
date: 2026-04-14
tags:
  - sre
  - keda
  - karpenter
  - autoscaling
sidebar_label: "트래픽 대응"
---

# 대규모 트래픽 대응 전략

## 1. 스케일링 계층

```
Pod 레벨:
  HPA  → CPU/메모리 기반 Pod 스케일
  VPA  → Pod 리소스 요청 자동 조정
  KEDA → 이벤트 기반 Pod 스케일

노드 레벨:
  Cluster Autoscaler → 노드 그룹 스케일
  Karpenter          → 직접 노드 프로비저닝
```

---

## 2. KEDA (Event-driven Autoscaling)

HTTP 요청 수, Kafka lag, SQS 큐 크기 등
다양한 이벤트 소스 기반으로 Pod를 스케일한다.

```yaml
# Kafka 기반 스케일링
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: order-processor-scaler
spec:
  scaleTargetRef:
    name: order-processor
  minReplicaCount: 1
  maxReplicaCount: 50
  pollingInterval: 15
  cooldownPeriod: 30
  triggers:
  - type: kafka
    metadata:
      bootstrapServers: kafka:9092
      topic: orders
      consumerGroup: order-processor
      lagThreshold: "100"    # 컨슈머 lag 100 당 1 Pod
```

```yaml
# HTTP 요청 기반 스케일링 (HTTP Add-on)
apiVersion: keda.sh/v1alpha1
kind: HTTPScaledObject
metadata:
  name: payment-http-scaler
spec:
  hosts:
  - payment.example.com
  scaleTargetRef:
    name: payment
    port: 8080
  replicas:
    min: 1
    max: 100
  scalingMetric:
    requestRate:
      granularity: 1s
      targetValue: 50    # Pod 당 초당 50 요청
```

---

## 3. Karpenter (Just-in-Time 노드 프로비저닝)

Cluster Autoscaler보다 빠른 노드 프로비저닝.
필요한 노드 타입을 자동 선택한다.

```yaml
# NodePool 정의
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: [on-demand, spot]
      - key: kubernetes.io/arch
        operator: In
        values: [amd64]
      - key: node.kubernetes.io/instance-type
        operator: In
        values: [m5.xlarge, m5.2xlarge, m6i.xlarge]

      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default

  limits:
    cpu: 1000
    memory: 4000Gi

  disruption:
    consolidationPolicy: WhenEmpty
    consolidateAfter: 30s
```

---

## 4. 트래픽 급증 대응 아키텍처

```
트래픽 급증 발생:
  ↓
CDN 캐시 히트 (정적 콘텐츠)
  ↓ 캐시 미스만
API Gateway 속도 제한 (Rate Limiting)
  ↓ 허용된 요청만
KEDA: 대기 큐 기반 스케일아웃
  ↓
Karpenter: 노드 부족 시 자동 추가 (90초)
  ↓
새 Pod가 트래픽 처리
```

---

## 5. 속도 제한 (Rate Limiting)

```yaml
# NGINX Ingress 속도 제한
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    # IP당 초당 10 요청
    nginx.ingress.kubernetes.io/limit-rps: "10"
    # 버스트 허용
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "5"
    # 연결 제한
    nginx.ingress.kubernetes.io/limit-connections: "100"
```

---

## 6. 서킷 브레이커 (Circuit Breaker)

```yaml
# Istio 서킷 브레이커
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-cb
spec:
  host: payment.production.svc.cluster.local
  trafficPolicy:
    outlierDetection:
      # 5xx가 30% 이상이면 서킷 오픈
      consecutiveGatewayErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
```

---

## 참고 문서

- [KEDA 공식 문서](https://keda.sh/docs/)
- [Karpenter](https://karpenter.sh/docs/)
- [NGINX Rate Limiting](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/#rate-limiting)
