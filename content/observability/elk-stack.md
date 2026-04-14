---
title: "ELK Stack (Elasticsearch, Logstash, Kibana)"
date: 2026-04-14
tags:
  - elasticsearch
  - logstash
  - kibana
  - elk
  - observability
sidebar_label: "ELK Stack"
---

# ELK Stack

## 1. 구성 요소

```
로그 소스 (앱, 시스템)
    ↓
Logstash / Beats (수집·파싱)
    ↓
Elasticsearch (저장·인덱싱·검색)
    ↓
Kibana (시각화·검색 UI)
```

| 컴포넌트 | 역할 |
|---------|------|
| **Elasticsearch** | 분산 검색·분석 엔진 (저장) |
| **Logstash** | 로그 수집·변환·파이프라인 |
| **Kibana** | 웹 UI (검색, 대시보드, 알림) |
| **Filebeat** | 경량 로그 수집기 (Logstash 대체 가능) |
| **Metricbeat** | 시스템 메트릭 수집 |

---

## 2. Docker Compose로 로컬 구성

```yaml
# docker-compose.yaml
services:
  elasticsearch:
    image: elasticsearch:8.13.0
    environment:
      discovery.type: single-node
      ES_JAVA_OPTS: "-Xms1g -Xmx1g"
      xpack.security.enabled: "false"
    ports:
    - "9200:9200"
    volumes:
    - es-data:/usr/share/elasticsearch/data

  kibana:
    image: kibana:8.13.0
    ports:
    - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
    depends_on:
    - elasticsearch

  logstash:
    image: logstash:8.13.0
    volumes:
    - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
    - elasticsearch

volumes:
  es-data:
```

---

## 3. Logstash 파이프라인

```ruby
# logstash.conf
input {
  beats {
    port => 5044   # Filebeat에서 수신
  }
  # 또는 직접 파일
  file {
    path => "/var/log/app/*.log"
    start_position => "beginning"
  }
}

filter {
  # JSON 로그 파싱
  if [message] =~ /^\{/ {
    json {
      source => "message"
    }
  }

  # grok 패턴으로 텍스트 로그 파싱
  grok {
    match => {
      "message" => [
        "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:msg}"
      ]
    }
  }

  # 타임스탬프 파싱
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }

  # 불필요한 필드 제거
  mutate {
    remove_field => ["message", "agent", "ecs"]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "app-logs-%{+YYYY.MM.dd}"
  }
}
```

---

## 4. Filebeat (경량 수집기)

```yaml
# filebeat.yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
  - /var/log/app/*.log
  # 멀티라인 (Java 스택 트레이스)
  multiline.pattern: '^\d{4}-\d{2}-\d{2}'
  multiline.negate: true
  multiline.match: after

# 필드 추가
processors:
- add_host_metadata: {}
- add_kubernetes_metadata:
    host: ${NODE_NAME}
    matchers:
    - logs_path:
        logs_path: "/var/log/containers/"

output.logstash:
  hosts: ["logstash:5044"]
# 또는 Elasticsearch 직접
# output.elasticsearch:
#   hosts: ["elasticsearch:9200"]
```

---

## 5. Kibana 주요 기능

```
Discover:
  → 로그 검색 (KQL: status:500 AND service:payment)
  → 시간 범위 필터링
  → 필드별 필터

Dashboard:
  → 로그 볼륨 그래프
  → 에러 분포
  → 서비스별 로그 통계

Lens:
  → 드래그앤드롭 시각화

Alerts:
  → 에러 패턴 감지 시 Slack 알림
```

---

## 6. Index Lifecycle Management (ILM)

오래된 인덱스를 자동으로 롤오버·삭제한다.

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_age": "7d",
            "max_size": "50GB"
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

---

## 7. ELK vs Loki 선택

| 항목 | ELK | Loki |
|-----|-----|------|
| 검색 방식 | 전문(full-text) 검색 | 레이블 기반 필터 |
| 저장 비용 | 높음 (인덱싱) | 낮음 (압축) |
| 쿼리 성능 | 강력한 텍스트 검색 | 레이블 필터에 최적화 |
| 설치 복잡도 | 높음 | 낮음 |
| Grafana 통합 | Kibana 별도 | 기본 통합 |
| 적합 케이스 | 복잡한 로그 분석 | Kubernetes 로그 집계 |

---

## 참고 문서

- [Elasticsearch 공식 문서](https://www.elastic.co/guide/en/elasticsearch/)
- [Filebeat 공식 문서](https://www.elastic.co/guide/en/beats/filebeat/)
- [Logstash 파이프라인](https://www.elastic.co/guide/en/logstash/current/pipeline.html)
