---
title: "ConfigMap, Secret"
date: 2026-04-14
tags:
  - kubernetes
  - configmap
  - secret
  - configuration
sidebar_label: "ConfigMap·Secret"
---

# ConfigMap, Secret

## 1. ConfigMap

비민감 설정 데이터를 저장한다.
코드 변경 없이 설정을 바꿀 수 있다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  DB_HOST: "postgres.default.svc.cluster.local"
  DB_PORT: "5432"
  LOG_LEVEL: "info"
  app.properties: |       # 파일 형식 저장
    timeout=30
    retries=3
    debug=false
```

### Pod에 주입하는 방법

```yaml
containers:
- name: app
  image: myapp:latest

  # 방법 1: envFrom (전체 ConfigMap을 환경변수로)
  envFrom:
  - configMapRef:
      name: app-config

  # 방법 2: env (특정 키만 선택)
  env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: LOG_LEVEL

  # 방법 3: volumeMount (파일로 마운트)
  volumeMounts:
  - name: config-vol
    mountPath: /etc/app

volumes:
- name: config-vol
  configMap:
    name: app-config
```

```bash
# ConfigMap 생성
kubectl create configmap app-config \
  --from-literal=LOG_LEVEL=info \
  --from-file=app.properties

# 확인
kubectl get configmap app-config -o yaml
```

---

## 2. Secret

민감한 데이터를 저장한다. Base64로 인코딩되지만 **암호화는 아니다**.
etcd 암호화 설정이 별도로 필요하다.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
type: Opaque
data:
  # echo -n 'mypassword' | base64
  username: bXl1c2Vy     # "myuser"
  password: bXlwYXNzd29yZA==  # "mypassword"
```

### Secret 유형

| 타입 | 용도 |
|-----|------|
| `Opaque` | 임의 데이터 (기본값) |
| `kubernetes.io/tls` | TLS 인증서 |
| `kubernetes.io/dockerconfigjson` | Private 레지스트리 인증 |
| `kubernetes.io/service-account-token` | ServiceAccount 토큰 (K8s 1.24+ 수동 생성, TokenRequest API 권장) |

```yaml
# TLS Secret
apiVersion: v1
kind: Secret
metadata:
  name: tls-cert
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi...  # base64
  tls.key: LS0tLS1CRUdJTi...  # base64
```

### Pod에 주입

```yaml
containers:
- name: app
  image: myapp:latest

  # 환경변수로 주입
  env:
  - name: DB_USER
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: username
  - name: DB_PASS
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password

  # 파일로 마운트 (권장 - 환경변수는 로그에 노출될 수 있음)
  volumeMounts:
  - name: secret-vol
    mountPath: /run/secrets
    readOnly: true

volumes:
- name: secret-vol
  secret:
    secretName: db-credentials
    defaultMode: 0400   # 소유자만 읽기 가능
```

```bash
# Secret 생성
kubectl create secret generic db-credentials \
  --from-literal=username=myuser \
  --from-literal=password=mypassword

# TLS Secret 생성
kubectl create secret tls tls-cert \
  --cert=cert.pem --key=key.pem

# Private 레지스트리 Secret
kubectl create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username=user \
  --docker-password=pass
```

---

## 3. 외부 시크릿 관리

Secret은 Base64 인코딩일 뿐이다.
프로덕션에서는 외부 시스템과 연동해 관리하라.

### External Secrets Operator

AWS Secrets Manager, HashiCorp Vault 등과 연동한다.
ESO v1.0+ (2025-11 GA)에서는 `external-secrets.io/v1` API를 사용한다.

```yaml
# SecretStore: 시크릿 소스 정의
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-secrets
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      # ⚠️ 인증 설정 필수. 프로덕션에서는 IRSA(IAM Roles for Service Accounts) 권장
      # auth: { jwt: { serviceAccountRef: { name: eso-sa } } }
---
# ExternalSecret: 동기화 규칙
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: db-secret
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets
    kind: SecretStore
  target:
    name: db-credentials     # 생성될 K8s Secret 이름
  data:
  - secretKey: password
    remoteRef:
      key: prod/db/password   # AWS Secrets Manager 경로
```

### Sealed Secrets

Git에 암호화된 Secret을 저장할 수 있다.

```bash
# 설치 (버전 명시 권장)
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.28.0/controller.yaml

# Secret 암호화
kubectl create secret generic mysecret \
  --from-literal=password=mypassword \
  --dry-run=client -o yaml | kubeseal -o yaml > sealed-secret.yaml

# Git에 커밋 가능 (안전)
git add sealed-secret.yaml
kubectl apply -f sealed-secret.yaml
```

---

## 4. 보안 주의사항

```text
[X] Base64 ≠ 암호화: kubectl get secret -o yaml로 디코딩 가능
[O] etcd 암호화 활성화 (EncryptionConfiguration)
[O] RBAC로 Secret 읽기 권한 최소화
[O] 환경변수보다 파일 마운트 사용 (로그 노출 방지)
[O] ConfigMap에 민감 정보 저장 금지
[O] 프로덕션에서는 External Secrets 사용 권장
```

---

## 참고 문서

- [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secret](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
