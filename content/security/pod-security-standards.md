---
title: "Pod Security Standards"
date: 2026-04-14
tags:
  - kubernetes
  - security
  - pod-security
sidebar_label: "Pod Security Standards"
---

# Pod Security Standards

## 1. 개요

Kubernetes 1.25에서 Pod Security Policy(PSP)가 제거됐다.
대체제로 **Pod Security Standards(PSS)** + **Pod Security Admission**이 도입됐다.

---

## 2. 3가지 프로파일

| 프로파일 | 설명 | 적합 환경 |
|---------|------|---------|
| **Privileged** | 제한 없음 | 시스템 컴포넌트 (CNI, CSI) |
| **Baseline** | 일반적인 취약점 방지 | 대부분의 앱 |
| **Restricted** | 최상위 보안 강화 | 민감 워크로드 |

---

## 3. Restricted 프로파일 요구사항

```yaml
# Restricted 프로파일 준수 예시
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true      # 비-root 실행 필수
    seccompProfile:
      type: RuntimeDefault  # seccomp 프로파일 필수
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false   # 권한 상승 금지
      capabilities:
        drop: ["ALL"]       # 모든 capability 제거
      readOnlyRootFilesystem: true      # 읽기 전용 루트
      runAsNonRoot: true
      runAsUser: 1000
    volumeMounts:
    - name: tmp
      mountPath: /tmp       # 쓰기 필요한 경로는 별도 볼륨
  volumes:
  - name: tmp
    emptyDir: {}
```

---

## 4. Pod Security Admission (네임스페이스 레이블)

네임스페이스에 레이블로 보안 정책을 적용한다.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # enforce: 위반 시 Pod 생성 거부
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest

    # audit: 위반 로그만 기록 (거부 안 함)
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest

    # warn: 위반 시 경고 메시지 (거부 안 함)
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
```

---

## 5. 네임스페이스별 정책 설계

```
kube-system, monitoring, kube-cni:
  → pod-security.kubernetes.io/enforce: privileged
  (시스템 컴포넌트는 특권 필요)

production, staging:
  → pod-security.kubernetes.io/enforce: restricted
  (앱 워크로드는 최소 권한)

development:
  → pod-security.kubernetes.io/warn: baseline
  (개발자 경험 방해 없이 경고만)
```

---

## 6. 마이그레이션 전략

```bash
# 기존 워크로드 점검
kubectl label namespace production \
  pod-security.kubernetes.io/warn=restricted \
  --overwrite
# warn 모드로 먼저 적용해 위반 파악

# 위반 목록 확인 (audit 로그)
kubectl get events -n production \
  --field-selector reason=FailedCreate

# 워크로드 수정 후 enforce 모드로 전환
kubectl label namespace production \
  pod-security.kubernetes.io/enforce=restricted \
  --overwrite
```

---

## 7. 체크리스트

```
컨테이너 보안 설정:
□ runAsNonRoot: true
□ runAsUser: (root가 아닌 UID)
□ allowPrivilegeEscalation: false
□ capabilities.drop: [ALL]
□ readOnlyRootFilesystem: true
□ seccompProfile.type: RuntimeDefault (또는 Localhost)

Pod 설정:
□ hostNetwork: false
□ hostPID: false
□ hostIPC: false
□ volumes: hostPath 금지 (emptyDir, PVC 사용)
```

---

## 참고 문서

- [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
