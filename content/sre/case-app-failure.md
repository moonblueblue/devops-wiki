---
title: "실전 케이스: 서버 애플리케이션 장애"
date: 2026-04-14
tags:
  - sre
  - incident-case
  - application
  - debugging
sidebar_label: "케이스: 앱 장애"
---

# 실전 케이스: 서버 애플리케이션 장애

## 1. OOMKilled (메모리 부족)

```
증상: Pod가 반복적으로 재시작
      kubectl describe pod → OOMKilled

진단:
  kubectl describe pod <name> | grep -A5 "Last State"
  # Exit Code: 137 = OOMKilled

원인:
  □ 메모리 누수
  □ limits 너무 낮게 설정
  □ 트래픽 급증으로 메모리 초과
```

```bash
# 메모리 사용량 추이 확인
kubectl top pod <name> --containers

# Prometheus로 메모리 패턴 분석
container_memory_working_set_bytes{
  pod=~"payment-.*"
}
```

```yaml
# 임시 조치: limits 증가
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "1Gi"    # 기존 512Mi → 1Gi
```

---

## 2. CrashLoopBackOff

```
증상: Pod가 계속 크래시 후 재시작
      상태: CrashLoopBackOff

진단 순서:
  1. kubectl logs <pod> --previous
     → 직전 크래시 로그 확인
  2. kubectl describe pod <pod>
     → 이벤트, 종료 원인 확인
  3. kubectl logs <pod> -f
     → 현재 시작 로그 실시간 확인
```

```bash
# 초기화 컨테이너 실패인 경우
kubectl logs <pod> -c <init-container-name>

# 이미지 실행 오류 디버깅
kubectl run debug --rm -it \
  --image=<문제이미지> -- /bin/sh
```

---

## 3. 느린 응답 (레이턴시 급증)

```bash
# 1단계: 레이턴시 확인
kubectl top pod -n production
# CPU throttling 확인:
kubectl get pod <name> -o yaml | grep -A5 resources

# 2단계: 스레드 덤프 (Java)
kubectl exec <pod> -- \
  kill -3 $(pgrep java)
kubectl logs <pod> | tail -200

# 3단계: Go pprof
kubectl exec <pod> -- \
  curl localhost:6060/debug/pprof/goroutine

# 4단계: 의존성 확인
kubectl exec <pod> -- \
  curl -w "@/dev/stdin" -o /dev/null \
  http://database:5432/health <<< \
  "time_total: %{time_total}\n"
```

---

## 4. 배포 후 장애 (Deployment 이슈)

```bash
# 롤링 업데이트 중 오류 감지
kubectl rollout status deployment/payment -w

# 즉시 롤백
kubectl rollout undo deployment/payment

# 특정 버전으로 롤백
kubectl rollout undo deployment/payment \
  --to-revision=3

# 롤아웃 이력 확인
kubectl rollout history deployment/payment
```

---

## 5. 진단 체크리스트

```
애플리케이션 장애 진단 순서:

□ Pod 상태 확인 (Running/Pending/CrashLoopBackOff)
□ 최근 배포/변경 이력 확인
□ 로그 확인 (현재 + 이전 크래시)
□ 리소스 사용량 (CPU/메모리)
□ 의존 서비스 상태 (DB, 캐시, 외부 API)
□ 환경 변수/시크릿 설정 확인
□ 헬스체크 엔드포인트 응답
□ 네트워크 접근성 (서비스, 인그레스)
```

---

## 참고 문서

- [K8s 디버깅 가이드](https://kubernetes.io/docs/tasks/debug/debug-application/)
- [kubectl 트러블슈팅](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
