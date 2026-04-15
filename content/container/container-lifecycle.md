---
title: "컨테이너 라이프사이클"
date: 2026-04-13
tags:
  - container
  - docker
  - lifecycle
  - kubernetes
sidebar_label: "컨테이너 라이프사이클"
---

# 컨테이너 라이프사이클

## 1. 컨테이너 상태

```
created ──start──> running ──pause──> paused
                      │                  │
                   stop/kill          unpause
                      │                  │
                   exited  <────────────┘
                      │
                    rm
                      │
                   removed
```

| 상태 | 설명 |
|------|------|
| `created` | 생성됨, 실행 전 |
| `running` | 실행 중 |
| `paused` | 일시 정지 (cgroup freezer 사용, SIGSTOP 아님) |
| `exited` | 정상/비정상 종료 |
| `dead` | 제거 실패 상태 |

```bash
# 상태 확인
docker ps -a --format "table {{.Names}}\t{{.Status}}"

# 특정 상태 필터링
docker ps -a --filter status=exited
docker ps -a --filter status=running
```

---

## 2. 재시작 정책

| 정책 | 동작 |
|------|------|
| `no` | 재시작 안 함 (기본값) |
| `on-failure[:N]` | 비정상 종료(exit code ≠ 0) 시만, N회 제한 가능 |
| `always` | 항상 재시작 (dockerd 재시작 시도 포함) |
| `unless-stopped` | 수동으로 중지한 경우 제외하고 항상 재시작 |

```bash
# 재시작 정책 설정
docker run -d --restart unless-stopped nginx

# 실행 중인 컨테이너 정책 변경
docker update --restart on-failure:3 myapp
```

**운영 환경 권장:** `unless-stopped`
**임시 서비스:** `no` 또는 `on-failure`

> Kubernetes 환경에서는 컨테이너 재시작을 Pod의
> `restartPolicy`(Always/OnFailure/Never)로 관리한다.
> 위 설정은 Docker 단독 운영에만 해당한다.

---

## 3. 종료 코드

| 코드 | 의미 | 원인 |
|------|------|------|
| `0` | 정상 종료 | 프로그램이 정상 완료 |
| `1` | 일반 오류 | 앱 오류, 설정 문제 |
| `125` | Docker 명령 실패 | docker run 자체 오류 |
| `126` | 명령 실행 불가 | 권한 없음 |
| `127` | 명령을 찾을 수 없음 | PATH 오류, 바이너리 없음 |
| `137` | SIGKILL (128+9) | **OOM Kill** 또는 강제 종료 |
| `143` | SIGTERM (128+15) | 정상적인 종료 요청 |

```bash
# 종료 코드 확인
docker inspect myapp --format='{{.State.ExitCode}}'

# OOM Kill 확인
docker inspect myapp --format='{{.State.OOMKilled}}'
```

---

## 4. PID 1 문제와 해결

컨테이너 내 첫 번째 프로세스(PID 1)는 특별한 역할을 한다.

**문제:**
```
일반 앱이 PID 1이면:
  - SIGTERM을 받아도 좀비 프로세스 처리 안 함
  - 자식 프로세스가 종료되어도 wait() 미호출 → 좀비 발생
  - 도커가 종료 시그널을 보내도 응답 안 함
```

**해결: tini 또는 dumb-init 사용**

```dockerfile
# tini 사용 (Docker 공식 초기화 프로세스)
# Alpine: /sbin/tini, Debian/Ubuntu 계열: /usr/bin/tini
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

```bash
# Docker --init 플래그 (tini 자동 포함)
docker run --init myapp
```

| 도구 | 역할 |
|------|------|
| `tini` | 좀비 프로세스 회수, 시그널 포워딩 |
| `dumb-init` | tini와 유사, Yelp 개발 |
| `--init` 플래그 | Docker가 자동으로 tini 주입 |

---

## 5. 컨테이너 종료 흐름

```bash
docker stop myapp
```

```
1. dockerd → SIGTERM 전송 (PID 1에게)
2. 10초 대기 (--time 옵션으로 조정)
3. 시간 초과 시 SIGKILL 전송 (강제 종료)
```

```bash
# 종료 대기 시간 조정 (기본 10초)
docker stop --time 30 myapp

# Dockerfile에서 STOPSIGNAL 설정
STOPSIGNAL SIGINT   # 기본값: SIGTERM
```

---

## 6. Kubernetes Pod 라이프사이클 비교

| Docker 컨테이너 | Kubernetes Pod | 상태 |
|--------------|---------------|------|
| created | Pending | 생성 전/대기 |
| running | Running | 실행 중 |
| exited(0) | Succeeded | 정상 완료 |
| exited(≠0) | Failed | 비정상 종료 |
| - | Unknown | 노드 통신 불가 |

> `Terminating`은 공식 Phase가 아니다. `kubectl delete pod` 후
> 종료 중인 Pod에 STATUS 컬럼에 표시되는 값이며,
> 기본 gracePeriod는 30초다.

```bash
# K8s Pod 라이프사이클 이벤트 확인
kubectl describe pod mypod | grep -A 20 Events:

# 컨테이너 재시작 횟수 확인
kubectl get pods --watch
# NAME      READY  STATUS    RESTARTS   AGE
# myapp-1   1/1    Running   3          5m  ← 3번 재시작
```

---

## 참고 문서

- [Docker 재시작 정책](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [tini GitHub](https://github.com/krallin/tini)
- [Kubernetes Pod 라이프사이클](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
