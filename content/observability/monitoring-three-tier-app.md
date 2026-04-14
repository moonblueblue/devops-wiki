---
title: "3계층 앱 모니터링 구성"
date: 2026-04-14
tags:
  - observability
  - monitoring
  - prometheus
  - grafana
sidebar_label: "3계층 앱 모니터링"
---

# 3계층 앱 모니터링 구성

## 1. 3계층 아키텍처 관측 포인트

```
사용자 요청
    ↓
[1] Web/Ingress  → 요청 수, 레이턴시, 에러율
    ↓
[2] App Server   → 응답시간, 스레드, JVM, 비즈니스 메트릭
    ↓
[3] Database     → 쿼리 시간, 연결 수, 캐시 히트율
```

---

## 2. Nginx Ingress 모니터링

```yaml
# Nginx Ingress에서 Prometheus 메트릭 활성화
# values.yaml
controller:
  metrics:
    enabled: true
    serviceMonitor:
      enabled: true

# 핵심 메트릭
nginx_ingress_controller_requests         # 요청 수 (status, ingress별)
nginx_ingress_controller_request_duration_seconds  # 응답시간 히스토그램
nginx_ingress_controller_response_size    # 응답 크기
```

```promql
# 에러율 (5xx)
sum by (ingress) (
  rate(nginx_ingress_controller_requests{status=~"5.."}[5m])
)
/
sum by (ingress) (
  rate(nginx_ingress_controller_requests[5m])
) * 100

# p95 응답시간 (ms)
histogram_quantile(0.95,
  sum by (le, ingress) (
    rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])
  )
) * 1000
```

---

## 3. 애플리케이션 메트릭

### Spring Boot (Micrometer)

```yaml
# application.yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
  metrics:
    export:
      prometheus:
        enabled: true
    tags:
      application: ${spring.application.name}
      env: ${ENVIRONMENT}
```

```promql
# HTTP 요청 RED 지표
# Rate
sum(rate(http_server_requests_seconds_count[5m]))

# Error rate
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
  / sum(rate(http_server_requests_seconds_count[5m]))

# Duration p95
histogram_quantile(0.95,
  rate(http_server_requests_seconds_bucket[5m])
)

# JVM 메트릭
jvm_memory_used_bytes{area="heap"}
jvm_gc_pause_seconds_sum
jvm_threads_live_threads
hikaricp_connections_active   # DB 연결 풀
```

### Node.js (prom-client)

```javascript
const client = require('prom-client');
const register = client.register;
const collectDefaultMetrics = client.collectDefaultMetrics;

// 기본 메트릭 수집 (CPU, 메모리, etc.)
collectDefaultMetrics({ register });

// 커스텀 메트릭
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// /metrics 엔드포인트
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## 4. 데이터베이스 모니터링

### PostgreSQL

```bash
# postgres_exporter 설치
docker run -d \
  -e DATA_SOURCE_NAME="postgresql://user:pass@postgres:5432/db?sslmode=disable" \
  -p 9187:9187 \
  prometheuscommunity/postgres-exporter
```

```promql
# 활성 연결 수
pg_stat_activity_count{state="active"}

# 쿼리 응답시간 (느린 쿼리)
rate(pg_stat_statements_total_time_milliseconds[5m])
  /
rate(pg_stat_statements_calls_total[5m])

# 캐시 히트율
pg_stat_database_blks_hit
  /
(pg_stat_database_blks_hit + pg_stat_database_blks_read)

# 복제 지연 (Primary-Replica)
pg_replication_lag
```

### Redis

```bash
redis_exporter \
  --redis.addr=redis:6379 \
  --redis.password=mypassword
```

```promql
# 메모리 사용률
redis_memory_used_bytes / redis_memory_max_bytes

# 히트율
redis_keyspace_hits_total
  /
(redis_keyspace_hits_total + redis_keyspace_misses_total)

# 커넥션 수
redis_connected_clients

# 명령 처리율
rate(redis_commands_processed_total[5m])
```

---

## 5. 통합 대시보드 구성

```
Row 1: 서비스 상태 요약
  [Stat] 에러율  [Stat] p95 응답시간  [Stat] RPS

Row 2: Ingress 트래픽
  [Graph] 요청/초  [Graph] 에러율 추이  [Heatmap] 응답시간 분포

Row 3: 앱 서버
  [Graph] JVM 힙  [Graph] GC 시간  [Graph] 스레드 수

Row 4: 데이터베이스
  [Graph] 쿼리/초  [Graph] 연결 수  [Stat] 캐시 히트율
```

---

## 6. ServiceMonitor 전체 설정

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
  - port: metrics
    interval: 15s
    path: /actuator/prometheus
  namespaceSelector:
    matchNames:
    - production
```

---

## 참고 문서

- [Prometheus Node Exporter](https://github.com/prometheus/node_exporter)
- [postgres_exporter](https://github.com/prometheus-community/postgres_exporter)
- [Spring Boot Actuator](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html)
