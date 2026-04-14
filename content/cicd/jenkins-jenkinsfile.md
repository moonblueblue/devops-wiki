---
title: "Jenkinsfile 작성 (Declarative vs Scripted)"
date: 2026-04-14
tags:
  - jenkins
  - jenkinsfile
  - pipeline
  - cicd
sidebar_label: "Jenkinsfile 작성"
---

# Jenkinsfile 작성

## 1. Declarative vs Scripted

| 항목 | Declarative | Scripted |
|-----|-------------|---------|
| 문법 | 구조적 (Jenkins DSL) | Groovy 자유 형식 |
| 가독성 | 높음 | 낮음 |
| 유연성 | 제한적 | 무제한 |
| 에러 검증 | 문법 사전 검증 | 런타임에만 발견 |
| 권장 | ✓ 신규 파이프라인 | 복잡한 로직 필요 시 |

---

## 2. Declarative Pipeline 전체 구조

```groovy
pipeline {
    agent any

    // 전역 옵션
    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()  // 동시 빌드 방지
    }

    // 파라미터
    parameters {
        string(name: 'ENVIRONMENT', defaultValue: 'staging')
        booleanParam(name: 'RUN_TESTS', defaultValue: true)
        choice(
            name: 'DEPLOY_TARGET',
            choices: ['staging', 'production'],
            description: '배포 대상'
        )
    }

    // 환경 변수
    environment {
        REGISTRY  = 'ghcr.io'
        APP_NAME  = 'myapp'
        IMAGE_TAG = "${BUILD_NUMBER}-${GIT_COMMIT.take(7)}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test') {
            when {
                expression { params.RUN_TESTS }
            }
            steps {
                sh 'npm ci && npm test'
            }
            post {
                always {
                    junit '**/test-results.xml'
                    publishHTML([
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        stage('Build Image') {
            steps {
                sh """
                    docker build \
                      -t ${REGISTRY}/${APP_NAME}:${IMAGE_TAG} .
                """
            }
        }

        stage('Push Image') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'github-registry',
                    usernameVariable: 'REG_USER',
                    passwordVariable: 'REG_PASS'
                )]) {
                    sh '''
                        echo ${REG_PASS} | docker login \
                          -u ${REG_USER} --password-stdin ${REGISTRY}
                        docker push ${REGISTRY}/${APP_NAME}:${IMAGE_TAG}
                    '''
                }
            }
        }

        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    kubectl set image deployment/myapp \
                      myapp=${REGISTRY}/${APP_NAME}:${IMAGE_TAG} \
                      -n ${params.ENVIRONMENT}
                    kubectl rollout status deployment/myapp \
                      -n ${params.ENVIRONMENT}
                """
            }
        }
    }

    post {
        always {
            cleanWs()      // 워크스페이스 정리
        }
        success {
            echo "배포 성공: ${APP_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "빌드 실패: ${currentBuild.currentResult}"
            // Slack 알림 등 추가 가능
        }
        unstable {
            echo "테스트 불안정"
        }
    }
}
```

---

## 3. Scripted Pipeline (필요한 경우)

```groovy
node('linux') {
    def imageTag = ""

    try {
        stage('Checkout') {
            checkout scm
            imageTag = sh(
                script: 'git rev-parse --short HEAD',
                returnStdout: true
            ).trim()
        }

        stage('Build') {
            sh "docker build -t myapp:${imageTag} ."
        }

        // 동적 스테이지 생성 (Declarative에서 어려운 경우)
        def environments = ['staging', 'production']
        environments.each { env ->
            stage("Deploy to ${env}") {
                if (env == 'production') {
                    input "프로덕션 배포 승인?"
                }
                sh "kubectl apply -k overlays/${env}"
            }
        }
    } catch (e) {
        currentBuild.result = 'FAILURE'
        throw e
    } finally {
        cleanWs()
    }
}
```

---

## 4. 자격증명 사용

```groovy
// 사용자명/비밀번호
withCredentials([usernamePassword(
    credentialsId: 'my-creds',
    usernameVariable: 'USER',
    passwordVariable: 'PASS'
)]) {
    sh 'docker login -u $USER -p $PASS registry.io'
}

// 시크릿 텍스트
withCredentials([string(
    credentialsId: 'api-token',
    variable: 'API_TOKEN'
)]) {
    sh 'curl -H "Authorization: Bearer $API_TOKEN" ...'
}

// SSH 키
withCredentials([sshUserPrivateKey(
    credentialsId: 'deploy-key',
    keyFileVariable: 'SSH_KEY'
)]) {
    sh 'ssh -i $SSH_KEY deploy@server.example.com'
}
```

---

## 참고 문서

- [Declarative Pipeline 문법](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Pipeline Steps Reference](https://www.jenkins.io/doc/pipeline/steps/)
- [자격증명 사용](https://www.jenkins.io/doc/book/pipeline/jenkinsfile/#handling-credentials)
