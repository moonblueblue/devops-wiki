---
title: "런타임 보안 (Falco)"
date: 2026-04-14
tags:
  - falco
  - runtime-security
  - security
  - kubernetes
sidebar_label: "런타임 보안 (Falco)"
---

# 런타임 보안 (Falco)

## 1. 개요

CNCF Graduated 프로젝트.
Linux 시스템 콜을 실시간으로 모니터링해
컨테이너·Pod에서 이상 행동을 탐지한다.

```
컨테이너 내부 프로세스
    ↓ 시스템 콜 (read, write, exec, open 등)
Falco 커널 모듈/eBPF
    ↓ 규칙과 대조
이상 탐지 → 알림 (Slack, syslog, Webhook)
```

---

## 2. 탐지 가능한 이상 행동

```
컨테이너 탈출 시도:
  - 민감 파일 접근 (/etc/shadow, /etc/kubernetes/admin.conf)
  - 호스트 네임스페이스 접근
  - 권한 상승 (setuid, capability 변경)

비정상 프로세스:
  - 웹 서버 컨테이너에서 셸 실행
  - kubectl 실행 (앱 컨테이너에서)
  - 예상치 못한 네트워크 연결 (C2 서버 연결)

파일 시스템:
  - 읽기 전용 마운트에 쓰기 시도
  - 바이너리 디렉토리 수정 (/usr/bin, /bin)
  - 인증서 파일 읽기

Kubernetes API:
  - 민감한 Secret 조회 시도
  - RBAC 설정 변경
  - 새 ClusterRoleBinding 생성
```

---

## 3. 설치

```bash
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

helm install falco falcosecurity/falco \
  --namespace falco \
  --create-namespace \
  --set falco.grpc.enabled=true \
  --set falco.grpcOutput.enabled=true \
  --set driver.kind=ebpf   # eBPF 드라이버 (커널 모듈 대신)
```

---

## 4. 규칙 작성

```yaml
# 커스텀 Falco 규칙
- rule: 웹서버 컨테이너에서 쉘 실행
  desc: nginx/apache 컨테이너에서 bash/sh 실행 감지
  condition: >
    spawned_process and
    container and
    container.image.repository in (nginx, apache) and
    proc.name in (bash, sh, zsh) and
    not proc.pname in (nginx, apache)
  output: >
    웹서버에서 쉘 실행 감지
    (user=%user.name command=%proc.cmdline
     container=%container.name image=%container.image.repository)
  priority: WARNING
  tags: [container, shell, mitre_execution]

- rule: Kubernetes 민감 파일 접근
  desc: 클러스터 자격증명 파일 읽기 시도
  condition: >
    open_read and
    fd.name in (/etc/kubernetes/admin.conf,
                /var/run/secrets/kubernetes.io/serviceaccount/token) and
    not proc.name in (kube-apiserver, etcd, kubelet)
  output: >
    K8s 자격증명 접근 (user=%user.name
     file=%fd.name proc=%proc.name)
  priority: CRITICAL
```

---

## 5. 알림 설정

```yaml
# Falco values.yaml
falco:
  jsonOutput: true
  jsonIncludeOutputProperty: true
  outputs:
    rate: 1
    maxBurst: 1000

# Falcosidekick으로 Slack/PagerDuty 연동
falcosidekick:
  enabled: true
  config:
    slack:
      webhookurl: "https://hooks.slack.com/services/..."
      minimumpriority: "warning"
    pagerduty:
      routingkey: "<PD_KEY>"
      minimumpriority: "critical"
```

---

## 6. Falco 규칙 기본 제공

```bash
# 기본 규칙 목록 확인
falco --list

# 중요 기본 규칙:
# - Container Drift Detected
# - Read sensitive file untrusted
# - Write below rpm database
# - Modify Shell Configuration File
# - Launch Privileged Container
# - Detect crypto miners
```

---

## 7. 대응 자동화 (Response Engine)

탐지 후 자동 대응 액션을 트리거한다.

```yaml
# Falcosidekick + Kubeless/AWS Lambda 연동

# 크리티컬 이벤트 → Pod 자동 격리
outputs:
  webhook:
    address: "http://response-engine/handle"
    minimumpriority: "critical"

# response-engine 예시 액션:
# - Pod 삭제 (격리)
# - NetworkPolicy로 트래픽 차단
# - PagerDuty 인시던트 생성
# - 스냅샷 포렌식 수집
```

---

## 참고 문서

- [Falco 공식 문서](https://falco.org/docs/)
- [Falco Rules](https://github.com/falcosecurity/rules)
- [Falcosidekick](https://github.com/falcosecurity/falcosidekick)
