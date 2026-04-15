---
title: "Finalizer와 Stuck 리소스 처리"
date: 2026-04-14
tags:
  - kubernetes
  - finalizer
  - troubleshooting
  - stuck
sidebar_label: "Finalizer·Stuck 리소스"
---

# Finalizer와 Stuck 리소스 처리

## 1. Finalizer란

리소스 삭제 전 컨트롤러가 정리 작업을 수행하도록 막는 장치다.

```
kubectl delete pod <name>
    ↓
API 서버: deletionTimestamp 설정 (리소스 유지)
    ↓
상태: Terminating
    ↓
컨트롤러: 정리 작업 수행
    ↓
컨트롤러: finalizer 제거
    ↓
finalizers 비어있으면 → 실제 삭제
```

```yaml
# Finalizer 예시
metadata:
  name: my-pvc
  finalizers:
  - kubernetes.io/pvc-protection       # 내장 PVC 보호
  - myoperator.io/volume-cleanup       # 커스텀 오퍼레이터
```

---

## 2. Stuck 발생 시나리오

| 시나리오 | 원인 |
|---------|------|
| Namespace Terminating | 내부 리소스에 finalizer, 컨트롤러 중단 |
| PVC Terminating | 스냅샷/백업 오퍼레이터 미완료 |
| CRD Terminating | CR 인스턴스가 남아있음 |
| Pod Terminating | 컨트롤러 없음, grace period 초과 |

---

## 3. Stuck 리소스 진단

```bash
# Terminating 상태 리소스 조회
# ⚠️ get all은 CRD 리소스를 조회하지 않는다.
# CRD 리소스 확인은 아래 섹션 4의 api-resources 방식을 사용한다.
kubectl get all -A \
  | grep Terminating

# Finalizer 확인
kubectl get <resource> <name> -n <ns> \
  -o jsonpath='{.metadata.finalizers}'

# 삭제 타임스탬프 확인
kubectl get <resource> <name> -n <ns> \
  -o jsonpath='{.metadata.deletionTimestamp}'

# 관련 이벤트
kubectl get events -n <ns> \
  --sort-by='.lastTimestamp'
```

---

## 4. Namespace Stuck in Terminating

가장 흔한 케이스. 내부 리소스나 CRD가 정리되지 않은 경우다.

```bash
# 1. 네임스페이스 finalizer 확인
kubectl get ns <ns> -o jsonpath=\
'{.metadata.finalizers}'

# 2. 내부 남은 리소스 확인
kubectl api-resources --verbs=list \
  --namespaced -o name \
  | xargs -I {} kubectl get {} \
    -n <ns> --ignore-not-found 2>/dev/null \
  | grep -v "^$"

# 3. finalizer 제거
kubectl patch ns <ns> \
  -p '{"metadata":{"finalizers":null}}' \
  --type=merge
```

---

## 5. PVC Stuck in Terminating

```bash
# 1. PVC finalizer 확인
kubectl get pvc <pvc> -n <ns> \
  -o jsonpath='{.metadata.finalizers}'
# kubernetes.io/pvc-protection 이면
# → 사용 중인 Pod가 있음

# 2. PVC를 사용 중인 Pod 확인
kubectl get pods -n <ns> -o json \
  | jq '.items[] | select(.spec.volumes[]?.persistentVolumeClaim.claimName=="<pvc>") | .metadata.name'

# 3. Pod 삭제 후 PVC 자동 삭제 확인
# (Pod가 없으면 PVC도 자동으로 사라짐)

# 4. 그래도 Stuck이면 finalizer 제거
kubectl patch pvc <pvc> -n <ns> \
  -p '{"metadata":{"finalizers":null}}' \
  --type=merge
```

---

## 6. CRD Stuck in Terminating

```bash
# 1. CRD finalizer 확인
kubectl get crd <crd-name> \
  -o jsonpath='{.metadata.finalizers}'

# 2. 남은 CR 인스턴스 확인
kubectl get <cr-kind> -A

# 3. CR 인스턴스의 finalizer 제거
kubectl get <cr-kind> -A -o json \
  | jq -r '.items[] | "\(.metadata.name) \(.metadata.namespace)"' \
  | while read name ns; do
    kubectl patch <cr-kind> $name -n $ns \
      -p '{"metadata":{"finalizers":null}}' \
      --type=merge
  done

# 4. CRD finalizer 제거
kubectl patch crd <crd-name> \
  -p '{"metadata":{"finalizers":null}}' \
  --type=merge
```

---

## 7. Finalizer 제거 방법

### patch (권장)

```bash
# 전체 finalizer 제거
kubectl patch <resource> <name> -n <ns> \
  -p '{"metadata":{"finalizers":null}}' \
  --type=merge

# 특정 finalizer 하나만 제거
kubectl patch <resource> <name> -n <ns> \
  --type json \
  -p='[{"op":"remove","path":"/metadata/finalizers/0"}]'
```

### edit (대화형)

```bash
kubectl edit <resource> <name> -n <ns>
# finalizers: [] 로 수정 후 저장
```

---

## 8. 강제 삭제

```bash
# 정상 종료 대기 없이 즉시 삭제
kubectl delete pod <name> \
  --grace-period=0 --force
```

> **주의**: StatefulSet Pod를 강제 삭제하면 데이터 손실 위험이 있다.
> EBS/Longhorn(RWO) 볼륨은 이전 노드에서 detach 완료 전
> 새 Pod의 attach 시도로 마운트 실패 또는 데이터 손상이 발생할 수 있다.

---

## 9. Owner References

부모 리소스가 삭제되면 자식도 연쇄 삭제된다.

```bash
# Owner Reference 확인
kubectl get pod <pod> -o jsonpath=\
'{.metadata.ownerReferences}'
```

```json
[{
  "apiVersion": "apps/v1",
  "kind": "ReplicaSet",
  "name": "myapp-rs-12345",
  "uid": "abc123",
  "controller": true,
  "blockOwnerDeletion": true
}]
```

| `blockOwnerDeletion` | 동작 |
|---------------------|------|
| `true` | 자식에 finalizer 있으면 부모 삭제 대기 |
| `false` | 자식 상태와 관계없이 부모 삭제 가능 |

---

## 10. etcd 직접 조작 (최후 수단)

API 서버로 해결 안 될 때만 사용한다.

```bash
# etcd Pod에 접근
kubectl exec -it etcd-<node> -n kube-system -- sh

# etcdctl로 리소스 조회
ETCDCTL_API=3 etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  get --prefix /registry/namespaces/<ns>

# etcd에서 직접 삭제 (극히 위험)
ETCDCTL_API=3 etcdctl del \
  /registry/pods/<ns>/<pod-name>
```

> etcd 직접 조작 후 변경사항은 watch 메커니즘으로 API 서버에 자동 반영된다.
> API 서버 재시작은 불필요하며 오히려 서비스 중단을 유발한다.
> 클러스터 전체에 영향을 미칠 수 있으므로 최후 수단으로만 사용한다.

---

## 빠른 참조

```bash
# 전체 Terminating 리소스 조회
kubectl get all -A | grep Terminating

# finalizer 일괄 확인
kubectl get pods -A -o json \
  | jq '.items[] | select(.metadata.finalizers != null) | .metadata.name'

# 네임스페이스 강제 삭제 (kubectl proxy 방식)
kubectl proxy &
curl -k -H "Content-Type: application/json" \
  -X PUT --data-binary @- \
  http://127.0.0.1:8001/api/v1/namespaces/<ns>/finalize << EOF
{
  "apiVersion": "v1",
  "kind": "Namespace",
  "metadata": {"name": "<ns>"},
  "spec": {"finalizers": []}
}
EOF
```

---

## 참고 문서

- [Finalizers](https://kubernetes.io/docs/concepts/overview/working-with-objects/finalizers/)
- [Using Finalizers to Control Deletion](https://kubernetes.io/blog/2021/05/14/using-finalizers-to-control-deletion/)
- [Troubleshoot Terminating Namespaces](https://www.redhat.com/en/blog/troubleshooting-terminating-namespaces)
