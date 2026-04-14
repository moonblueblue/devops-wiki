---
title: "GitHub Actions 트리거와 이벤트"
date: 2026-04-14
tags:
  - github-actions
  - triggers
  - events
  - cicd
sidebar_label: "GHA 트리거·이벤트"
---

# GitHub Actions 트리거와 이벤트

## 1. push / pull_request

```yaml
on:
  # 특정 브랜치 push
  push:
    branches:
    - main
    - "release/*"
    tags:
    - "v*"
    paths-ignore:
    - "docs/**"
    - "*.md"

  # PR 이벤트
  pull_request:
    branches: [main]
    types:
    - opened        # PR 생성
    - synchronize   # 새 커밋 push
    - reopened      # PR 재오픈
```

---

## 2. 스케줄 (cron)

```yaml
on:
  schedule:
  # 매일 오전 9시 (UTC 기준 → KST +9)
  - cron: "0 0 * * *"

  # 매주 월요일 오전 9시 KST
  - cron: "0 0 * * 1"

  # 평일 오전 9시~오후 6시 매시간
  - cron: "0 0-9 * * 1-5"
```

```
cron 형식: 분 시 일 월 요일
          0-59  0-23  1-31  1-12  0-6(0=일요일)
```

---

## 3. 수동 트리거 (workflow_dispatch)

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "배포 환경"
        required: true
        default: staging
        type: choice
        options:
        - staging
        - production
      dry-run:
        description: "실제 배포 없이 실행"
        type: boolean
        default: false
      version:
        description: "배포할 버전 태그"
        type: string
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - run: |
        echo "환경: ${{ inputs.environment }}"
        echo "Dry-run: ${{ inputs.dry-run }}"
        echo "버전: ${{ inputs.version }}"
```

---

## 4. 다른 Workflow에서 호출 (workflow_call)

```yaml
# .github/workflows/reusable-test.yaml
on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: "20"
    secrets:
      npm-token:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
    - run: npm ci
    - run: npm test
```

```yaml
# 호출하는 Workflow
jobs:
  run-tests:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "22"
    secrets:
      npm-token: ${{ secrets.NPM_TOKEN }}
```

---

## 5. 외부 이벤트 (repository_dispatch)

```yaml
on:
  repository_dispatch:
    types: [deploy-trigger, rebuild]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - run: |
        echo "이벤트 타입: ${{ github.event.action }}"
        echo "클라이언트 페이로드: ${{ toJSON(github.event.client_payload) }}"
```

```bash
# 외부에서 트리거
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/myorg/myrepo/dispatches \
  -d '{"event_type":"deploy-trigger","client_payload":{"version":"v2.0.0"}}'
```

---

## 6. 조건부 실행 (if)

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'   # main 브랜치만

  notify:
    if: always()    # 성공/실패 모두

  rollback:
    if: failure()   # 실패 시만

steps:
- name: 프로덕션만 실행
  if: github.event.inputs.environment == 'production'
  run: ./notify-oncall.sh
```

---

## 7. 경로 필터링

```yaml
on:
  push:
    branches: [main]
    paths:
    - "src/**"           # src 하위 변경 시만
    - "package*.json"

    paths-ignore:
    - "docs/**"
    - "**/*.md"
    - ".github/workflows/other.yaml"
```

---

## 참고 문서

- [이벤트 레퍼런스](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)
- [workflow_dispatch](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#workflow_dispatch)
