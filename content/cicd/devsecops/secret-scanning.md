---
title: "시크릿 스캔 — Gitleaks·TruffleHog·Push Protection·Rotation"
sidebar_label: "시크릿 스캔"
sidebar_position: 3
date: 2026-04-25
last_verified: 2026-04-25
tags:
  - cicd
  - devsecops
  - secret-scanning
  - gitleaks
  - trufflehog
---

# 시크릿 스캔

> **Git에 커밋된 시크릿은 "지워도 남는다"**. `git rebase`, force-push,
> BFG로 히스토리에서 제거해도 **이미 push된 커밋은 공개**되었고, 2025년
> GitHub "Oops Commits" 연구는 **삭제된 commit조차 수개월 뒤까지 조회
> 가능**함을 보여줬다. 시크릿 스캔의 목표는 **커밋 자체를 막는 것**이며,
> 이미 유출됐다면 **즉시 rotation**. 스캔은 **3단계** — pre-commit,
> pre-push/CI, 이력 전체 — 에 걸쳐야 한다.

- **도구**: Gitleaks, TruffleHog, detect-secrets, GitGuardian(SaaS),
  GitHub/GitLab/Bitbucket 내장
- **인접 글**: [SAST/SCA](./sast-sca.md), [이미지 스캔](./image-scanning-cicd.md),
  [SLSA](./slsa-in-ci.md)
- **시크릿 관리 도구** (Vault, ESO, Sealed Secrets, SOPS)는 `security/`
  카테고리 — 여기는 **탐지·차단**만

---

## 1. 왜 어려운가

### 1.1 시크릿 유출의 현실

- 2024년 GitHub 전수 조사: **공개 커밋에서 연간 수백만 건의 시크릿 유출**
- `git reset --hard` 후 force-push 했어도 **reflog·GitHub events API**로
  수개월 조회 가능
- pr 닫힌 후에도 PR 브랜치는 남음, fork에도 동일 커밋

### 1.2 "발견"만으로는 안 된다

```mermaid
flowchart LR
  LEAK[시크릿 발견] --> ROT[즉시 Rotation]
  ROT --> AUDIT[사용 감사]
  AUDIT --> REMOVE[히스토리 제거]
  REMOVE --> DISC[공격자 이미 확보 여부]
```

**시크릿은 한 번 push되면 공격자 손에 있다고 가정**. 히스토리 제거는
"정리"일 뿐 "복구"가 아니다. 공격받은 적이 없다는 증거가 없으면 반드시
rotation.

---

## 2. 스캔 엔진 비교

### 2.1 기본 탐지 방식

| 방식 | 설명 | 장단 |
|---|---|---|
| **Regex pattern** | AWS_KEY, GitHub PAT 등 형식 매칭 | 빠름 · false positive 많음 |
| **Entropy analysis** | 랜덤 string의 섀넌 엔트로피 임계 | 미지의 형식도 탐지 |
| **Verified (live check)** | 탐지된 credential을 실제 API 호출해 활성 여부 확인 | false positive ≈ 0 · API 호출 필요 |
| **Machine Learning** | 분류기 기반 (상용) | 고비용 |

### 2.2 OSS 주요 도구

| 도구 | 출처 | 특징 | 2026 추세 |
|---|---|---|---|
| **Gitleaks** | Zricethezav | 빠른 regex 스캐너, pre-commit에 최적 | ⭕ 기본 |
| **TruffleHog** | Truffle Security | 800+ credential 타입, **live verification** | ⭕ 깊이 검증 |
| **detect-secrets** | Yelp | entropy + plugin, **`.secrets.baseline`** 파일로 기존 finding snapshot, 신규 diff만 탐지 → 레거시 repo 도입 친화 | 점진 대체 |
| **Gitleaks + pre-commit.com** | 커뮤니티 | 개발자 환경 통합 | ⭕ |

### 2.3 상용·플랫폼 내장

| 제품 | 특징 |
|---|---|
| **GitHub Secret Protection** (2025-04 GHAS 분리) | secret scanning + **push protection** + custom pattern + validity check. Public repo 무료, Private은 $19/월 사용자 기준 |
| **GitLab Secret Detection** | CI/CD에 자동 통합, Ultimate tier에서 Push protection |
| **Bitbucket Secret Scanning** | Premium tier |
| **GitGuardian** | SaaS 플랫폼, 400+ detector, Slack 통합 |
| **Doppler / Akeyless / 1Password** | 시크릿 관리 본업이지만 스캔 기능 포함 |

**권장 조합**: **Gitleaks pre-commit + CI + 플랫폼 내장 push protection +
TruffleHog 주간 full-history sweep**.

---

## 3. 3단계 방어

### 3.1 Layer 1 — pre-commit (개발자 머신)

개발자가 `git commit` 전에 차단. 네트워크 없이 로컬에서 동작.

```yaml
# .pre-commit-config.yaml (pre-commit.com)
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.30.1          # 최신 안정(예시). Releases 확인 후 고정
    hooks:
      - id: gitleaks
```

```bash
# 설치
pip install pre-commit
pre-commit install

# 실행 (commit 시 자동)
git add .
git commit -m "feat: ..."
# → Gitleaks가 staged diff 검사, 실패 시 commit 거부
```

**장점**: 아예 repo에 기록되지 않음. **한계**: 개발자가 `--no-verify`로
우회 가능 → Layer 2·3 필수.

### 3.2 Layer 2 — pre-push / CI (조직 통제)

서버 쪽에서 강제. 우회 불가.

**GitHub Actions**

```yaml
# .github/workflows/secret-scan.yml
name: secret-scan
on:
  pull_request:
  push: {branches: [main]}
jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}      # full history (주간 전체 스캔용)
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}  # 조직 라이선스
```

**`fetch-depth: 0` 비용**: 대형 모노레포에서는 full clone에 수 분 + 디스크
GB 단위. 실무 표준은:

- **PR 단위**: `fetch-depth: 0` 대신 base ref만 fetch해 diff scan
- **주간 full sweep**: 별도 workflow로 `fetch-depth: 0`

**`GITLEAKS_LICENSE`**: Gitleaks 무료 tier의 org 사용 제한을 풀기 위한
조직 라이선스 키. Personal repo·공개 OSS에는 불필요.

**GitHub Push Protection** (권장)

- **GitHub Secret Protection** 활성 (2025-04부터 GHAS에서 분리된 독립 제품)
- **push 자체를 거부** — PR도 만들어지지 않음, 히스토리에 남지 않음
- 개발자 bypass는 **사유(false positive / test / fix later) 필수 + admin 통지**
- **Delegated bypass**: 특정 개인·팀만 bypass 가능, 나머지는 승인 플로우
- Custom pattern 정의 가능 (조직 고유 API key)

```text
Settings > Code security > Secret scanning
- Enable
- Push protection: Enabled
- Alert on unused tokens: Enabled
```

### 3.3 Layer 3 — full-history sweep (주기)

기존 커밋·브랜치·tag·fork 전체를 정기 스캔. TruffleHog가 강점 — **live
verification**으로 아직 활성 중인 자격증명 식별.

```bash
# 로컬에서 full history + verify
trufflehog git https://github.com/my-org/repo --only-verified

# Docker로 모든 branch·tag 스캔
docker run --rm -it trufflesecurity/trufflehog:latest \
  git https://github.com/my-org/repo \
  --only-verified --json > findings.json
```

**CI 주간**

```yaml
# GitHub Actions — 주간 전체 스캔
on:
  schedule:
    - cron: '0 2 * * 0'
jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: trufflesecurity/trufflehog@v3
        with:
          extra_args: --only-verified
```

Only-verified 모드는 **활성 키만** 보고 — rotation 우선순위 분류에 필수.

---

## 4. 탐지 대상 — 시크릿의 유형

| 유형 | 예 | 난이도 |
|---|---|---|
| Cloud API keys | AWS_ACCESS_KEY_ID, GCP service account JSON | 고정 prefix로 쉽게 탐지 |
| SCM tokens | GitHub PAT(`ghp_`), GitLab(`glpat-`) | prefix 확실 |
| DB 접속 문자열 | `postgres://user:pass@host` | URL 형식 |
| SaaS 토큰 | Slack(`xoxb-`), Stripe(`sk_live_`), Twilio | prefix 있음 |
| Private keys | `-----BEGIN RSA PRIVATE KEY-----` | 명확 |
| JWT | `eyJhbGciOi...` | 3-part base64 |
| 사설 | 조직 고유 API key | **custom pattern 필요** |
| 일반 비밀번호 | 무작위 high-entropy string | 가장 어려움 |

**custom pattern**이 핵심. 조직마다 내부 API 토큰 형식이 다르므로
`.gitleaks.toml`·GitHub custom pattern으로 등록 필수.

```toml
# .gitleaks.toml
[[rules]]
id = "internal-api-key"
description = "Internal platform API key"
regex = '''(?i)(platform_api_key|PLATFORM_KEY)[\s=:]+['"]?([a-z0-9]{32})['"]?'''
tags = ["key", "internal"]
```

---

## 5. False Positive 관리

### 5.1 흔한 false positive

- 예시·테스트용 placeholder: `AKIAIOSFODNN7EXAMPLE` (AWS 공식 예시)
- OSS vendored 파일의 샘플 key
- 로컬 개발용 dummy Postgres URL

### 5.2 Gitleaks allowlist

```toml
# .gitleaks.toml
[allowlist]
description = "Test fixtures"
paths = ['''.*test.*''', '''vendor/''']
regexes = [
  '''AKIAIOSFODNN7EXAMPLE''',    # AWS 공식 예시
]
```

### 5.3 코멘트 기반 allow

```python
API_KEY = "AKIA..."  # gitleaks:allow
```

### 5.4 원칙

- **repo-wide 전역 allow 금지** — 한 번의 실수를 일반화
- **경로·파일 한정**
- **분기별 재검토**
- 새 finding이 allowlist로 반복 자주 들어온다면 **패턴 자체가 잘못** —
  룰 튜닝

---

## 6. 유출 대응 Runbook

### 6.1 발견 즉시 (T+0분)

1. **rotation 우선**: 해당 credential이 활성이면 즉시 revoke·재발급
2. 영향 범위 조사: 어떤 서비스·계정에 사용되는지
3. **액세스 로그 조회**: AWS CloudTrail, GitHub audit log, DB slow log 등
   에서 해당 key 사용 이력

### 6.2 단기 (T+1시간)

4. 담당 팀 page (PagerDuty·Slack)
5. 보안 팀 통지
6. GitHub/GitLab에 **Security Advisory** 생성 (내부 또는 공개)

### 6.3 중기 (T+1일)

7. 히스토리 정리: `git filter-repo` (BFG는 더 이상 권장 안됨), force-push
8. 유사 패턴이 repo에 더 있는지 full-history sweep
9. Post-mortem — 왜 pre-commit에서 못 잡았는가

### 6.4 장기

10. 근본 대응 — ESO + Vault + short-lived credential (이상적으로는
    **정적 키 자체가 없어야**)

### 6.5 rotation 자동화

가능하면 credential을 **短-lived**로:

- AWS STS assume-role (1h)
- GitHub App installation token (1h)
- Vault dynamic secrets

정적 키가 필요하면 **30~90일 강제 rotation**. 시크릿 관리 도구 상세는
`security/` 카테고리.

---

## 7. 이력 제거 — 신화와 현실

### 7.1 "삭제"의 한계

```bash
# git filter-repo (BFG 대체)
git filter-repo --invert-paths --path secret.json
git push --force
```

> ⚠️ **`filter-repo`의 파급**: 모든 팀원이 repo를 **re-clone**해야 하고
> 기존 PR·브랜치·tag가 전부 무효화된다. 운영 중인 공유 repo에는 반드시
> 사전 공지 + 타임라인 조율. rotation 없이 filter-repo만 실행하는 것은
> 무의미.

이렇게 해도:

- GitHub **unreachable commit**이 일정 기간(최소 90일, GitHub 경우에 따라
  더) 접근 가능
- 2025년 GitHub "Oops Commits" 연구: **삭제된 commit이 GitHub events
  API로 수개월 조회** 가능
- 누군가 이미 fork·clone했다면 제거 불가
- **rotation 없이 히스토리 제거만 하면 아직 유출 상태**

### 7.2 결론

**히스토리 제거는 "정리"이지 "복구"가 아니다**. rotation이 우선.

---

## 8. 관측·대시보드

### 8.1 Verified vs Unverified

TruffleHog `--only-verified` 결과만 "긴급". unverified는 백로그.

### 8.2 Mean Time to Rotation (MTTR)

**시크릿 유출의 핵심 SLO**: 발견 후 rotation까지 시간.

| 등급 | MTTR 목표 |
|---|---|
| Cloud admin key | 1시간 이내 |
| Production DB | 4시간 이내 |
| 외부 SaaS | 24시간 이내 |
| 개발용 | 7일 이내 |

### 8.3 SIEM 통합

- GitHub Advanced Security alerts → Webhook → SIEM (Splunk, Datadog, Sumo)
- SOAR playbook: 자동 rotation 스크립트 트리거

---

## 9. 안티패턴

| 안티패턴 | 왜 문제 | 교정 |
|---|---|---|
| 스캔 없이 repo 운영 | 유출 누적 발견 안 됨 | 최소 CI Gitleaks |
| pre-commit만 의존 | `--no-verify`로 우회 | CI + push protection |
| CI에서만 스캔, push 후 | 이미 repo에 기록 | push protection |
| 발견만 하고 rotation 안 함 | 유출 상태 지속 | runbook으로 rotation 자동화 |
| 히스토리 제거로 "끝" | 아직 유출됨 | rotation이 먼저 |
| 모든 finding을 allowlist에 | 진짜 시크릿도 무시 | 경로·파일 한정 + 분기 재검토 |
| custom pattern 없음 | 사내 API key 놓침 | `.gitleaks.toml` custom rule |
| Public repo에 정적 키 | 분 단위 crawler에 포획 | STS assume-role, 동적 secret |
| `AWS_ACCESS_KEY_ID` CI env 평문 | 로그·fork 노출 | OIDC + IAM Role |
| private key를 Base64로 커밋 | 스캐너가 놓칠 수 있음 | ESO·Vault |
| `.env` 파일 commit | dotenv 보관 습관 | `.gitignore` + dotenv secrets |
| TruffleHog full sweep 안 함 | 활성 credential 식별 불가 | 주간 `--only-verified` |
| push protection OFF | 하한선 없음 | 조직 전 repo 강제 |
| bypass 로그 미감사 | 우회가 반복됨 | admin 알림 + 주간 리포트 |
| `git filter-repo` 후 rotation 생략 | 히스토리는 깨끗하나 키는 살아 있음 | 항상 rotation 먼저 |
| fork 존재 무시 | 제거가 무력화 | fork 삭제 요청은 한계 — GitHub cross-fork ghost ref 문제로 실효성 제한. **rotation이 유일한 진짜 해답** |

---

## 10. 도입 로드맵

1. **Gitleaks CI Gate**: PR에서 새 시크릿 차단 (5분 설정)
2. **Push Protection 활성**: GitHub/GitLab 플랫폼 설정
3. **pre-commit 표준화**: 조직 개발자 onboarding 문서에 추가
4. **Custom pattern**: 사내 API 토큰 형식 등록
5. **TruffleHog 주간 sweep**: `--only-verified` 기준 긴급 알림
6. **Rotation runbook**: 클라우드·DB·SaaS별 단축 절차
7. **MTTR SLO**: 등급별 목표 설정 + 측정
8. **SIEM·SOAR**: 자동 rotation 파이프라인
9. **근본 대응**: 정적 key → 동적 secret 이전
10. **교육**: 연 1회 시크릿 위생 훈련

---

## 11. 관련 문서

- [SAST·SCA](./sast-sca.md) — 코드·의존성 스캔
- [이미지 스캔](./image-scanning-cicd.md) — 이미지 내부 시크릿도 발견
- [SLSA](./slsa-in-ci.md)
- [GHA 보안](../github-actions/gha-security.md) — Actions OIDC·secrets
- 시크릿 관리 도구(Vault/ESO/SOPS/Sealed Secrets) — `security/` 카테고리

---

## 참고 자료

- [Gitleaks 공식](https://github.com/gitleaks/gitleaks) — 확인: 2026-04-25
- [TruffleHog 공식](https://github.com/trufflesecurity/trufflehog) — 확인: 2026-04-25
- [detect-secrets (Yelp)](https://github.com/Yelp/detect-secrets) — 확인: 2026-04-25
- [pre-commit.com](https://pre-commit.com/) — 확인: 2026-04-25
- [GitHub Secret Scanning Docs](https://docs.github.com/en/code-security/secret-scanning) — 확인: 2026-04-25
- [GitHub Push Protection](https://docs.github.com/en/code-security/secret-scanning/push-protection-for-repositories-and-organizations) — 확인: 2026-04-25
- [GitLab Secret Detection](https://docs.gitlab.com/ee/user/application_security/secret_detection/) — 확인: 2026-04-25
- [GitHub "Oops Commits" Research (2025)](https://www.infoq.com/news/2025/09/github-leaked-secrets/) — 확인: 2026-04-25
- [git-filter-repo](https://github.com/newren/git-filter-repo) — 확인: 2026-04-25
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) — 확인: 2026-04-25
