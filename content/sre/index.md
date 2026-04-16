---
title: "SRE"
date: 2026-04-16
tags:
  - sre
  - reliability
  - incident
  - chaos-engineering
  - roadmap
sidebar_label: "SRE"
---

# 10. SRE

Site Reliability Engineering. Google에서 시작된 신뢰성 공학.
SLO·에러버짓·Toil·Postmortem·카오스 엔지니어링 등
기술과 문화가 결합된 운영 철학을 다룬다.

## 목차

### 개념

- [ ] [SRE란 무엇인가 (Google 정의)](concepts/sre-overview.md)
- [ ] [SRE vs DevOps](concepts/sre-vs-devops.md)
- [ ] [Embedded SRE vs Center SRE 모델](concepts/sre-org-models.md)
- [ ] [에러 버짓과 리스크 관리 철학](concepts/error-budget-philosophy.md)
- [ ] [SRE의 기본 원칙 (Google SRE Book)](concepts/sre-principles.md)

### SLI / SLO / SLA

- [ ] [SLI, SLO, SLA 정의와 차이](sli-slo-sla/sli-slo-sla.md)
- [ ] [SLI 선정 기준 (사용자 경험 중심)](sli-slo-sla/sli-selection.md)
- [ ] [SLO 설정 실전 가이드](sli-slo-sla/slo-guide.md)
- [ ] [에러 버짓 정책 (Error Budget Policy)](sli-slo-sla/error-budget-policy.md)
- [ ] [Burn Rate 기반 알림](sli-slo-sla/burn-rate-alerting.md)
- [ ] [SLO as Code (Sloth, Pyrra, OpenSLO)](sli-slo-sla/slo-as-code.md)

### 신뢰성 설계

- [ ] [가용성 수학 (9s 의미와 비용)](reliability-design/availability-math.md)
- [ ] [리던던시 설계 (Active-Active vs Active-Passive)](reliability-design/redundancy-design.md)
- [ ] [Failure Domain 분리](reliability-design/failure-domains.md)
- [ ] [Circuit Breaker, Bulkhead 패턴](reliability-design/circuit-breaker.md)
- [ ] [Retry, Timeout, Rate Limiting](reliability-design/retry-timeout-ratelimit.md)
- [ ] [Graceful Degradation](reliability-design/graceful-degradation.md)
- [ ] [Cascading Failure 방지](reliability-design/cascading-failure.md)

### 장애 관리 (Incident Management)

- [ ] [장애 심각도 등급 (Severity Levels)](incident-management/incident-severity.md)
- [ ] [Incident Response 프로세스](incident-management/incident-response.md)
- [ ] [Incident Commander 역할](incident-management/incident-commander.md)
- [ ] [On-call Rotation 설계와 운영](incident-management/oncall-rotation.md)
- [ ] [PagerDuty / Opsgenie 운영](incident-management/pagerduty-opsgenie.md)
- [ ] [War Room과 커뮤니케이션](incident-management/war-room.md)
- [ ] [외부 Status Page 운영](incident-management/status-page.md)

### Postmortem과 RCA

- [ ] [Blameless Postmortem 문화](postmortem-rca/blameless-postmortem.md)
- [ ] [Postmortem 작성 표준 (Google Template)](postmortem-rca/postmortem-template.md)
- [ ] [액션 아이템 추적과 관리](postmortem-rca/action-items.md)
- [ ] [Postmortem Review 미팅](postmortem-rca/postmortem-review.md)
- [ ] [5 Whys와 Fishbone Diagram](postmortem-rca/five-whys-fishbone.md)
- [ ] [Timeline 분석과 Sequence of Events](postmortem-rca/timeline-analysis.md)

### Runbook / Playbook

- [ ] [Runbook 작성법과 베스트 프랙티스](runbook-playbook/runbook.md)
- [ ] [Playbook 자동화 (Ansible, StackStorm)](runbook-playbook/playbook-automation.md)
- [ ] [ChatOps 통합 (Slack, MS Teams)](runbook-playbook/chatops.md)
- [ ] [Runbook as Code](runbook-playbook/runbook-as-code.md)

### Toil 관리

- [ ] [Toil 정의와 식별](toil/toil-definition.md)
- [ ] [Toil 측정과 활동 분배 (50% 규칙)](toil/toil-measurement.md)
- [ ] [Toil 자동화 전략](toil/toil-automation.md)

### 카오스 엔지니어링

- [ ] [카오스 엔지니어링 원칙 (Principles of Chaos)](chaos-engineering/chaos-principles.md)
- [ ] [Chaos Mesh (K8s-native, CNCF)](chaos-engineering/chaos-mesh.md)
- [ ] [Litmus Chaos (CNCF)](chaos-engineering/litmus-chaos.md)
- [ ] [Chaos Monkey (Netflix)](chaos-engineering/chaos-monkey.md)
- [ ] [Gremlin (상용)](chaos-engineering/gremlin.md)
- [ ] [AWS FIS (Fault Injection Service)](chaos-engineering/aws-fis.md)
- [ ] [Game Day 운영 설계](chaos-engineering/game-day.md)
- [ ] [Reliability as Code (CI/CD에 chaos test 내장)](chaos-engineering/reliability-as-code.md)

### 부하 테스트와 용량 계획

- [ ] [부하 테스트 도구 (k6, Locust, JMeter, Vegeta)](load-testing-capacity/load-testing-tools.md)
- [ ] [부하 테스트 시나리오 설계](load-testing-capacity/load-test-scenario.md)
- [ ] [Capacity Planning (용량 계획)](load-testing-capacity/capacity-planning.md)
- [ ] [병목 분석과 리소스 산정](load-testing-capacity/bottleneck-analysis.md)
- [ ] [트래픽 예측 모델](load-testing-capacity/traffic-forecasting.md)
- [ ] [오토스케일링 전략 (KEDA, Karpenter, HPA/VPA)](load-testing-capacity/autoscaling-strategy.md)

### Progressive Delivery (SRE 관점)

- [ ] [Feature Flag와 점진 출시](progressive-delivery/feature-flag-progressive.md)
- [ ] [Canary Analysis 자동화](progressive-delivery/canary-analysis-automation.md)
- [ ] [Shadow Traffic](progressive-delivery/shadow-traffic.md)

### 관측 (SRE 관점)

- [ ] [Synthetic Monitoring for SRE](observability-sre/synthetic-monitoring-sre.md)
- [ ] [Dependency Mapping](observability-sre/dependency-mapping.md)
- [ ] [장애 전파 분석 (Blast Radius)](observability-sre/blast-radius.md)

### AI-assisted SRE / AIOps (2026)

- [ ] [AI-assisted SRE 개요 (MTTR 40~70% 단축)](ai-sre/ai-sre-overview.md)
- [ ] [LLM 기반 RCA와 Incident Investigation](ai-sre/llm-rca.md)
- [ ] [AI-assisted Postmortem 작성](ai-sre/ai-postmortem.md)
- [ ] [자동 Remediation 추천 (incident.io, Datadog Bits AI)](ai-sre/ai-remediation.md)
- [ ] [PagerDuty AIOps와 알림 노이즈 감소](ai-sre/pagerduty-aiops.md)

### 조직과 문화

- [ ] [Team Topologies (Stream-aligned, Platform, Enabling)](org-culture/team-topologies-sre.md)
- [ ] [DevOps/SRE 조직 모델 비교](org-culture/org-models-comparison.md)
- [ ] [SRE와 Platform Engineering의 관계](org-culture/sre-vs-platform-engineering.md)
- [ ] [DORA 메트릭 (SRE 관점 해석)](org-culture/dora-metrics-sre.md)
- [ ] [SPACE 프레임워크](org-culture/space-framework.md)

### Database Reliability Engineering (DRE)

- [ ] [DRE 개념과 DBA와의 차이](dre/dre-overview.md)
- [ ] [DB 백업·복구 전략](dre/db-backup-strategy.md)
- [ ] [복제 지연과 Failover](dre/replication-failover.md)
- [ ] [Connection Pool 관리](dre/connection-pool.md)

### 실전 케이스 스터디

- [ ] [네트워크 장애 (DNS, BGP)](case-studies/case-network.md)
- [ ] [애플리케이션 장애 (메모리 누수, deadlock)](case-studies/case-application.md)
- [ ] [데이터베이스 장애와 복구](case-studies/case-database.md)
- [ ] [SPOF 장애](case-studies/case-spof.md)
- [ ] [트래픽 급증 장애 (Thundering Herd)](case-studies/case-traffic-spike.md)
- [ ] [공개된 글로벌 기업 포스트모템 분석](case-studies/famous-postmortems.md)

---

## 참고 레퍼런스

- [Google SRE Books (무료 공개)](https://sre.google/books/)
- [Seeking SRE (David Blank-Edelman)](https://www.oreilly.com/library/view/seeking-sre/9781491978856/)
- [Database Reliability Engineering (Laine Campbell)](https://www.oreilly.com/library/view/database-reliability-engineering/9781491925935/)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [USENIX SREcon](https://www.usenix.org/conferences/byname/925)
- [Postmortem 공개 아카이브](https://github.com/danluu/post-mortems)
