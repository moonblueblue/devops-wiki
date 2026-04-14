---
title: "Jenkins Multi Branch Pipeline"
date: 2026-04-14
tags:
  - jenkins
  - multibranch
  - pipeline
  - cicd
sidebar_label: "Multi Branch Pipeline"
---

# Jenkins Multi Branch Pipeline

## 1. 개요

브랜치, PR마다 Jenkinsfile을 자동으로 감지해
개별 파이프라인을 생성한다.

```
Jenkins → 저장소 스캔 (주기적 또는 webhook)
    ├── branch: main     → Jenkinsfile 실행
    ├── branch: develop  → Jenkinsfile 실행
    ├── branch: feature/A → Jenkinsfile 실행
    └── PR #123           → Jenkinsfile 실행
```

---

## 2. 생성 방법

**Jenkins UI 경로**: Dashboard → New Item → Multibranch Pipeline

**설정 항목**:
- **Branch Sources**: GitHub / GitLab / Bitbucket / Git
- **Scan Triggers**: 주기적 스캔 (1분~하루) 또는 Webhook
- **Orphaned Item Strategy**: 삭제된 브랜치 처리

```groovy
// Jenkinsfile에서 브랜치 조건 분기
stage('배포') {
    when {
        branch 'main'        // main 브랜치만
    }
    steps {
        sh './deploy.sh prod'
    }
}

stage('스테이징 배포') {
    when {
        branch 'develop'     // develop 브랜치만
    }
    steps {
        sh './deploy.sh staging'
    }
}

stage('PR 검증') {
    when {
        changeRequest()      // PR일 때만
    }
    steps {
        sh 'npm run test:integration'
    }
}
```

---

## 3. GitHub Webhook 설정

PR/push 시 즉시 파이프라인을 트리거한다.

```
GitHub 저장소 → Settings → Webhooks → Add webhook
Payload URL: http://jenkins.example.com/github-webhook/
Content type: application/json
Events: Push, Pull requests
```

```bash
# Jenkins에서 GitHub Plugin 설치 필요
# Manage Jenkins → Plugins → GitHub Integration
```

---

## 4. PR 상태 보고

파이프라인 결과를 GitHub PR에 자동으로 표시한다.

```groovy
pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                sh 'make build'
            }
        }
    }

    post {
        success {
            // GitHub PR에 체크 상태 업데이트
            githubNotify(
                status: 'SUCCESS',
                description: '빌드 성공',
                context: 'ci/jenkins/build'
            )
        }
        failure {
            githubNotify(
                status: 'FAILURE',
                description: '빌드 실패',
                context: 'ci/jenkins/build'
            )
        }
    }
}
```

---

## 5. Organization Folder

GitHub Organization 전체를 자동 스캔한다.
새 저장소가 생기면 자동으로 파이프라인이 생성된다.

```
Jenkins Organization Folder
    → myorg (GitHub Organization)
        → repo-A (Multibranch Pipeline)
        → repo-B (Multibranch Pipeline)
        → repo-C (Multibranch Pipeline)
```

**설정**: New Item → GitHub Organization
- GitHub API URL
- 조직명
- 자격증명

---

## 6. Replay 기능

파이프라인 실패 시 Jenkinsfile을 수정해 재실행할 수 있다.
코드 push 없이 파이프라인 로직을 테스트할 때 유용하다.

```
빌드 결과 페이지 → Replay → Jenkinsfile 수정 → Run
```

---

## 참고 문서

- [Multibranch Pipeline](https://www.jenkins.io/doc/book/pipeline/multibranch/)
- [GitHub Branch Source Plugin](https://plugins.jenkins.io/github-branch-source/)
