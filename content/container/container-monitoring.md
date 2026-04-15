---
title: "컨테이너 모니터링 (cAdvisor, Prometheus)"
date: 2026-04-14
tags:
  - container
  - docker
  - monitoring
  - cadvisor
  - prometheus
sidebar_label: "컨테이너 모니터링"
---

# 컨테이너 모니터링 (cAdvisor, Prometheus)

## 1. docker stats vs cAdvisor

| 항목 | docker stats | cAdvisor |
|-----|-------------|---------|
| 범위 | 로컬 호스트 | 로컬 호스트 |
| 히스토리 | 없음 (실시간만) | Prometheus로 저장 |
| 시각화 | CLI | 웹 UI + Grafana |
| 알림 | 없음 | AlertManager 연동 |
| 메트릭 수 | 기본 6종 | 44종 이상 |
| 설정 난이도 | 없음 | YAML 설정 필요 |

**빠른 진단** → `docker stats`  
**장기 모니터링** → cAdvisor + Prometheus + Grafana

---

## 2. cAdvisor 실행

```bash
# 단독 실행
docker run -d \
  --name cadvisor \
  --volume=/:/rootfs:ro \
  --volume=/var/run:/var/run:ro \
  --volume=/sys:/sys:ro \
  --volume=/var/lib/docker/:/var/lib/docker:ro \
  --publish=8080:8080 \
  gcr.io/cadvisor/cadvisor:latest

# 메트릭 엔드포인트
# http://localhost:8080/metrics
# 웹 UI: http://localhost:8080/
```

---

## 3. Prometheus + cAdvisor + Grafana 스택

```yaml
# compose.yml
services:
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    networks:
      - monitoring

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitoring
    depends_on:
      - cadvisor

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      # ⚠️ 프로덕션에서는 반드시 변경할 것
      GF_SECURITY_ADMIN_PASSWORD: ${GF_ADMIN_PASSWORD:-admin}
    volumes:
      - grafana-data:/var/lib/grafana
    networks:
      - monitoring
    depends_on:
      - prometheus

networks:
  monitoring:

volumes:
  prometheus-data:
  grafana-data:
```

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: cadvisor
    static_configs:
      - targets: [cadvisor:8080]
    scrape_interval: 5s
```

---

## 4. 주요 메트릭

### CPU

```promql
# 컨테이너별 CPU 사용량 (코어 단위, 1.0 = 1 core)
# ⚠️ * 100 해도 % 아님 — 멀티코어 환경에서 200 이상 가능
rate(container_cpu_usage_seconds_total{
  name!=""
}[5m])

# CPU 스로틀 비율 (제한에 의해 지연된 비율)
rate(container_cpu_cfs_throttled_periods_total[5m])
  / rate(container_cpu_cfs_periods_total[5m])
```

### 메모리

```promql
# 컨테이너 메모리 사용량 (bytes)
# working_set = usage - inactive_file_cache
# OOM killer 판단 기준에 더 가까운 지표
container_memory_working_set_bytes{name!=""}

# 메모리 제한 대비 사용률 (%)
# limit 미설정 시 container_spec_memory_limit_bytes = 0 → +Inf 방지
container_memory_working_set_bytes{name!=""}
  / container_spec_memory_limit_bytes{name!="", container_spec_memory_limit_bytes > 0}
  * 100
```

### 네트워크

```promql
# 수신 트래픽 (bytes/s)
rate(container_network_receive_bytes_total[5m])

# 송신 트래픽 (bytes/s)
rate(container_network_transmit_bytes_total[5m])
```

---

## 5. Grafana 대시보드

Grafana에서 cAdvisor 대시보드를 임포트할 수 있다.

```
Grafana → Dashboards → Import → ID 입력
```

| ID | 설명 |
|----|------|
| `193` | Docker Monitoring (오래된 커뮤니티 대시보드, 일부 패널 불일치 가능) |
| `19908` | Docker Container Monitoring (cAdvisor + Prometheus, 최신) |

주요 패널:
- CPU 사용률 (전체 / 컨테이너별)
- 메모리 사용량 / 제한 대비 비율
- 네트워크 I/O
- 디스크 I/O

---

## 참고 문서

- [cAdvisor GitHub](https://github.com/google/cadvisor)
- [Prometheus cAdvisor Guide](https://prometheus.io/docs/guides/cadvisor/)
- [Grafana Dashboard 193](https://grafana.com/grafana/dashboards/193)
