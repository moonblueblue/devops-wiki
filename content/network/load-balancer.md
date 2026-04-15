---
title: "로드밸런서 (L4 vs L7)"
date: 2026-04-13
tags:
  - network
  - load-balancer
  - haproxy
  - nginx
  - envoy
sidebar_label: "로드밸런서"
---

# 로드밸런서 (L4 vs L7)

## 1. 로드밸런서란

다수의 서버에 트래픽을 분산하여
가용성과 처리량을 높이는 장치다.

```
클라이언트
    ↓
로드밸런서 (단일 진입점)
    ├── 서버 A
    ├── 서버 B
    └── 서버 C
```

---

## 2. L4 vs L7 비교

| 항목 | L4 (Transport) | L7 (Application) |
|------|---------------|-----------------|
| 동작 계층 | TCP/UDP | HTTP/HTTPS |
| 라우팅 기준 | IP + 포트 | URL, 헤더, 쿠키, 메서드 |
| TLS 처리 | Pass-through (일부 제품은 Termination 지원, 예: AWS NLB TLS listener) | **TLS 종료 가능** |
| 콘텐츠 기반 라우팅 | **불가** | **가능** |
| 속도 | **빠름** | 상대적으로 느림 |
| 주요 용도 | TCP 서비스, DB | HTTP 서비스 |
| 예시 | AWS NLB, HAProxy TCP | AWS ALB, Nginx, Envoy |

### L7 라우팅 예시

```
/api/*      → API 서버 풀
/static/*   → 정적 파일 서버
/admin/*    → 관리자 서버 (IP 제한)
Host: app.example.com → 앱 서버
Host: api.example.com → API 서버
```

---

## 3. 로드밸런싱 알고리즘

| 알고리즘 | 동작 | 권장 상황 |
|---------|------|---------|
| Round Robin | 순서대로 순환 | 서버 스펙 동일 |
| Weighted RR | 가중치 비율로 분산 | 서버 스펙 상이 |
| Least Connections | 현재 연결 수 가장 적은 서버 | **장시간 연결** |
| IP Hash | 클라이언트 IP 기반 고정 | 세션 유지 필요 |
| Random | 2개 무작위 선택 후 연결 수 적은 쪽 (power-of-two) | HAProxy 3.3+ 기본값 |

---

## 4. 헬스체크

```
L4 헬스체크: TCP 포트 연결 시도
L7 헬스체크: HTTP GET /health → 200 응답 확인
```

```nginx
# Nginx upstream 헬스체크
# - passive 헬스체크(실패 감지 기반)는 오픈소스 기본 지원
# - active 헬스체크(주기적 프로브)는 NGINX Plus 전용
upstream backend {
    server 10.0.1.10:8080;
    server 10.0.1.11:8080;
}
```

```haproxy
# HAProxy 헬스체크 (HAProxy 2.2+ 권장 문법)
# option httpchk GET /health 는 2.2부터 deprecated
backend app_servers
    option httpchk
    http-check send meth GET uri /health ver HTTP/1.1 hdr Host app.example.com
    http-check expect status 200
    server app1 10.0.1.10:8080 check inter 2s rise 2 fall 3
    server app2 10.0.1.11:8080 check inter 2s rise 2 fall 3
```

| 파라미터 | 의미 |
|---------|------|
| `inter 2s` | 2초마다 체크 |
| `rise 2` | 2회 성공 시 정상 |
| `fall 3` | 3회 실패 시 제외 |

---

## 5. 세션 지속성 (Sticky Session)

stateful 애플리케이션에서 같은 클라이언트를
같은 서버로 보내야 할 때 사용한다.

```haproxy
# HAProxy - 쿠키 기반 세션 지속
backend app_servers
    cookie SERVERID insert indirect nocache
    server app1 10.0.1.10:8080 cookie app1
    server app2 10.0.1.11:8080 cookie app2
```

> 가능하면 세션을 **Redis 등 외부 저장소**로 이전하여
> Sticky Session 의존성을 없애는 것이 권장된다.

---

## 6. SSL Termination vs Pass-through

```
SSL Termination:
클라이언트 ──HTTPS──> LB(복호화) ──HTTP──> 서버
                       ↑
                       인증서 관리 여기서만

SSL Pass-through:
클라이언트 ──HTTPS──────────────────────> 서버
                                           ↑
                                           각 서버에서 복호화
```

| 방식 | 장점 | 단점 |
|------|------|------|
| Termination | 중앙 인증서 관리, L7 기능 활용 | LB가 평문 처리 |
| Pass-through | End-to-End 암호화 | L7 기능 불가, 서버별 인증서 |
| Re-encryption | 보안 강화 | CPU 오버헤드 증가 |

---

## 7. 주요 도구 비교

| 항목 | HAProxy | Nginx | Envoy |
|------|---------|-------|-------|
| 주요 용도 | L4/L7 LB | 웹서버 + 리버스 프록시 | 서비스 메시 사이드카 |
| 성능 | **최고** | 높음 | 높음 |
| 설정 방식 | 선언적 (haproxy.cfg) | 선언적 (nginx.conf) | xDS API (동적) 또는 static YAML |
| 동적 설정 | Runtime API | 제한적 | **완전 동적** |
| 관찰성 | 통계 페이지 | stub_status | **내장 메트릭** |
| 주요 사용처 | 고성능 LB | 웹/프록시 | Istio, K8s Ingress |

---

## 8. 고가용성 구성

```
Active-Active (부하 분산):
    ├── LB-1 (처리 중)
    └── LB-2 (처리 중)
    → DNS Round Robin 또는 ECMP

Active-Passive (장애 대비):
    ├── LB-1 (Active, VIP 보유)
    └── LB-2 (Standby, Keepalived 대기)
    → LB-1 장애 시 VIP를 LB-2로 이전
```

```bash
# Keepalived 상태 확인
systemctl status keepalived
ip addr show | grep "vip\|virtual"
```

---

## 참고 문서

- [HAProxy 공식 문서](https://www.haproxy.org/#docs)
- [Nginx 로드밸런싱 가이드](https://nginx.org/en/docs/http/load_balancing.html)
- [Envoy 프록시 공식 문서](https://www.envoyproxy.io/docs)
- [AWS - 로드밸런서 유형 비교](https://aws.amazon.com/elasticloadbalancing/features/)
