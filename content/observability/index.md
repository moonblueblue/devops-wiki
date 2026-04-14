---
title: "Observability"
date: 2026-04-14
tags:
  - observability
  - prometheus
  - grafana
  - roadmap
---

# Observability

배포 후 시스템을 보는 눈. 운영의 시작.

## 목차

### 개념

- [x] [모니터링 vs 옵저버빌리티](observability-vs-monitoring.md)
- [x] [메트릭, 로그, 트레이스 (3 pillars)](three-pillars.md)
- [x] [모니터링 Anti-Pattern](monitoring-anti-patterns.md)
- [x] [주요 지표 (RED, USE, Golden Signals)](monitoring-signals.md)

### 메트릭

- [x] [Prometheus 아키텍처와 설치](prometheus-install.md)
- [x] [PromQL 기본](promql-basics.md)
- [x] [메트릭 수집과 알림 (Alertmanager)](alertmanager.md)
- [x] [Grafana 대시보드 구성](grafana-dashboard.md)

### 로깅

- [x] [ELK Stack (Elasticsearch, Logstash, Kibana)](elk-stack.md)
- [x] [Fluentd / Fluent Bit](fluentd-fluent-bit.md)
- [x] [Loki](loki.md)
- [x] [쿠버네티스 환경 로깅 전략](k8s-logging-strategy.md)

### 트레이싱

- [x] [분산 트레이싱 개념](distributed-tracing.md)
- [x] [OpenTelemetry 소개](opentelemetry.md)
- [x] [Jaeger / Tempo](jaeger-tempo.md)

### 알림

- [x] [알림 설계 원칙](alerting-principles.md)
- [x] [Grafana 알림 설정](grafana-alerting.md)
- [x] [Slack / PagerDuty 연동](alert-integrations.md)

### 실전

- [x] [3계층 앱 모니터링 구성](monitoring-three-tier-app.md)
- [x] [쿠버네티스 환경 모니터링 스택](k8s-monitoring-stack.md)
