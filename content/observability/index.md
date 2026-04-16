---
title: "Observability"
date: 2026-04-16
tags:
  - observability
  - prometheus
  - grafana
  - opentelemetry
  - profiling
  - roadmap
sidebar_label: "Observability"
---

# 08. Observability

배포 후 시스템을 보는 눈. Metrics·Logs·Traces 3 Pillars에
Continuous Profiling이 4번째 기둥으로 추가되었다.
Prometheus·OpenTelemetry·eBPF 기반 관측까지 다룬다.

## 목차

### 개념

- [ ] [모니터링 vs 옵저버빌리티](concepts/observability-vs-monitoring.md)
- [ ] [3 Pillars + Profiling (4th Pillar)](concepts/four-pillars.md)
- [ ] [시그널 유형 (RED, USE, Golden Signals)](concepts/monitoring-signals.md)
- [ ] [모니터링 안티패턴 (알림 피로, 카디널리티 폭발)](concepts/anti-patterns.md)
- [ ] [SLI/SLO와 관측의 관계](concepts/observability-slo.md)

### Prometheus (메트릭 코어)

- [ ] [Prometheus 아키텍처와 설치](prometheus/prometheus-install.md)
- [ ] [Scrape 모델과 Service Discovery](prometheus/prometheus-scrape.md)
- [ ] [PromQL 기초](prometheus/promql-basics.md)
- [ ] [PromQL 심화 (히스토그램, 퀀타일, rate)](prometheus/promql-advanced.md)
- [ ] [Recording Rules와 Alerting Rules](prometheus/prometheus-rules.md)
- [ ] [Prometheus Operator](prometheus/prometheus-operator.md)
- [ ] [Pushgateway (배치 메트릭)](prometheus/pushgateway.md)
- [ ] [Alertmanager 설정과 라우팅](prometheus/alertmanager.md)

### 메트릭 장기 저장

- [ ] [Thanos (장기 저장, 글로벌 쿼리)](metric-storage/thanos.md)
- [ ] [Grafana Mimir](metric-storage/mimir.md)
- [ ] [Cortex](metric-storage/cortex.md)
- [ ] [VictoriaMetrics](metric-storage/victoriametrics.md)
- [ ] [장기 저장소 선택 기준](metric-storage/long-term-storage-comparison.md)

### Grafana

- [ ] [Grafana 설치와 Data Source 설정](grafana/grafana-basics.md)
- [ ] [대시보드 구성과 베스트 프랙티스](grafana/grafana-dashboard.md)
- [ ] [Templating과 Variables](grafana/grafana-templating.md)
- [ ] [Panel 타입 (Time series, Stat, Table, Heatmap)](grafana/grafana-panels.md)
- [ ] [Grafana Alerting](grafana/grafana-alerting.md)

### 로깅

- [ ] [로깅 아키텍처 패턴 (sidecar, node-level, agent)](logging/logging-patterns.md)
- [ ] [ELK Stack (Elasticsearch, Logstash, Kibana)](logging/elk-stack.md)
- [ ] [OpenSearch (ELK 포크)](logging/opensearch.md)
- [ ] [Grafana Loki와 LogQL](logging/loki.md)
- [ ] [Fluentd](logging/fluentd.md)
- [ ] [Fluent Bit](logging/fluent-bit.md)
- [ ] [Vector (by Datadog)](logging/vector.md)
- [ ] [Grafana Alloy (구 Grafana Agent)](logging/grafana-alloy.md)
- [ ] [Kubernetes 로깅 전략](logging/k8s-logging-strategy.md)
- [ ] [구조화 로깅과 로그 레벨](logging/structured-logging.md)

### 분산 트레이싱

- [ ] [분산 트레이싱 개념 (Span, Trace, Context Propagation)](tracing/tracing-concepts.md)
- [ ] [OpenTelemetry 개요 (SDK, API, Collector)](tracing/opentelemetry-overview.md)
- [ ] [OpenTelemetry Collector 아키텍처와 파이프라인](tracing/otel-collector.md)
- [ ] [OTel Collector 배포 패턴 (DaemonSet vs Sidecar vs Gateway)](tracing/otel-collector-patterns.md)
- [ ] [OpenTelemetry Auto-Instrumentation](tracing/otel-auto-instrument.md)
- [ ] [Jaeger](tracing/jaeger.md)
- [ ] [Grafana Tempo](tracing/tempo.md)
- [ ] [Zipkin](tracing/zipkin.md)
- [ ] [Exemplars (Metric → Trace 드릴다운)](tracing/exemplars.md)

### Continuous Profiling (4번째 기둥)

- [ ] [Continuous Profiling 개념과 의의](profiling/profiling-overview.md)
- [ ] [OpenTelemetry Profiling Signal (2026 Alpha)](profiling/otel-profiling-signal.md)
- [ ] [Grafana Pyroscope](profiling/pyroscope.md)
- [ ] [Parca](profiling/parca.md)
- [ ] [eBPF 기반 프로파일링 (Parca Agent)](profiling/ebpf-profiling.md)

### eBPF 기반 관측

- [ ] [Pixie (K8s용)](ebpf-observability/pixie.md)
- [ ] [Beyla (auto-instrumentation)](ebpf-observability/beyla.md)
- [ ] [Hubble (Cilium 플로우 모니터링)](ebpf-observability/hubble.md)
- [ ] [Inspektor Gadget](ebpf-observability/inspektor-gadget.md)

### 알림 전략

- [ ] [알림 설계 원칙 (Actionable, Symptom-based)](alerting/alerting-principles.md)
- [ ] [SLO 기반 알림 (Burn Rate)](alerting/slo-alerting.md)
- [ ] [Multi-window Multi-burn-rate](alerting/multi-window-alerting.md)
- [ ] [Runbook 연결](alerting/alert-runbook.md)
- [ ] [PagerDuty, Opsgenie 연동](alerting/alert-integrations.md)
- [ ] [Grafana OnCall (오픈소스 on-call 관리)](alerting/grafana-oncall.md)

### AIOps / AI-assisted Observability

- [ ] [AIOps 개념과 2026 트렌드](aiops/aiops-overview.md)
- [ ] [LLM 기반 로그 분석과 이상 탐지](aiops/llm-log-analysis.md)
- [ ] [자동 RCA (Root Cause Analysis)](aiops/automated-rca.md)
- [ ] [상용 도구 (Datadog Bits AI, Dynatrace Davis, New Relic AI)](aiops/commercial-aiops.md)

### Real User Monitoring과 Synthetic

- [ ] [Real User Monitoring (RUM)](rum-synthetic/rum.md)
- [ ] [Synthetic Monitoring (Grafana Synthetic, Blackbox Exporter)](rum-synthetic/synthetic-monitoring.md)

### SLO 도구

- [ ] [Sloth (SLO as Code)](slo-tools/sloth.md)
- [ ] [Pyrra](slo-tools/pyrra.md)
- [ ] [OpenSLO 표준](slo-tools/openslo.md)

### 비용과 운영

- [ ] [카디널리티 관리 전략](cost-operations/cardinality-management.md)
- [ ] [메트릭 다운샘플링과 보존](cost-operations/metric-retention.md)
- [ ] [로그 보존 정책과 비용](cost-operations/log-retention.md)
- [ ] [관측 스택 운영 비용 최적화](cost-operations/observability-cost.md)

### 클라우드 네이티브 스택

- [ ] [Kubernetes 모니터링 스택 (kube-prometheus-stack)](cloud-native-stack/k8s-monitoring-stack.md)
- [ ] [3-tier 앱 모니터링 구성](cloud-native-stack/three-tier-monitoring.md)
- [ ] [마이크로서비스 관측 패턴](cloud-native-stack/microservices-observability.md)

---

## 참고 레퍼런스

- [Prometheus Documentation](https://prometheus.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Observability Engineering (Charity Majors et al.)](https://www.oreilly.com/library/view/observability-engineering/9781492076438/)
- [Distributed Systems Observability (Cindy Sridharan)](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
