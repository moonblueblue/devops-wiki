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
      GF_SECURITY_ADMIN_PASSWORD: admin
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
# 컨테이너별 CPU 사용률 (%)
rate(container_cpu_usage_seconds_total{
  name!=""
}[5m]) * 100

# CPU 스로틀 비율 (제한에 의해 지연된 비율)
rate(container_cpu_cfs_throttled_periods_total[5m])
  / rate(container_cpu_cfs_periods_total[5m])
```

### 메모리

```promql
# 컨테이너 메모리 사용량 (bytes)
container_memory_working_set_bytes{name!=""}

# 메모리 제한 대비 사용률 (%)
container_memory_working_set_bytes{name!=""}
  / container_spec_memory_limit_bytes{name!=""}
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

Grafana에서 ID `193`으로 cAdvisor 공식 대시보드를 임포트할 수 있다.

```
Grafana → Dashboards → Import → ID: 193
```

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
