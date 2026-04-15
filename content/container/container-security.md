---
title: "컨테이너 보안 기초"
date: 2026-04-14
tags:
  - container
  - docker
  - security
  - seccomp
  - capabilities
sidebar_label: "컨테이너 보안"
---

# 컨테이너 보안 기초

## 1. 보안 원칙

```
최소 권한 원칙 (Principle of Least Privilege)
  → 필요한 권한만, 필요한 시간만
  → 공격자가 컨테이너를 탈취해도 피해 최소화
```

---

## 2. 비root 사용자 실행

root로 실행된 컨테이너가 탈출하면 호스트 root와 동일한 권한을 갖는다.

```dockerfile
# Dockerfile
FROM node:20-alpine

# 비root 사용자 생성
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --chown=appuser:appgroup . .

# root 권한 필요한 작업은 USER 변경 전에 완료
RUN npm ci --only=production

# 비root로 전환
USER appuser

CMD ["node", "server.js"]
```

```bash
# 실행 시 사용자 지정
docker run -u 1000:1000 myapp:latest

# 컨테이너 내 사용자 확인
docker exec my-container whoami
```

---

## 3. Linux Capabilities 제한

root 권한을 세분화한 기능 단위. 불필요한 권한을 제거해 공격 표면을 줄인다.

```bash
# 모두 제거 후 필요한 것만 추가 (권장 패턴)
docker run \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  nginx:latest
```

```yaml
# docker-compose.yml
services:
  web:
    image: nginx:latest
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # 80/443 포트 바인딩

  app:
    image: myapp:latest
    cap_drop:
      - ALL
    # 추가 capability 불필요
```

| Capability | 용도 |
|-----------|------|
| `NET_BIND_SERVICE` | 1024 미만 포트 바인딩 (containerd 기본값: 필요. `--sysctl net.ipv4.ip_unprivileged_port_start=0`으로 우회 가능하나 런타임별 동작 상이) |
| `CHOWN` | 파일 소유자 변경 |
| `SETUID` / `SETGID` | 프로세스 UID/GID 변경 |
| `SYS_ADMIN` | 광범위한 시스템 권한 (위험) |
| `SYS_PTRACE` | 프로세스 추적 (디버거) |

---

## 4. 읽기 전용 파일시스템

공격자가 컨테이너 내 파일을 수정하거나 악성 코드를 설치하지 못하게 한다.

```bash
docker run --read-only \
  --tmpfs /tmp \
  --tmpfs /var/run \
  myapp:latest
```

```yaml
services:
  app:
    image: myapp:latest
    read_only: true
    tmpfs:
      - /tmp         # 임시 파일
      - /var/run     # PID, 소켓 파일
    volumes:
      - ./data:/app/data  # 쓰기 필요한 경로만 마운트
```

---

## 5. seccomp 프로파일

시스템 콜(syscall)을 제한한다.
Docker 기본 프로파일은 허용 목록(allowlist) 방식으로 동작하며,
불필요한 syscall은 기본 차단된다.
(차단 수는 버전마다 다름 — 최신 목록은
[default.json](https://github.com/moby/moby/blob/master/profiles/seccomp/default.json) 참조)

```bash
# 기본 프로파일 명시적 적용
docker run --security-opt seccomp=default myapp:latest

# 비활성화 (권장하지 않음)
docker run --security-opt seccomp=unconfined myapp:latest
```

---

## 6. 이미지 취약점 스캔 (Trivy)

```bash
# 설치
brew install trivy  # macOS

# 이미지 스캔
trivy image nginx:1.27

# HIGH, CRITICAL만 표시
trivy image --severity HIGH,CRITICAL myapp:latest

# CI/CD에서 CRITICAL 발견 시 빌드 실패
trivy image --exit-code 1 --severity CRITICAL myapp:latest
```

> 베이스 이미지 선택 시 미리 스캔해라.
> Alpine, Distroless가 일반적으로 취약점 수가 적다.

---

## 7. 보안 체크리스트 (CIS Docker Benchmark 기반)

```text
이미지:
  [ ] 비root USER 설정
  [ ] 태그 고정 (latest 금지)
  [ ] trivy로 HIGH/CRITICAL 취약점 스캔
  [ ] 민감 정보 이미지에 포함 금지 (ARG/ENV 주의)

런타임:
  [ ] --cap-drop=ALL + 필요 cap만 추가
  [ ] --read-only + tmpfs 조합
  [ ] --memory, --cpus 제한 설정
  [ ] --privileged 금지

네트워크:
  [ ] 필요한 포트만 노출
  [ ] internal: true 네트워크로 DB 격리
  [ ] --network=host 사용 금지

CI/CD:
  [ ] 빌드 시 자동 취약점 스캔
  [ ] 이미지 서명 (Cosign)
  [ ] Docker Bench for Security 정기 실행
```

```bash
# Docker Bench for Security 실행
docker run --rm \
  --net host \   # 벤치마크 도구가 호스트 네트워크 정보 수집에 필요
  --pid host \
  -v /var/lib:/var/lib \
  -v /var/run:/var/run \
  -v /sys:/sys \
  -v /etc:/etc:ro \
  docker/docker-bench-security
```

---

## 참고 문서

- [Docker Security](https://docs.docker.com/engine/security/)
- [Seccomp Profiles](https://docs.docker.com/engine/security/seccomp/)
- [AppArmor](https://docs.docker.com/engine/security/apparmor/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [Trivy](https://aquasecurity.github.io/trivy/)
