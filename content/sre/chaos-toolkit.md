---
title: "Chaos Toolkit"
date: 2026-04-14
tags:
  - sre
  - chaos-toolkit
  - chaos-engineering
sidebar_label: "Chaos Toolkit"
---

# Chaos Toolkit

## 1. 개요

오픈소스 카오스 엔지니어링 프레임워크.
YAML/JSON으로 실험을 정의하고 자동 실행한다.

---

## 2. 설치

```bash
pip install chaostoolkit

# Kubernetes 드라이버
pip install chaostoolkit-kubernetes

# 검증
chaos --version
```

---

## 3. 실험 구조

```json
{
  "version": "1.0.0",
  "title": "payment-api Pod 삭제 후 복구 확인",
  "description": "Pod 강제 삭제 시 서비스 가용성 유지",

  "steady-state-hypothesis": {
    "title": "서비스 정상 상태",
    "probes": [
      {
        "type": "probe",
        "name": "payment-api-responds",
        "provider": {
          "type": "http",
          "url": "https://api.example.com/health",
          "timeout": 5
        },
        "tolerance": 200
      }
    ]
  },

  "method": [
    {
      "type": "action",
      "name": "kill-payment-pod",
      "provider": {
        "type": "python",
        "module": "chaosk8s.pod.actions",
        "func": "terminate_pods",
        "arguments": {
          "label_selector": "app=payment",
          "ns": "production",
          "rand": true
        }
      }
    },
    {
      "type": "probe",
      "name": "wait-for-recovery",
      "provider": {
        "type": "python",
        "module": "chaoslib.control",
        "func": "wait_for_x_seconds",
        "arguments": {"seconds": 30}
      }
    }
  ],

  "rollbacks": [
    {
      "type": "action",
      "name": "ensure-pods-running",
      "provider": {
        "type": "python",
        "module": "chaosk8s.pod.probes",
        "func": "pods_in_phase",
        "arguments": {
          "label_selector": "app=payment",
          "phase": "Running"
        }
      }
    }
  ]
}
```

---

## 4. 실험 실행

```bash
# 기본 실행
chaos run experiment.json

# 상세 로그
chaos --log-level DEBUG run experiment.json

# 드라이런 (실제 실행 없이 검증)
chaos validate experiment.json

# 결과 저장
chaos run experiment.json \
  --journal-path journal.json
```

---

## 5. 네트워크 지연 실험 (tc 기반)

```json
{
  "method": [
    {
      "type": "action",
      "name": "introduce-latency",
      "provider": {
        "type": "python",
        "module": "chaosk8s.node.actions",
        "func": "exec_in_pods",
        "arguments": {
          "cmd": "tc qdisc add dev eth0 root netem delay 500ms",
          "label_selector": "app=payment",
          "ns": "production"
        }
      }
    }
  ],
  "rollbacks": [
    {
      "type": "action",
      "name": "remove-latency",
      "provider": {
        "type": "python",
        "module": "chaosk8s.node.actions",
        "func": "exec_in_pods",
        "arguments": {
          "cmd": "tc qdisc del dev eth0 root",
          "label_selector": "app=payment",
          "ns": "production"
        }
      }
    }
  ]
}
```

---

## 6. CI 통합

```yaml
# GitHub Actions에서 카오스 실험
- name: 카오스 실험 실행
  run: |
    chaos run experiments/pod-failure.json \
      --journal-path results.json

- name: 결과 확인
  run: |
    cat results.json | jq '.status'
    # "completed" 이어야 통과
```

---

## 참고 문서

- [Chaos Toolkit 공식 문서](https://chaostoolkit.org/reference/usage/run/)
- [chaostoolkit-kubernetes](https://github.com/chaostoolkit-incubator/chaostoolkit-kubernetes)
