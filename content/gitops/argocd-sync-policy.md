---
title: "ArgoCD Sync 정책과 Auto Sync"
date: 2026-04-14
tags:
  - argocd
  - gitops
  - sync
sidebar_label: "Sync 정책"
---

# ArgoCD Sync 정책과 Auto Sync

## 1. 수동 vs 자동 동기화

| 방식 | 설명 | 적합 환경 |
|-----|------|---------|
| 수동 (Manual) | UI/CLI에서 직접 sync 실행 | 프로덕션, 승인 필요 |
| 자동 (Automated) | Git 변경 감지 시 자동 적용 | 스테이징, 빠른 반영 |

---

## 2. syncPolicy 설정

```yaml
spec:
  syncPolicy:
    # 자동 동기화 활성화
    automated:
      prune: true       # Git에서 삭제된 리소스 제거
      selfHeal: true    # 수동 변경 감지 시 Git으로 복원
      allowEmpty: false # 빈 소스는 동기화 안 함 (안전장치)

    # 동기화 옵션
    syncOptions:
    - CreateNamespace=true          # 네임스페이스 자동 생성
    - PrunePropagationPolicy=foreground
    - RespectIgnoreDifferences=true
    - ApplyOutOfSyncOnly=true       # OutOfSync 리소스만 적용

    # 재시도 정책
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

---

## 3. selfHeal 동작

```
누군가 kubectl edit으로 직접 변경
    → App Controller가 diff 감지
        → OutOfSync 상태
            → selfHeal: true면 자동으로 Git 상태로 복원
            → selfHeal: false면 OutOfSync 상태 유지 (알림만)
```

---

## 4. prune 동작

```
Git에서 deployment.yaml 파일 삭제
    → 다음 sync 시
        → prune: true  → 클러스터에서도 Deployment 삭제
        → prune: false → 클러스터 리소스 그대로 유지
```

`prune: true`는 프로덕션에서 신중하게 설정해야 한다.
실수로 파일을 삭제하면 운영 중인 리소스가 제거될 수 있다.

---

## 5. ignoreDifferences

특정 필드의 드리프트를 무시한다.
HPA, 외부 컨트롤러가 자동 변경하는 필드에 유용하다.

```yaml
spec:
  ignoreDifferences:
  # HPA가 replicas를 자동 조정하는 경우
  - group: apps
    kind: Deployment
    jsonPointers:
    - /spec/replicas

  # 특정 어노테이션 무시
  - group: ""
    kind: Service
    jsonPointers:
    - /metadata/annotations/kubectl.kubernetes.io~1last-applied-configuration
```

---

## 6. Sync Waves (배포 순서 제어)

리소스 간 배포 순서를 지정한다.

```yaml
# 먼저 배포 (wave -1)
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"

# 기본 순서 (wave 0)
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "0"

# 나중에 배포 (wave 1)
metadata:
  annotations:
    argocd.argoproj.io/sync-wave: "1"
```

```
Wave -1: Namespace, CRD
Wave  0: ConfigMap, Secret
Wave  1: Deployment, StatefulSet
Wave  2: Ingress, HPA
```

---

## 7. Sync Hooks

배포 전·후 작업을 Hook으로 실행한다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  annotations:
    argocd.argoproj.io/hook: PreSync      # 배포 전 실행
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: myapp:latest
        command: ["python", "manage.py", "migrate"]
      restartPolicy: Never
```

| Hook | 실행 시점 |
|-----|---------|
| PreSync | 동기화 시작 전 |
| Sync | 동기화 중 |
| PostSync | 동기화 완료 후 |
| SyncFail | 동기화 실패 시 |

---

## 참고 문서

- [ArgoCD Sync Options](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)
- [Sync Waves & Hooks](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-waves/)
