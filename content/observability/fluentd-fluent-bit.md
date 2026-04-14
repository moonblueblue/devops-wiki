---
title: "Fluentd / Fluent Bit"
date: 2026-04-14
tags:
  - fluentd
  - fluent-bit
  - logging
  - observability
sidebar_label: "Fluentd·Fluent Bit"
---

# Fluentd / Fluent Bit

## 1. 개요 및 비교

CNCF Graduated 프로젝트.
통합 로깅 레이어로 다양한 소스에서 로그를 수집하고 목적지로 전송한다.

| 항목 | Fluentd | Fluent Bit |
|-----|---------|-----------|
| 언어 | Ruby (C 코어) | C (순수) |
| 메모리 | ~40MB | ~1MB |
| 플러그인 수 | 1,000+ | 100+ |
| 처리 성능 | 보통 | 매우 빠름 |
| 주요 용도 | 로그 집계·변환 허브 | 경량 수집기 (엣지, Pod) |

**실무 패턴:**
```
Pod → Fluent Bit (DaemonSet, 경량 수집)
         → Fluentd (집계·변환·라우팅)
             → Elasticsearch / Loki / S3
```

---

## 2. Fluent Bit 설정

```ini
# fluent-bit.conf
[SERVICE]
    Flush         5
    Log_Level     info
    Parsers_File  parsers.conf

[INPUT]
    Name          tail
    Path          /var/log/containers/*.log
    Parser        docker
    Tag           kube.*
    Refresh_Interval 5
    Mem_Buf_Limit 5MB

[FILTER]
    Name          kubernetes
    Match         kube.*
    Kube_URL      https://kubernetes.default.svc:443
    Kube_CA_File  /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    Kube_Token_File /var/run/secrets/kubernetes.io/serviceaccount/token
    Merge_Log     On       # JSON 로그 자동 파싱
    K8S-Logging.Parser On
    K8S-Logging.Exclude On  # 어노테이션으로 제외 가능

[FILTER]
    Name          grep
    Match         kube.*
    Exclude       log  ^\s*$   # 빈 로그 제외

[OUTPUT]
    Name          loki
    Match         kube.*
    Host          loki
    Port          3100
    Labels        job=fluentbit, namespace=$kubernetes['namespace_name']
```

---

## 3. Kubernetes DaemonSet 배포

```bash
# Helm으로 설치
helm repo add fluent https://fluent.github.io/helm-charts
helm repo update

helm install fluent-bit fluent/fluent-bit \
  --namespace logging \
  --create-namespace \
  --values fluent-bit-values.yaml
```

```yaml
# fluent-bit-values.yaml
config:
  outputs: |
    [OUTPUT]
        Name loki
        Match kube.*
        Host loki-gateway.monitoring.svc
        Port 80
        Labels job=fluent-bit
        Label_Keys $kubernetes['namespace_name'],$kubernetes['pod_name']

  filters: |
    [FILTER]
        Name kubernetes
        Match kube.*
        Merge_Log On
        Keep_Log Off
        K8S-Logging.Parser On
```

---

## 4. Fluentd 설정 (집계 허브)

```xml
# fluentd.conf

# Fluent Bit에서 포워딩 수신
<source>
  @type forward
  port 24224
</source>

# 변환: 타임스탬프 파싱
<filter kube.**>
  @type parser
  key_name log
  reserve_data true
  <parse>
    @type json
  </parse>
</filter>

# 에러 로그는 Slack으로도 전송
<match kube.** level=error>
  @type copy
  <store>
    @type elasticsearch
    host elasticsearch
    port 9200
    index_name fluentd-${tag}.%Y%m%d
  </store>
  <store>
    @type slack
    webhook_url https://hooks.slack.com/services/...
    message "%{message}"
  </store>
</match>

# 나머지는 Elasticsearch로
<match kube.**>
  @type elasticsearch
  host elasticsearch
  port 9200
  logstash_format true
  logstash_prefix app-logs
  <buffer>
    @type file
    path /var/log/fluentd-buffers/
    flush_mode interval
    flush_interval 5s
  </buffer>
</match>
```

---

## 5. 파드별 로깅 제어

어노테이션으로 파드별 로그 수집을 제어한다.

```yaml
metadata:
  annotations:
    # Fluent Bit로 로그 수집 제외
    fluentbit.io/exclude: "true"

    # 커스텀 파서 지정
    fluentbit.io/parser: "json"

    # 로그 제외 패턴
    fluentbit.io/exclude-filter: "healthcheck"
```

---

## 참고 문서

- [Fluent Bit 공식 문서](https://docs.fluentbit.io/)
- [Fluentd 공식 문서](https://docs.fluentd.org/)
- [Fluent Bit Kubernetes 필터](https://docs.fluentbit.io/manual/pipeline/filters/kubernetes)
