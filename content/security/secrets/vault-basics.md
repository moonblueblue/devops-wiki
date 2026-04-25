---
title: "Vault 기본 — 아키텍처·Dynamic Secrets·Transit"
sidebar_label: "Vault"
sidebar_position: 1
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - security
  - secrets
  - vault
  - hashicorp
---

# Vault 기본

> **2026년 Vault의 진실**: 정적 시크릿 보관소를 넘어 **단명 자격증명 발급
> 엔진**으로 자리잡았다. DB·AWS·SSH·PKI를 *동적*으로 발급하고, Transit으로
> *암호화 위임 서비스*까지 제공. 본 글은 Vault 아키텍처(Seal·Storage·HA),
> 인증·시크릿 엔진, Dynamic Secrets, Transit, K8s 통합·운영 함정을
> 글로벌 스탠다드 깊이로 다룬다.

- **이 글의 자리**: 보안 카테고리의 *Secrets* 주인공. K8s 동기화는
  [ESO](external-secrets-operator.md), 경량 대안은
  [경량 시크릿 도구](lightweight-secrets.md), 워크로드 신원으로 Vault에
  인증하는 흐름은 [Workload Identity](../authn-authz/workload-identity.md).
- **선행 지식**: TLS, JWT, 클라우드 IAM, K8s ServiceAccount.

---

## 1. 한 줄 정의

> **HashiCorp Vault**는 "시크릿·암호화·자격증명 관리의 통합 백엔드 —
> 정적 KV뿐 아니라 **요청 시점에 짧은 자격증명을 발급**하고, 모든 접근을
> *정책으로 통제*하며, *audit 로그*로 추적 가능하게 한다."

- 핵심 원칙: 시크릿을 코드·평문 파일·이미지에서 분리, 인증 후 동적 fetch
- 라이선스: Vault Community(OSS, MPL 2.0 → 2023-08 BSL 1.1 전환), Vault
  Enterprise(상용 — replication·HSM·namespace 등), HCP Vault(SaaS)
- 2026-04 IBM의 HashiCorp 인수 완료 후 **Vault 2.0**이 첫 메이저 릴리스 —
  Visual Policy Generator, SCIM 2.0 provisioning, SPIFFE JWT-SVID,
  Secret Sync via WIF, Local Accounts Secret Engine 등
- 대안 OSS: **OpenBao** v2.0.0 GA 2024-07-16 (LF Edge), MPL 2.0 유지.
  Vault 1.14 코드 베이스에서 fork, 이후 PostgreSQL backend·SCIF 등 독자
  발전. 2026년 OSS 강제·BSL 회피 시 검토.

---

## 2. 핵심 아키텍처

```mermaid
flowchart TB
    CLI[클라이언트] --> API[HTTP API]
    API --> AUTH[Auth Method]
    API --> POL[Policy]
    API --> SE[Secret Engine]
    SE --> ST[Storage]
    SE -.-> EXT[외부 시스템]
    AUDIT[Audit Device] -.-> API
    SEAL[Seal Wrap] -.-> ST
```

| 레이어 | 역할 |
|---|---|
| **API (HTTP/gRPC)** | 모든 상호작용의 진입 — CLI·SDK·UI 동일 |
| **Auth Method** | 클라이언트 인증 → Vault token 발급 |
| **Policy (HCL/JSON)** | path 단위 capability(create·read·update·delete·list·sudo) |
| **Secret Engine** | 시크릿 생성·저장·발급 로직 (KV·DB·PKI·AWS·Transit 등) |
| **Storage Backend** | 암호화된 데이터 영속 — Raft Integrated Storage 기본 |
| **Audit Device** | 모든 요청·응답 기록 (file·socket·syslog) |
| **Seal** | 마스터 키 보호 — auto-unseal 또는 Shamir |

### 2.0 Vault 버전·분기 (2026-04 기준)

| 버전 | 주요 |
|---|---|
| **Vault 2.0** (2026-04) | IBM 인수 후 첫 메이저 — Visual Policy Gen, SCIM 2.0, SPIFFE JWT-SVID native, Secret Sync(WIF), Local Accounts Engine |
| **Vault 1.21.x** (2026-02) | Enterprise·OSS 안정 분기, 1.x LTS 유지 |
| **OpenBao 2.1.x** (2024-11) | Vault 1.14 fork, MPL 2.0, PostgreSQL backend, SCIF |

### 2.1 Sealing — 가장 중요한 개념

| 상태 | 설명 |
|---|---|
| **Sealed** | 부팅 직후, Storage 암호화 키 미해독 → API 거의 차단 |
| **Unsealed** | 마스터 키 재구성 완료 → API 운영 |

- **Shamir's Secret Sharing**: 마스터 키를 N개 조각으로 분할, M개로 복원
  (기본 5/3). 사람의 개입 필요 — 부팅 시마다 unseal key 입력.
- **Auto-unseal**: KMS(AWS KMS·GCP KMS·Azure Key Vault·HSM·Transit)로
  자동 복원. 운영 표준. 그러나 KMS 신뢰 단일 지점.
- **재해 복구**: Recovery Keys(auto-unseal 시 일부 권한 회수용), Backup,
  Operator Generate-Root.

> **Auto-unseal 함정**: KMS 의존이 곧 SPOF. region 단위 KMS 장애 시 cluster
> 부팅 불가. **multi-region replication** 필요. KMS 키 정책에 Vault role만
> 허용 — 분실 시 영원히 unseal 불가.

### 2.2 Storage — Integrated (Raft)

```mermaid
flowchart LR
    L[Leader] --- F1[Follower]
    L --- F2[Follower]
    L --- F3[Follower]
    L --- F4[Follower]
    L -->|쓰기| BD[BoltDB]
    F1 -.-> BD2[BoltDB]
```

- **Raft consensus** — leader 1개, follower N개. write는 leader만, 다수
  결의 후 commit. read도 기본은 leader (consistency)
- **권고 size**: 5 nodes (failure tolerance 2). 7 이상은 latency·write
  throughput 손실
- **BoltDB 두 파일**: `vault.db`(암호화 운영 데이터), `raft.db`(Raft 메타)
- **이전 추천 Consul**: 외부 의존 + 운영 부담으로 사실상 deprecated. **신규는 Raft**

### 2.3 HA·재해 복구

| 메커니즘 | 설명 | 라이선스 |
|---|---|---|
| **HA via Raft** | leader-follower 자동 failover | OSS |
| **Performance Standby** | follower가 read API를 직접 처리 (write는 forward) | Enterprise Premium |
| **Performance Replication** | secondary cluster가 read·*일부* write API 처리, token·lease 자체 관리 | Enterprise |
| **DR Replication** | secondary가 *거의 봉쇄*(replication API만), promote로 승격, token·lease 동기화 | Enterprise |
| **Snapshot** | `vault operator raft snapshot save` 정기 백업 | OSS |
| **Automated Snapshots** | UI/API로 일정 백업 | Enterprise |

> **Performance Replication vs DR**: 둘 다 master→secondary 비동기 복제,
> 그러나 Performance는 **secondary도 active API**(read+로컬 write 중계),
> DR은 **거의 사용 불가 standby — 장애 시 promote**. 멀티 region read
> latency 개선은 Performance, region 단위 재해 복구는 DR. 운영 데이터
> 복제 범위 — Performance는 token·lease *제외*(secondary가 자체 관리),
> DR은 *포함*(완전 동기화).
>
> **OSS의 자동 snapshot**: Enterprise UI 없이 cron + `vault operator raft
> snapshot save` 또는 외부 자동화 도구로 표준 운영. snapshot은 외부 스토리지로 전송.

---

## 3. 인증 — Auth Methods

| Auth Method | 사용처 |
|---|---|
| **Token** | 직접 token 사용 (Vault 내부 발급) |
| **Userpass** | username·password (개발·소규모) |
| **AppRole** | machine-to-machine — role_id + secret_id |
| **Kubernetes** | K8s SA token 검증 (TokenReview API) |
| **JWT/OIDC** | OIDC IdP 토큰 (Okta·GitHub Actions·SPIFFE JWT-SVID) |
| **AWS** | EC2 instance identity, IAM identity (IRSA 토큰) |
| **GCP** | GCE instance, GCP SA |
| **Azure** | Azure AD, MSI |
| **Cert (mTLS)** | X.509 client cert (SPIFFE X509-SVID) |
| **LDAP** | 디렉터리 통합 |
| **TLS Cert** | 인증서 기반 |
| **OCI** | Oracle Cloud |

### 3.1 K8s 통합 — k8s vs jwt 차이

| Auth | 동작 | 폐기 반영 | 부하 |
|---|---|---|---|
| **`kubernetes`** | Vault가 K8s `TokenReview` API 호출 | 즉시 | API server 부하 |
| **`jwt`** | Vault가 K8s OIDC discovery + JWKS로 검증 | 만료까지 유효 | JWKS 캐시로 낮음 |

> **선택**: SA·Pod 폐기를 즉시 반영해야 = `kubernetes`. K8s API 부하·
> latency 우려, 짧은 token TTL 가능 = `jwt`. 보통 prod는 `kubernetes`.

### 3.2 AppRole — 사람 없는 워크로드

| 단계 | 동작 |
|---|---|
| 1 | Operator가 role 생성 → `role_id` 발급 |
| 2 | Trusted orchestrator가 `secret_id` 동적 발급 (TTL·use_limit 제한) |
| 3 | App이 role_id + secret_id 교환 → Vault token |

> **secret_id 배포 함정**: K8s Secret·env로 평문 마운트는 안티패턴.
> **Wrapped Token** 패턴 — orchestrator가 wrapping token 발급, app이
> 1회 unwrap. CI 잡·VM에서 표준. 신규 환경은 K8s/JWT/Workload ID
> 기반이 더 안전.

---

## 4. 정책 (Policy)

```hcl
# payments-policy.hcl
path "kv/data/payments/*" {
  capabilities = ["read"]
}
path "database/creds/payments-readonly" {
  capabilities = ["read"]
}
path "transit/encrypt/payments" {
  capabilities = ["update"]
}
path "sys/leases/lookup-self" {
  capabilities = ["read"]
}
```

| Capability | 의미 |
|---|---|
| `create` | POST·PUT |
| `read` | GET |
| `update` | POST·PUT (덮어쓰기) |
| `delete` | DELETE |
| `list` | LIST |
| `sudo` | root-protected path 접근 |
| `deny` | 명시적 거부 (allow보다 우선) |

> **path 패턴**: `+`(한 segment), `*`(다중 segment, **마지막에만**).
> templating으로 `{{identity.entity.aliases.kubernetes_xxx.name}}` 동적
> 정책 가능. 한 정책을 여러 entity가 공유.

### 4.1 Sentinel·EGP/RGP (Enterprise)

ACL 위에 추가 정책 엔진. Sentinel 언어로 ACL이 표현 못하는 조건 강제:

| 종류 | 적용 범위 |
|---|---|
| **EGP (Endpoint Governing Policy)** | 특정 path/endpoint에 강제 — 시간·MFA·IP 조건 |
| **RGP (Role Governing Policy)** | 토큰 발급 시 추가 검증 |
| **MFA EGP** | 특정 작업에만 step-up MFA 강제 |

> 예: `prod/*` write는 *업무 시간 + Duo MFA + sourceIP=corp* 조건. Enterprise 전용.

---

## 5. Identity — Entity·Group·Alias

```mermaid
flowchart LR
    A1[k8s alias] --> ENT[Entity]
    A2[oidc alias] --> ENT
    A3[ldap alias] --> ENT
    ENT --> GRP[Group]
    GRP --> POL[Policy]
    ENT -.-> IT[Identity Token]
```

| 개념 | 의미 |
|---|---|
| **Entity** | "한 사람·서비스"의 통합 신원 — 여러 auth method를 단일 entity로 |
| **Alias** | auth method별 신원 매핑 (예: k8s SA, OIDC sub) — entity의 하위 |
| **Group** | entity·다른 group 묶음. internal vs external (OIDC group 자동 매핑) |
| **Identity Token** | Vault 자체가 IdP가 되어 entity 기반 JWT 발급 — Vault 2.0 native SPIFFE JWT-SVID 발급 |

### 5.1 왜 중요한가

- 한 사람이 OIDC로 로그인 + k8s에서 Pod로 인증해도 **같은 entity** — audit·정책에 통합
- Group으로 정책 부여 → 사용자 추가 시 group join만으로 자동 권한
- Identity Token으로 *Vault가 OIDC IdP 역할* — 다른 SaaS의 OIDC 신원으로

### 5.2 사용 패턴

```bash
vault auth list -detailed     # mount accessor 확인
vault write identity/group name=payments-eng \
  policies="payments-rw" \
  member_entity_ids="..."
```

---

## 6. Namespaces (Enterprise)

| 패턴 | 활용 |
|---|---|
| **`/sys/namespaces/admin`** | 멀티테넌시 — 자식 namespace는 독립 mount·정책 |
| 위임 운영 | sub-org가 자체 secret engine·auth 관리 |
| 격리 | tenant 간 데이터·정책 침투 차단 |

> Vault Enterprise의 **multi-tenant 표준**. OSS는 namespace 미지원 →
> 클러스터 분리 또는 path prefix로 흉내. 2.0에서 namespace onboarding GUI.

---

## 7. Quotas — Rate Limit·Lease Count

```bash
vault write sys/quotas/rate-limit/api-rate \
  path="payments/" rate=100 interval=10s

vault write sys/quotas/lease-count/db-leases \
  path="database/" max_leases=5000
```

| 종류 | 보호 |
|---|---|
| **Rate Limit Quota** | API 폭주 방어 (path·namespace·role 단위) |
| **Lease Count Quota** | dynamic secret 폭증 방어 — DB user 폭증 사고 |

> Vault 1.5+. 운영 표준. lease count 누락 시 잘못된 자동화가 수만 DB user
> 생성 → DB 자체 다운 사고 가능.

---

## 8. MFA — Step-up·Login

| 종류 | 동작 |
|---|---|
| **Login MFA** | auth 통과 후 추가 factor 필요 |
| **Step-up MFA (Sentinel EGP)** | 특정 path/작업에만 추가 factor |

| 지원 | 구현 |
|---|---|
| **TOTP** (Vault 내장) | 코드 발급·검증 |
| **Duo** | push·passcode |
| **Okta** | factor delegation |
| **PingID** | factor |
| **OIDC step-up** | IdP의 ACR로 |

> Vault 1.10+ 통합 MFA. 1.10 이전 legacy MFA(deprecated)와 구분.

---

## 9. Vault Agent — Auto-Auth·Template·Caching

```mermaid
flowchart LR
    SINK[Sink] --> APP[App]
    AGENT[Agent] --> SINK
    AUTH[Auto-Auth] --> AGENT
    TPL[Template] --> AGENT
    AGENT -->|cache| LOCAL[Local cache]
    AGENT --> VAULT[Vault Server]
```

### 9.1 3대 기능

| 기능 | 동작 |
|---|---|
| **Auto-Auth** | 설정된 method(k8s·jwt·approle 등)로 자동 인증, token sink에 작성 |
| **Template** | Consul Template 문법으로 시크릿을 파일로 렌더, 변경 시 `command` 실행(reload) |
| **Caching / Proxy** | 앱이 Agent에 호출 → Agent가 Vault 호출 + 응답 캐시. token TTL·lease 자동 |

### 9.2 K8s 외 사용처

- **VM·온프레미스 워크로드** — systemd로 Agent 실행, app은 파일만 read
- **CI runner** — 잡 시작 시 Agent 부팅, 잡 종료 시 자동 revoke
- **레거시 앱** — Vault SDK 통합 어려운 곳, 파일 기반으로

```hcl
auto_auth {
  method "kubernetes" {
    config = { role = "payments" }
  }
  sink "file" {
    config = { path = "/var/run/vault/token" }
  }
}
template {
  source      = "/etc/vault-templates/db.tpl"
  destination = "/etc/app/db.env"
  command     = "systemctl reload app"
}
```

---

## 10. Plugin System

| 종류 | 예 |
|---|---|
| **Built-in plugin** | 기본 포함 (kv, database, aws, transit 등) |
| **External plugin** | 별도 binary, `plugin_directory` 등록 |
| **Plugin multiplexing** | 한 plugin process가 여러 mount 처리 — 메모리 절감 |
| **Plugin runtime/version** | 1.12+ 버전 관리, rolling upgrade |

```bash
vault plugin register -sha256=$(sha256sum custom-engine | cut -d' ' -f1) \
  secret custom-engine
vault secrets enable -plugin-name=custom-engine -path=custom custom-engine
```

> SHA256 등록은 plugin 무결성 검증. 미등록 plugin은 mount 거부.

---

## 11. Token 종류

| 종류 | 특징 |
|---|---|
| **Service token** | 기본형, 만료·갱신·revocation 추적, storage 사용 |
| **Batch token** | 경량, storage 사용 X (HMAC만), HA failover 안전, 그러나 revocation 불가 |
| **Periodic token** | TTL이 max에 도달해도 갱신 무한 — 장기 daemon |
| **Orphan token** | 부모 폐기 시 자식이 살아남음, 의도적 사용 |
| **Wrapping token** | 1회용 wrapper, 단일 unwrap, secret_id 안전 배포 |

> **Batch token** 활용처: 고빈도 호출(메트릭 1초당 N회), HA failover 시
> stale token 안전. 그러나 audit 추적·즉시 revoke는 service token.

---

## 12. KV — 정적 시크릿

### 12.1 KV v2 (versioned)

```bash
vault kv put kv/payments/db username=app password=secret123
vault kv get -version=2 kv/payments/db
vault kv metadata get kv/payments/db
vault kv delete kv/payments/db          # soft delete
vault kv destroy -versions=1 kv/payments/db   # hard delete
```

| 기능 | 설명 |
|---|---|
| **버전 관리** | 기본 10 버전 보관 |
| **soft delete** | 복구 가능 |
| **destroy** | 영구 삭제 |
| **check-and-set** | optimistic locking |
| **metadata** | created·deleted_time·custom |

> **KV는 마지막 수단**: 가능한 한 dynamic secrets 사용. KV에 들어가는 건
> 외부에서 받은 정적 키(파트너 API key 등) 또는 root credential.

### 12.2 패턴

| 패턴 | 권고 |
|---|---|
| `kv/data/<env>/<service>/<key>` | env·service 분리 |
| 시크릿 자체 회전 | `vault kv put`만 — 앱은 lease·watcher로 갱신 |
| `secret/` legacy mount | KV v1, 새 환경은 v2 |

---

## 13. Dynamic Secrets — 핵심 가치

```mermaid
sequenceDiagram
    participant A as App
    participant V as Vault
    participant DB as Database
    A->>V: read database/creds/role
    V->>DB: CREATE USER xx WITH PASSWORD ...
    V->>A: 단명 username password
    A->>DB: 사용
    Note over V,DB: TTL 만료
    V->>DB: DROP USER xx
```

### 13.1 Database Secret Engine

```bash
vault write database/config/postgres \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@db.local:5432/" \
  allowed_roles="readonly,writer" \
  username="vault-root" password="..."

vault write database/roles/readonly \
  db_name=postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
                       GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  default_ttl="1h" max_ttl="24h"

vault read database/creds/readonly  # 호출 시점에 USER 생성
```

| 지원 DB | 비고 |
|---|---|
| PostgreSQL, MySQL, MariaDB, MSSQL, Oracle | 표준 |
| MongoDB, Cassandra, InfluxDB | 문서·NoSQL |
| Redis, Snowflake, Elasticsearch | 다양 |
| Custom plugin | 자체 DB 통합 가능 |

### 13.2 AWS Secret Engine

```bash
vault write aws/config/root \
  access_key=... secret_key=... region=us-east-1

vault write aws/roles/payments-s3 \
  credential_type=iam_user \
  policy_document=@s3-readonly.json \
  default_ttl=1h

vault read aws/creds/payments-s3
# → 단명 access_key, secret_key
```

| 모드 | 설명 |
|---|---|
| **iam_user** | IAM 사용자 동적 생성·삭제 (TTL) |
| **assumed_role** | STS AssumeRole — 권고, 워크로드 ID와 통합 |
| **federation_token** | STS GetFederationToken |

> **권고**: Vault 자체도 워크로드 ID로 AWS 호출 — `aws/config/root`에
> 정적 키 대신 IAM Role(IRSA) 사용. 정적 키 0의 chain.

### 13.3 PKI Secret Engine — 동적 인증서

**권고 구조 — Root offline, Intermediate만 Vault**:

```bash
# 1. Root CA는 air-gap·HSM에서 생성·offline 보관
# 2. Vault에는 Intermediate CA만
vault secrets enable -path=pki_int pki
vault secrets tune -max-lease-ttl=43800h pki_int

vault write pki_int/intermediate/generate/internal \
  common_name="acme.com Intermediate CA" \
  ttl=43800h
# → CSR 생성 → root CA로 서명 → Vault에 import

vault write pki_int/roles/services \
  allowed_domains=acme.com \
  allow_subdomains=true \
  allow_wildcard_certificates=false \
  key_type=ec key_bits=256 \
  max_ttl=720h

vault write pki_int/issue/services \
  common_name=svc.acme.com ttl=24h
```

| 기능 | 설명 |
|---|---|
| **CRL/OCSP unified provider** | 자동 publish, 표준 endpoint |
| **ACME server (1.14+)** | RFC 8555, cert-manager·certbot 호환 |
| **Cross-signing** | 다른 CA와 chain 연결 |
| **EAB (External Account Binding)** | ACME 외부 계정 인증 |

> **mTLS·Service Mesh의 CA로** Vault PKI 사용 가능. cert-manager의
> Vault issuer로 K8s 인증서 자동화. **root CA는 절대 Vault online에 두지 말 것** —
> 침해 시 trust chain 전체 회수 비용.

### 13.4 SSH Secret Engine

| 모드 | 동작 |
|---|---|
| **OTP** | 사용자별 1회용 비밀번호, helper agent로 sshd 통합 |
| **CA-signed** | 사용자 SSH 공개키를 단명 SSH 인증서로 서명 — 표준 |

> CA-signed가 글로벌 스탠다드. 호스트 신뢰 = Vault CA, 사용자 키마다 단명
> 인증서로 한정된 principals·만료 시간. ssh `~/.ssh/authorized_keys` 관리 0.

---

## 14. Transit — 암호화 위임 서비스

```bash
vault secrets enable transit
vault write -f transit/keys/payments

# 앱이 데이터를 암호화 (key 자체는 Vault 안)
vault write transit/encrypt/payments plaintext=$(echo -n "card1234" | base64)
# → ciphertext: vault:v1:abcd...

# 복호화
vault write transit/decrypt/payments ciphertext=vault:v1:abcd...
```

### 14.1 핵심 가치

| 가치 | 설명 |
|---|---|
| **앱은 키를 다루지 않는다** | 키는 Vault에. 앱은 plaintext·ciphertext만 |
| **자동 키 회전** | `vault write -f transit/keys/.../rotate`, 새 ciphertext는 새 버전, 옛 ciphertext도 복호화 가능 |
| **rewrap** | 옛 ciphertext를 새 키 버전으로 재암호화 (`transit/rewrap`), plaintext 노출 없이 |
| **convergent encryption** | 같은 plaintext = 같은 ciphertext (deterministic) — 검색 가능 |
| **datakey** | KEK으로 보호된 DEK 발급 (envelope encryption) |
| **sign·verify·hmac·hash** | 키 관리형 서명 |

### 14.2 사용처

| 시나리오 | 패턴 |
|---|---|
| **DB 컬럼 암호화** | 앱이 transit으로 암호화한 ciphertext만 DB 저장 |
| **로그·메시지 페이로드** | 민감 필드만 transit 암호화 |
| **KMS 대안 / 멀티 클라우드 일관 암호화** | 클라우드 KMS의 vendor lock-in 회피 |
| **Auto-Unseal** | 다른 Vault의 Transit으로 unseal |

### 14.3 Managed Keys·BYOK·FPE

| 기능 | 설명 |
|---|---|
| **Managed Keys** | 외부 KMS·HSM의 키를 Vault가 사용 (PKCS#11) — 키 자체는 외부에 |
| **BYOK Import** | 외부에서 생성한 키를 Vault Transit으로 import (`/keys/import`) |
| **Format-Preserving Encryption (FF1)** | 카드번호·SSN 등 형식 유지 암호화 (Enterprise) |
| **Key Derivation** | context 기반 키 파생, 같은 키로 데이터별 분리 |

> **장점**: KMS와 동일한 envelope encryption 패턴, 그러나 Vault 정책으로
> 사용자·서비스별 권한 미세 통제. 키 분실 위험은 KMS와 동등 — backup 필수.

---

## 15. Lease·Renewal·Revocation

```mermaid
flowchart LR
    REQ[요청] --> LEASE[Lease 발급]
    LEASE --> APP[App]
    APP --> RENEW[Renew]
    RENEW --> APP
    APP --> REV[Revoke]
    LEASE -.->|expire| AUTO[Auto Revoke]
```

| 개념 | 설명 |
|---|---|
| **Lease** | dynamic secret·token의 lifecycle 단위, ID·TTL·max_ttl |
| **Renewal** | 만료 전 갱신, max_ttl 초과 불가 |
| **Revocation** | 명시적 폐기, 혹은 prefix로 일괄 |
| **Lease ID prefix revoke** | `vault lease revoke -prefix database/` — 사고 시 일괄 |

> **앱 측 lease watcher 의무**: TTL 만료 전 갱신, 실패 시 새 자격증명 fetch.
> Vault Agent·VSO·앱 SDK가 자동화.

---

## 16. K8s 통합 — Vault Agent vs CSI vs VSO

### 16.1 세 가지 패턴

| 패턴 | 메커니즘 |
|---|---|
| **Vault Agent Sidecar Injector** | Pod에 sidecar agent + init container, 시크릿을 파일 마운트 |
| **CSI Provider** (Secrets Store CSI Driver) | CSI volume으로 시크릿 마운트 |
| **VSO (Vault Secrets Operator)** | CRD 기반, Vault 시크릿을 K8s Secret으로 동기화 |

### 16.2 비교

| 차원 | Agent | CSI | VSO |
|---|---|---|---|
| 설치 | Helm + injector webhook | CSI Driver + Provider | Operator |
| 시크릿 노출 | 파일 마운트 | volume 마운트 | K8s Secret |
| 회전 반영 | 자동 (file watcher 가능) | refresh 주기 | 자동 |
| K8s Secret 사용 | 안 함 | 옵션 | **사용** (etcd 저장) |
| Use case | sidecar 패턴 | secret을 file로만 | 기존 K8s Secret 인터페이스 유지 |

> **트레이드오프**: VSO는 K8s Secret을 만들어 etcd에 저장 — etcd 암호화 필수.
> Agent·CSI는 etcd 우회 가능. 보안 vs 호환성. ESO와 유사 패턴이지만 ESO는
> 멀티 백엔드.

---

## 17. 운영 — 깊이 있게

### 17.1 Audit

```bash
vault audit enable file file_path=/vault/audit.log
```

- 모든 sensitive 필드(token, request body 값)는 **SHA256 HMAC 단방향 해시**.
  마스킹이 아닌 해시 — 같은 값은 같은 HMAC이라 *조사 시 매칭 가능*하나
  값 자체는 복원 불가
- 한 device 실패 시 모든 요청 차단(*audit blocking*) — **device 가용성 운영 필수**
- 권고: 2개 이상 device 활성화 (file + syslog), 최소 1개 동작 보장

### 17.2 root token 처리

- 초기화 후 즉시 root 사용 중지 (operator 정책 만들고 사용)
- 응급 시: `vault operator generate-root` — quorum unseal key로 새 root 생성
- 평상시는 OIDC·LDAP·k8s auth로 운영자 entity 관리

### 17.3 monitoring·관측

| metric | 의미 |
|---|---|
| `vault.core.unsealed` | unseal 상태 (1·0) |
| `vault.runtime.alloc_bytes` | 메모리 |
| `vault.audit.log_request_failure` | audit 실패 |
| `vault.token.lookup` | token 사용 패턴 |
| `vault.expire.num_leases` | 활성 lease 수 |
| `vault.raft.apply` | Raft write throughput |
| `vault.raft.leader.lastContact` | leader liveness |
| `vault.barrier.put` / `get` | storage I/O |
| `vault.autopilot.healthy` | Raft autopilot 헬스 |
| `vault.autopilot.failure_tolerance` | 허용 가능한 노드 장애 수 |
| `vault.identity.num_entities` | Entity 수 (성장 추세) |
| `vault.wal.persistwals` | Write-Ahead Log 영속화 |
| `vault.merkle.flushdirty` | replication merkle tree flush |

> Prometheus exporter native (`/v1/sys/metrics?format=prometheus`).
> Grafana dashboard 제공.

### 17.4 backup·DR

```bash
vault operator raft snapshot save backup.snap
vault operator raft snapshot restore backup.snap
```

> 정기 자동 + offsite 보관. **Auto-unseal 키도 별도 backup**(KMS 키 정책·
> Recovery Keys). snapshot만으로는 unseal 불가.

---

## 18. 안티패턴

| 안티패턴 | 결과 | 교정 |
|---|---|---|
| KV에 모든 시크릿 — DB 비밀번호도 정적 | 회전 부담, 유출 시 사고 | DB Secret Engine으로 동적 |
| AppRole secret_id를 K8s Secret 평문 | 토큰 가장 표면 | k8s/jwt auth 또는 wrapping token |
| root token을 자동화 스크립트에 | 분실·유출 | 정책 기반 token, root는 응급용 |
| Auto-unseal 키 backup 없음 | KMS 키 분실 시 영원히 unseal 불가 | KMS 키 multi-region + Recovery Keys |
| audit device 1개만 | 1개 실패 시 Vault 전체 차단 | 2개 이상 (file + syslog) |
| Consul backend 신규 도입 | 외부 의존, 운영 복잡 | Integrated Storage (Raft) |
| Vault 자체에 정적 cloud 키 (`aws/config/root`) | Vault 침해 시 cloud 영구 권한 | 워크로드 ID로 Vault 인증 |
| dynamic secret TTL 24h+ | 탈취 시 장기간 사용 | 1시간 이하, app은 renew/refresh |
| lease watcher 미구현 | 만료 후 사고 | Vault Agent·VSO·SDK |
| 정책에 `+`·`*` 와일드카드 광범위 | 권한 폭주 | 최소 path, capability 제한 |
| KV v1 신규 사용 | 버전·복구 X | KV v2 |
| Transit key rotation 안 함 | crypto-period 위반 | 정기 rotate + rewrap |
| 단일 region cluster | 재해 시 SPOF | DR Replication 또는 multi-region (Enterprise) |
| seal HSM·KMS 키를 Vault role 외 다른 principal에 부여 | 우회 unseal | 키 정책 좁게 |
| token TTL 무한 | 사고 추적 불가 | TTL 기본값, root token도 만료 |
| identity entity 분리 안 함 | 사용자·서비스 audit 추적 어려움 | OIDC 등 통합 + entity 자동 매핑 |
| audit log를 Vault 자신의 storage에 | 회전·디스크 위험 | 외부 file·syslog·SIEM |
| Vault를 평문 HTTP | MITM | TLS 의무, 내부 인증서도 자동 회전 |
| PKI root CA를 Vault online에 | 침해 시 trust chain 회수 | root는 offline·HSM, intermediate만 Vault |
| Quotas 미설정 | 자동화 버그로 lease·user 폭증 | Rate Limit + Lease Count Quota |
| MFA 미강제 (운영자 admin) | 토큰 탈취 시 운영 권한 즉시 침해 | Login MFA + step-up MFA EGP |
| 모든 사용자가 root namespace에서 작업 | 격리 X, 정책 충돌 | Enterprise는 namespace 분리, OSS는 cluster 분리 |
| Identity entity 자동 매핑 안 됨 | OIDC + k8s auth가 별도 entity로 보임 | mount accessor 등록, alias로 통합 |

---

## 19. 운영 체크리스트

- [ ] Storage = Integrated Storage (Raft), 5 nodes
- [ ] Auto-unseal = KMS·HSM, multi-region 키 백업, Recovery Keys 보관
- [ ] root token: 초기화 후 사용 중단, 응급 generate-root만
- [ ] OIDC·LDAP·k8s auth로 사용자·서비스 entity 통합
- [ ] AppRole 사용 시 secret_id는 wrapping token 또는 k8s/jwt auth로 대체
- [ ] DB·AWS·SSH 등 *동적* secret engine 우선, KV는 외부 정적 키만
- [ ] dynamic secret TTL 1시간, max_ttl 24시간 이하
- [ ] PKI는 단명(시간~일) 인증서, root CA는 offline
- [ ] Transit으로 앱 암호화 위임, key rotation 정기 + rewrap
- [ ] lease watcher (Vault Agent·VSO·앱 SDK) 의무
- [ ] audit device 2개 이상 (file + syslog 또는 socket)
- [ ] audit 로그 → SIEM, 외부 보관, HMAC 마스킹 검증
- [ ] Prometheus metrics scrape, Grafana dashboard, leader/lease alert
- [ ] Raft snapshot 정기 + offsite, KMS 키 백업 별도
- [ ] 정책은 path 좁게, `*` 사용 시 review, deny 우선
- [ ] Vault 자체의 cloud 호출은 워크로드 ID 페더레이션
- [ ] K8s 통합은 VSO/Agent/CSI 중 시크릿 노출·회전 요구로 선택
- [ ] OSS만 가능한 환경은 OpenBao 검토 — 라이선스 변경 영향 평가
- [ ] Identity entity 통합 — auth method간 alias 일치, group 기반 정책
- [ ] Login MFA 의무 (TOTP·Duo·OIDC step-up), 민감 작업은 EGP MFA
- [ ] Quotas 설정 — Rate Limit·Lease Count로 폭주 방어
- [ ] Namespace로 멀티 테넌시 격리 (Enterprise) 또는 cluster 분리
- [ ] Vault Agent로 워크로드 통합 — Auto-Auth + Template + Caching
- [ ] PKI root CA는 offline·HSM, Vault에는 Intermediate만
- [ ] Plugin은 SHA256 등록, 외부 plugin 무결성 검증
- [ ] Sentinel·EGP/RGP로 ACL 위 추가 정책 (Enterprise)

---

## 참고 자료

- [Vault Documentation](https://developer.hashicorp.com/vault/docs) (확인 2026-04-25)
- [Vault — Integrated Storage (Raft)](https://developer.hashicorp.com/vault/docs/internals/integrated-storage) (확인 2026-04-25)
- [Vault — Auto-unseal](https://developer.hashicorp.com/vault/docs/concepts/seal) (확인 2026-04-25)
- [Vault — Database Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/databases) (확인 2026-04-25)
- [Vault — AWS Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/aws) (확인 2026-04-25)
- [Vault — Transit Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/transit) (확인 2026-04-25)
- [Vault — PKI Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/pki) (확인 2026-04-25)
- [Vault — Kubernetes Auth](https://developer.hashicorp.com/vault/docs/auth/kubernetes) (확인 2026-04-25)
- [Vault — JWT/OIDC Auth](https://developer.hashicorp.com/vault/docs/auth/jwt) (확인 2026-04-25)
- [Vault Secrets Operator (VSO)](https://developer.hashicorp.com/vault/docs/deploy/kubernetes/vso) (확인 2026-04-25)
- [OpenBao — LF Vault Fork](https://openbao.org/) (확인 2026-04-25)
- [HashiCorp BSL License Change (2023-08)](https://www.hashicorp.com/blog/hashicorp-adopts-business-source-license) (확인 2026-04-25)
- [OpenBao v2.0.0 GA (LF Edge, 2024-07)](https://lfedge.org/announcing-openbao-v2-0-0-the-initial-ga-release/) (확인 2026-04-25)
- [Vault — Performance Standby](https://developer.hashicorp.com/vault/docs/enterprise/performance-standby) (확인 2026-04-25)
- [Vault — Identity & Entity](https://developer.hashicorp.com/vault/docs/concepts/identity) (확인 2026-04-25)
- [Vault — Quotas](https://developer.hashicorp.com/vault/docs/enterprise/lease-count-quotas) (확인 2026-04-25)
- [Vault — Login MFA](https://developer.hashicorp.com/vault/docs/auth/login-mfa) (확인 2026-04-25)
- [Vault Agent](https://developer.hashicorp.com/vault/docs/agent-and-proxy/agent) (확인 2026-04-25)
- [Vault — Plugin System](https://developer.hashicorp.com/vault/docs/plugins) (확인 2026-04-25)
