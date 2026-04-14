---
title: "Jenkins Job과 Pipeline"
date: 2026-04-14
tags:
  - jenkins
  - cicd
  - pipeline
  - job
sidebar_label: "Jenkins Job·Pipeline"
---

# Jenkins Job과 Pipeline

## 1. Job 유형

| 유형 | 특징 | 사용 시기 |
|-----|------|---------|
| **Freestyle** | GUI로 설정, 단순 | 간단한 빌드·스크립트 |
| **Pipeline** | Jenkinsfile 코드 | 복잡한 파이프라인 |
| **Multibranch Pipeline** | 브랜치별 자동 생성 | 대부분의 프로젝트 |
| **Folder** | Job 그룹 관리 | 팀/프로젝트 분리 |
| **Organization Folder** | GitHub Org 전체 스캔 | 대규모 조직 |

---

## 2. Pipeline 개념

```
Pipeline
  └── Stage (논리적 단계: Build, Test, Deploy)
        └── Step (실제 실행: sh, echo, withCredentials)
```

```groovy
pipeline {
    agent any

    stages {
        stage('Build') {
            steps {
                sh 'make build'
            }
        }

        stage('Test') {
            steps {
                sh 'make test'
            }
            post {
                always {
                    junit '**/test-results.xml'
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh 'make deploy'
            }
        }
    }
}
```

---

## 3. Parallel 스테이지

```groovy
stage('Test') {
    parallel {
        stage('Unit Test') {
            steps {
                sh 'npm run test:unit'
            }
        }
        stage('Integration Test') {
            steps {
                sh 'npm run test:integration'
            }
        }
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }
    }
}
```

---

## 4. Agent 유형

```groovy
// 어느 노드든
pipeline {
    agent any
}

// 특정 레이블의 노드
pipeline {
    agent {
        label 'linux && docker'
    }
}

// 컨테이너 안에서 실행
pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args '-v /tmp:/tmp'
        }
    }
}

// Kubernetes Pod에서 실행
pipeline {
    agent {
        kubernetes {
            yaml '''
                apiVersion: v1
                kind: Pod
                spec:
                  containers:
                  - name: gradle
                    image: gradle:8.5-jdk21
                    command: [cat]
                    tty: true
            '''
        }
    }
    stages {
        stage('Build') {
            steps {
                container('gradle') {
                    sh 'gradle build'
                }
            }
        }
    }
}
```

---

## 5. Input 스테이지 (수동 승인)

```groovy
stage('프로덕션 배포 승인') {
    when {
        branch 'main'
    }
    steps {
        input(
            message: '프로덕션에 배포할까요?',
            ok: '배포',
            submitter: 'admin,deploy-team',  // 승인 가능 사용자
            parameters: [
                choice(
                    name: 'ENVIRONMENT',
                    choices: ['prod', 'prod-us', 'prod-eu'],
                    description: '배포 대상 환경'
                )
            ]
        )
    }
}
```

---

## 6. 파이프라인 시각화

Jenkins Blue Ocean 플러그인을 설치하면
파이프라인을 시각적으로 확인할 수 있다.

```
Build → Test (병렬) → 보안 스캔 → Deploy Staging → 승인 → Deploy Prod
         ↓      ↓
      Unit    Integration
```

---

## 참고 문서

- [Pipeline 공식 문서](https://www.jenkins.io/doc/book/pipeline/)
- [Pipeline 문법](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Blue Ocean](https://www.jenkins.io/doc/book/blueocean/)
