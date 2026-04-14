---
title: "감사 로그 (Audit Log)"
date: 2026-04-14
tags:
  - audit-log
  - kubernetes
  - security
  - compliance
sidebar_label: "감사 로그"
---

# 감사 로그 (Audit Log)

## 1. 개요

누가, 언제, 무엇을, 어떻게 했는지 기록한다.
보안 사고 분석과 규정 준수의 핵심이다.

```
감사 로그로 답할 수 있어야 하는 질문:
  → 누가 이 ConfigMap을 수정했나?
  → 어떤 Pod가 삭제됐나? 누가 했나?
  → 비정상적인 API 호출이 있었나?
  → 권한 상승 시도가 있었나?
```

---

## 2. Kubernetes API 감사 로그

### 감사 레벨

| 레벨 | 기록 내용 |
|------|---------|
| None | 기록 안 함 |
| Metadata | 메타데이터만 (verb, user, resource) |
| Request | 메타데이터 + 요청 본문 |
| RequestResponse | 메타데이터 + 요청 + 응답 |

### 감사 정책 설정

```yaml
# /etc/kubernetes/audit-policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:
# Secret, ConfigMap 전체 기록
- level: RequestResponse
  resources:
  - group: ""
    resources: [secrets, configmaps]

# Pod exec/attach 기록
- level: RequestResponse
  verbs: [create]
  resources:
  - group: ""
    resources: [pods/exec, pods/attach, pods/portforward]

# 일반 Pod 메타데이터만
- level: Metadata
  resources:
  - group: ""
    resources: [pods]

# 읽기 전용 무시
- level: None
  verbs: [get, list, watch]
  resources:
  - group: ""
    resources: [nodes, pods]

# 시스템 계정 무시
- level: None
  users: [system:kube-proxy]
  verbs: [watch]

# 나머지 모두 메타데이터
- level: Metadata
```

### kube-apiserver 설정

```yaml
# /etc/kubernetes/manifests/kube-apiserver.yaml
spec:
  containers:
  - command:
    - kube-apiserver
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-policy-file=/etc/kubernetes/audit-policy.yaml
    - --audit-log-maxage=30        # 30일 보관
    - --audit-log-maxbackup=10     # 최대 10개 백업
    - --audit-log-maxsize=100      # 100MB 로테이션
    # 실시간 전송 (Webhook)
    - --audit-webhook-config-file=/etc/kubernetes/audit-webhook.yaml
```

---

## 3. 감사 로그 수집 (Fluentd/Fluent Bit)

```yaml
# Fluent Bit DaemonSet - audit 로그 수집
[INPUT]
    Name        tail
    Path        /var/log/kubernetes/audit.log
    Tag         audit.*
    Parser      json

[FILTER]
    Name        grep
    Match       audit.*
    # 위험 verb만 필터링
    Regex       verb (create|update|delete|patch)

[OUTPUT]
    Name        elasticsearch
    Match       audit.*
    Host        elasticsearch.logging.svc
    Index       k8s-audit
```

---

## 4. 감사 로그 분석 쿼리

### Elasticsearch (Kibana)

```json
# Secret 접근 이벤트
{
  "query": {
    "bool": {
      "must": [
        {"term": {"objectRef.resource": "secrets"}},
        {"terms": {"verb": ["get", "list"]}}
      ]
    }
  }
}
```

### CloudTrail (AWS)

```bash
# Athena로 IAM 권한 상승 쿼리
SELECT eventtime, useridentity.arn, eventname
FROM cloudtrail_logs
WHERE eventname IN (
  'AttachUserPolicy',
  'CreateAccessKey',
  'AssumeRole'
)
AND eventtime > '2026-04-01'
ORDER BY eventtime DESC;
```

---

## 5. 주요 모니터링 항목

```
즉시 알림 (Critical):
  □ Secret 대량 조회 (list secrets)
  □ ClusterRoleBinding 생성/변경
  □ pod/exec 실행
  □ 비정상 시간대 관리자 접근

경고 (Warning):
  □ RBAC 변경
  □ Namespace 생성/삭제
  □ 인증 실패 다수 발생
  □ ServiceAccount 토큰 생성
```

---

## 6. Falco 기반 감사 알림

```yaml
# Falco 규칙 - Secret 접근 탐지
- rule: K8s Secret Access
  desc: K8s Secret 접근 감지
  condition: >
    ka.verb=get and
    ka.target.resource=secrets and
    not ka.user.name startswith "system:"
  output: >
    Secret 접근: user=%ka.user.name
    secret=%ka.target.name
    ns=%ka.target.namespace
  priority: WARNING
  source: k8s_audit
  tags: [audit, secret]
```

---

## 7. 규정 준수 보관 기준

| 규정 | 보관 기간 |
|------|---------|
| PCI DSS | 1년 (90일 즉시 검색) |
| SOC 2 | 1년 |
| ISO 27001 | 조직 정책에 따라 |
| GDPR | 필요한 기간만 |

---

## 참고 문서

- [K8s Audit Logging](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/)
- [Falco K8s Audit](https://falco.org/docs/event-sources/kubernetes-audit/)
