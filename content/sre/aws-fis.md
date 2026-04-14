---
title: "AWS FIS (Fault Injection Service)"
date: 2026-04-14
tags:
  - sre
  - aws-fis
  - chaos-engineering
  - aws
sidebar_label: "AWS FIS"
---

# AWS FIS (Fault Injection Service)

## 1. 개요

AWS 관리형 카오스 엔지니어링 서비스.
EC2, EKS, RDS, ECS 등 AWS 서비스에
장애를 주입한다. IAM으로 권한 제어.

---

## 2. 주요 장애 유형

| 대상 | 장애 유형 |
|------|---------|
| EC2 | 인스턴스 중지/재시작/종료 |
| EKS | Pod 강제 종료, 노드 그룹 드레인 |
| RDS | 인스턴스 재시작, 페일오버 |
| ECS | 태스크 중지 |
| 네트워크 | 지연, 패킷 손실, 연결 거부 |
| CPU/메모리 | 리소스 과부하 주입 |

---

## 3. 실험 템플릿 생성

```bash
# AWS CLI로 FIS 실험 생성
aws fis create-experiment-template \
  --description "EKS Pod 종료 실험" \
  --actions '{
    "kill-pods": {
      "actionId": "aws:eks:terminate-nodegroup-instances",
      "parameters": {
        "instanceTerminationPercentage": "30"
      },
      "targets": {
        "nodeGroups": "eks-nodegroup"
      }
    }
  }' \
  --targets '{
    "eks-nodegroup": {
      "resourceType": "aws:eks:nodegroup",
      "resourceArns": [
        "arn:aws:eks:ap-northeast-2:123456789012:nodegroup/my-cluster/my-nodegroup/xxx"
      ],
      "selectionMode": "ALL"
    }
  }' \
  --stop-conditions '[
    {
      "source": "aws:cloudwatch:alarm",
      "value": "arn:aws:cloudwatch:...:alarm/HighErrorRate"
    }
  ]' \
  --role-arn arn:aws:iam::123456789012:role/FISRole
```

---

## 4. 안전 장치 (Stop Condition)

```json
{
  "stopConditions": [
    {
      "source": "aws:cloudwatch:alarm",
      "value": "arn:aws:cloudwatch:...:alarm/CriticalAlarm"
    }
  ]
}
```

```
중단 조건:
  CloudWatch Alarm이 ALARM 상태가 되면
  → FIS 실험 자동 중단
  → 이미 주입된 장애도 롤백
```

---

## 5. Terraform으로 FIS 관리

```hcl
resource "aws_fis_experiment_template" "pod_failure" {
  description = "EKS Pod 종료 실험"
  role_arn    = aws_iam_role.fis.arn

  action {
    name      = "kill-pods"
    action_id = "aws:eks:terminate-nodegroup-instances"

    parameter {
      key   = "instanceTerminationPercentage"
      value = "25"
    }

    target {
      key   = "nodeGroups"
      value = "eks-nodegroup"
    }
  }

  target {
    name           = "eks-nodegroup"
    resource_type  = "aws:eks:nodegroup"
    selection_mode = "PERCENT(25)"

    resource_tag {
      key   = "Environment"
      value = "production"
    }
  }

  stop_condition {
    source = "aws:cloudwatch:alarm"
    value  = aws_cloudwatch_metric_alarm.high_error.arn
  }
}
```

---

## 6. 실험 실행

```bash
# 실험 시작
aws fis start-experiment \
  --experiment-template-id EXT123456789

# 상태 확인
aws fis get-experiment \
  --id EXPTABC123 \
  --query 'experiment.state'

# 실험 중단
aws fis stop-experiment \
  --id EXPTABC123
```

---

## 참고 문서

- [AWS FIS 공식 문서](https://docs.aws.amazon.com/fis/latest/userguide/)
- [AWS FIS 실습](https://chaos.aws/)
- [FIS Terraform 리소스](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/fis_experiment_template)
