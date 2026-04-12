---
title: "Kubernetes v1.33~v1.36 릴리즈 총정리 (2025-2026)"
date: 2026-04-12
tags:
  - kubernetes
  - release
  - upgrade
---

# Kubernetes v1.33~v1.36 릴리즈 총정리 (2025-2026)

2025년 4월부터 2026년 4월까지 Kubernetes는 v1.33부터 v1.36까지 네 번의 메이저 릴리즈를 거쳤다. In-Place Pod Resize GA, Dynamic Resource Allocation GA, Ingress NGINX 종료, CEL 기반 Admission Policy GA 등 운영 환경에 즉시 영향을 주는 변화가 많았다. 이 글에서는 DevOps 엔지니어가 반드시 알아야 할 핵심 변경사항을 정리한다.

## 현재 지원 버전 (2026-04 기준)

| 버전 | 릴리즈일 | 상태 |
|------|----------|------|
| **v1.36** | 2026-04-22 (예정) | RC 단계 |
| **v1.35** "Timbernetes" | 2025-12-17 | 최신 안정 (v1.35.3) |
| **v1.34** "Of Wind & Will" | 2025-08-27 | 지원 중 (v1.34.6) |
| **v1.33** "Octarine" | 2025-04-23 | 지원 중 - 최하위 (v1.33.10) |

---

## 1. In-Place Pod Resource Resize (KEP-1287) — v1.35 GA

Pod를 재시작하지 않고 CPU/메모리를 동적으로 변경할 수 있다. v1.27에서 알파로 시작해 v1.33 베타를 거쳐 v1.35에서 GA되었다.

### 왜 중요한가

기존에는 리소스 변경 시 Pod 재생성이 필수였다. 이제 다운타임 없이 수직 스케일링이 가능해져, 트래픽 급증 시 HPA(수평)와 함께 VPA(수직)를 무중단으로 적용할 수 있다.

### 적용 예시

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: web
    image: nginx:1.27
    resources:
      requests:
        cpu: "500m"
        memory: "256Mi"
      limits:
        cpu: "1"
        memory: "512Mi"
    resizePolicy:
    - resourceName: cpu
      restartPolicy: NotRequired
    - resourceName: memory
      restartPolicy: NotRequired
```

런타임에 리소스 변경:

```bash
# Pod 재시작 없이 CPU를 2코어로 증가
kubectl patch pod app --subresource resize --patch \
  '{"spec":{"containers":[{"name":"web","resources":{"requests":{"cpu":"2"},"limits":{"cpu":"2"}}}]}}'

# 상태 확인
kubectl get pod app -o jsonpath='{.status.resize}'
# "Proposed" -> "InProgress" -> "" (완료)
```

> **주의**: 노드에 가용 리소스가 부족하면 `resize` 상태가 `Infeasible`로 표시되며, 이 경우 수동 개입이 필요하다.

---

## 2. Dynamic Resource Allocation (KEP-4381) — v1.34 GA

GPU, TPU, FPGA, 특수 NIC 등 비표준 하드웨어를 Kubernetes 네이티브로 할당할 수 있다. `resource.k8s.io/v1` API가 GA되었다.

### 핵심 API 리소스

| 리소스 | 역할 |
|--------|------|
| `ResourceSlice` | 노드가 광고하는 가용 디바이스 목록 |
| `DeviceClass` | 디바이스 유형별 정책 정의 |
| `ResourceClaim` | 워크로드의 디바이스 요청 |
| `ResourceClaimTemplate` | Pod 템플릿에서 동적 Claim 생성 |

### 적용 예시

```yaml
# GPU 2개를 요청하는 ResourceClaim
apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: gpu-claim
spec:
  devices:
    requests:
    - name: gpu
      deviceClassName: gpu.nvidia.com
      count: 2
---
apiVersion: v1
kind: Pod
metadata:
  name: ml-training
spec:
  resourceClaims:
  - name: gpu
    resourceClaimName: gpu-claim
  containers:
  - name: trainer
    image: my-ml-image:latest
    resources:
      claims:
      - name: gpu
```

v1.36에서는 **Device Taints/Tolerations**과 **Partitionable Devices**(GPU 파티셔닝)가 베타로 추가되어 AI/ML 워크로드 지원이 한층 강화되었다.

---

## 3. Ingress NGINX 종료 — 2026-03-24

Datadog 조사 기준 클라우드 네이티브 환경의 약 50%가 사용하던 Ingress NGINX 컨트롤러가 공식 종료되었다. 더 이상 보안 패치가 제공되지 않는다.

### 마이그레이션 경로

**Gateway API**로의 전환이 공식 권장 사항이다. SIG-Network은 `ingress2gateway` v1.0 (2026-03-20)을 출시하여 30개 이상의 어노테이션을 자동 변환한다.

```bash
# ingress2gateway 설치 및 실행
go install sigs.k8s.io/ingress2gateway@latest

# 기존 Ingress 리소스를 Gateway API로 변환
ingress2gateway print --input-file ingress.yaml > gateway.yaml

# 또는 클러스터에서 직접 변환
ingress2gateway print --all-namespaces > gateway-resources.yaml
```

변환 전후 비교:

```yaml
# Before: Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: app-svc
            port:
              number: 80
---
# After: Gateway API
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app
spec:
  parentRefs:
  - name: main-gateway
  hostnames:
  - "app.example.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: app-svc
      port: 80
```

> **참고**: Ingress API 리소스 자체는 폐기되지 않았다. 종료된 것은 ingress-nginx *컨트롤러*다. Istio, Contour, Traefik, Envoy Gateway 등 Gateway API를 지원하는 대안을 검토하라.

---

## 4. CEL 기반 Mutating Admission Policy — v1.36 GA

외부 웹훅 서버 없이 API 서버 내에서 CEL 표현식으로 리소스를 변조할 수 있다. v1.34에서 알파, v1.36에서 GA.

### 기존 방식 vs 새로운 방식

| | Webhook | CEL Admission Policy |
|---|---------|---------------------|
| 외부 서버 필요 | O | X |
| 네트워크 지연 | 있음 | 없음 (인프로세스) |
| 장애 영향 | 웹훅 다운 시 API 영향 | API 서버와 동일 생명주기 |
| 언어 | 자유 (Go, Python 등) | CEL |

### 적용 예시

모든 Pod에 자동으로 레이블을 추가하는 정책:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicy
metadata:
  name: add-team-label
spec:
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE"]
      resources: ["pods"]
  mutations:
  - patchType: ApplyConfiguration
    applyConfiguration:
      expression: >
        Object{
          metadata: Object.metadata{
            labels: {"managed-by": "platform-team"}
          }
        }
---
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicyBinding
metadata:
  name: add-team-label-binding
spec:
  policyName: add-team-label
```

---

## 5. 그 외 주요 변경사항

### Sidecar Containers GA (v1.33)

`initContainers`에 `restartPolicy: Always`를 지정하면 사이드카로 동작한다. 메인 컨테이너보다 먼저 시작되고, 메인 컨테이너 종료 후 정리된다.

```yaml
spec:
  initContainers:
  - name: log-collector
    image: fluentbit:latest
    restartPolicy: Always  # 이것이 사이드카의 핵심
```

### kube-proxy: iptables → nftables 전환

- v1.33: nftables 백엔드 베타
- v1.35: ipvs 모드 공식 디프리케이트
- 향후 nftables가 기본값이 될 예정

```bash
# nftables 모드 활성화 (kube-proxy ConfigMap)
kubectl edit configmap kube-proxy -n kube-system
# mode: "nftables"
```

### Pod Certificates (KEP-4317) — v1.35 베타

cert-manager나 SPIFFE/SPIRE 없이 kubelet이 직접 인증서를 발급하여 네이티브 mTLS를 지원한다.

### gitRepo Volume 제거 (v1.36)

v1.11 이후 디프리케이트 상태였던 `gitRepo` 볼륨 드라이버가 완전 제거되었다. root 권한으로 임의 코드 실행이 가능한 보안 취약점 때문이다. `init container` + `git-sync`로 대체하라.

### Service externalIPs 디프리케이트 (v1.36)

CVE-2020-8554(중간자 공격)로 인해 `spec.externalIPs`가 디프리케이트되었다. v1.43에서 제거 예정. LoadBalancer 서비스나 Gateway API로 마이그레이션이 필요하다.

---

## 업그레이드 체크리스트

v1.33 이하에서 v1.35+로 업그레이드할 때 확인할 사항:

- [ ] Ingress NGINX를 사용 중이라면 Gateway API 마이그레이션 계획 수립
- [ ] kube-proxy ipvs 모드를 사용 중이라면 nftables 전환 검토
- [ ] `gitRepo` 볼륨을 사용하는 워크로드가 있다면 init container 방식으로 변경
- [ ] `spec.externalIPs`를 사용하는 Service가 있다면 대안 마련
- [ ] DRA를 활용한 GPU/가속기 관리가 필요하다면 v1.34+ 업그레이드 고려
- [ ] In-Place Pod Resize를 활용하려면 v1.35+ 필요

---

## 참고 링크

- [Kubernetes v1.33 Release Blog](https://kubernetes.io/blog/2025/04/23/kubernetes-v1-33-release/)
- [Kubernetes v1.34 Release Blog](https://kubernetes.io/blog/2025/08/27/kubernetes-v1-34-release/)
- [Kubernetes v1.35 Release Blog](https://kubernetes.io/blog/2025/12/17/kubernetes-v1-35-release/)
- [Kubernetes v1.36 Sneak Peek](https://kubernetes.io/blog/2026/03/30/kubernetes-v1-36-sneak-peek/)
- [Ingress NGINX Retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
- [Kubernetes Releases](https://kubernetes.io/releases/)
- [Kubernetes Deprecation Guide](https://kubernetes.io/docs/reference/using-api/deprecation-guide/)
