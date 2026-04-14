---
title: "주요 지표 (RED, USE, Golden Signals)"
date: 2026-04-14
tags:
  - observability
  - metrics
  - sre
  - red
  - use
sidebar_label: "RED·USE·Golden Signals"
---

# 주요 지표 (RED, USE, Golden Signals)

어떤 메트릭을 봐야 할지를 체계화한 방법론.
각 방법론이 서로 보완 관계에 있다.

## 1. RED Method (서비스 관점)

**Rate, Errors, Duration.**
요청을 처리하는 서비스 (API, 마이크로서비스)에 적합하다.

| 지표 | 내용 | PromQL 예시 |
|-----|------|-----------|
| **Rate** | 초당 요청 수 | `rate(http_requests_total[5m])` |
| **Errors** | 에러 비율 | `rate(http_requests_total{status=~"5.."}[5m])` |
| **Duration** | 응답 시간 (p95, p99) | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` |

```
서비스가 느리거나 에러가 나면 RED 지표가 먼저 변한다.
→ "뭔가 잘못됐다"는 신호
→ USE 또는 로그/트레이스로 원인 파악
```

---

## 2. USE Method (인프라 관점)

**Utilization, Saturation, Errors.**
CPU, 메모리, 네트워크 같은 시스템 리소스에 적합하다.

| 지표 | 내용 | 예시 |
|-----|------|------|
| **Utilization** | 리소스 사용률 | CPU 75%, 메모리 60% |
| **Saturation** | 처리 대기 정도 | Run Queue 길이, 디스크 I/O 대기 |
| **Errors** | 에러 이벤트 수 | 네트워크 패킷 드롭, 디스크 에러 |

```
인프라 문제 진단 순서:
  1. Errors 확인 → 하드웨어/OS 에러 있는가
  2. Utilization 확인 → 리소스가 포화에 가까운가
  3. Saturation 확인 → 큐잉이 발생하고 있는가
```

---

## 3. Four Golden Signals (Google SRE)

Google SRE Book에서 제안한 핵심 4가지 지표.

| 신호 | 내용 | 예시 |
|-----|------|------|
| **Latency** | 요청 처리 시간 | p95 응답시간 < 200ms |
| **Traffic** | 시스템 수요 | 초당 요청 수 (RPS) |
| **Errors** | 요청 실패율 | HTTP 5xx 비율 < 0.1% |
| **Saturation** | 리소스 포화 | CPU > 80%, 큐 길이 증가 |

```
우선순위: Latency = Errors > Saturation > Traffic
→ 사용자 경험에 직접 영향: Latency, Errors
→ 곧 문제가 생길 예측: Saturation
→ 맥락 파악용: Traffic
```

---

## 4. 방법론 비교

| 방법론 | 관점 | 주요 대상 |
|--------|-----|---------|
| RED | 요청 처리 | API, 마이크로서비스 |
| USE | 리소스 | CPU, 메모리, 디스크, 네트워크 |
| Golden Signals | 종합 | 전체 서비스 |

**실무 조합:**
- 서비스 SLO: RED + Golden Signals
- 인프라 알림: USE
- Kubernetes 노드: USE
- 애플리케이션 API: RED

---

## 5. SLI/SLO와의 연결

RED/Golden Signals는 SLI(Service Level Indicator)로 직결된다.

```
SLI 예시:
  → 요청의 99%가 200ms 이내에 처리됨
  → 에러율이 0.1% 미만 유지

SLO 예시:
  → 위 SLI가 28일 중 99.9% 충족됨
  → Error Budget: 43분/월
```

---

## 참고 문서

- [Google SRE Book: 4 Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)
- [USE Method](https://www.brendangregg.com/usemethod.html)
- [RED Method](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/)
