---
title: "ArgoCD 보안 가이드"
date: 2026-04-14
tags:
  - argocd
  - security
  - gitops
sidebar_label: "ArgoCD 보안"
---

# ArgoCD 보안 가이드

## 1. 기본 보안 설정 체크리스트

```
□ admin 계정 비밀번호 변경 (또는 비활성화)
□ SSO 연동으로 개인 계정 사용
□ RBAC 최소 권한 원칙 적용
□ TLS 인증서 구성 (argocd-server)
□ 공개 노출 최소화 (Internal LB 또는 VPN)
□ Git 저장소 자격증명 암호화 저장
□ Secret 관리 도구 연동 (Vault, Sealed Secrets)
```

---

## 2. admin 계정 비활성화

SSO가 설정된 후에는 admin 계정을 비활성화한다.

```yaml
# argocd-cm ConfigMap
data:
  admin.enabled: "false"
```

---

## 3. Git 저장소 자격증명 관리

```bash
# SSH 키 방식 (권장)
argocd repo add git@github.com:myorg/gitops.git \
  --ssh-private-key-path ~/.ssh/argocd_rsa

# HTTPS 토큰 방식
argocd repo add https://github.com/myorg/gitops.git \
  --username mybot \
  --password ghp_xxxx
```

자격증명은 `argocd-repo-creds` Secret에 저장된다.
외부 시크릿 관리 도구와 연동하면 더 안전하다.

---

## 4. Secret 암호화 (Sealed Secrets)

Git에 Secret을 그대로 저장하면 안 된다.
Sealed Secrets로 암호화 후 저장한다.

```bash
# Sealed Secrets 컨트롤러 설치
helm repo add sealed-secrets \
  https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system

# Secret 암호화
kubectl create secret generic my-secret \
  --from-literal=password=mysecretpass \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > sealed-secret.yaml

# sealed-secret.yaml을 Git에 커밋 (안전)
git add sealed-secret.yaml
git commit -m "add sealed secret"
```

---

## 5. 네트워크 보안

```yaml
# argocd-server는 내부에서만 접근
# LoadBalancer type 대신 ClusterIP + Ingress 사용

apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: argocd-server-policy
  namespace: argocd
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: argocd-server
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-nginx
    ports:
    - port: 8080
```

---

## 6. ArgoCD 3.x 보안 강화 사항

```
1. 기본 RBAC: role:readonly (이전: role:admin)
2. 클러스터 접근: 명시적 등록 필수 (이전: 암묵적)
3. PreDelete Hook 지원
4. 컨테이너 non-root 실행 강화
```

---

## 7. 감사 로그 (Audit)

```bash
# ArgoCD 이벤트 수집 (kubectl events)
kubectl get events -n argocd \
  --sort-by='.lastTimestamp'

# argocd-server 로그에서 감사 추적
kubectl logs -n argocd \
  deployment/argocd-server | grep "audit"
```

Kubernetes audit logging과 함께 사용하면
ArgoCD를 통한 모든 변경사항을 추적할 수 있다.

---

## 참고 문서

- [ArgoCD Security Guide](https://argo-cd.readthedocs.io/en/stable/operator-manual/security/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [ArgoCD Vault Plugin](https://argocd-vault-plugin.readthedocs.io/)
