---
title: "쿠버네티스 환경 로깅 전략"
date: 2026-04-14
tags:
  - kubernetes
  - logging
  - observability
sidebar_label: "K8s 로깅 전략"
---

# 쿠버네티스 환경 로깅 전략

## 1. K8s 로깅 아키텍처

```
Pod 컨테이너 → stdout/stderr
    ↓
kubelet이 노드 /var/log/containers/ 에 저장
    ↓
노드 에이전트 (DaemonSet: Fluent Bit, Promtail)
    ↓
중앙 로그 저장소 (Loki, Elasticsearch)
    ↓
시각화 (Grafana, Kibana)
```

---

## 2. 로깅 패턴 3가지

### 패턴 1: Node-level Logging (권장)

```yaml
# DaemonSet으로 각 노드에 에이전트 배포
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
spec:
  selector:
    matchLabels:
      name: fluent-bit
  template:
    spec:
      containers:
      - name: fluent-bit
        image: fluent/fluent-bit:3.0
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

### 패턴 2: Sidecar Logging

```yaml
# 앱 컨테이너와 로그 수집기를 같은 Pod에 배치
spec:
  containers:
  - name: app
    image: myapp:latest
    volumeMounts:
    - name: log-volume
      mountPath: /var/log/app
  - name: log-agent            # Sidecar
    image: fluent/fluent-bit
    volumeMounts:
    - name: log-volume
      mountPath: /var/log/app
  volumes:
  - name: log-volume
    emptyDir: {}
```

비용이 높아 특수한 경우(멀티 로그 파일)에만 사용한다.

### 패턴 3: 직접 전송 (Application Push)

```java
// 앱이 직접 로그 시스템으로 전송
// 단점: 앱과 로그 시스템 간 강한 결합
logger.info("Payment processed");
// → OpenTelemetry SDK가 Loki/Elasticsearch로 직접 전송
```

---

## 3. 구조화 로그 (Structured Logging)

```
Bad (텍스트 로그):
  2026-04-14 09:30:00 ERROR Payment failed for user 123

Good (JSON 로그):
  {
    "timestamp": "2026-04-14T09:30:00Z",
    "level": "ERROR",
    "message": "Payment failed",
    "userId": 123,
    "traceId": "abc123",
    "service": "payment-service",
    "version": "1.5.0"
  }
```

JSON 로그의 이점:
- 파싱 불필요 (Loki/Elastic이 필드 자동 인식)
- 레이블/필드 기반 필터링 가능
- 트레이스 ID 포함으로 트레이싱 연계

---

## 4. 로그 레벨 전략

```yaml
# 환경별 로그 레벨 설정 (ConfigMap)
data:
  LOG_LEVEL: "INFO"   # 프로덕션

# 일반: INFO
# 문제 발생 시: DEBUG (일시적으로 변경)
# 정상화: INFO로 복원
```

| 환경 | 레벨 | 이유 |
|-----|------|------|
| 프로덕션 | INFO | 불필요한 로그 최소화, 비용 절감 |
| 스테이징 | DEBUG | 문제 재현·디버깅 |
| 개발 | DEBUG | 상세 정보 필요 |

---

## 5. 로그 보존 정책

```yaml
# Loki ILM 설정
limits_config:
  retention_period: 30d    # 프로덕션 30일
  # 규정 준수가 필요한 경우: 90일~1년

# Elasticsearch ILM
hot phase: 7일
warm phase: 14일
delete phase: 30일 후 삭제

# 비용 최적화
# 자주 조회하는 최근 로그 → hot (SSD)
# 조회 빈도 낮은 오래된 로그 → warm/cold (HDD/S3)
```

---

## 6. 멀티 테넌시 로그 분리

```yaml
# Loki 멀티 테넌트 설정
# 각 팀/네임스페이스별로 로그 격리

# Fluent Bit에서 tenant-id 헤더 추가
[OUTPUT]
    Name         loki
    Match        kube.*
    Host         loki
    Labels       namespace=$kubernetes['namespace_name']
    tenant_id    $kubernetes['namespace_name']   # 네임스페이스를 tenant로 사용
```

---

## 7. 체크리스트

```
□ 모든 앱이 stdout/stderr로 로그 출력
□ JSON 구조화 로그 사용
□ 모든 로그에 traceId 포함
□ 민감 정보 (비밀번호, 개인정보) 마스킹
□ 로그 레벨 환경변수로 동적 변경 가능
□ 에러 로그에 stacktrace 포함 (백엔드)
□ 보존 기간 및 비용 정책 설정
```

---

## 참고 문서

- [Kubernetes Logging](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
- [Fluent Bit K8s](https://docs.fluentbit.io/manual/pipeline/filters/kubernetes)
