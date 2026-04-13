---
title: "Docker 네트워크 모드"
date: 2026-04-13
tags:
  - container
  - docker
  - network
  - bridge
  - overlay
sidebar_label: "Docker 네트워크"
---

# Docker 네트워크 모드

## 1. 네트워크 드라이버 비교

| 드라이버 | 동작 방식 | 사용 시점 |
|---------|---------|---------|
| `bridge` | 기본값. 컨테이너에 독립 IP 할당 | 단일 호스트 일반 용도 |
| `host` | 호스트 네트워크 스택 직접 사용 | 성능 최적화 필요 시 |
| `none` | 네트워크 완전 격리 | 배치 작업, 최대 보안 |
| `overlay` | 다중 호스트 연결 | Docker Swarm |
| `macvlan` | 물리 NIC에 MAC 주소 할당 | 레거시 앱, 네트워크 모니터링 |
| `ipvlan` | MAC 없이 IP만 할당 | MAC 주소 제한 환경 |

---

## 2. Bridge 네트워크 (기본)

```
컨테이너 A (172.17.0.2)  컨테이너 B (172.17.0.3)
         ↓                        ↓
         └──────── docker0 ────────┘
                       ↓
                   호스트 NIC
                       ↓
                    인터넷
```

```bash
# 사용자 정의 bridge 생성 (권장)
docker network create \
  --driver bridge \
  --subnet 172.20.0.0/16 \
  --gateway 172.20.0.1 \
  my-net

# 컨테이너 실행 시 네트워크 지정
docker run -d --network my-net --name db postgres:15
docker run -d --network my-net --name app myapp:latest

# app → db를 컨테이너 이름으로 접근 가능 (자동 DNS)
```

> 기본 `bridge` 네트워크는 컨테이너 이름으로 DNS 해석이 안 된다.
> 사용자 정의 bridge를 쓰면 이름 기반 통신이 가능하다.

---

## 3. Host 네트워크

```bash
# 호스트 포트를 그대로 사용 (포트 바인딩 불필요)
docker run -d --network host --name nginx nginx:latest
# 호스트의 80번 포트로 직접 서비스
```

- 장점: 포트 매핑 오버헤드 없음, 성능 최적화
- 단점: 포트 충돌 위험, 컨테이너 격리 약화
- Linux 전용 (macOS/Windows는 VM 경유라 효과 없음)

---

## 4. 포트 바인딩

```
외부 요청 → 호스트 0.0.0.0:8080
                    ↓ iptables NAT
            컨테이너 172.17.0.2:80
```

```bash
# 기본 (모든 인터페이스)
docker run -d -p 8080:80 nginx:latest

# localhost만 바인딩 (내부 서비스)
docker run -d -p 127.0.0.1:8080:80 nginx:latest

# UDP 포트
docker run -d -p 53:53/udp dns-server:latest

# 다중 포트
docker run -d -p 80:80 -p 443:443 nginx:latest

# 임의 호스트 포트 (포트 충돌 방지)
docker run -d -p 80 nginx:latest
docker ps  # 할당된 포트 확인
```

---

## 5. 네트워크 명령어

```bash
# 목록 조회
docker network ls

# 상세 정보 (연결된 컨테이너 포함)
docker network inspect my-net

# 실행 중인 컨테이너에 네트워크 추가
docker network connect my-net existing-container

# 네트워크 분리
docker network disconnect my-net existing-container

# 사용하지 않는 네트워크 정리
docker network prune
```

---

## 6. 컨테이너 간 통신 패턴

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15
    networks:
      - backend

  api:
    image: myapi:latest
    environment:
      DB_HOST: db        # 컨테이너 이름으로 접근
    networks:
      - backend
      - frontend

  web:
    image: nginx:latest
    networks:
      - frontend

networks:
  frontend:
  backend:
    internal: true       # 외부 인터넷 차단
```

---

## 참고 문서

- [Docker Network Drivers](https://docs.docker.com/engine/network/drivers/)
- [Bridge Network Driver](https://docs.docker.com/engine/network/drivers/bridge/)
- [Port Publishing](https://docs.docker.com/engine/network/port-publishing/)
