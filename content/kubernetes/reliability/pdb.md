---
title: "PodDisruptionBudget"
sidebar_label: "PDB"
sidebar_position: 1
date: 2026-04-24
last_verified: 2026-04-24
tags:
  - kubernetes
  - reliability
  - pdb
  - disruption
  - eviction
  - availability
---

# PodDisruptionBudget (PDB)

PDB는 **자발적 중단(voluntary disruption)에 대한 가용성 하한선**을
선언한다. 노드 드레인·Cluster Autoscaler 축소·Karpenter consolidation
처럼 **클러스터가 주체가 되어 Pod을 종료**하려는 모든 경로가 Eviction
API를 거치며 PDB를 확인한다. `disruptionsAllowed=0`이면 eviction은
HTTP 429로 즉시 거절되어 드레인이 멈춘다.

**PDB가 지키지 않는 것**을 먼저 이해해야 혼동이 없다.

| 중단 유형 | PDB 보호 여부 |
|----------|:-------------:|
| 노드 드레인(`kubectl drain`) | ✅ |
| Cluster Autoscaler·Karpenter 노드 축소 | ✅ |
| `kubectl delete pod` 직접 삭제 | ❌ |
| Deployment·StatefulSet 롤링 업데이트 | ❌ (워크로드 strategy) |
| 노드 하드웨어 장애·kernel panic | ❌ |
| OOMKilled, 노드 압박 eviction(kubelet) | ❌ |
| Preemption(높은 우선순위 Pod 공간 확보) | ❌ (별도 정책) |

운영 관점 핵심 질문은 다섯 가지다.

1. **`minAvailable`과 `maxUnavailable` 중 무엇을 쓰는가** — 반올림
   방향이 결정적으로 다르다.
2. **`unhealthyPodEvictionPolicy`는 왜 기본값이 위험한가** —
   `IfHealthyBudget`의 드레인 stuck 함정.
3. **드레인이 무한 대기 중일 때 어디를 보는가** —
   `disruptionsAllowed`, `DisruptionTarget` condition.
4. **쿼럼 기반 Stateful(etcd·Kafka·ZooKeeper)은 어떻게 계산하나** —
   replica·결함 허용 수치 유도.
5. **Cluster Autoscaler·Karpenter·KEDA와 어떻게 상호작용하나** —
   consolidation·scale-in 실패 원인 1위.

> 관련: [Eviction](./eviction.md)
> · [Graceful Shutdown](./graceful-shutdown.md)
> · [Topology Spread](../scheduling/topology-spread.md)
> · [Pod 라이프사이클](../workloads/pod-lifecycle.md)

---

## 1. API 개요

```yaml
apiVersion: policy/v1              # v1beta1은 1.25에서 제거됨
kind: PodDisruptionBudget
metadata:
  name: web-pdb
  namespace: team-a
spec:
  minAvailable: 3                  # 또는 maxUnavailable 중 하나만
  selector:
    matchLabels:
      app: web
  unhealthyPodEvictionPolicy: AlwaysAllow   # 권장 기본
```

### 필드 요약

| 필드 | 타입 | 설명 |
|------|------|------|
| `spec.selector` | LabelSelector | 보호 대상 Pod 집합 |
| `spec.minAvailable` | int·string(%) | 살아 있어야 할 최소 Pod 수 |
| `spec.maxUnavailable` | int·string(%) | 동시에 내릴 수 있는 최대 Pod 수 |
| `spec.unhealthyPodEvictionPolicy` | enum | `IfHealthyBudget`(기본)·`AlwaysAllow`. 1.26 Alpha → 1.27 Beta(기본 on) → 1.31 GA |
| `status.disruptionsAllowed` | int | **지금 evict 가능한 Pod 수** |
| `status.currentHealthy` | int | 현재 healthy Pod 수 |
| `status.desiredHealthy` | int | 만족해야 할 최소 healthy |
| `status.expectedPods` | int | 워크로드가 기대하는 replicas |

`minAvailable`과 `maxUnavailable`은 **정확히 하나만** 지정한다.

### API 버전 주의

- `policy/v1`이 GA(1.21). `policy/v1beta1`은 **1.25에서 제거**.
- 빈 `selector`의 의미가 버전 간 **반대**다: v1beta1에서는 0개,
  **v1에서는 네임스페이스 내 모든 Pod 일치**. GitOps로 옮기다
  `selector: {}`를 그대로 두면 전 네임스페이스가 evict 불가 상태가
  될 수 있다.

---

## 2. `minAvailable` vs `maxUnavailable`

같아 보이지만 **계산 대상과 실패 모드가 다르다**.

replicas=7일 때 50% 지정의 의미:

| 지정 | 계산 | 결과 |
|------|------|------|
| `minAvailable: "50%"` | `ceil(7 × 0.5) = 4` | 4개 유지, 동시에 최대 3개 내림 |
| `maxUnavailable: "50%"` | `ceil(7 × 0.5) = 4` | 동시에 최대 4개 내림 |

둘 다 올림(`ceil`)이므로 "50%"라는 같은 표현이 결과적으로 다른
허용치를 낳는다.

| 측면 | `minAvailable` | `maxUnavailable` |
|------|---------------|-------------------|
| 반올림 | `ceil` → **유지 수치를 올림(가용성 보수적)** | `ceil` → **허용 중단을 올림(드레인 허용 큼)** |
| replicas 변동 대응 | 절대 숫자 고정 자연스러움 | **상대(%) 이 자연스러움** |
| 스케일 아웃 시 | 여전히 같은 하한 | 허용 중단이 함께 증가 |
| 스케일 다운(0) 시 | 드레인 영구 차단 위험 | 0 유지로 문제 없음 |

### 실전 고르는 법

- **내구성이 첫 번째인 stateful 쿼럼**(etcd·ZooKeeper·Kafka) —
  `maxUnavailable: 1` 고정. "한 번에 하나씩"이 쿼럼 보존의 유일한
  답.
- **수평 확장하는 stateless 서비스** — `maxUnavailable: "20%"`.
  replicas가 늘면 자동으로 더 많은 drain이 가능해진다.
- **항상 최소 N개 보장이 SLA에 직결** — `minAvailable: N`.
  다만 워크로드가 N까지 축소되면 드레인이 영구 차단된다는 점을
  주의.

### 흔한 사고 패턴

- `minAvailable: 100%` — 드레인 **영원히 불가**. 노드 업그레이드가
  막힌다.
- `maxUnavailable: 0` — 동일 효과, 더 명시적. 쓰지 말 것.
- `minAvailable: N`인데 replicas == N — disruptionsAllowed가 항상 0.
  운영자가 "PDB가 동작 안 한다"고 착각.
- `minAvailable: 1`인데 replicas == 1 — 롤링 업데이트는 되지만 드레인
  은 영원히 막힌다. "단일 replica는 PDB로 지키지 않는다"가 원칙.

---

## 3. Pod "healthy" 판정과 `unhealthyPodEvictionPolicy`

PDB가 카운트하는 **healthy Pod** 정의:

- `status.phase == Running`
- `status.conditions[type=Ready].status == "True"`
- `deletionTimestamp`가 없음

즉 `CrashLoopBackOff`·`ImagePullBackOff`·`Pending`·Ready=False 모두
**unhealthy**.

> **readinessGates 주의**: Pod에 `spec.readinessGates`(AWS ALB·GCP
> LB Ingress·Service Mesh 용도)가 선언되어 있으면 해당 게이트가
> True가 되기 전까지 `Ready=True`가 되지 않는다. 결과적으로 스케일
> 아웃 직후 `currentHealthy` 증가가 지연되어 **드레인이 예기치 않게
> 차단**될 수 있다. 드레인 stuck 조사 시 readinessGates 존재 여부를
> 함께 확인할 것.

### 기본값 `IfHealthyBudget`의 함정

**상황**: replicas=3, `minAvailable=2`. Pod 하나가 `CrashLoopBackOff`.

- `currentHealthy = 2`, `desiredHealthy = 2`, `disruptionsAllowed = 0`.
- 운영자가 노드 드레인 시도 → Eviction API가 **비정상 Pod조차 거절**.
- 드레인 무한 대기. 상위 원인이 드러나지 않으면 밤새 추적.

기본 정책은 "예산을 채울 때까지는 건강하든 아니든 evict 안 함". 논리
적으로는 맞지만 실전에서는 **고장 난 Pod가 오히려 복구를 막는다**.

### `AlwaysAllow` 권장

```yaml
spec:
  minAvailable: 2
  unhealthyPodEvictionPolicy: AlwaysAllow
```

- `Running`이지만 `Ready=False`인 Pod은 **예산과 관계 없이** evict
  가능.
- 건강한 Pod은 여전히 PDB 보호.
- 드레인은 망가진 Pod을 먼저 치우고, 새 노드에서 재생성되도록 자연
  스럽게 흐른다.

**1.27 Beta(기본 on)부터 사실상 표준**, **1.31 GA**. 예외는
"비정상 Pod도 반드시 온전히 복구 후에만 내려야 하는" 극히 드문
케이스(전체 주기 보존이 SLA인 금융 거래 체결기 등).

---

## 4. Stateful·쿼럼 기반 계산

쿼럼(N/2 + 1)을 깨면 클러스터가 read-only·쓰기 불가가 된다. PDB는
**쿼럼 여유분만큼만** 중단을 허용해야 한다.

| 시스템 | 권장 replicas | PDB |
|--------|--------------|-----|
| etcd | 3·5 | `maxUnavailable: 1` |
| ZooKeeper | 3·5 | `maxUnavailable: 1` |
| Kafka(KRaft) | 3·5 | `maxUnavailable: 1` |
| PostgreSQL(Patroni·CloudNativePG) | 3 | `maxUnavailable: 1` |
| Redis Sentinel·Cluster | 3·6 | `maxUnavailable: 1` |

### 왜 항상 1인가

N=3이면 결함 허용 수는 (3-1)/2 = 1. 동시에 **두 개가 내려가면
쿼럼 깨짐**. N=5면 이론상 2개까지 허용하지만, **드레인 중 예기치
않은 추가 장애**(하드웨어 failure·네트워크 파티션·쓰기 지연)에
대비하는 보수성 때문에 실무는 1로 고정하는 것이 Raft·Paxos 운영
관례. 예비 장애 마진을 잡아두지 않으면 의도적 drain이 의도치 않은
쿼럼 상실로 이어진다.

드레인 속도가 중요하면 replicas를 늘리는 것이 답이 아니다. StatefulSet
의 `updateStrategy.rollingUpdate.maxUnavailable`(업데이트 전용)과
워크로드별 재-sync 속도(etcd defrag·Kafka ISR catch-up)를 개선해야
한다.

> **Kafka KRaft 주의**: KRaft 모드에서 `maxUnavailable: 1`은 **controller
> 쿼럼**에만 의미가 있다. broker의 가용성은 별도로 `min.insync.replicas`·
> rack awareness(`broker.rack`)·토픽별 RF 조합으로 제어한다. controller
> Pod과 broker Pod을 동일 StatefulSet으로 돌리는 경우 PDB가 둘을 한꺼번에
> 보호하지만, 분리 배포 시 broker 쪽은 별도 전략이 필요.

### StatefulSet 롤링과의 관계

StatefulSet의 `.spec.updateStrategy.rollingUpdate.maxUnavailable`은
**업데이트 전용**. PDB와 별개 경로다. 드레인에는 적용되지 않으므로
둘 다 설정해야 의도한 안전이 확보된다.

---

## 5. 상태 읽기와 진단

```bash
kubectl get pdb -n team-a -o wide
# NAME       MIN AVAILABLE  MAX UNAVAILABLE  ALLOWED DISRUPTIONS  AGE
# web-pdb    3              N/A              2                    12d
```

| 상태 | 의미 | 행동 |
|------|------|------|
| `disruptionsAllowed > 0` | evict 허용 | 드레인 정상 진행 |
| `disruptionsAllowed == 0` 지속 | 현재 예산 없음 | currentHealthy 확인, 복구 대기 |
| `currentHealthy < desiredHealthy` | 애초에 부족 | Pod 상태·노드·리소스 확인 |
| `expectedPods == 0` | 셀렉터에 매칭 Pod 없음 | 라벨 오타·워크로드 미존재 |

### DisruptionTarget condition

Pod 측에도 감지 수단이 있다. Kubernetes 1.26+에서 **evict 대상이 된
Pod은 `DisruptionTarget` condition을 받는다**. `reason`으로 원인
구분 가능.

| reason | 의미 |
|--------|------|
| `EvictionByEvictionAPI` | Eviction API(`kubectl drain` 등) |
| `PreemptionByScheduler` | 높은 우선순위 Pod에게 자리 양보 |
| `DeletionByTaintManager` | `NoExecute` taint로 삭제 |
| `DeletionByPodGC` | 노드가 사라져 GC 대상 |
| `TerminationByKubelet` | 노드 그레이스풀 종료·압박 eviction·시스템 critical preemption |

```bash
kubectl get pod web-0 -o jsonpath='{.status.conditions}' | jq
```

세부 원인이 `DisruptionTarget.reason`에 있으므로 장애 대응·postmortem
에서 evict 경로를 정확히 특정할 수 있다.

---

## 6. 드레인 stuck 디버깅 체크리스트

`kubectl drain <node>`가 멈췄을 때 순서대로 본다.

1. **PDB 존재 여부**
   ```bash
   kubectl get pdb -A -o wide
   ```
2. **disruptionsAllowed**가 0인 PDB 찾기.
3. **현재 healthy/desired 차이** 확인 — 애초에 Pod이 부족한 상태라면
   PDB가 아니라 **워크로드 자체 문제**.
4. **unhealthyPodEvictionPolicy** 확인 — 기본값이면 `AlwaysAllow`로
   변경 후 재시도.
5. **셀렉터 매칭 Pod 수** — `kubectl get pods -l <selector>`. 라벨
   불일치로 `expectedPods=0`일 때는 PDB가 유효하지 않음(이 경우
   드레인을 막지 않는다).
6. **다중 PDB 중첩** — 한 Pod이 두 PDB에 매칭되면 **가장 엄격한 쪽**
   이 강제된다. 의도치 않은 중첩이 잦다.
7. **Terminating 상태로 멈춘 Pod** — finalizer·`preStop` 장기 대기·
   볼륨 detach 지연. PDB 문제가 아니라
   [Graceful Shutdown](./graceful-shutdown.md) 이슈.

### 마지막 수단

```bash
# PDB 일시 완화 — 권장 경로. 드레인이 끝나면 원복
kubectl patch pdb <name> --type merge -p '{"spec":{"minAvailable":1}}'

# PDB 우회, API server에서 Pod 객체 즉시 제거
# kubelet의 실제 종료를 기다리지 않음 → 워커에 고아 Pod 잔존 위험
kubectl delete pod <name> --grace-period=0 --force
```

**`--force` 주의**: 이 명령은 eviction API를 쓰지 않고 **API server
스토리지에서 Pod 객체를 즉시 삭제**한다. kubelet이 아직 컨테이너를
종료하지 않았다면 **워커 노드에 프로세스가 계속 살아 있는 고아
상태**가 된다. 쿼럼 앱에서 이 상태는 **split-brain**의 직접 원인
이므로 stateful·쿼럼 워크로드에서는 절대 금지. stateless 앱이라도
`preStop`·graceful shutdown 경로를 건너뛰므로 in-flight 요청 실패가
발생한다.

---

## 7. Autoscaler와의 상호작용

### Cluster Autoscaler

- scale-down은 **빈 노드만** 제거하는 것이 기본. PDB가 빡빡하면 Pod
  재배치가 막혀 **유휴 노드가 영구적으로 살아남는다**. 월 단위 비용
  낭비의 흔한 원인.
- 워크로드에 PDB를 두지 않으면 scale-down이 공격적으로 Pod을 옮길 수
  있어 가용성 리스크.
- 권장: 프로덕션 워크로드는 **반드시 PDB** + `maxUnavailable`로
  relative 값 사용. 비용·가용성 모두 합리적.

### Karpenter

- **consolidation** 정책이 더 공격적이라 PDB와 더 자주 부딪힌다.
- `disruptionsAllowed=0`인 PDB가 있으면 해당 노드의 consolidation
  이 skip된다. 추적은 Karpenter 이벤트에서:
  ```bash
  kubectl get events -A --field-selector reason=DisruptionBlocked
  ```
- Karpenter `disruption.karpenter.sh/do-not-disrupt` 어노테이션은
  **PDB와 별개 계층**. Pod이 완전히 consolidation 대상에서 빠진다.
  PDB로는 부족한 특수 케이스에만 쓴다(롱 배치 Job 등).

### HPA·KEDA

- 스케일 아웃 중 추가된 Pod이 Ready 되기 전에는 `currentHealthy`가
  늘지 않는다. 동시 드레인과 겹치면 잠시 disruptionsAllowed=0.
- 스케일 인으로 replicas가 `minAvailable`에 근접·동일해지면 드레인이
  막힌다. `maxUnavailable: "20%"` 같은 상대값이 이 문제 회피.

---

## 8. 다중 PDB·네임스페이스 기본값

### 다중 PDB 중첩

한 Pod이 여러 PDB의 셀렉터에 매칭되면 **eviction API는 매칭된
모든 PDB의 `disruptionsAllowed > 0`을 AND로 요구**한다. 하나라도
예산이 0이면 전체 eviction 거절. 결과적으로 "가장 엄격한 쪽이
강제된다".

실수 패턴:

- 팀 전체를 덮는 "넓은" PDB + 개별 앱 "좁은" PDB
- 라벨 재사용으로 다른 워크로드가 예상 외로 매칭
- 자동화가 생성한 PDB와 수동 생성 PDB의 중복

진단 쿼리:

```bash
# 특정 Pod에 매칭되는 모든 PDB 확인
kubectl get pdb -A -o json | jq -r --arg ns team-a --arg pod web-0 '
  .items[]
  | select(.metadata.namespace == $ns)
  | {name: .metadata.name, selector: .spec.selector, allowed: .status.disruptionsAllowed}
'
```

전체 클러스터 단위로는 `kubectl get pdb -A -o wide`의 `SELECTOR`
컬럼을 주기 감사. 중첩 탐지 도구(`kube-lineage`·`kubepug`) 활용
가능.

### 네임스페이스 기본 PDB

흔히 "팀 네임스페이스에 기본 PDB를 깔아 두고 싶다"는 요구가 나온다.
**빈 셀렉터는 네임스페이스 전역을 잡지만, 실수·부작용이 크다**. 권장:

- Gatekeeper·[VAP](../extensibility/validating-admission-policy.md)로
  "프로덕션 네임스페이스의 모든 Deployment·StatefulSet은 PDB 필수"를
  검증.
- 자동 생성이 꼭 필요하면 Kyverno `generate` 규칙으로 **워크로드별
  셀렉터를 가진 PDB를 자동 생성**.
- 빈 셀렉터 PDB는 특수 상황(네임스페이스 동결 등) 외엔 쓰지 않는다.

---

## 9. 롤링 업데이트와의 관계

Deployment·StatefulSet의 `strategy`는 **PDB와 완전히 별개 경로**다.
롤링 업데이트는 Eviction API를 쓰지 않고 워크로드 컨트롤러가 직접
Pod을 내린다.

| 경로 | PDB 적용 | 제어 수단 |
|------|:--------:|----------|
| 롤링 업데이트 | ❌ | `strategy.rollingUpdate.{maxSurge,maxUnavailable}` |
| 노드 드레인 | ✅ | PDB |
| CA·Karpenter 종료 | ✅ | PDB |
| 직접 `kubectl delete pod` | ❌ | 없음(운영자 책임) |
| Scheduler Preemption | ❌ | PriorityClass |

두 설정 모두가 필요하다. 팀들이 "`maxUnavailable`을 이미 설정했으니
PDB는 필요 없다"고 오해하는 경우가 많다.

> **Preemption은 막지 않지만 흔적은 남긴다**. scheduler preemption
> 시 evict 대상 Pod에 `DisruptionTarget=PreemptionByScheduler`
> condition이 부착되며, 관련 이벤트·메트릭이 발생한다. PDB가
> preemption을 **거절하지는 못하지만**, 관측·추적 경로는 동일하므로
> postmortem 시 Eviction API 경로와 합쳐 분석할 수 있다.

### 권장 조합 (stateless, replicas=10)

```yaml
# Deployment
strategy:
  rollingUpdate:
    maxSurge: 2
    maxUnavailable: 1
---
# PDB
spec:
  maxUnavailable: "20%"      # replicas 증감에 자동 대응
  unhealthyPodEvictionPolicy: AlwaysAllow
```

---

## 10. 관측

| 메트릭 | 출처 | 의미 |
|--------|------|------|
| `kube_poddisruptionbudget_status_current_healthy` | kube-state-metrics | 현재 healthy |
| `kube_poddisruptionbudget_status_desired_healthy` | kube-state-metrics | desired 최소치 |
| `kube_poddisruptionbudget_status_pod_disruptions_allowed` | kube-state-metrics | 즉시 evict 가능 수 |
| `kube_poddisruptionbudget_status_expected_pods` | kube-state-metrics | 셀렉터 매칭 Pod 수 |
| `apiserver_admission_controller_admission_duration_seconds{name="PodDisruptionBudget"}` | apiserver | eviction 체크 지연 |

알람 예시:

- `pod_disruptions_allowed == 0` 이 **30분 지속**되면 경고 — 드레인
  직전 상태이거나, stuck 예측.
- `current_healthy < desired_healthy` 5분 지속 — 워크로드 degraded
  이면서 동시에 PDB가 드레인을 차단 중임을 의미.
- `expected_pods == 0` — **셀렉터 오설정**(가장 흔한 사고).

---

## 11. 운영 체크리스트

- [ ] 모든 프로덕션 워크로드(replicas ≥ 2)에 PDB가 있다.
- [ ] `minAvailable` 대신 `maxUnavailable`(또는 `%`) 사용을 우선
      고려 — 스케일링 대응·드레인 stuck 회피.
- [ ] **`unhealthyPodEvictionPolicy: AlwaysAllow`**. 기본값은
      드레인 stuck 유발.
- [ ] `policy/v1` 사용. `policy/v1beta1` 남아 있으면 제거(1.25에서
      제거됨).
- [ ] 빈 셀렉터 PDB 금지. 의도된 경우만 허용하고 리뷰.
- [ ] 단일 replica 워크로드는 PDB로 지키지 않는다(드레인 차단). 단일
      replica가 필요하면 `PriorityClass`·노드 taint로 별도 보호.
- [ ] Stateful 쿼럼(etcd·Kafka·ZK)은 `maxUnavailable: 1` 고정.
- [ ] Cluster Autoscaler·Karpenter consolidation 관점에서 PDB가
      과도하게 막고 있지 않은지 `DisruptionBlocked` 이벤트 주기
      감사.
- [ ] `kube-state-metrics` 기반 PDB 상태 알람
      (`kube_poddisruptionbudget_status_pod_disruptions_allowed == 0`
      지속, `kube_poddisruptionbudget_status_expected_pods == 0`).
- [ ] 롤링 업데이트 strategy와 **동시에** 설정. 둘은 별개 경로.
- [ ] 다중 PDB 중첩 감사(`kubectl get pdb -A -o wide`의 셀렉터).
- [ ] 네임스페이스 단위 강제는 Kyverno 또는
      [VAP](../extensibility/validating-admission-policy.md)로 구현.
      빈 셀렉터 꼼수 금지.
- [ ] 드레인 stuck 런북 문서화: `disruptionsAllowed` 확인 →
      `unhealthyPodEvictionPolicy` 점검 → `DisruptionTarget` 조건 →
      last-resort(`--grace-period=0 --force`는 쿼럼 앱 제외).

---

## 참고 자료

- Kubernetes 공식 — Disruptions:
  https://kubernetes.io/docs/concepts/workloads/pods/disruptions/
- Kubernetes 공식 — Specifying a Disruption Budget:
  https://kubernetes.io/docs/tasks/run-application/configure-pdb/
- Kubernetes 공식 — PodDisruptionBudget v1 API:
  https://kubernetes.io/docs/reference/kubernetes-api/policy-resources/pod-disruption-budget-v1/
- Kubernetes Blog — Eviction policy for unhealthy pods guarded by PDBs
  (1.26 beta):
  https://kubernetes.io/blog/2023/01/06/unhealthy-pod-eviction-policy-for-pdbs/
- KEP-3017 Pod Healthy Policy for PDB (Alpha 1.26 → Beta 1.27 → GA 1.31):
  https://github.com/kubernetes/enhancements/tree/master/keps/sig-apps/3017-pod-healthy-policy-for-pdb
- kube-state-metrics — PodDisruptionBudget 메트릭 정의:
  https://github.com/kubernetes/kube-state-metrics/blob/main/docs/metrics/policy/poddisruptionbudget-metrics.md
- Kubernetes 공식 — Pod Conditions (DisruptionTarget):
  https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-conditions
- Karpenter — Disruption:
  https://karpenter.sh/docs/concepts/disruption/
- Cluster Autoscaler FAQ:
  https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/FAQ.md

확인 날짜: 2026-04-24
