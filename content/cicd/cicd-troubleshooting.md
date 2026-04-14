---
title: "CI/CD 파이프라인 트러블슈팅"
date: 2026-04-14
tags:
  - cicd
  - troubleshooting
  - github-actions
  - jenkins
sidebar_label: "파이프라인 트러블슈팅"
---

# CI/CD 파이프라인 트러블슈팅

## 1. 빌드 실패 진단 체크리스트

```
1. 에러 메시지 정확히 읽기
   → "error" 포함된 라인 찾기
   → 첫 번째 에러가 원인 (이후는 연쇄)

2. 로컬 재현 시도
   → 같은 명령어를 로컬에서 실행

3. 최근 변경사항 확인
   → git diff 또는 GitHub PR diff

4. 환경 차이 확인
   → 로컬과 CI 환경 버전 비교
```

---

## 2. GitHub Actions 일반 문제

### 권한 오류 (403/401)

```yaml
# 문제: GITHUB_TOKEN 권한 부족
# 해결: permissions 명시적 설정
permissions:
  contents: read
  packages: write
  id-token: write
```

### 시크릿 없음 (empty string)

```yaml
# 문제: fork PR에서 시크릿 접근 불가 (보안 정책)
# 해결: 환경 시크릿 또는 Repository Environments 사용
jobs:
  build:
    environment: staging
    # staging 환경의 시크릿만 사용
```

### 캐시 히트 안 됨

```yaml
# 확인: 캐시 키가 올바른지
- uses: actions/cache@v4
  with:
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    # package-lock.json이 있어야 해시가 생성됨

# 디버그: 캐시 키 출력
- run: |
    echo "캐시 키: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}"
```

### Job이 실행되지 않음

```yaml
# 문제: needs 조건 또는 if 조건 체크
jobs:
  deploy:
    needs: [test, build]
    if: |
      github.ref == 'refs/heads/main' &&
      needs.test.result == 'success'
    # 위 조건이 false이면 skipped 상태

# 디버그: 조건 출력
- run: |
    echo "ref: ${{ github.ref }}"
    echo "event: ${{ github.event_name }}"
```

---

## 3. Docker 빌드 문제

### 이미지 빌드 실패

```bash
# 로컬에서 동일 빌드 재현
docker buildx build \
  --platform linux/amd64 \
  --no-cache \
  -t myapp:debug \
  --progress=plain \   # 자세한 출력
  .
```

### 멀티플랫폼 빌드 실패

```yaml
# QEMU 에뮬레이터 필요 (arm64 빌드 시)
- uses: docker/setup-qemu-action@v3
- uses: docker/setup-buildx-action@v3

# arm64 빌드가 너무 느릴 때
- uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64  # amd64만 빌드 (CI에서)
    # arm64는 별도 파이프라인 또는 네이티브 Runner 사용
```

### 레이어 캐시 무효화

```dockerfile
# 의존성을 먼저 복사해 캐시 레이어 분리
COPY package*.json ./    # 이것만 변경 시 npm ci 재실행
RUN npm ci

COPY . .                 # 소스코드 변경 시 이후만 무효화
RUN npm run build
```

---

## 4. Jenkins 문제

### 빌드가 큐에서 대기 중

```
원인:
  - 사용 가능한 에이전트 없음
  - 레이블 불일치

확인:
  Manage Jenkins → Nodes → 에이전트 상태 확인
  빌드 큐에서 "pending" 이유 확인

해결:
  - 에이전트 재시작
  - 레이블 매핑 확인
```

### 스크립트 승인 오류

```
org.jenkinsci.plugins.scriptsecurity.sandbox.RejectedAccessException

해결:
  Manage Jenkins → In-process Script Approval
  → 해당 메서드 승인
  
또는 Groovy 샌드박스 우회 (주의 필요):
  @NonCPS 어노테이션 사용
```

### 워크스페이스 권한 오류

```bash
# 컨트롤러에서 직접 실행 (권장하지 않음)
# 에이전트 없이 실행 시 권한 문제 발생

# 해결: 에이전트 설정 확인
agent { label 'linux' }

# 또는 임시 해결: 워크스페이스 정리
stage('Clean') {
    steps {
        cleanWs()
    }
}
```

---

## 5. 느린 파이프라인 진단

```bash
# GitHub Actions - 각 Step 소요 시간 확인
# Actions 탭 → 빌드 → 각 Job 클릭 → Step 시간 확인

# 병목 구간 최적화 우선순위:
# 1. 의존성 설치 → 캐시로 해결
# 2. 빌드 시간 → 병렬화, 증분 빌드
# 3. 테스트 → 병렬화, 선택적 실행
# 4. 이미지 빌드 → 레이어 캐시, 멀티스테이지
```

---

## 6. 환경 변수 디버깅

```yaml
# 모든 환경 변수 출력 (시크릿 제외)
- name: 환경 변수 확인
  run: env | sort | grep -v SECRET

# 컨텍스트 덤프 (민감 정보 주의)
- name: 컨텍스트 출력
  run: echo '${{ toJSON(github) }}'

# 특정 변수만 확인
- run: |
    echo "ref: ${{ github.ref }}"
    echo "event: ${{ github.event_name }}"
    echo "sha: ${{ github.sha }}"
```

---

## 7. 자주 발생하는 에러 모음

| 에러 | 원인 | 해결 |
|-----|------|------|
| `Exit code 137` | OOM (메모리 부족) | 메모리 늘리기 또는 병렬 테스트 줄이기 |
| `ENOENT: no such file` | 경로 오류 | `working-directory` 확인 |
| `npm ERR! code ELIFECYCLE` | 스크립트 실패 | package.json 스크립트 확인 |
| `docker: permission denied` | Docker socket 권한 | `--privileged` 또는 그룹 추가 |
| `error: pathspec ... did not match` | Git 브랜치 없음 | `fetch-depth: 0` 설정 |
| `No space left on device` | 디스크 부족 | `docker system prune`, `cleanWs()` |

---

## 참고 문서

- [GitHub Actions 디버깅](https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/troubleshooting-workflows/enabling-debug-logging)
- [Jenkins 트러블슈팅](https://www.jenkins.io/doc/book/troubleshooting/)
