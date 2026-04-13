---
title: "리버스 프록시 (Nginx, HAProxy)"
date: 2026-04-13
tags:
  - network
  - nginx
  - haproxy
  - proxy
  - reverse-proxy
sidebar_label: "리버스 프록시"
---

# 리버스 프록시 (Nginx, HAProxy)

## 1. 포워드 vs 리버스 프록시

| 항목 | 포워드 프록시 | 리버스 프록시 |
|------|-----------|------------|
| 위치 | 클라이언트 앞 | 서버 앞 |
| 클라이언트 인지 | 명시적 설정 필요 | 투명하게 처리 |
| 주요 기능 | 캐싱, 필터링, 익명화 | LB, TLS 종료, 캐싱 |
| 예시 | Squid, 사내 프록시 | Nginx, HAProxy, Envoy |

```
포워드 프록시:
클라이언트 → [프록시] → 인터넷

리버스 프록시:
인터넷 → [리버스 프록시] → 백엔드 서버
```

---

## 2. Nginx 리버스 프록시

### 기본 upstream 설정

```nginx
# /etc/nginx/conf.d/app.conf

upstream app_backend {
    least_conn;                         # Least Connections 알고리즘
    server 10.0.1.10:8080 weight=2;
    server 10.0.1.11:8080 weight=1;
    server 10.0.1.12:8080 backup;      # 장애 시에만 사용
    keepalive 32;                       # 백엔드 연결 재사용
}

server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate     /etc/ssl/app.crt;
    ssl_certificate_key /etc/ssl/app.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass         http://app_backend;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Connection        "";  # keepalive용
    }
}
```

### URL 기반 라우팅

```nginx
server {
    location /api/ {
        proxy_pass http://api_backend/;
    }

    location /static/ {
        root /var/www;               # 정적 파일 직접 서빙
        expires 7d;
        add_header Cache-Control "public";
    }

    location /admin/ {
        allow 10.0.0.0/8;            # 사내 IP만 허용
        deny all;
        proxy_pass http://admin_backend/;
    }
}
```

### Rate Limiting

```nginx
http {
    # 분당 60회 제한 (IP 기반)
    limit_req_zone $binary_remote_addr
        zone=api_limit:10m rate=60r/m;

    server {
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://api_backend;
        }
    }
}
```

### 응답 캐싱

```nginx
http {
    proxy_cache_path /var/cache/nginx
        levels=1:2
        keys_zone=app_cache:10m
        max_size=1g
        inactive=60m;

    server {
        location /api/public/ {
            proxy_cache app_cache;
            proxy_cache_valid 200 10m;
            proxy_cache_use_stale error timeout;
            add_header X-Cache-Status $upstream_cache_status;
            proxy_pass http://api_backend;
        }
    }
}
```

---

## 3. HAProxy 설정

### 기본 구조

```haproxy
# /etc/haproxy/haproxy.cfg

global
    log /dev/log local0
    maxconn 50000
    tune.ssl.default-dh-param 2048

defaults
    mode http
    timeout connect 5s
    timeout client  30s
    timeout server  30s
    option forwardfor
    option http-server-close

frontend http_in
    bind *:80
    bind *:443 ssl crt /etc/ssl/app.pem
    redirect scheme https if !{ ssl_fc }

    # ACL 기반 라우팅
    acl is_api  path_beg /api/
    acl is_admin path_beg /admin/

    use_backend api_servers  if is_api
    use_backend admin_servers if is_admin
    default_backend app_servers

backend app_servers
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    server app1 10.0.1.10:8080 check
    server app2 10.0.1.11:8080 check

backend api_servers
    balance roundrobin
    server api1 10.0.2.10:8080 check
    server api2 10.0.2.11:8080 check

backend admin_servers
    balance roundrobin
    acl is_internal src 10.0.0.0/8
    http-request deny unless is_internal
    server admin1 10.0.3.10:8080 check
```

### HAProxy 통계 페이지

```haproxy
frontend stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 10s
    stats auth admin:password
```

```bash
# 런타임 API로 서버 상태 변경
echo "disable server app_servers/app1" \
  | socat stdio /var/run/haproxy.sock

echo "enable server app_servers/app1" \
  | socat stdio /var/run/haproxy.sock
```

---

## 4. 헤더 조작

```nginx
# Nginx: 불필요한 헤더 제거, 보안 헤더 추가
proxy_hide_header X-Powered-By;
proxy_hide_header Server;

add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header Strict-Transport-Security "max-age=31536000" always;
```

```haproxy
# HAProxy: 응답 헤더 수정
http-response del-header Server
http-response set-header X-Frame-Options SAMEORIGIN
```

### X-Forwarded 헤더

| 헤더 | 내용 |
|------|------|
| `X-Forwarded-For` | 클라이언트 실제 IP (중간 프록시 IP 포함) |
| `X-Forwarded-Proto` | 원본 프로토콜 (http/https) |
| `X-Forwarded-Host` | 원본 Host 헤더 |
| `X-Real-IP` | 클라이언트 IP (Nginx 단독 헤더) |

---

## 5. 실무 체크리스트

```text
[ ] proxy_set_header Host, X-Real-IP 설정 (백엔드 로그 정확성)
[ ] proxy_http_version 1.1 + keepalive 설정 (성능)
[ ] 타임아웃 명시: connect/read/send 분리
[ ] 헬스체크: 모든 백엔드에 설정
[ ] Rate Limiting: API 엔드포인트 보호
[ ] 보안 헤더: X-Frame-Options, HSTS 추가
[ ] 서버 정보 헤더 제거: Server, X-Powered-By
[ ] 통계/모니터링: HAProxy stats 또는 Nginx stub_status
```

---

## 참고 문서

- [Nginx 리버스 프록시 가이드](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [HAProxy 설정 가이드](https://www.haproxy.com/documentation/)
- [RFC 7239 - Forwarded HTTP 헤더](https://www.rfc-editor.org/rfc/rfc7239)
