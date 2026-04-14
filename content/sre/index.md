---
title: "SRE"
date: 2026-04-14
tags:
  - sre
  - incident
  - chaos-engineering
  - roadmap
---

# SRE

위 모든 것을 종합하는 운영 철학과 실전.

## 목차

### 개념

- [x] [SRE란 무엇인가](./sre-overview.md)
- [x] [SRE vs DevOps](./sre-vs-devops.md)
- [x] [에러 버짓과 위험 관리](./error-budget.md)

### SLI / SLO / SLA

- [x] [SLI, SLO, SLA 정의와 차이](./sli-slo-sla.md)
- [x] [SLO 설정 실전 가이드](./slo-guide.md)
- [x] [에러 버짓 정책](./error-budget-policy.md)

### 장애 대응

- [x] [장애 심각도 등급 정의](./incident-severity.md)
- [x] [장애 대응 프로세스 (탐지 → 대응 → 복구)](./incident-response.md)
- [x] [장애 보고서 작성 요령](./incident-report.md)
- [x] [5 Whys와 Fishbone Diagram](./root-cause-analysis.md)
- [x] [Incident Review와 Retrospective](./incident-review.md)

### 장애 지표 관리

- [x] [장애 지표 설계와 관리 요령](./incident-metrics.md)
- [x] [모니터링 지표 설계](./monitoring-metrics-design.md)
- [x] [알림 시스템 구축](./alerting-system.md)

### 카오스 엔지니어링

- [x] [카오스 엔지니어링 개념](./chaos-engineering.md)
- [x] [Chaos Toolkit](./chaos-toolkit.md)
- [x] [AWS FIS (Fault Injection Service)](./aws-fis.md)
- [x] [모의 장애 훈련 설계](./game-day.md)

### 부하 테스트

- [x] [부하 테스트 도구 (k6, locust)](./load-testing.md)
- [x] [서버 스펙 산정과 용량 계획](./capacity-planning.md)
- [x] [대규모 트래픽 대응 전략 (KEDA, Karpenter)](./traffic-scaling.md)

### 실전 케이스

- [x] [네트워크 장애 (DNS)](./case-network-dns.md)
- [x] [서버 애플리케이션 장애](./case-app-failure.md)
- [x] [데이터베이스 장애와 복구](./case-db-failure.md)
- [x] [SPOF 장애](./case-spof.md)
- [x] [트래픽 급증 장애](./case-traffic-spike.md)
