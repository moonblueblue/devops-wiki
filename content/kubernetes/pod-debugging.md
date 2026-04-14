---
title: "파드가 안 뜰 때 디버깅 순서"
date: 2026-04-14
tags:
  - kubernetes
  - debugging
  - troubleshooting
  - pod
sidebar_label: "파드 디버깅"
---

# 파드가 안 뜰 때 디버깅 순서

## 1. 파드 상태별 원인 요약

| 상태 | 주요 원인 |
|-----|---------|
| `Pending` | 리소스 부족, 노드 셀렉터 불일치, PVC 미바인딩 |
| `CrashLoopBackOff` | 앱 크래시, 설정 오류, 의존성 누락 |
| `ImagePullBackOff` | 이미지 없음, 크리덴셜 오류, 레지스트리 접근 불가 |
| `OOMKilled` | 메모리 한계 초과 (exit code 137) |
| `Evicted` | 노드 디스크·메모리·PID 부족 |
| `Terminating` | Finalizer 대기, 컨트롤러 중단 |

---

## 2. 디버깅 순서

```
1. kubectl get pods → 상태 확인
2. kubectl describe pod → Events 섹션 분석
3. kubectl logs → 앱 로그 확인
4. kubectl top pod → 리소스 사용량 확인
5. kubectl describe node → 노드 상태 확인
6. kubectl debug → 에피머럴 컨테이너로 직접 접근
```

---

## 3. 핵심 명령어

```bash
# 1. 전체 파드 상태
kubectl get pods -A -o wide

# 2. 이벤트 확인 (Events 섹션이 핵심)
kubectl describe pod <pod-name> -n <ns>

# 3. 앱 로그
kubectl logs <pod> -n <ns>
kubectl logs <pod> -n <ns> --previous    # 이전 컨테이너 로그
kubectl logs <pod> -n <ns> -c <container> # 컨테이너 지정

# 4. 리소스 사용량
kubectl top pod <pod> --containers

# 5. 노드 상태
kubectl describe node <node-name>

# 6. 이벤트 시간순 정렬
kubectl get events -n <ns> \
  --sort-by='.lastTimestamp'
```

---

## 4. Pending 디버깅

```bash
kubectl describe pod <pod> | grep -A 20 "Events:"
```

```
# 자주 보이는 Event 메시지
0/3 nodes are available: 3 Insufficient memory.
  → 메모리 요청량 줄이거나 노드 증설

0/3 nodes are available: 3 node(s) had taint...
  → Toleration 추가 필요

no nodes matched affinity rules
  → nodeAffinity 또는 nodeSelector 수정

pod has unbound immediate PersistentVolumeClaims
  → PVC Pending 상태 확인
```

---

## 5. CrashLoopBackOff 디버깅

```bash
# 이전 크래시 로그 확인 (핵심)
kubectl logs <pod> --previous

# 재시작 횟수 확인
kubectl get pod <pod> -o wide
# RESTARTS 컬럼 확인

# 종료 코드 확인
kubectl describe pod <pod> | grep "Exit Code"
```

| Exit Code | 의미 |
|-----------|------|
| 1 | 앱 오류 |
| 137 | OOMKilled (SIGKILL) |
| 143 | 정상 종료 (SIGTERM) |
| 127 | 명령어 없음 |

---

## 6. ImagePullBackOff 디버깅

```bash
kubectl describe pod <pod> | grep -A 5 "Failed to pull"
```

```
# 원인별 메시지
ErrImagePull: rpc error: code = NotFound
  → 이미지 태그 없음

Failed to pull image: unauthorized
  → 레지스트리 인증 실패

Failed to pull image: network timeout
  → 레지스트리 접근 불가
```

```bash
# 이미지 풀 시크릿 확인
kubectl get secrets -n <ns>
kubectl get serviceaccount default -n <ns> -o yaml

# 풀 시크릿 생성
kubectl create secret docker-registry regcred \
  --docker-server=docker.io \
  --docker-username=myuser \
  --docker-password=mypass \
  -n <ns>
```

---

## 7. OOMKilled 디버깅

```bash
# 메모리 사용량 확인
kubectl top pod <pod> --containers

# 현재 limit 확인
kubectl get pod <pod> -o jsonpath=\
'{.spec.containers[*].resources}'

# 이전 로그 (종료 직전)
kubectl logs <pod> --previous | tail -50
```

```yaml
# 메모리 limit 증가
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "512Mi"   # 증가
```

---

## 8. 에피머럴 컨테이너 (K8s 1.25+ GA)

실행 중인 Pod에 디버그 컨테이너를 삽입한다.
프로덕션 이미지에 디버그 도구를 넣을 필요가 없다.

```bash
# 네트워크 디버그 (curl, dig, tcpdump 포함)
kubectl debug -it <pod> \
  --image=nicolaka/netshoot -- bash

# 특정 컨테이너 네임스페이스에 접근
kubectl debug -it <pod> \
  --target=<container-name> \
  --image=ubuntu -- bash

# 노드 디버그
kubectl debug node/<node> \
  -it --image=ubuntu -- bash
```

### 자주 쓰는 디버그 이미지

| 이미지 | 용도 |
|-------|------|
| `nicolaka/netshoot` | 네트워크 (curl, dig, tcpdump, iperf) |
| `busybox` | 최소 도구 (sh, wget, ps) |
| `ubuntu` | 범용 Linux |
| `curlimages/curl` | HTTP 테스트 |

---

## 9. Probe 설정 문제

```bash
# probe 설정 확인
kubectl get pod <pod> -o yaml \
  | grep -A 15 "livenessProbe\|readinessProbe"

# probe 엔드포인트 직접 테스트
kubectl port-forward <pod> 8080:8080
curl -v http://localhost:8080/healthz
```

```yaml
# 자주 발생하는 실수: initialDelaySeconds 부족
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30   # 앱 시작 시간보다 길게
  periodSeconds: 10
  failureThreshold: 3
```

> **주의**: Liveness Probe는 로컬 프로세스 상태만 검사한다.
> 외부 DB 연결 등 의존성은 Readiness Probe에만 사용한다.

---

## 참고 문서

- [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/)
- [Ephemeral Containers](https://kubernetes.io/docs/concepts/workloads/pods/ephemeral-containers/)
- [Configure Liveness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
