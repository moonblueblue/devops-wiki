---
title: "Docker 네트워크 모드"
date: 2026-04-13
tags:
  - network
  - docker
  - container
  - networking
sidebar_label: "Docker 네트워크"
---

# Docker 네트워크 모드

## 1. 네트워크 드라이버 종류

| 드라이버 | 격리 | 성능 | 용도 |
|---------|------|------|------|
| `bridge` | 있음 (기본) | 보통 | 단일 호스트 컨테이너 통신 |
| `host` | **없음** | **최고** | 성능 최우선, 포트 충돌 주의 |
| `none` | 완전 격리 | - | 네트워크 불필요 컨테이너 |
| `overlay` | 있음 | 보통 | Docker Swarm 멀티 호스트 (`--attachable`로 standalone 컨테이너도 사용 가능) |
| `macvlan` | 있음 | 높음 | 컨테이너에 MAC 주소 직접 할당 |
| `ipvlan` | 있음 | 높음 | L2: macvlan 유사, L3: ARP/브로드캐스트 차단 대규모 라우팅 |

```bash
# 네트워크 목록 확인
docker network ls

# 네트워크 상세 정보
docker network inspect bridge
```

---

## 2. bridge 네트워크

### 기본 bridge vs 사용자 정의 bridge

| 항목 | 기본 bridge (docker0) | 사용자 정의 bridge |
|------|---------------------|-----------------|
| DNS 이름 해석 | **불가** | **가능** (컨테이너명으로 통신) |
| 자동 격리 | 모든 컨테이너 공유 | 같은 네트워크만 통신 |
| 실시간 연결/해제 | 불가 (재시작 필요) | 가능 |
| 권장 | 지양 | **권장** |

```bash
# 사용자 정의 bridge 생성
docker network create --driver bridge \
  --subnet 172.20.0.0/16 \
  mynet

# 컨테이너를 네트워크에 연결
docker run -d --name web --network mynet nginx
docker run -d --name app --network mynet myapp

# app 컨테이너에서 web을 이름으로 접근 가능
docker exec app ping web
```

---

## 3. host 네트워크

컨테이너가 호스트의 네트워크 스택을 직접 사용한다.

```bash
docker run --network host nginx
# 호스트의 80 포트가 그대로 사용됨 (-p 옵션 불필요)
```

> 성능은 최고지만 컨테이너 간 포트 충돌 가능성 있다.
> Linux 전용. macOS/Windows Docker Desktop에서는 Docker Desktop 내부
> Linux VM의 네트워크 스택을 공유하므로, 호스트 OS의 포트·인터페이스에
> 직접 접근되지 않는다. 포트 포워딩(-p)을 사용해야 한다.

---

## 4. 컨테이너 간 통신

```
같은 사용자 정의 bridge:
  container-A → container-B (이름으로 통신)

다른 네트워크:
  통신 불가 (의도적 격리)
  → docker network connect로 네트워크 추가 연결

호스트 → 컨테이너:
  -p 8080:80 으로 포트 매핑
```

```bash
# 실행 중인 컨테이너에 네트워크 추가
docker network connect mynet container-name

# 네트워크에서 분리
docker network disconnect mynet container-name
```

---

## 5. Docker Compose 네트워크

```yaml
# docker-compose.yml
services:
  web:
    image: nginx
    networks:
      - frontend

  app:
    image: myapp
    networks:
      - frontend
      - backend

  db:
    image: postgres
    networks:
      - backend   # web에서 직접 접근 불가

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # 외부 인터넷 차단
```

> `internal: true`로 설정된 네트워크는
> 외부 인터넷 및 호스트 네트워크 모두 차단된다.
> 여러 네트워크에 연결된 컨테이너는 다른 네트워크를 통해
> 외부 접근이 가능하므로 주의 (위 예시에서 `app`은 `frontend`를 통해 접근 가능).

---

## 6. 네트워크 트러블슈팅

```bash
# 컨테이너 네트워크 설정 확인
docker inspect <container> \
  --format '{{json .NetworkSettings.Networks}}' | jq

# 컨테이너 내부에서 연결 테스트
docker exec -it <container> \
  sh -c "curl -sf http://other-container/health"

# 전체 네트워크 정리 (미사용)
docker network prune
```

---

## 참고 문서

- [Docker 네트워킹 공식 문서](https://docs.docker.com/network/)
- [Docker Compose 네트워킹](https://docs.docker.com/compose/networking/)
