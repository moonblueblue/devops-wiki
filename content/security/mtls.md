---
title: "mTLS (상호 TLS 인증)"
date: 2026-04-14
tags:
  - mtls
  - tls
  - security
  - service-mesh
sidebar_label: "mTLS"
---

# mTLS (상호 TLS 인증)

## 1. TLS vs mTLS

```
TLS (일방향):
  클라이언트 → 서버 인증서 검증
  서버는 클라이언트를 신뢰
  (HTTPS 기본 방식)

mTLS (상호 인증):
  클라이언트 ↔ 서버 양방향 인증
  서버도 클라이언트 인증서 검증
  → 서비스 간 Zero Trust 구현
```

---

## 2. mTLS 동작 원리

```
1. 클라이언트 → 서버: TLS Hello
2. 서버 → 클라이언트: 서버 인증서 + 클라이언트 인증서 요청
3. 클라이언트 → 서버: 클라이언트 인증서
4. 서버: 클라이언트 인증서 검증 (CA 체인 확인)
5. 양방향 인증 완료 → 암호화 통신 시작
```

| 항목 | TLS | mTLS |
|------|-----|------|
| 서버 인증 | O | O |
| 클라이언트 인증 | X | O |
| 사용 사례 | 웹 브라우저 | 마이크로서비스, API |

---

## 3. 인증서 발급 (cert-manager)

```yaml
# ClusterIssuer (자체 CA)
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: internal-ca
spec:
  ca:
    secretName: internal-ca-key-pair

---
# 서비스용 인증서 발급
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: payment-cert
  namespace: production
spec:
  secretName: payment-tls
  duration: 24h          # 짧은 수명 권장
  renewBefore: 1h
  subject:
    organizations: [myorg]
  commonName: payment.production.svc.cluster.local
  dnsNames:
  - payment.production.svc.cluster.local
  - payment
  issuerRef:
    name: internal-ca
    kind: ClusterIssuer
```

---

## 4. Istio mTLS (서비스 메시)

가장 일반적인 K8s mTLS 구현 방법.
Envoy 사이드카가 mTLS를 자동 처리한다.

```yaml
# 네임스페이스 전체 STRICT mTLS 강제
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT    # PERMISSIVE: 일반 TLS도 허용
```

```yaml
# 특정 포트만 예외 (헬스체크 등)
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: payment-mtls
  namespace: production
spec:
  selector:
    matchLabels:
      app: payment
  mtls:
    mode: STRICT
  portLevelMtls:
    8080:
      mode: PERMISSIVE    # 헬스체크 허용
```

---

## 5. DestinationRule로 아웃바운드 mTLS

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-dr
  namespace: production
spec:
  host: payment.production.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL    # Istio 자동 인증서 사용
```

---

## 6. Linkerd mTLS

Linkerd는 기본적으로 자동 mTLS를 활성화한다.

```bash
# mTLS 상태 확인
linkerd viz edges deployment -n production

# 특정 Pod 간 mTLS 확인
linkerd viz tap deployment/payment -n production
```

---

## 7. Nginx mTLS 설정 (직접 구성)

서비스 메시 없이 직접 mTLS를 설정하는 경우.

```nginx
server {
    listen 443 ssl;

    # 서버 인증서
    ssl_certificate     /certs/server.crt;
    ssl_certificate_key /certs/server.key;

    # 클라이언트 인증서 검증
    ssl_client_certificate /certs/ca.crt;
    ssl_verify_client on;

    # 인증된 클라이언트 정보 헤더로 전달
    proxy_set_header X-Client-Cert $ssl_client_cert;
    proxy_set_header X-Client-DN   $ssl_client_s_dn;
}
```

---

## 8. SPIFFE/SPIRE (워크로드 ID)

```
SPIFFE: 워크로드에 고유 ID 부여하는 표준
SPIRE:  SPIFFE 구현체 (X.509 인증서 자동 발급)

SPIFFE ID 형식:
  spiffe://trust-domain/workload-identifier
  예: spiffe://myorg.com/ns/production/sa/payment
```

```yaml
# SPIRE 기반 WorkloadSelector
apiVersion: spire.spiffe.io/v1alpha1
kind: ClusterSPIFFEID
metadata:
  name: payment-id
spec:
  spiffeIDTemplate: >-
    spiffe://myorg.com/ns/{{ .PodMeta.Namespace }}/sa/{{ .PodSpec.ServiceAccountName }}
  podSelector:
    matchLabels:
      app: payment
```

---

## 참고 문서

- [Istio mTLS](https://istio.io/latest/docs/tasks/security/authentication/mtls-migration/)
- [cert-manager](https://cert-manager.io/docs/)
- [SPIFFE/SPIRE](https://spiffe.io/)
