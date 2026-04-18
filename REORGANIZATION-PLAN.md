# 위키 재편 계획 (Phase 0 산출물)

이 문서는 2026-04-18 메인테이너의 명시적 재설계 지시에 따라 작성된 **1회성 개편 계획**이다.
이후 동일한 대규모 재편은 없으며, `CLAUDE.md`의 "index.md 임의 수정 금지" 원칙은 계속 유지된다.

---

## 1. 재편 요약

| 항목 | Before | After |
|---|---|---|
| 카테고리 수 | 12개 | **9개** |
| 총 글 수 (계획) | 약 800개 | **약 270개** |
| 계층 구조 | 평면 | **메인·서브·성장 3티어** |
| 사라지는 카테고리 | — | GitOps · Platform Engineering · FinOps |

---

## 2. 최종 카테고리 구조

```
[서브]   01 linux              25글   필수만
         02 network            20글   필수만
         03 container          10글   필수만
[메인]   04 kubernetes         70글   빠짐없이
         05 observability      45글   빠짐없이
         06 cicd               45글   빠짐없이 (GitOps 흡수)
[성장]   07 iac                15글   필수만
         08 security           20글   필수만
         09 sre                20글   필수만
                              ─────
                              270글
```

---

## 3. 사라지는 3개 카테고리 처리 매핑

### 3-A. `gitops/` 해체 (59글 → 40 흡수 / 10 나중에 / 9 제거)

| 기존 서브디렉토리 | 처리 | 새 위치 |
|---|---|---|
| `argocd-basics/` | 🟢 흡수 | `cicd/argocd/` |
| `argocd-advanced/` | 🟢 흡수 | `cicd/argocd/` |
| `argocd-operations/` | 🟢 흡수 | `cicd/argocd/` |
| `flux/` | 🟢 흡수 | `cicd/flux/` |
| `progressive-delivery/` | 🟢 흡수 | `cicd/progressive-delivery/` |
| `deploy-tools/` | 🟢 흡수 | `cicd/` 또는 `kubernetes/` (Helm·Kustomize는 K8s) |
| `secrets-management/` | 🟢 흡수 | `security/secrets-management/` (주인공 통합) |
| `multi-cluster/` | 🟢 흡수 | `kubernetes/multi-tenancy/` |
| `dependency-update/` | 🟢 흡수 | `cicd/dependency-management/` |
| `concepts/` (OpenGitOps) | 🟢 흡수 | `cicd/concepts/gitops-concepts.md` |
| `repo-structure/` | 🟢 흡수 | `cicd/concepts/repo-structure.md` |
| `gitops-iac/` | 🟡 나중에 | `iac/gitops-iac/` (Phase 2) |
| `gitops-security/` | 🔴 제거 | 중복 (security·cicd에 녹음) |

### 3-B. `platform-engineering/` 해체 (72글 → 20 흡수 / 20 나중에 / 32 제거)

| 기존 서브디렉토리 | 처리 | 새 위치 |
|---|---|---|
| `backstage/` | 🟡 나중에 | `cicd/developer-portal/` (Phase 2) |
| `idp-components/` (Score, KRO) | 🟢 흡수 | `kubernetes/extensibility/` |
| `ai-ml-platform/` | 🟢 흡수 | `kubernetes/ai-ml-workloads/` |
| `dev-environments/` (CDE) | 🟡 나중에 | `cicd/dev-tooling/` |
| `team-topologies/` | 🟢 흡수 | `sre/org-culture/` |
| `devex/` (SPACE, DORA, Core 4) | 🟢 흡수 | `sre/org-culture/devex-metrics.md` |
| `platform-observability/` | 🟢 흡수 | `observability/` |
| `platform-operations/` | 🟡 나중에 | 필요 시 |
| `api-platform/` | 🟡 나중에 | `kubernetes/service-networking/` |
| `scorecards-techradar/` | 🔴 제거 | 트렌드성 |
| `case-studies/` | 🔴 제거 | 공식 레퍼런스 위키에 불필요 |
| `alt-idp-tools/` | 🔴 제거 | 도구 나열, 공식 비교 참조 |
| `concepts/` (플랫폼 성숙도) | 🟡 나중에 | `sre/` |
| `platform-governance/` | 🔴 제거 | 조직 특화 |

### 3-C. `finops/` 해체 (72글 → 20 흡수 / 15 나중에 / 37 제거)

| 기존 서브디렉토리 | 처리 | 새 위치 |
|---|---|---|
| `k8s-cost/` (Kubecost, OpenCost) | 🟢 흡수 | `kubernetes/cost/` |
| `budget-alerts/` | 🟢 흡수 | `observability/alerting/` |
| `anomaly-detection/` | 🟢 흡수 | `observability/alerting/` |
| `tagging/` | 🟢 흡수 | `iac/operational/tagging-strategy.md` |
| `resource-optimization/` | 🟢 흡수 | `kubernetes/autoscaling/` |
| `cloud-cost-structure/` | 🟡 나중에 | `iac/cloud-vendor-iac/` |
| `concepts/` (FinOps Framework) | 🟡 나중에 | 독립 파일 1개 |
| `finops-for-ai/` | 🟡 나중에 | `kubernetes/ai-ml-workloads/` (Phase 2) |
| `finops-gitops/` (Pre-deploy cost gates) | 🟡 나중에 | `cicd/` (Phase 2) |
| `cost-allocation/` | 🟡 나중에 | |
| `cost-visibility/` (FOCUS) | 🟡 나중에 | |
| `pricing-models/` | 🔴 제거 | 공식 문서 대체 |
| `sustainability/` | 🔴 제거 | 역할 특화 |
| `saas-cost/` | 🔴 제거 | 역할 특화 |
| `org-culture/` | 🔴 제거 | 조직 특화 |
| `case-studies/` | 🔴 제거 | |

---

## 4. Sub·Growth 카테고리 슬림화

### 4-A. `linux/` (52 → 25)

**남김** (index.md 기준 25글):
- 배포판·기본기 4개
- Boot & Init 2개
- Process Isolation 4개
- Performance 4개
- Filesystem & Storage 3개
- Security 6개
- Logging 2개

**제거 후보** (27글):
- `distro-basics/immutable-os.md` (단 하나만 대표로 유지 가능)
- `distro-basics/nix-nixos.md` (특수 환경)
- `distro-basics/package-management.md` (공식 문서 대체)
- `boot-init/kernel-modules.md`, `kernel-parameters.md`, `scheduled-tasks.md` (참고용)
- `filesystem-storage/raid.md`, `mount-tuning.md` (서브 카테고리 "필수만" 기준 밖)
- `linux-security/` 일부 (명시 선택 필요)
- `network-basics/` 4개 → `network/`와 중복, 삭제
- `performance/` 일부 (bpf-co-re 등 심화)
- `shell-automation/` 전체 (공식 문서 대체)
- `terminal/` 전체 (참고서 영역)
- `virtualization/` 전체 (별도 카테고리 승격 시 재검토)
- `logging/log-management.md`와 `log-rotation.md` 통합

### 4-B. `network/` (54 → 20)
- 기존 파일 대부분 스텁 → index.md 재설계 목차를 **새 출발점**으로 사용
- 스텁 중 목차에 매칭되지 않는 파일 제거

### 4-C. `container/` (43 → 10)
- 동일하게 index.md 재설계 목차 기준 정리

### 4-D. `iac/` (59 → 15)
- Terraform 기초·심화 축소
- Cloud vendor IaC는 Phase 2
- AI-IaC는 필요 시 추가

### 4-E. `security/` (81 → 20)
- Secrets·공급망·PQC·Workload Identity 중심
- CIS·PCI 세부 컴플라이언스 제거
- 암호학 심화 제거

### 4-F. `sre/` (79 → 20)
- 방법론·원칙 중심
- Progressive Delivery 도구는 `cicd/`로
- SLO as Code 도구는 `observability/`로
- Case studies 제거

---

## 5. Main 카테고리 슬림화

### 5-A. `kubernetes/` (96 → 70)

**추가** (흡수):
- `cost/` (Kubecost, OpenCost) — FinOps에서
- `multi-cluster/` 이전 (GitOps에서 Karmada·Fleet)
- `extensibility/kro.md` 강화 (PE에서)
- `extensibility/validating-admission-policy.md` 신규 분리

**제거/통합**:
- `architecture/` 7글 → 6글 (controller-manager·kubelet 병합)
- `scheduling/` 7글 → 5글 (pod-overhead 등 생략)
- `management-tools/` 5글 → 3글 (stern, cluster-ui-tools 생략)
- `upgrade-operations/` 4글 → 2글 (cert-rotation은 security로)
- `special-workloads/` 3글 → 2글
- 기타 세부 주제 축소

### 5-B. `observability/` (74 → 45)
- `grafana/` 12글 → 3글
- `concepts/` 중복 정리
- Semantic Conventions·Exemplars 추가 (reviewer 지적)
- Cost Operations 간소화

### 5-C. `cicd/` (기존 61 + GitOps 흡수 → 45)
- GitHub Actions 축소 (자주 쓰는 패턴 중심)
- Jenkins 축소
- DevSecOps·Progressive Delivery·ArgoCD·Flux 강화

---

## 6. 수치 요약

| 구분 | 🟢 흡수 | 🟡 Phase 2 | 🔴 제거 |
|---|:-:|:-:|:-:|
| GitOps (59) | 40 | 10 | 9 |
| Platform Eng. (72) | 20 | 20 | 32 |
| FinOps (72) | 20 | 15 | 37 |
| Linux Sub (52→25) | 25 유지 | — | 27 |
| Network (54→20) | 20 | — | 34 (스텁) |
| Container (43→10) | 10 | — | 33 (스텁) |
| Kubernetes (96→70) | 70 | — | 26 |
| Observability (74→45) | 45 | — | 29 |
| IaC (59→15) | 15 | — | 44 (스텁) |
| Security (81→20) | 20 | — | 61 (스텁) |
| SRE (79→20) | 20 | — | 59 (스텁) |
| **합계** | **305** | **45** | **391** |

- **305글**이 새 구조의 뼈대 (메인 160 + 서브 55 + 성장 55 + 흡수분 35)
- **45글**은 Phase 2 backlog로 대기
- **391글**의 스텁·중복·트렌드 파일 제거

---

## 7. 실행 단계

| Phase | 내용 | 승인 지점 |
|:-:|---|---|
| **0** | CLAUDE.md + index.md × 10 작성 | 메인테이너 검토 (이 문서로 마무리) |
| **1** | 3개 카테고리 해체, 파일 이동/삭제 | Phase 0 승인 후 |
| **2** | 서브·성장 카테고리 슬림화 | Phase 1 완료 후 |
| **3** | Linux 형식 교정 (ASCII/Mermaid) | 병행 가능 |
| **4** | frontmatter 표준화 (`draft: true`, `last_verified`) | 병행 가능 |
| **5** | 집필 시작 (메인 3개 우선) | 구조 정비 완료 후 |

---

## 8. 롤백 전략

- 모든 변경은 **커밋 단위로 분리**하여 복구 가능
- `git revert`로 카테고리 단위 원복 가능
- 삭제된 글은 Git 이력으로 조회 가능 (필요 시 재추가)

---

## 9. 이 문서 이후

이 문서는 **1회성 재편 계획서**로서의 역할을 다하면 보존 목적으로만 유지된다.
이후의 위키 변경은 `CLAUDE.md`의 규칙(특히 "index.md 임의 수정 금지")을 따른다.

재편 완료 후 이 파일은:
- `.claude/history/2026-04-reorganization.md` 등으로 이관하거나
- 그대로 루트에 보존하여 구조 변경 이력으로 삼는다

메인테이너 선택에 따라 처리한다.
