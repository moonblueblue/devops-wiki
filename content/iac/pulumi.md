---
title: "Pulumi 소개"
date: 2026-04-14
tags:
  - pulumi
  - iac
  - infrastructure
sidebar_label: "Pulumi"
---

# Pulumi 소개

## 1. 개요

일반 프로그래밍 언어(Python, TypeScript, Go, C#)로
인프라를 정의하는 오픈소스 IaC 도구.
HCL 대신 익숙한 언어를 사용할 수 있는 것이 핵심 장점이다.

| 항목 | Terraform | Pulumi |
|-----|-----------|--------|
| 언어 | HCL (전용 DSL) | Python, TypeScript, Go, C# |
| 로직 표현 | 제한적 | 반복문, 조건문, 함수 자유롭게 사용 |
| 테스트 | 어려움 | 단위 테스트 가능 |
| 학습 곡선 | HCL 새로 배워야 함 | 기존 언어 지식 활용 |
| 생태계 | 매우 넓음 (~76% 점유율) | 빠르게 성장 중 |
| State 관리 | 직접 또는 Terraform Cloud | Pulumi Cloud 또는 자체 관리 |

---

## 2. 설치 및 초기화

```bash
# Pulumi CLI 설치
curl -fsSL https://get.pulumi.com | sh

# 버전 확인
pulumi version

# 새 프로젝트 생성
pulumi new aws-python      # Python + AWS
pulumi new aws-typescript  # TypeScript + AWS
pulumi new kubernetes-go   # Go + Kubernetes
```

---

## 3. Python으로 인프라 정의

```python
# __main__.py
import pulumi
import pulumi_aws as aws

# VPC 생성
vpc = aws.ec2.Vpc("main-vpc",
    cidr_block="10.0.0.0/16",
    tags={"Environment": "production"})

# 서브넷
subnet = aws.ec2.Subnet("public-subnet",
    vpc_id=vpc.id,
    cidr_block="10.0.1.0/24",
    availability_zone="ap-northeast-2a")

# EC2 인스턴스
instance = aws.ec2.Instance("web-server",
    ami="ami-0c55b159cbfafe1f0",
    instance_type="t3.micro",
    subnet_id=subnet.id,
    tags={"Name": "web-server"})

# 출력
pulumi.export("instance_ip", instance.public_ip)
pulumi.export("vpc_id", vpc.id)
```

---

## 4. TypeScript 예시

```typescript
// index.ts
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";

// EKS 클러스터
const cluster = new aws.eks.Cluster("my-cluster", {
    roleArn: eksRole.arn,
    vpcConfig: {
        subnetIds: privateSubnets.ids,
    },
    version: "1.30",
});

// 동적 노드 그룹 생성 (반복문 활용)
const nodeGroups = ["general", "spot"].map(name =>
    new aws.eks.NodeGroup(`ng-${name}`, {
        clusterName: cluster.name,
        nodeGroupName: name,
        capacityType: name === "spot" ? "SPOT" : "ON_DEMAND",
    })
);

export const kubeconfig = cluster.kubeconfig;
```

---

## 5. 프로젝트 구조

```
my-infra/
├── Pulumi.yaml           # 프로젝트 메타데이터
├── Pulumi.dev.yaml       # dev 스택 설정
├── Pulumi.prod.yaml      # prod 스택 설정
├── __main__.py           # 인프라 코드 (Python)
└── requirements.txt
```

```yaml
# Pulumi.yaml
name: my-infra
runtime: python
description: 프로덕션 인프라

# Pulumi.prod.yaml
config:
  aws:region: ap-northeast-2
  my-infra:instanceType: t3.large
  my-infra:replicaCount: "3"
```

---

## 6. 워크플로우

```bash
# 스택 선택
pulumi stack select prod

# 변경 미리 보기 (terraform plan 동일)
pulumi preview

# 적용 (terraform apply 동일)
pulumi up

# 리소스 삭제
pulumi destroy

# 스택 목록
pulumi stack ls
```

---

## 7. State 관리

```bash
# Pulumi Cloud 로그인 (기본)
pulumi login

# 로컬 파일 백엔드
pulumi login --local

# S3 백엔드 (AWS)
pulumi login s3://my-bucket/pulumi-state

# GCS 백엔드
pulumi login gs://my-bucket/pulumi-state
```

---

## 8. 언제 Pulumi를 선택하는가

- 기존 Python/TypeScript 개발팀이 인프라 관리
- 복잡한 조건 로직이 필요한 인프라
- 단위 테스트로 인프라 코드 검증이 필요할 때
- HCL 학습 없이 빠른 시작이 필요할 때

---

## 참고 문서

- [Pulumi 공식 문서](https://www.pulumi.com/docs/)
- [AWS 가이드](https://www.pulumi.com/docs/clouds/aws/)
- [Pulumi vs Terraform](https://www.pulumi.com/docs/concepts/vs/terraform/)
