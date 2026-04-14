---
title: "침입 탐지와 대응"
date: 2026-04-14
tags:
  - ids
  - intrusion-detection
  - falco
  - security
sidebar_label: "침입 탐지·대응"
---

# 침입 탐지와 대응

## 1. 탐지 유형

| 유형 | 설명 | 도구 |
|------|------|------|
| HIDS | 호스트 기반 침입 탐지 | OSSEC, Wazuh |
| NIDS | 네트워크 기반 침입 탐지 | Suricata, Snort |
| CSPM | 클라우드 보안 상태 관리 | AWS Security Hub, Prisma |
| CWPP | 컨테이너 워크로드 보호 | Falco, Aqua |
| SIEM | 통합 이벤트 관리 | Splunk, Elastic SIEM |

---

## 2. Falco 심층 활용

Falco는 eBPF/커널 모듈로 시스템 콜을 감시한다.

### 탐지 규칙 작성

```yaml
# 컨테이너에서 셸 실행 탐지
- rule: Shell Spawned in Container
  desc: 컨테이너에서 셸이 실행됨
  condition: >
    spawned_process and
    container and
    shell_procs and
    not user_known_shell_spawn_binaries
  output: >
    컨테이너 셸 실행 (user=%user.name
    cmd=%proc.cmdline container=%container.name
    image=%container.image.repository)
  priority: WARNING

# 민감 파일 접근
- rule: Read Sensitive File Untrusted
  desc: 신뢰할 수 없는 프로세스가 민감 파일 접근
  condition: >
    open_read and
    sensitive_files and
    not proc.name in (trusted_binaries)
  output: >
    민감 파일 접근 (file=%fd.name
    user=%user.name proc=%proc.name)
  priority: ERROR

# 네트워크 도구 실행 (내부 정찰)
- rule: Network Tool Launched in Container
  desc: 컨테이너에서 네트워크 스캔 도구 실행
  condition: >
    spawned_process and
    container and
    proc.name in (network_tool_binaries)
  output: >
    네트워크 도구 실행 (tool=%proc.name
    container=%container.name
    image=%container.image.repository)
  priority: CRITICAL
```

---

## 3. Falco 자동 대응 (Response Engine)

```yaml
# falcosidekick 설정: Slack + Lambda 자동 대응
config:
  slack:
    webhookurl: "https://hooks.slack.com/..."
    minimumpriority: "warning"

  aws:
    lambda:
      functionname: "falco-response"
      minimumpriority: "critical"
      # Critical 이벤트 → Lambda가 Pod 자동 격리
```

```python
# Lambda 자동 대응 함수
import boto3
import json

def handler(event, context):
    falco_event = json.loads(event['body'])

    if falco_event['priority'] == 'Critical':
        # Pod 네트워크 격리 (NetworkPolicy 생성)
        isolate_pod(
            namespace=falco_event['output_fields']['k8s.ns.name'],
            pod=falco_event['output_fields']['k8s.pod.name']
        )
        notify_security_team(falco_event)
```

---

## 4. Wazuh (통합 HIDS/SIEM)

```yaml
# Kubernetes DaemonSet으로 Wazuh 에이전트 배포
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: wazuh-agent
spec:
  selector:
    matchLabels:
      app: wazuh-agent
  template:
    spec:
      hostPID: true
      hostNetwork: true
      containers:
      - name: wazuh-agent
        image: wazuh/wazuh-agent:4.9.0
        env:
        - name: WAZUH_MANAGER
          value: "wazuh-manager.security.svc"
        securityContext:
          privileged: true
        volumeMounts:
        - name: host-root
          mountPath: /rootfs
          readOnly: true
      volumes:
      - name: host-root
        hostPath:
          path: /
```

---

## 5. 네트워크 기반 탐지 (Suricata)

```yaml
# Suricata 규칙 - 포트 스캔 탐지
alert tcp any any -> $HOME_NET any (
  msg:"포트 스캔 탐지";
  flags:S;
  threshold: type both,
    track by_src,
    count 20, seconds 60;
  sid:1000001;
  rev:1;
)

# 알려진 C2 서버 통신
alert dns any any -> any any (
  msg:"알려진 악성 도메인";
  dns.query;
  content:"malicious-c2.example.com";
  sid:1000002;
  rev:1;
)
```

---

## 6. SIEM 통합 (Elastic SIEM)

```yaml
# Filebeat - Falco 이벤트 수집
filebeat.inputs:
- type: container
  paths:
  - /var/log/containers/falco*.log
  processors:
  - decode_json_fields:
      fields: [message]
      target: falco

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "falco-%{+yyyy.MM.dd}"
```

---

## 7. 인시던트 대응 절차

```
1. 탐지 (Detect)
   → Falco/SIEM에서 알림 수신

2. 격리 (Isolate)
   → 영향 받은 Pod/노드 네트워크 격리
   → NetworkPolicy로 모든 트래픽 차단

3. 수집 (Collect)
   → 포드 로그, 커널 이벤트 백업
   → 스냅샷 생성

4. 분석 (Analyze)
   → 공격 경로 역추적
   → MITRE ATT&CK 매핑

5. 복구 (Recover)
   → 침해된 Pod 재배포
   → 인증 정보 순환

6. 사후 분석 (Post-mortem)
   → 탐지 규칙 개선
   → 보안 정책 강화
```

---

## 참고 문서

- [Falco](https://falco.org/docs/)
- [Wazuh](https://documentation.wazuh.com/)
- [Suricata](https://suricata.io/documentation/)
- [MITRE ATT&CK for Containers](https://attack.mitre.org/matrices/enterprise/containers/)
