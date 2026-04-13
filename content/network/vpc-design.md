---
title: "VPC 설계 (클라우드/온프레미스 공통)"
date: 2026-04-13
tags:
  - network
  - vpc
  - cloud
  - subnet
  - security
sidebar_label: "VPC 설계"
---

# VPC 설계 (클라우드/온프레미스 공통)

## 1. VPC 개념

VPC(Virtual Private Cloud)는 클라우드 위에 구성하는
논리적으로 격리된 가상 네트워크다.

```
클라우드 리전
    └── VPC (10.0.0.0/16)
            ├── 가용영역 A
            │     ├── 퍼블릭 서브넷  (10.0.1.0/24)
            │     └── 프라이빗 서브넷 (10.0.10.0/24)
            └── 가용영역 B
                  ├── 퍼블릭 서브넷  (10.0.2.0/24)
                  └── 프라이빗 서브넷 (10.0.11.0/24)
```

---

## 2. 퍼블릭 vs 프라이빗 서브넷

| 항목 | 퍼블릭 서브넷 | 프라이빗 서브넷 |
|------|------------|--------------|
| 인터넷 게이트웨이 | 연결됨 | 없음 |
| 외부 접근 | 가능 | 불가 |
| 외부 통신 | 직접 | NAT Gateway 경유 |
| 배치 자원 | LB, Bastion, NAT GW | 앱 서버, DB |

### 3-Tier 아키텍처 예시

```
인터넷
    ↓
[퍼블릭 서브넷] L7 로드밸런서 (ALB/Nginx)
    ↓
[프라이빗 서브넷] 애플리케이션 서버
    ↓
[DB 서브넷] RDS / DB 클러스터
```

---

## 3. NAT Gateway

프라이빗 서브넷의 리소스가 외부 인터넷에 **아웃바운드** 접근할 때 사용한다.

```
프라이빗 서버 → NAT Gateway (퍼블릭 서브넷) → 인터넷
                ↑
                소스 IP를 NAT GW의 공인 IP로 변환
```

| 항목 | NAT Gateway (관리형) | NAT Instance (직접 운영) |
|------|---------------------|------------------------|
| 관리 | 클라우드 자동 관리 | 직접 패치/운영 |
| 가용성 | 내장 HA | 직접 구성 필요 |
| 대역폭 | 자동 확장 | 인스턴스 스펙 한계 |
| 비용 | 상대적으로 비쌈 | 저렴 |
| 권장 | **운영 환경** | 비용 최적화 소규모 |

---

## 4. 보안 그룹 vs NACL

| 항목 | 보안 그룹 | NACL |
|------|---------|------|
| 적용 레벨 | 인스턴스(ENI) | 서브넷 |
| 상태 추적 | **Stateful** (응답 자동 허용) | Stateless (인/아웃 모두 명시) |
| 규칙 순서 | 없음 (모두 평가) | **있음** (낮은 번호 우선) |
| 기본 동작 | 허용 없음 (거부) | 모두 허용 |
| 주 용도 | 인스턴스 간 세밀한 제어 | 서브넷 단위 차단 |

```
패킷 흐름:
인터넷 → NACL (서브넷 진입) → 보안 그룹 (인스턴스 진입) → 앱
```

---

## 5. VPC 연결 옵션

### VPC Peering vs Transit Gateway

| 항목 | VPC Peering | Transit Gateway |
|------|-----------|----------------|
| 연결 구조 | 1:1 (양방향) | Hub-and-Spoke |
| VPC 수 | 소규모 적합 | **대규모 적합** |
| 전이적 라우팅 | **불가** | **가능** |
| 비용 | 낮음 | 상대적으로 높음 |
| 관리 복잡도 | VPC 증가 시 급증 | 중앙 집중 관리 |

```
VPC Peering (3개 VPC = 3개 피어링 필요):
VPC-A ←→ VPC-B
VPC-A ←→ VPC-C
VPC-B ←→ VPC-C

Transit Gateway (N개 VPC = N개 연결):
VPC-A ─┐
VPC-B ─┼→ TGW
VPC-C ─┘
```

### 온프레미스 연결

| 방식 | 특징 | 용도 |
|------|------|------|
| Site-to-Site VPN | 인터넷 경유, 암호화, 빠른 설정 | PoC, 백업 경로 |
| Direct Connect / ExpressRoute | 전용선, 낮은 레이턴시 | 운영 환경 |
| 두 방식 병행 | DX + VPN 이중화 | **고가용성 권장** |

---

## 6. 멀티 AZ 설계 원칙

```
리전
├── AZ-A
│    ├── 퍼블릭 서브넷 (10.0.1.0/24)
│    ├── 프라이빗 서브넷 (10.0.10.0/24)
│    └── NAT Gateway
└── AZ-B
     ├── 퍼블릭 서브넷 (10.0.2.0/24)
     ├── 프라이빗 서브넷 (10.0.11.0/24)
     └── NAT Gateway
```

- NAT Gateway는 AZ당 하나씩 배치 (AZ 장애 시 영향 최소화)
- 로드밸런서는 멀티 AZ 활성화
- DB는 멀티 AZ 복제 구성

---

## 7. VPC 설계 체크리스트

```text
[ ] CIDR 범위: 미래 확장 고려 (/16 이상 권장)
[ ] 서브넷 분리: 퍼블릭/프라이빗/DB 계층 분리
[ ] 멀티 AZ: 최소 2개 AZ에 서브넷 배치
[ ] NAT Gateway: AZ당 1개 배치
[ ] 보안 그룹: 최소 권한 원칙, 용도별 분리
[ ] NACL: 서브넷 단위 1차 방어선
[ ] VPC Peering/TGW: VPC 수 10개 이상 시 TGW 검토
[ ] 온프레미스 연결: DX + VPN 이중화
[ ] 흐름 로그(Flow Logs) 활성화: 보안 감사
```

---

## 참고 문서

- [AWS VPC 사용 설명서](https://docs.aws.amazon.com/vpc/latest/userguide/)
- [GCP VPC 네트워크 개요](https://cloud.google.com/vpc/docs/overview)
- [Azure Virtual Network 개요](https://learn.microsoft.com/azure/virtual-network/virtual-networks-overview)
- [RFC 1918 - 사설 주소](https://www.rfc-editor.org/rfc/rfc1918)
