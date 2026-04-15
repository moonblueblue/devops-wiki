---
title: "Job, CronJob, DaemonSet, StatefulSet"
date: 2026-04-14
tags:
  - kubernetes
  - job
  - cronjob
  - daemonset
  - statefulset
sidebar_label: "Job·DaemonSet·StatefulSet"
---

# Job, CronJob, DaemonSet, StatefulSet

## 1. Job

**완료를 보장**하는 일회성 작업 실행.
Pod가 실패하면 `backoffLimit` 횟수만큼 재시도한다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
spec:
  completions: 1       # 성공해야 할 총 횟수
  parallelism: 1       # 동시 실행 Pod 수
  backoffLimit: 3      # 실패 시 재시도 최대 횟수
  ttlSecondsAfterFinished: 86400  # 완료 후 자동 삭제
  template:
    spec:
      restartPolicy: Never  # Job은 Never 또는 OnFailure
      containers:
      - name: migrate
        image: myapp:latest
        command: ["python", "manage.py", "migrate"]
        env:
        - name: DB_HOST
          value: postgres
```

```bash
# Job 상태 확인
kubectl get job
kubectl describe job db-migration

# Job 로그
kubectl logs job/db-migration
```

---

## 2. CronJob

정기적으로 Job을 스케줄한다.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-report
spec:
  schedule: "0 9 * * 1-5"     # 평일 오전 9시 (KST 기준)
  timeZone: "Asia/Seoul"       # K8s 1.27+ GA. 미지정 시 UTC 기준
  concurrencyPolicy: Forbid    # 이전 Job 미완료 시 스킵
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: reporter
            image: reporter:latest
```

### concurrencyPolicy 옵션

| 값 | 동작 |
|---|------|
| `Allow` | 동시 실행 허용 (기본값) |
| `Forbid` | 이전 Job 완료 전까지 실행 안 함 |
| `Replace` | 이전 Job 중단하고 새 Job 실행 |

### Cron 표현식

```
분   시   일   월   요일
0    9    *    *    1-5    평일 09:00
*/30 *    *    *    *      30분마다
0    2    *    *    *      매일 02:00
0    0    1    *    *      매월 1일 00:00
```

---

## 3. DaemonSet

**모든 Node**에 Pod을 하나씩 배치한다.
Node가 추가되면 자동으로 Pod이 배포된다.

**주요 사용 사례:**
- 로그 수집 에이전트 (Filebeat, Fluentd)
- 모니터링 에이전트 (Prometheus Node Exporter)
- 네트워크 플러그인 (Cilium, Calico)
- 스토리지 에이전트

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule    # Control Plane에도 배포
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.8.2  # 프로덕션에서는 latest 대신 버전 고정
        ports:
        - containerPort: 9100
          hostPort: 9100      # 호스트 포트 직접 바인딩
        volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: sys
          mountPath: /host/sys
          readOnly: true
      volumes:
      - name: proc
        hostPath:
          path: /proc
      - name: sys
        hostPath:
          path: /sys
```

```bash
# DaemonSet 상태 (각 Node의 Pod 확인)
kubectl get daemonset -n monitoring
kubectl get pods -n monitoring -o wide
```

---

## 4. StatefulSet

**안정적인 ID와 순서를 보장**하는 Pod 관리.
데이터베이스, 메시지 큐 등 스테이트풀 워크로드에 사용한다.

**특징:**
- Pod 이름 고정: `postgres-0`, `postgres-1`, `postgres-2`
- 순차 생성 (0 → 1 → 2) / 역순 삭제 (2 → 1 → 0)
- 각 Pod마다 PVC 자동 생성 (`volumeClaimTemplates`)
- Headless Service로 각 Pod DNS 주소 고정

```yaml
# Headless Service (Pod별 DNS 필요)
apiVersion: v1
kind: Service
metadata:
  name: postgres-headless
spec:
  clusterIP: None      # Headless
  selector:
    app: postgres
  ports:
  - port: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
  volumeClaimTemplates:      # 각 Pod마다 PVC 자동 생성
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 50Gi
```

**자동 생성되는 PVC:**
- `data-postgres-0`
- `data-postgres-1`
- `data-postgres-2`

**Pod DNS 주소:**
- `postgres-0.postgres-headless.default.svc.cluster.local`
- `postgres-1.postgres-headless.default.svc.cluster.local`

```bash
# StatefulSet 상태
kubectl get statefulset
kubectl get pods -l app=postgres -w  # 순차 생성 관찰

# PVC 확인 (자동 생성된 것)
kubectl get pvc | grep data-postgres
```

---

## 5. 선택 가이드

| 상황 | 리소스 |
|-----|--------|
| 일회성 배치 작업 | Job |
| 주기적 반복 작업 | CronJob |
| 모든 Node에 에이전트 배포 | DaemonSet |
| DB, 메시지 큐 등 상태 있는 앱 | StatefulSet |
| 일반 무상태 웹/API 서버 | Deployment |

---

## 참고 문서

- [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)
- [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/)
- [StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
