---
title: "시크릿 관리 (Vault, Sealed Secrets, External Secrets)"
date: 2026-04-14
tags:
  - secrets
  - vault
  - sealed-secrets
  - external-secrets
  - security
sidebar_label: "시크릿 관리"
---

# 시크릿 관리

## 1. 시크릿 관리 원칙

```
금지:
  □ Git에 평문 비밀번호/API 키 저장
  □ 환경변수에 시크릿 하드코딩
  □ Dockerfile에 시크릿 포함 (빌드 캐시에 남음)
  □ Kubernetes Secret을 GitOps 저장소에 평문 저장

권장:
  □ 전용 시크릿 관리 도구 사용
  □ 시크릿 암호화 후 Git 저장 (Sealed Secrets)
  □ 외부 시크릿 저장소와 K8s 동기화 (External Secrets)
  □ 시크릿 로테이션 자동화
```

---

## 2. HashiCorp Vault

엔터프라이즈급 시크릿 관리 플랫폼.

### 설치 (Kubernetes)

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  --set "server.ha.enabled=true" \
  --set "server.ha.replicas=3"
```

### 기본 사용법

```bash
# 초기화
vault operator init

# 언씰 (여러 사람이 나눠서 키를 입력)
vault operator unseal <key-1>
vault operator unseal <key-2>
vault operator unseal <key-3>

# 시크릿 저장
vault secrets enable -path=secret kv-v2
vault kv put secret/payment/db \
  username=dbuser \
  password=supersecret

# 시크릿 조회
vault kv get secret/payment/db
vault kv get -field=password secret/payment/db
```

### Kubernetes Auth 연동

```bash
# Vault가 K8s ServiceAccount로 인증
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc:443"

# 정책 생성
vault policy write payment-policy - <<EOF
path "secret/data/payment/*" {
  capabilities = ["read"]
}
EOF

# 역할 매핑
vault write auth/kubernetes/role/payment \
  bound_service_account_names=payment-service \
  bound_service_account_namespaces=production \
  policies=payment-policy \
  ttl=1h
```

---

## 3. Sealed Secrets

Kubernetes Secret을 암호화해서 Git에 안전하게 저장한다.

```bash
# 컨트롤러 설치
helm repo add sealed-secrets \
  https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  -n kube-system

# Secret → SealedSecret 암호화
kubectl create secret generic db-credentials \
  --from-literal=username=admin \
  --from-literal=password=supersecret \
  --dry-run=client -o yaml | \
  kubeseal --format yaml > sealed-db-credentials.yaml

# Git에 커밋 (안전)
git add sealed-db-credentials.yaml
git commit -m "add db credentials"
```

SealedSecret은 클러스터의 공개키로 암호화되어
해당 클러스터에서만 복호화 가능하다.

---

## 4. External Secrets Operator

AWS Secrets Manager, GCP Secret Manager, Vault 등 외부 시크릿 저장소와
Kubernetes Secret을 동기화한다.

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets --create-namespace
```

```yaml
# SecretStore: 외부 저장소 연결 설정
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: production
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa   # IRSA로 인증
```

```yaml
# ExternalSecret: 동기화할 시크릿 정의
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: payment-db-credentials
  namespace: production
spec:
  refreshInterval: 1h    # 1시간마다 동기화
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: payment-db-credentials   # K8s Secret 이름
    creationPolicy: Owner
  data:
  - secretKey: username
    remoteRef:
      key: prod/payment/db
      property: username
  - secretKey: password
    remoteRef:
      key: prod/payment/db
      property: password
```

---

## 5. 도구 선택 가이드

| 항목 | Sealed Secrets | External Secrets | Vault |
|-----|---------------|----------------|-------|
| 복잡도 | 낮음 | 중간 | 높음 |
| GitOps 친화성 | 매우 높음 | 높음 | 낮음 |
| 로테이션 | 수동 재암호화 | 자동 동기화 | 자동 |
| 멀티 클라우드 | 제한적 | 다양한 백엔드 | 다양한 백엔드 |
| 감사 로그 | Kubernetes 이벤트 | Kubernetes 이벤트 | 상세 감사 |
| 비용 | 무료 | 무료 | OSS 무료 / 엔터프라이즈 유료 |

---

## 참고 문서

- [HashiCorp Vault](https://developer.hashicorp.com/vault)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [External Secrets Operator](https://external-secrets.io/)
