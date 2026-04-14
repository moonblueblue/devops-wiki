---
title: "Control Plane (API Server, etcd, Scheduler, Controller Manager)"
date: 2026-04-14
tags:
  - kubernetes
  - control-plane
  - apiserver
  - etcd
  - scheduler
sidebar_label: "Control Plane"
---

# Control Plane

## 1. kube-apiserver

모든 K8s 조작의 단일 진입점이다.
etcd와 직접 통신하는 유일한 구성요소다.

### 인증 → 인가 → Admission 흐름

```
kubectl apply -f pod.yaml
      ↓
1. 인증 (Authentication)
   누구인가? (인증서, Bearer Token, OIDC)
      ↓
2. 인가 (Authorization)
   무엇을 할 수 있는가? (RBAC)
      ↓
3. Admission
   - Mutating Webhook (리소스 변경)
   - Validating Webhook (검증)
      ↓
etcd에 저장
```

```bash
# API Server 상태
kubectl get pods -n kube-system -l component=kube-apiserver

# 현재 사용자 권한 확인
kubectl auth can-i create pods
kubectl auth can-i create pods --as=jane

# RBAC 조회
kubectl get clusterroles
kubectl get rolebindings -n default
```

---

## 2. etcd

클러스터의 모든 상태를 저장하는 분산 키-값 저장소다.
**etcd를 잃으면 클러스터 전체를 잃는다.**

### Raft 합의

```
etcd 3개 노드:
  Node A (Leader) → Node B, C에 데이터 복제
  2/3 이상 동의 시 커밋
  Leader 장애 → 자동으로 새 Leader 선출
```

### 백업 (필수)

```bash
# 스냅샷 백업
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /backup/etcd-$(date +%Y%m%d).db

# 백업 검증
ETCDCTL_API=3 etcdctl snapshot status /backup/etcd-20260414.db

# 복구
ETCDCTL_API=3 etcdctl snapshot restore \
  /backup/etcd-20260414.db \
  --data-dir=/var/lib/etcd-restored

# 멤버 상태 확인
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  member list
```

> etcd 백업은 최소 1일 1회, 클러스터 변경 전 반드시 수행한다.

---

## 3. kube-scheduler

스케줄되지 않은 Pod을 적합한 Node에 배치한다.

### 스케줄링 단계

```
1. Filtering (필터링)
   후보 Node 목록 생성
   - CPU/Memory 여유 있는가?
   - NodeSelector 일치하는가?
   - Taint 허용되는가?
   → 결과: [Node-1, Node-3, Node-5]

2. Scoring (점수 매기기)
   각 후보 Node에 0-100점 부여
   - 리소스 균형 점수
   - 이미지 로컬리티 점수
   - Pod Affinity 점수
   → Node-1: 85점, Node-3: 70점

3. 최고 점수 Node에 Pod 배치
```

```bash
# 스케줄링 안 된 Pod 확인
kubectl get pods --field-selector=status.phase=Pending

# 스케줄링 실패 원인 확인
kubectl describe pod <pod-name>
# Events 섹션 확인
```

---

## 4. kube-controller-manager

**제어 루프(Reconciliation Loop)** 를 실행한다.
선언된 상태(Desired)와 현재 상태(Current)의 차이를 감지하고 수정한다.

```
감시: etcd에서 리소스 변경 이벤트 수신
비교: Desired state vs Current state
행동: 차이 해소 (Pod 생성/삭제 등)
      ↓ 반복
```

### 내장 컨트롤러

| 컨트롤러 | 역할 |
|---------|------|
| Deployment | ReplicaSet 관리, 롤링 업데이트 |
| ReplicaSet | Pod 개수 유지 |
| StatefulSet | 순서가 있는 Pod 관리 |
| DaemonSet | 모든 Node에 Pod 배치 |
| Job / CronJob | 일회성 / 반복 작업 |
| Endpoint | Service ↔ Pod 매핑 |
| Namespace | 리소스 격리 |
| GarbageCollector | 고아 리소스 정리 |

```bash
# Deployment 상태 추적
kubectl rollout status deployment/nginx
kubectl rollout history deployment/nginx

# 롤백
kubectl rollout undo deployment/nginx
kubectl rollout undo deployment/nginx --to-revision=2
```

---

## 5. cloud-controller-manager

CSP(클라우드 서비스 제공자)의 API를 호출한다.
온프레미스 환경에서는 불필요하다.

| 컨트롤러 | 기능 |
|---------|------|
| Node | EC2/VM 상태 동기화 |
| Service | LoadBalancer 프로비저닝 (ELB 등) |
| PersistentVolume | EBS/GCP PD/Azure Disk 할당 |
| Route | VPC 라우팅 설정 |

```yaml
# Service type: LoadBalancer → CSP가 자동으로 LB 생성
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: LoadBalancer
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 8080
```

---

## 참고 문서

- [kube-apiserver](https://kubernetes.io/docs/reference/command-line-tools-reference/kube-apiserver/)
- [etcd](https://etcd.io/docs/)
- [kube-scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/)
- [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/)
