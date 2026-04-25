---
title: "Capacity Planning — 수요 예측·헤드룸·리소스 계획"
sidebar_label: "Capacity Planning"
sidebar_position: 1
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - sre
  - capacity
  - planning
  - autoscaling
  - forecasting
---

# Capacity Planning

> **2026년의 자리**: Capacity Planning은 *Dickerson 5층* — 신뢰성의 *예측
> 가능성*. Google SRE Book *"Software Engineering in SRE"*·*"Capacity
> Planning at Scale"* (Google Research) 정전. 핵심은 *수요 예측 →
> 자원 매핑 → 헤드룸 설계 → 검증*. 2026년 트렌드는 *자동 스케일링 +
> 사전 예측*의 결합 — autoscaling이 *대신*하지 *않고 보강*.
>
> 1~5인 환경에서는 *분기 1회 예측 + autoscaling + 50% 헤드룸*으로 충분.
> 도구보다 *수요 신호 식별*이 본질.

- **이 글의 자리**: Dickerson 5층, [Failure Modes](../reliability-design/failure-modes.md)
  와 짝. 사고 방지의 *예측* 측면.
- **선행 지식**: SLO, autoscaling 기본, 트래픽 패턴 분석.

---

## 1. 한 줄 정의

> **Capacity Planning**: "*예상 수요(load) + 헤드룸(buffer)에 맞춰 자원
> (capacity)을 *사전*에 확보하는 활동.* Autoscaling이 즉시 대응이라면
> Capacity Planning은 *기간 한 단계 위*."

### 핵심 공식

```text
Resource Usage = f(Demand, Capacity, Software Efficiency)

목표: 비용 최소 × 사용자 영향 0
        = 수요 정확 예측 × 효율적 헤드룸 × autoscaling
```

### 왜 Autoscaling만으론 부족한가

| 한계 | 의미 |
|---|---|
| **Cold start** | 새 인스턴스 부팅 시간 (분 단위) |
| **Cluster 자체 한계** | 노드 풀 가득 차면 autoscaling 멈춤 |
| **Quota** | 클라우드 region·계정 quota |
| **트래픽 급증 (10배)** | autoscaling 따라잡기 X |
| **계획 이벤트** | 블랙프라이데이·캠페인 — *사전* 준비 필요 |
| **하드웨어·라이선스** | 즉시 확보 X |

> Autoscaling은 *분 단위* 대응, Capacity Planning은 *분기·연간* 계획.
> 둘 다 필요.

---

## 2. Capacity Planning 라이프사이클

```mermaid
flowchart LR
    H[과거 데이터] --> F[수요 예측]
    F --> M[자원 매핑]
    M --> HR[헤드룸 설계]
    HR --> P[프로비저닝]
    P --> V[검증 부하 테스트]
    V --> M2[모니터링]
    M2 --> H
```

| 단계 | 산출 | 시간 |
|:-:|---|---|
| 1 | **과거 데이터 수집** | 6개월~1년 트래픽 |
| 2 | **수요 예측** | 다음 분기·연간 |
| 3 | **자원 매핑** | 수요 → CPU·메모리·QPS |
| 4 | **헤드룸 설계** | 안전 마진 |
| 5 | **프로비저닝** | quota·노드·DB |
| 6 | **검증** | 부하 테스트로 확인 |
| 7 | **모니터링** | 실적 vs 예측 — 다음 분기 보정 |

---

## 3. 수요 예측 (Demand Forecasting)

### 데이터 입력

| 종류 | 의미 |
|---|---|
| **트래픽** | RPS, QPS, 동시 사용자 |
| **사용자 수** | DAU·MAU·신규 가입 |
| **비즈니스 메트릭** | 주문 수, 결제 건 |
| **계절성** | 요일·시간·계절·연중 패턴 |
| **이벤트** | 캠페인·세일·외부 트리거 |
| **외부 신호** | 마케팅 계획·신규 기능 |

### 예측 방법

| 방법 | 적합 |
|---|---|
| **Linear Regression** | 단순 성장 — 예: MAU 직선 증가 |
| **ARIMA** | 계절성·자기회귀 |
| **Prophet** (Facebook OSS) | 계절성·휴일·이벤트 자동 처리 |
| **Holt-Winters** | 트렌드 + 계절성 |
| **ML 기반** (LSTM 등) | 복잡한 비선형 |
| **Capacity Planner (GCP)** | 매니지드 예측 도구 |

### 단순 시작 — 분기 트래픽 X 1.5

작은 팀에 *과학적 예측*은 과하다. 시작 룰:

```text
다음 분기 capacity = max(
  지난 분기 peak × 1.5,
  지난 분기 평균 × 2.0,
  알려진 이벤트 추정
)
```

> 정확도 70%면 충분. 분기마다 보정.

### 예측 검증

| 메트릭 | 목표 |
|---|---|
| **예측 vs 실측 오차** | < 30% (분기 단위) |
| **Peak 예측 정확도** | < 50% 차이 |
| **이벤트 예측 적중** | 사전 알람 |

---

## 4. 자원 매핑 — 수요를 자원으로

### 매핑 단위

| 자원 | 수요 매핑 단위 |
|---|---|
| **CPU·Memory** | RPS · 평균 latency |
| **DB connections** | 동시 트랜잭션 |
| **DB Storage** | 사용자 수 × 평균 저장량 + 로그 |
| **Network 대역폭** | RPS × 평균 응답 크기 |
| **Cache** | hit ratio × 데이터 크기 |
| **Queue** | 메시지 수 × 처리 시간 |

### 단일 인스턴스 capacity 측정

> 한 인스턴스가 SLO를 만족하며 처리할 수 있는 *최대 RPS*.

| 측정 방법 | 의미 |
|---|---|
| **Load Test** | 합성 부하로 한계 측정 |
| **실측** | 프로덕션 인스턴스 *최대 부하* 시점 RPS |
| **Stress Test** | SLO 위반 직전까지 |

### 인스턴스 수 계산

```text
인스턴스 수 = ceil(예상 peak RPS / 단일 인스턴스 capacity / 안전 마진)

예: peak 10,000 RPS, 단일 capacity 200 RPS, 헤드룸 30%
인스턴스 수 = ceil(10000 / 200 / 0.7) = 72
```

---

## 5. 헤드룸 (Headroom) 설계

### 헤드룸 = 사용 가능 capacity의 *남는 부분*

| 시나리오 | 헤드룸 권장 |
|---|---|
| **표준 운영** | 30~50% (CPU 50~70% 사용률) |
| **변동 큰 트래픽** | 50~70% |
| **계절성 강한 비즈니스** | 100% (이벤트 시점) |
| **임계 운영** (financial) | 100~200% |
| **AI/ML 훈련** | < 20% (cost-driven) |

### 70% 룰 — 권장 시작점

> *CPU 사용률 70% 초과 = 헤드룸 위반.* 70% 미만으로 일상 운영, 30% 헤드룸
> 이 트래픽 급증·인스턴스 1개 손실 흡수.

> 70%는 *시작점*. Google SRE Book은 *서비스별 데이터로 결정*을 강조 —
> latency 분포, autoscaling 응답 시간, 트래픽 변동성에 따라 50~80% 사이
> 조정. 70%는 무난한 default.

### 헤드룸의 차원

| 차원 | 의미 |
|---|---|
| **Compute** | CPU·메모리 사용률 70% 미만 |
| **Storage** | 디스크 80% 미만 |
| **Network** | 대역폭 50% 미만 |
| **Connection Pool** | 60~70% |
| **Queue** | 평소 비어 있어야 |
| **Time** | autoscaling cold start 시간 흡수 |

### N+1·N+2 — 인스턴스 손실 흡수

> N = peak 부하를 SLO 만족하며 처리하는 *최소* 인스턴스 수.

| 모델 | 의미 |
|---|---|
| **N** | 정상 N개로 충분 — *손실 흡수 X* |
| **N+1** | 정상 N개 + 여분 1개 — 1개 손실 OK |
| **N+2** | 여분 2개 — 1개 손실 + 유지보수 |
| **2N** | 두 배 — Active-Active multi-AZ |

> *최소 N+1*. 단일 인스턴스 손실에 견디는 것이 표준. **N=2면 min replicas
> 3, N=10이면 min 11** — N+1은 무조건 3이 아니다.

---

## 6. Autoscaling — 동적 capacity

### Autoscaling 종류

| 종류 | 트리거 | 도구 |
|---|---|---|
| **HPA** (Horizontal) | CPU·메모리·custom metric | K8s HPA |
| **VPA** (Vertical) | Pod 자체 자원 조정 | K8s VPA |
| **Cluster Autoscaler** | 노드 풀 자체 | K8s CA, Karpenter |
| **KEDA** (Event-driven) | Queue·이벤트 기반 | K8s KEDA |
| **CSP autoscaling** | EC2 ASG, GCP MIG | 직접 |

### Karpenter — AWS 표준 (v1.x GA)

| 강점 | 의미 |
|---|---|
| **빠른 노드 프로비저닝** | 30초 이내 (vs Cluster Autoscaler 분 단위) |
| **다양한 인스턴스 타입** | spot·on-demand·ARM·x86 자동 선택 |
| **Bin packing** | Pod 요구사항으로 최적 인스턴스 선택 |
| **빈 노드 정리** | consolidation으로 비용 ↓ |

> 2026년 기준 **AWS v1.x GA**. **Azure provider는 alpha/preview**, **GCP는
> 로드맵**. AWS 외에서는 Cluster Autoscaler가 표준.

### VPA·HPA 충돌 주의

| 조합 | 동작 |
|---|---|
| **HPA (CPU 트리거)** + **VPA `Auto`** | *충돌* — 둘 다 CPU 변경, oscillation |
| **HPA (custom metric)** + **VPA `Auto`** | OK — 메트릭 분리 |
| **HPA** + **VPA `Off` 또는 `Initial`** | 권장 — VPA는 추천만 |
| **VPA 단독** | Pod 재시작 빈번 — 단명 워크로드만 |

> HPA + VPA 동시 사용 시 VPA 모드는 `Off`/`Initial` (추천만), CPU 외
> 메트릭으로 HPA 운영. K8s 공식 권장.

### Autoscaling 설정 핵심

```yaml
# K8s HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: payment-api
spec:
  minReplicas: 3        # 최소 (heaadroom)
  maxReplicas: 50       # 최대 (cost cap)
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # 70% 사용률 목표
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 30  # 빠른 scale up
    scaleDown:
      stabilizationWindowSeconds: 300 # 느린 scale down (오버 회피)
```

### Autoscaling 함정

| 함정 | 처방 |
|---|---|
| **Min replicas 1** | N+1 보장 X | min ≥ 3 |
| **Max replicas 무제한** | 비용 폭주 | cost cap |
| **CPU만 트리거** | latency·queue 무시 | 다중 메트릭 |
| **Scale down 너무 빠름** | thrashing | stabilization window |
| **Cold start 무시** | 트래픽 급증 못 따라감 | warm pool 또는 사전 scaling |
| **Quota 도달** | scale 멈춤 | quota 모니터링 |

---

## 7. Bin Packing & Stranded Capacity

### Bin Packing

K8s 스케줄러가 *Pod requests*를 노드에 *얼마나 효율적으로 채우는가*. 잘
못하면 노드는 가득 찼는데 Pod 배치 실패 — *Stranded Capacity*.

| 신호 | 의미 |
|---|---|
| **노드 CPU 50% 사용 중인데 Pod 추가 불가** | request 잘못 설정 |
| **request과 실사용 차이 큼** | over-request |
| **클러스터 비용 30%+ 낭비** | bin packing 실패 |
| **Pending Pod 항상 있음** | resource fragmentation |

### 처방

| 처방 | 도구 |
|---|---|
| **Right-sizing** | VPA `Off` 모드 추천, Goldilocks |
| **Karpenter consolidation** | 빈 노드 회수 |
| **Pod 통합** | Descheduler |
| **Request 모니터링** | Kubecost·OpenCost |
| **PriorityClass** | 우선순위 낮은 Pod는 evict 가능 |

---

## 8. Heterogeneous Capacity — 인스턴스 다양성

| 차원 | 활용 |
|---|---|
| **CPU 아키텍처** | ARM (Graviton, Ampere) 30~40% 저렴 + 효율 |
| **Spot vs On-demand** | Spot 50~80% 절감, 중단 가능 |
| **GPU vs CPU** | AI 워크로드 분리 |
| **인스턴스 패밀리** | compute-optimized·memory-optimized·storage |
| **Region** | 비용·레이턴시 trade-off |

### Karpenter NodePool 다양화

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64", "arm64"]   # 둘 다 허용
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values: ["m6i.large", "m6g.large", "c7i.large", "m7g.large"]
```

> 다양성 ↑ = spot 가용성 ↑, 비용 ↓, 단일 instance type 부족 위험 ↓.

---

## 9. AI/GPU Workload Capacity

2026년 핵심 주제. 일반 capacity와 다른 차원.

### GPU 특수성

| 측면 | 의미 |
|---|---|
| **Throughput 단위** | tokens/sec, batch size, KV cache 크기 |
| **Context length** | 길어질수록 throughput ↓↓ |
| **GPU 분할** | NVIDIA MIG (Multi-Instance GPU), MPS |
| **Fractional GPU** | 1 GPU를 N Pod 공유 |
| **Cold start** | 모델 로딩 분 단위 — autoscaling 어려움 |
| **공급 제약** | H100·H200·B200 quota |

### Inference vs Training

| 측면 | Inference | Training |
|---|---|---|
| **트래픽 패턴** | request-response | batch |
| **Latency 민감** | ↑↑ | 낮음 |
| **Autoscaling** | Inference만 — KEDA + DCGM 메트릭 |
| **Spot 사용** | 위험 | OK (체크포인트) |
| **GPU 종류** | T4·L4·A10·A100·H100 | H100·H200·B200 |

### KEDA + GPU 메트릭

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
spec:
  scaleTargetRef:
    name: llm-inference
  minReplicaCount: 1
  maxReplicaCount: 20
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus:9090
        query: |
          avg(DCGM_FI_DEV_GPU_UTIL{namespace="ai"})
        threshold: '70'
```

---

## 10. Demand Shaping — 수요 평탄화

공급(capacity)만이 아니라 *수요 자체를 변형*.

| 기법 | 의미 |
|---|---|
| **Rate Limiting** | 사용자·tenant당 RPS 상한 |
| **Throttling** | 부하 시 일부 요청 거절·지연 |
| **Queue 평탄화** | sync API → async + 큐 |
| **Admission Control** | priority 낮은 요청 거절 |
| **Load Shedding** | 시스템 위험 시 비-임계 요청 drop |
| **Caching** | hot 데이터 캐시 → DB 부하 ↓ |
| **Pre-computation** | 미리 계산 → 요청 시 빠름 |
| **Time shifting** | 비-실시간 요청은 야간 처리 |

> Capacity Planning은 *공급-수요 양쪽*. 수요 통제 못 하면 *영구 over-
> provisioning*.

---

## 11. Production-safe Load Testing

프로덕션에 부하 테스트는 *위험*. 안전 패턴.

| 패턴 | 의미 |
|---|---|
| **Shadow Traffic** | 프로덕션 트래픽 *복제* — 응답 무시 |
| **Traffic Mirroring** | Service Mesh로 N% 복제 |
| **Dark Launch** | 새 기능 배포 후 *호출만* — 응답 미사용 |
| **Tenant 격리** | 특정 tenant·region만 부하 |
| **Kill Switch** | 즉시 중단 가능 |
| **사전 통보** | On-call·CS 사전 인지 |
| **시간대 선택** | 트래픽 ↓ 시간 |
| **점진적 ramp-up** | 갑작스러운 spike X |

> *Staging이 진짜 프로덕션과 다르다*면 Production-safe 부하 테스트 필요.
> Shadow + Dark Launch가 가장 안전.

---

## 12. 부하 테스트 — Capacity 검증

### 테스트 종류

| 종류 | 의미 |
|---|---|
| **Load Test** | 예상 peak까지 부하 |
| **Stress Test** | SLO 깰 때까지 부하 — 한계 측정 |
| **Soak Test** | 장시간 일정 부하 — 메모리 누수 |
| **Spike Test** | 갑작스러운 급증 — autoscaling 검증 |
| **Volume Test** | 대량 데이터 — DB 한계 |

### 도구

| 도구 | 강점 |
|---|---|
| **k6** (Grafana Labs) | JavaScript, Cloud + OSS |
| **Locust** | Python, 분산 |
| **JMeter** | UI, 다양한 프로토콜 |
| **Gatling** | Scala, 고성능 |
| **Vegeta** | Go, CLI 단순 |
| **AWS Distributed Load Testing** | 대규모 |

### Load Test 시나리오

```javascript
// k6 예시
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 100 },   // 5분간 100 RPS까지 ramp
    { duration: '10m', target: 500 },  // 10분간 500 RPS 유지
    { duration: '5m', target: 1000 },  // 5분간 1000 RPS spike
    { duration: '10m', target: 1000 }, // 10분간 1000 RPS 유지
    { duration: '5m', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],   // p95 < 300ms
    http_req_failed: ['rate<0.01'],     // 실패율 < 1%
  },
};

export default function() {
  const res = http.get('https://api.example.com/payment');
  check(res, { 'status 200': r => r.status === 200 });
  sleep(1);
}
```

> 분기 1회 *Production-shape* 부하 테스트. SLO 임계와 같이 검증.

---

## 13. Cost vs Reliability — 트레이드오프

### 비용 차원

| 차원 | 의미 |
|---|---|
| **Compute** | CPU·메모리 인스턴스 |
| **Storage** | 디스크·DB |
| **Network** | egress 비용 (region 간) |
| **License** | 상용 SW |
| **Spot vs On-demand** | 50~80% 절감 vs 안정성 |
| **Reserved/Savings Plan** | 1·3년 약정 |

### 비용 vs 신뢰성 매트릭스

| 신뢰성 | 비용 |
|---|---|
| **99.5%** | 1× (단일 region·AZ) |
| **99.9%** | 1.5~2× (Multi-AZ) |
| **99.99%** | 3~5× (Multi-AZ + N+2 + 자동 failover) |
| **99.999%** | 10× (Multi-region active-active) |

> *9 하나 추가에 비용 2~5배*. 사용자가 정말 그 신뢰성을 인지하는지 검토.

---

## 14. FinOps — 운영 비용 관리

| 활동 | 의미 |
|---|---|
| **Right-sizing** | 인스턴스 크기 최적화 |
| **Spot 활용** | 비-임계 워크로드 |
| **Reserved/Saving** | 안정 워크로드 약정 |
| **Idle 정리** | 유휴 인스턴스·디스크 |
| **CDN·캐시 최대화** | egress·DB 부하 ↓ |
| **데이터 라이프사이클** | hot·warm·cold·archive |
| **Cost allocation** | 팀·서비스별 추적 |

### 도구

| 도구 | 용도 |
|---|---|
| **Infracost** | Terraform 비용 분석 (CI 통합) |
| **OpenCost / Kubecost** | K8s 비용 |
| **AWS Cost Explorer / GCP Billing** | CSP 네이티브 |
| **CloudHealth / Cloudability** | 멀티 클라우드 |

> FinOps는 별도 분과지만 SRE의 *Capacity Planning과 직결*. [iac/](../../iac/)
> 카테고리에서 깊이 다룸.

---

## 15. 이벤트 대응 — 캠페인·블랙프라이데이

### 사전 준비 체크리스트

```markdown
# Black Friday Readiness — 2026-11-29

## D-30
- [ ] 예상 peak 추정 (작년 × 1.5)
- [ ] Quota 사전 확장 요청 (CSP)
- [ ] 부하 테스트 — 예상 peak 1.5배
- [ ] 자동화 점검 (autoscaling, alert)

## D-14
- [ ] Pre-warm: 인스턴스 사전 확보
- [ ] CDN 캐시 설정 검증
- [ ] DB 읽기 replica 추가
- [ ] Runbook 검증 (Wheel of Misfortune)

## D-7
- [ ] Code freeze (변경 동결)
- [ ] On-call 추가 인력
- [ ] War Room 사전 준비

## D-1
- [ ] 최종 부하 테스트
- [ ] 모니터링 대시보드 점검
- [ ] 외부 의존성 확인 (PG·인증 등)

## D-day
- [ ] War Room 가동
- [ ] 실시간 SLI 모니터링
- [ ] 30분 단위 capacity 보고

## D+7
- [ ] 사후 회고
- [ ] 다음 이벤트 개선점
```

---

## 16. 안티패턴

| 안티패턴 | 증상 | 처방 |
|---|---|---|
| **Autoscaling만 의존** | 급증 못 따라감 | 사전 예측 + autoscaling |
| **헤드룸 0** | 인스턴스 1개 손실로 사고 | 30%+ 헤드룸 |
| **CPU 100% 운영** | 헤드룸 위반 | 70% 룰 |
| **Quota 미점검** | 스케일 멈춤 | 분기 점검 + 알람 |
| **부하 테스트 없음** | 한계 모름 | 분기 1회 |
| **Min replicas 1** | 단일 손실 = 전체 다운 | min ≥ 3, N+1 |
| **이벤트 임시 대응** | 매번 사고 | Pre-warm 절차 |
| **비용만 우선** | 신뢰성 손상 | SLO 우선 |
| **신뢰성만 우선** | 비용 폭주 | SLO와 cost 균형 |

---

## 17. 1~5인 팀의 Capacity Planning — 미니 가이드

### 분기 사이클

```markdown
# Q2 Capacity Review

## 1. 데이터 (1일)
- 지난 분기 peak RPS, 평균 RPS
- 사용자 수 증가율
- 알려진 이벤트 (캠페인 등)

## 2. 예측 (반일)
- 다음 분기 peak = 지난 분기 peak × 1.5
- 알려진 이벤트 별도 추가

## 3. 자원 (반일)
- 인스턴스 수 = peak / 단일 capacity / 0.7 (헤드룸)
- DB·Storage·Cache 검토
- Quota 점검

## 4. 액션 (반일)
- Pre-warm 일정
- Quota 요청
- 부하 테스트 일정

## 5. 검증 (1일)
- k6 부하 테스트
```

총 3~4일이면 분기 capacity planning 완료.

---

## 18. 한눈에 보기

| 항목 | 한 줄 |
|---|---|
| **본질** | 수요 예측 + 헤드룸 + autoscaling 조합 |
| **70% 룰** | CPU 사용률 70% 미만 — 30% 헤드룸 |
| **N+1·N+2** | 인스턴스 손실 흡수 |
| **예측 도구** | Prophet·ARIMA·ML — 작은 팀은 ×1.5 룰 |
| **Autoscaling** | HPA + Karpenter (AWS) — 즉시 대응 |
| **부하 테스트** | k6·Locust — 분기 1회 |
| **이벤트 준비** | D-30 체크리스트 |
| **비용** | 9 하나 추가 ≈ 2~5× 비용 |
| **시작** | 분기 1회 예측 + 70% 헤드룸 + autoscaling |

---

## 참고 자료

- [Google Research — SRE Best Practices for Capacity Management](https://research.google/pubs/sre-best-practices-for-capacity-management/) (확인 2026-04-25)
- [Google Research — Capacity Planning at Scale](https://research.google/pubs/pub45902/) (확인 2026-04-25)
- [Google SRE Book — Software Engineering in SRE](https://sre.google/sre-book/software-engineering-in-sre/) (확인 2026-04-25)
- [Google Cloud — Capacity Planner](https://docs.cloud.google.com/capacity-planner/docs/overview) (확인 2026-04-25)
- [Karpenter](https://karpenter.sh/) (확인 2026-04-25)
- [k6 Documentation](https://k6.io/docs/) (확인 2026-04-25)
- [Facebook Prophet](https://facebook.github.io/prophet/) (확인 2026-04-25)
- [OpenCost — K8s 비용](https://www.opencost.io/) (확인 2026-04-25)
