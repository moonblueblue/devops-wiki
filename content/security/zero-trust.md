---
title: "제로 트러스트 모델"
date: 2026-04-14
tags:
  - security
  - zero-trust
  - network
sidebar_label: "제로 트러스트"
---

# 제로 트러스트 모델

## 1. 핵심 원칙

```
"절대 신뢰하지 말고, 항상 검증하라"
(Never Trust, Always Verify)
```

전통적 보안은 네트워크 경계를 신뢰한다.
제로 트러스트는 내부 네트워크도 신뢰하지 않는다.

---

## 2. 전통 모델 vs 제로 트러스트

| 항목 | 전통 모델 (Castle & Moat) | 제로 트러스트 |
|-----|------------------------|-------------|
| 신뢰 경계 | 내부 네트워크 | 없음 |
| 인증 시점 | 입장 시 1회 | 모든 요청마다 |
| 내부 트래픽 | 암묵적 신뢰 | 검증 필요 |
| VPN | 내부망 접근의 핵심 | 보조 수단 |
| 침해 가정 | 외부만 위협 | 내부도 위협 |

---

## 3. 제로 트러스트 아키텍처

```
모든 요청 → Identity Provider (OIDC/SAML)
    ↓ 인증·인가
Policy Engine (OPA, etc.)
    ↓ 정책 검사
Resource (서비스, 데이터)

사용자, 디바이스, 서비스 모두 동일하게 적용
```

---

## 4. 핵심 구성 요소

### 강력한 인증

```
□ MFA (다중 인증) 필수
□ 디바이스 상태 검증 (패치, 인증서)
□ 인간·서비스 모두 동일한 인증 정책
□ 세션 시간 제한, 재인증
```

### 최소 권한 (Least Privilege)

```
□ 필요한 권한만 부여 (JIT: Just-In-Time)
□ 사용하지 않는 권한 자동 회수
□ 시간 제한 자격증명
□ API 키 최소 범위 설정
```

### 마이크로 세그멘테이션

```
서비스 A ──[mTLS 필요]──→ 서비스 B

각 서비스 간 통신을 개별적으로 인증·인가
NetworkPolicy / Service Mesh (Istio, Linkerd)로 구현
```

### 지속적 모니터링

```
□ 모든 접근 로그 기록
□ 이상 행동 탐지 (ML 기반)
□ 실시간 위협 인텔리전스 반영
```

---

## 5. Kubernetes에서의 구현

```yaml
# 1. NetworkPolicy로 서비스 간 통신 제한
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: payment-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: payment
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway   # api-gateway에서만 허용
    ports:
    - port: 8080

# 2. RBAC으로 최소 권한
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: payment-reader
  namespace: production
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]   # read-only

# 3. ServiceAccount 기반 인증
# 각 서비스가 자체 ServiceAccount로 인증
```

---

## 6. 서비스 메시와 mTLS

```
서비스 메시 (Istio, Linkerd)로 서비스 간 mTLS 강제:

서비스 A → [자동 TLS 핸드셰이크] → 서비스 B
  서비스 A 인증서: SPIFFE 기반 자동 발급
  검증: 클러스터 내부 CA
```

---

## 참고 문서

- [NIST Zero Trust Architecture](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf)
- [Google BeyondCorp](https://cloud.google.com/beyondcorp)
- [CNCF Zero Trust Whitepaper](https://github.com/cncf/tag-security/tree/main/community/resources/zero-trust)
