---
title: "실전 케이스: 데이터베이스 장애와 복구"
date: 2026-04-14
tags:
  - sre
  - incident-case
  - database
  - recovery
sidebar_label: "케이스: DB 장애"
---

# 실전 케이스: 데이터베이스 장애와 복구

## 1. 연결 풀 고갈

```
증상:
  "too many connections" 오류
  애플리케이션 DB 요청 타임아웃
  에러율 급증

원인:
  □ 연결 풀 설정이 너무 작음
  □ 쿼리가 느려 연결을 오래 점유
  □ 연결 누수 (Connection Leak)
```

```bash
# PostgreSQL 활성 연결 수 확인
kubectl exec -it postgres-0 -- psql -U postgres -c "
  SELECT count(*), state, wait_event_type
  FROM pg_stat_activity
  GROUP BY state, wait_event_type
  ORDER BY count DESC;
"

# 유휴 연결 강제 종료
kubectl exec -it postgres-0 -- psql -U postgres -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND state_change < NOW() - INTERVAL '10 minutes';
"
```

```yaml
# PgBouncer로 연결 풀링
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer
spec:
  template:
    spec:
      containers:
      - name: pgbouncer
        image: pgbouncer/pgbouncer:1.22.0
        env:
        - name: DATABASES_HOST
          value: postgres.production.svc
        - name: PGBOUNCER_POOL_MODE
          value: transaction    # transaction 풀링
        - name: PGBOUNCER_MAX_CLIENT_CONN
          value: "1000"
        - name: PGBOUNCER_DEFAULT_POOL_SIZE
          value: "50"
```

---

## 2. 슬로우 쿼리

```bash
# PostgreSQL 슬로우 쿼리 확인
kubectl exec -it postgres-0 -- psql -U postgres -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration,
         query, state
  FROM pg_stat_activity
  WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  ORDER BY duration DESC;
"

# 실행 계획 분석
EXPLAIN ANALYZE
  SELECT * FROM orders WHERE user_id = 12345;
# → Sequential Scan이 Index Scan으로 바뀌어야 함

# 인덱스 추가 (무중단)
CREATE INDEX CONCURRENTLY
  idx_orders_user_id ON orders(user_id);
```

---

## 3. 복제 지연

```bash
# PostgreSQL 복제 지연 확인
kubectl exec -it postgres-0 -- psql -U postgres -c "
  SELECT client_addr,
         pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS unsent,
         pg_wal_lsn_diff(sent_lsn, flush_lsn) AS unflushed,
         pg_wal_lsn_diff(flush_lsn, replay_lsn) AS unreplayed
  FROM pg_stat_replication;
"

# 복제 지연 Prometheus 알림
- alert: PostgresReplicationLag
  expr: |
    pg_replication_lag > 300  # 5분 이상 지연
  for: 2m
  annotations:
    summary: "PostgreSQL 복제 지연 5분 초과"
```

---

## 4. 장애 조치 (Failover)

```bash
# Patroni 기반 PostgreSQL HA
# 자동 페일오버 상태 확인
patronictl -c /etc/patroni.yml list

# 수동 페일오버
patronictl -c /etc/patroni.yml failover \
  --master postgres-0 \
  --candidate postgres-1

# 구 Primary를 Replica로 복귀
patronictl -c /etc/patroni.yml reinit postgres-0
```

---

## 5. 백업과 복구

```bash
# PITR (Point-in-Time Recovery)
# pg_basebackup으로 기본 백업
pg_basebackup -h postgres-0 -U replicator \
  -D /backup/base -Ft -z -P -Xs

# 특정 시점으로 복구
# postgresql.conf
recovery_target_time = '2026-04-14 14:30:00'
recovery_target_action = 'promote'

# pgBackRest (권장)
pgbackrest --stanza=main restore \
  --type=time \
  "--target=2026-04-14 14:30:00+09"
```

---

## 6. 장애 대응 우선순위

```
1. 서비스 보호 (데이터 손실 방지 > 가용성):
   → 읽기 전용 모드 전환
   → 쓰기 기능 일시 비활성화

2. 원인 파악:
   → 슬로우 쿼리, 연결 고갈, 복제 지연

3. 임시 조치:
   → 유휴 연결 종료, 슬로우 쿼리 kill

4. 영구 수정:
   → 인덱스 추가, 쿼리 최적화, 풀링 설정
```

---

## 참고 문서

- [PostgreSQL 트러블슈팅](https://www.postgresql.org/docs/current/runtime-config-logging.html)
- [Patroni 문서](https://patroni.readthedocs.io/)
- [pgBackRest](https://pgbackrest.org/)
