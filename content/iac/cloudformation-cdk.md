---
title: "CloudFormation vs CDK (AWS)"
date: 2026-04-14
tags:
  - cloudformation
  - cdk
  - aws
  - iac
sidebar_label: "CFn vs CDK"
---

# CloudFormation vs CDK (AWS)

## 1. 개요

AWS 전용 IaC 도구 두 가지.
CloudFormation은 YAML/JSON 템플릿을,
CDK는 일반 프로그래밍 언어를 사용한다.

| 항목 | CloudFormation | AWS CDK |
|-----|---------------|---------|
| 언어 | YAML / JSON | TypeScript, Python, Java, Go, C# |
| 추상화 수준 | 낮음 (리소스 1:1) | 높음 (Construct 추상화) |
| 학습 곡선 | 낮음 | 보통 |
| 재사용성 | 중간 (Nested Stack) | 높음 (Construct 라이브러리) |
| 테스트 | 어려움 | 단위 테스트 가능 |
| 출력 형식 | 그대로 CloudFormation | CloudFormation으로 변환 |
| AWS 서비스 지원 | 완전 지원 | 완전 지원 |
| 비용 | 무료 | 무료 |

---

## 2. CloudFormation 템플릿

```yaml
# vpc.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: VPC와 기본 네트워크 리소스

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  CidrBlock:
    Type: String
    Default: "10.0.0.0/16"

Resources:
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Ref CidrBlock
      EnableDnsHostnames: true
      Tags:
      - Key: Environment
        Value: !Ref Environment

  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: "10.0.1.0/24"
      AvailabilityZone: !Select [0, !GetAZs ""]

  WebServer:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-0c55b159cbfafe1f0
      InstanceType: !If [IsProd, t3.large, t2.micro]
      SubnetId: !Ref PublicSubnet

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub "${AWS::StackName}-VpcId"
```

```bash
# 스택 생성
aws cloudformation create-stack \
  --stack-name my-vpc \
  --template-body file://vpc.yaml \
  --parameters ParameterKey=Environment,ParameterValue=prod

# 변경 세트 (변경 전 미리보기)
aws cloudformation create-change-set \
  --stack-name my-vpc \
  --change-set-name my-changes \
  --template-body file://vpc.yaml

aws cloudformation describe-change-set \
  --stack-name my-vpc \
  --change-set-name my-changes

# 변경 세트 실행
aws cloudformation execute-change-set \
  --stack-name my-vpc \
  --change-set-name my-changes
```

---

## 3. AWS CDK (Python)

```python
# app.py
import aws_cdk as cdk
from constructs import Construct
from aws_cdk import (
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_elasticloadbalancingv2 as elbv2,
)

class WebStack(cdk.Stack):
    def __init__(self, scope: Construct, id: str,
                 env_name: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # VPC (NAT Gateway, 서브넷 자동 생성)
        vpc = ec2.Vpc(self, "VPC",
            max_azs=2,
            nat_gateways=1 if env_name == "prod" else 0,
        )

        # ECS 클러스터
        cluster = ecs.Cluster(self, "Cluster", vpc=vpc)

        # Fargate 서비스
        fargate_service = ecs.patterns.ApplicationLoadBalancedFargateService(
            self, "Service",
            cluster=cluster,
            cpu=256,
            memory_limit_mib=512,
            desired_count=2 if env_name == "prod" else 1,
            task_image_options=ecs.patterns.ApplicationLoadBalancedTaskImageOptions(
                image=ecs.ContainerImage.from_registry("nginx:latest"),
                container_port=80,
            ),
        )

        # 출력
        cdk.CfnOutput(self, "LoadBalancerDNS",
            value=fargate_service.load_balancer.load_balancer_dns_name)


app = cdk.App()
WebStack(app, "WebStack-Prod",
    env_name="prod",
    env=cdk.Environment(
        account="123456789012",
        region="ap-northeast-2"
    ))
app.synth()
```

```bash
# CDK 설치
npm install -g aws-cdk

# 초기화 (Python)
cdk init app --language python
pip install -r requirements.txt

# CloudFormation 템플릿 미리 생성
cdk synth

# 변경 미리보기
cdk diff

# 배포
cdk deploy

# 삭제
cdk destroy
```

---

## 4. CDK Construct 레벨

```
L1 (Cfn Constructs): CloudFormation 리소스와 1:1 매핑
  → CfnVpc, CfnBucket 등

L2 (AWS Constructs): AWS 모범사례 기본 적용
  → ec2.Vpc, s3.Bucket 등

L3 (Patterns): 여러 리소스를 묶은 패턴
  → ApplicationLoadBalancedFargateService 등
```

---

## 5. Terraform vs CloudFormation vs CDK

| 항목 | Terraform | CloudFormation | CDK |
|-----|-----------|---------------|-----|
| 클라우드 | 멀티클라우드 | AWS 전용 | AWS 전용 |
| 언어 | HCL | YAML/JSON | TypeScript/Python 등 |
| AWS 서비스 지원 속도 | 느림 (커뮤니티 의존) | 즉시 | 즉시 |
| 드리프트 감지 | 있음 | 있음 | CDK Drift (있음) |
| 비용 | 무료 / 유료 (Cloud) | 무료 | 무료 |
| 적합한 환경 | 멀티클라우드 | AWS 단독, 단순 | AWS 단독, 복잡한 로직 |

---

## 참고 문서

- [CloudFormation 공식 문서](https://docs.aws.amazon.com/cloudformation/)
- [AWS CDK 공식 문서](https://docs.aws.amazon.com/cdk/v2/guide/)
- [CDK API Reference](https://docs.aws.amazon.com/cdk/api/v2/)
