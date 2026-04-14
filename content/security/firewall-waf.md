---
title: "방화벽과 WAF (Web Application Firewall)"
date: 2026-04-14
tags:
  - firewall
  - waf
  - security
  - network
sidebar_label: "방화벽·WAF"
---

# 방화벽과 WAF

## 1. 방화벽 유형

| 유형 | 동작 계층 | 특징 |
|------|---------|------|
| 패킷 필터 | L3/L4 | IP/포트 기반, 빠름 |
| 상태 추적(Stateful) | L4 | 연결 상태 추적 |
| 애플리케이션 방화벽 | L7 | 내용 검사, 느림 |
| WAF | L7 HTTP | 웹 공격 전문 차단 |

---

## 2. iptables / nftables

### iptables 기본

```bash
# 인바운드 SSH만 허용, 나머지 차단
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -j DROP

# 특정 IP 차단
iptables -A INPUT -s 1.2.3.4 -j DROP

# 규칙 저장 (RHEL/CentOS)
service iptables save
# Ubuntu
iptables-save > /etc/iptables/rules.v4
```

### nftables (현대적 대안)

```bash
# /etc/nftables.conf
table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;

    # 루프백 허용
    iifname lo accept

    # 기존 연결 허용
    ct state established,related accept

    # SSH 허용
    tcp dport 22 accept

    # ICMP 허용
    icmp type echo-request accept
  }

  chain forward {
    type filter hook forward priority 0; policy drop;
  }

  chain output {
    type filter hook output priority 0; policy accept;
  }
}
```

---

## 3. WAF 개요

OWASP Top 10 공격을 HTTP 레벨에서 차단한다.

```
WAF가 막는 주요 공격:
  SQL Injection    → SELECT * FROM users WHERE id='1' OR '1'='1'
  XSS             → <script>document.cookie</script>
  Path Traversal  → /../../../etc/passwd
  CSRF            → 위조된 요청
  RCE             → eval(base64_decode(...))
```

---

## 4. ModSecurity + OWASP CRS

오픈소스 WAF 엔진. Nginx/Apache에 모듈로 통합.

```nginx
# nginx.conf with ModSecurity
server {
    listen 443 ssl;

    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsecurity/main.conf;

    location / {
        proxy_pass http://backend;
    }
}
```

```bash
# /etc/nginx/modsecurity/main.conf
Include /usr/share/modsecurity-crs/crs-setup.conf
Include /usr/share/modsecurity-crs/rules/*.conf

# 탐지 모드 (차단하지 않고 로깅만)
SecRuleEngine DetectionOnly

# 차단 모드
SecRuleEngine On
```

---

## 5. Kubernetes Ingress WAF

### NGINX Ingress + ModSecurity

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: webapp-ingress
  annotations:
    # WAF 활성화
    nginx.ingress.kubernetes.io/enable-modsecurity: "true"
    nginx.ingress.kubernetes.io/enable-owasp-core-rules: "true"
    nginx.ingress.kubernetes.io/modsecurity-snippet: |
      SecRuleEngine On
      SecRequestBodyAccess On
      # 특정 규칙 비활성화 (오탐 제거)
      SecRuleRemoveById 920350
spec:
  rules:
  - host: webapp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: webapp
            port:
              number: 80
```

---

## 6. 클라우드 WAF

```
AWS WAF:
  - ALB, CloudFront, API Gateway에 연결
  - AWS Managed Rules (OWASP, Bot Control)
  - Rate-based rules (DDoS 완화)

GCP Cloud Armor:
  - HTTPS Load Balancer에 연결
  - Preconfigured rules (OWASP CRS 포함)
  - Adaptive Protection (ML 기반 DDoS)

Azure WAF:
  - Application Gateway, Front Door에 연결
  - OWASP 3.2 규칙셋 내장
```

---

## 7. WAF 운영 패턴

```
탐지 모드 (Detection):
  → 먼저 탐지만 하고 로그 수집
  → 오탐(False Positive) 파악

튜닝:
  → 오탐 규칙 제외 (SecRuleRemoveById)
  → 정상 트래픽 패턴 화이트리스트

차단 모드 (Prevention):
  → 충분한 튜닝 후 전환
  → 지속적으로 오탐 모니터링
```

---

## 참고 문서

- [OWASP ModSecurity](https://owasp.org/www-project-modsecurity/)
- [OWASP Core Rule Set](https://coreruleset.org/)
- [nftables 공식 문서](https://wiki.nftables.org/)
