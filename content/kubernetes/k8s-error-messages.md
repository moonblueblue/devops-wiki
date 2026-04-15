---
title: "리소스별 에러 메시지 유형과 해결"
date: 2026-04-14
tags:
  - kubernetes
  - troubleshooting
  - error
  - debugging
sidebar_label: "에러 유형과 해결"
---

# 리소스별 에러 메시지 유형과 해결

## 1. Pod 에러

### CrashLoopBackOff

| 원인 | 확인 방법 | 해결 |
|-----|---------|------|
| 앱 크래시 | `kubectl logs --previous` | 앱 버그 수정 |
| 설정 오류 | Events 확인 | ConfigMap/Secret 검토 |
| 메모리 부족 | `kubectl top pod` | 메모리 limit 증가 |
| Probe 설정 오류 | YAML spec 확인 | initialDelaySeconds 증가 |

```bash
kubectl logs <pod> --previous
kubectl describe pod <pod> | grep -A 10 "Last State:"
```

---

### ImagePullBackOff

```bash
# 진단
kubectl describe pod <pod> | grep "Failed to pull"

# 이미지 존재 확인
docker manifest inspect <image>:<tag>

# 풀 시크릿 생성
kubectl create secret docker-registry regcred \
  --docker-server=ghcr.io \
  --docker-username=myuser \
  --docker-password=mytoken \
  -n <ns>
```

```yaml
# Pod에 imagePullSecrets 추가
spec:
  imagePullSecrets:
  - name: regcred
  containers:
  - name: app
    image: ghcr.io/myorg/myapp:v1.0.0
```

---

### OOMKilled

```bash
# 진단
kubectl describe pod <pod> | grep "OOMKilled\|Exit Code"
kubectl top pod <pod> --containers

# 노드 OOM 이벤트
kubectl get events -n <ns> \
  --field-selector reason=OOMKilling
```

```yaml
# 메모리 limit 증가
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "1Gi"   # OOMKill 재발 시 증가
```

---

### Evicted

```bash
# 진단
kubectl describe pod <pod> | grep "Eviction\|reason:"

# 노드 압박 상태 확인
kubectl describe node <node> | grep -A 5 "Conditions:"
```

```
# 자주 보이는 메시지
The node was low on resource: memory.
The node was low on resource: ephemeral-storage.
```

```bash
# 노드 디스크 정리
kubectl debug node/<node> -it --image=ubuntu -- bash
# 내부에서: df -h, du -sh /var/log/*

# 이미지 정리 (containerd)
crictl rmi --prune
```

---

### Terminating (stuck)

```bash
# Finalizer 확인
kubectl get pod <pod> -o jsonpath=\
'{.metadata.finalizers}'

# Finalizer 강제 제거
kubectl patch pod <pod> \
  -p '{"metadata":{"finalizers":null}}' \
  --type=merge

# 강제 삭제
kubectl delete pod <pod> \
  --grace-period=0 --force
```

---

## 2. Deployment 에러

### Unavailable Replicas

```bash
# 진단
kubectl rollout status deployment/<name>
kubectl describe deployment <name> \
  | grep -A 5 "Conditions:"

# ReplicaSet 확인
kubectl get rs -l app=<app>
kubectl describe rs <rs-name> | grep "Events:" -A 10
```

```
# 자주 보이는 메시지
Waiting for deployment "myapp" rollout to finish:
  1 out of 3 new replicas have been updated...

→ 신규 Pod가 Ready 안 됨. Pod 상태 개별 확인
```

---

### 롤아웃 멈춤

```bash
# 진단
kubectl rollout history deployment/<name>
kubectl get events -n <ns> \
  --sort-by='.lastTimestamp'

# 이전 버전으로 롤백
kubectl rollout undo deployment/<name>

# 특정 revision으로 롤백
kubectl rollout undo deployment/<name> \
  --to-revision=2
```

---

## 3. Service 에러

### Endpoints 없음

```bash
# 진단 (K8s 1.33+ 권장)
kubectl get endpointslices -l kubernetes.io/service-name=<svc-name>
# → 출력 없으면 Pod 연결 안 됨

# 라벨 셀렉터 일치 여부 확인
kubectl get svc <svc> -o jsonpath='{.spec.selector}'
kubectl get pods -l app=myapp --show-labels
```

```yaml
# Service selector와 Pod label이 일치해야 함
# Service
spec:
  selector:
    app: myapp    # ← 이 라벨을

# Pod
metadata:
  labels:
    app: myapp    # ← Pod가 가지고 있어야 함
```

---

### Connection Refused

```bash
# 진단 순서
# 1. EndpointSlice 확인 (K8s 1.33+ 권장)
kubectl get endpointslices -l kubernetes.io/service-name=<svc>

# 2. Pod 포트 확인
kubectl get pod <pod> -o yaml \
  | grep -A 3 "ports:"

# 3. 직접 연결 테스트
kubectl port-forward svc/<svc> 8080:80
curl -v http://localhost:8080

# 4. 네트워크 폴리시 확인
kubectl get networkpolicies -n <ns>
```

---

## 4. PVC 에러

### Pending PVC

```bash
# 진단
kubectl describe pvc <pvc-name>
# Events: no persistent volumes available
#         storageclass not found

# StorageClass 확인
kubectl get storageclass

# PV 목록 확인 (정적 프로비저닝)
kubectl get pv
```

```
# 자주 보이는 메시지
no persistent volumes available for this claim
  → PV 없음 또는 조건 불일치

storageclass.storage.k8s.io "fast-ssd" not found
  → StorageClass 이름 오타
```

---

### ReadOnly Filesystem

```bash
# 진단
kubectl get pvc <pvc> -o yaml \
  | grep accessModes
kubectl logs <pod> | grep -i "read-only\|EROFS"
```

```yaml
# AccessMode 수정
spec:
  accessModes:
  - ReadWriteOnce   # ReadOnlyMany에서 변경
```

---

## 5. Node 에러

### NotReady

```bash
# 진단
kubectl describe node <node> \
  | grep -A 10 "Conditions:"

# 노드에서 kubelet 상태 확인
ssh <node-ip>
sudo systemctl status kubelet
sudo journalctl -u kubelet -n 100
```

```bash
# kubelet 재시작
sudo systemctl restart kubelet

# 정상화 후 uncordon
kubectl uncordon <node>
```

---

### DiskPressure

```bash
# 진단
kubectl describe node <node> \
  | grep "DiskPressure\|Allocatable"
df -h /var/lib/containerd

# 정리 방법
# 1. 미사용 이미지 제거
crictl rmi --prune

# 2. 컨테이너 로그 정리
journalctl --vacuum-size=1G

# 3. 만료된 컨테이너 제거
crictl rm $(crictl ps -a -q)
```

```yaml
# /var/lib/kubelet/config.yaml - containerd 환경 로그 제한
# (kubelet 설정 후 systemctl restart kubelet)
containerLogMaxSize: "10Mi"
containerLogMaxFiles: 3
```

---

### MemoryPressure / PIDPressure

```bash
# 메모리 압박
kubectl top node <node>
free -h

# PID 압박
ps aux | wc -l
ps aux | grep defunct   # 좀비 프로세스

# Eviction 임계값 확인
kubectl describe node <node> \
  | grep "Eviction\|threshold"
```

---

## 빠른 진단 요약

```bash
# 문제 있는 Pod 일괄 조회
kubectl get pods -A \
  | grep -v "Running\|Completed"

# 최근 이벤트 (문제 파악용)
kubectl get events -A \
  --sort-by='.lastTimestamp' \
  | tail -20

# 노드 전체 리소스 현황
kubectl top nodes
kubectl describe nodes \
  | grep -A 5 "Conditions:"
```

---

## 참고 문서

- [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Debug Services](https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/)
- [Node Health](https://kubernetes.io/docs/tasks/debug/debug-cluster/)
