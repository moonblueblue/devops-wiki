---
title: "Jenkins Pipeline과 운영"
date: 2026-04-14
tags:
  - jenkins
  - cicd
  - pipeline
  - jenkinsfile
sidebar_label: "Jenkins"
---

# Jenkins Pipeline과 운영

## 1. Docker Compose로 설치

```yaml
# docker-compose.yaml
services:
  jenkins:
    image: jenkins/jenkins:lts-jdk21
    container_name: jenkins
    ports:
    - "8080:8080"
    - "50000:50000"
    volumes:
    - jenkins_home:/var/jenkins_home
    - /var/run/docker.sock:/var/run/docker.sock
    environment:
      JAVA_OPTS: "-Xmx2g -Xms512m"

volumes:
  jenkins_home:
```

```bash
docker compose up -d

# 초기 비밀번호 확인
docker logs jenkins | grep "initial Admin"
# 또는
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

---

## 2. Declarative Jenkinsfile

```groovy
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    parameters {
        string(name: 'ENVIRONMENT', defaultValue: 'staging')
        booleanParam(name: 'RUN_TESTS', defaultValue: true)
    }

    environment {
        REGISTRY    = 'ghcr.io'
        APP_NAME    = 'myapp'
        IMAGE_TAG   = "${BUILD_NUMBER}-${GIT_COMMIT.take(7)}"
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
                }
            }
        }

        stage('Build Image') {
            steps {
                sh '''
                    docker build \
                      -t ${REGISTRY}/${APP_NAME}:${IMAGE_TAG} .
                '''
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
                sh '''
                    kubectl set image deployment/myapp \
                      myapp=${REGISTRY}/${APP_NAME}:${IMAGE_TAG} \
                      -n ${ENVIRONMENT}
                    kubectl rollout status deployment/myapp \
                      -n ${ENVIRONMENT}
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "배포 성공: ${APP_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "빌드 실패: ${currentBuild.currentResult}"
        }
    }
}
```

---

## 3. Declarative vs Scripted Pipeline

| 항목 | Declarative | Scripted |
|-----|-------------|---------|
| 문법 | 구조적 (Jenkins DSL) | Groovy 자유 형식 |
| 가독성 | 높음 | 낮음 |
| 유연성 | 제한적 | 높음 |
| 권장 | ✓ 신규 파이프라인 | 복잡한 로직 필요 시 |

---

## 4. Multi Branch Pipeline

브랜치/PR마다 자동으로 파이프라인을 생성한다.

```
Jenkins → 저장소 스캔
    → branch: main     → Jenkinsfile 실행
    → branch: develop  → Jenkinsfile 실행
    → PR #123          → Jenkinsfile 실행
```

**설정**: Jenkins UI → New Item → Multibranch Pipeline
- Branch Sources: GitHub/GitLab
- Scan Triggers: 5분마다 또는 Webhook

```groovy
// 브랜치별 조건 분기
stage('Deploy') {
    when {
        branch 'main'         // main만 배포
    }
}

stage('PR 검증') {
    when {
        changeRequest()       // PR일 때만
    }
}
```

---

## 5. Shared Library

공통 파이프라인 로직을 중앙 관리한다.

```
shared-library/
├── vars/
│   ├── buildDockerImage.groovy
│   └── deployToK8s.groovy
└── src/
    └── com/company/Utils.groovy
```

```groovy
// vars/buildDockerImage.groovy
def call(Map config) {
    withCredentials([usernamePassword(
        credentialsId: config.credentialsId,
        usernameVariable: 'REG_USER',
        passwordVariable: 'REG_PASS'
    )]) {
        sh """
            docker build -t ${config.registry}/${config.name}:${BUILD_NUMBER} .
            echo \${REG_PASS} | docker login -u \${REG_USER} \
              --password-stdin ${config.registry}
            docker push ${config.registry}/${config.name}:${BUILD_NUMBER}
        """
    }
}
```

```groovy
// Jenkinsfile에서 사용
@Library('shared-pipeline-library') _

pipeline {
    agent any
    stages {
        stage('Build') {
            steps {
                script {
                    buildDockerImage(
                        registry: 'ghcr.io',
                        name: 'myapp',
                        credentialsId: 'github-registry'
                    )
                }
            }
        }
    }
}
```

**등록**: Manage Jenkins → System → Global Pipeline Libraries

---

## 6. Jenkins Configuration as Code (JCasC)

Jenkins 설정을 YAML 파일로 버전 관리한다.

```yaml
# jenkins.yaml
jenkins:
  systemMessage: "Jenkins managed by JCasC"
  numExecutors: 2

  securityRealm:
    local:
      allowsSignup: false

credentials:
  system:
    domainCredentials:
    - credentials:
      - usernamePassword:
          scope: GLOBAL
          id: github-registry
          username: ${GITHUB_USER}
          password: ${GITHUB_TOKEN}

unclassified:
  globalLibraries:
    libraries:
    - name: shared-pipeline-library
      defaultVersion: main
      retriever:
        modernSCM:
          scm:
            git:
              remote: "https://github.com/myorg/shared-lib.git"
              credentialsId: github-registry
```

```bash
# JCasC 플러그인 설치 후 환경변수로 경로 지정
CASC_JENKINS_CONFIG=/path/to/jenkins.yaml
```

---

## 7. GitHub Actions vs Jenkins

| 항목 | GitHub Actions | Jenkins |
|-----|---------------|---------|
| 설치·운영 | 불필요 | 직접 운영 |
| 비용 | 무료 2,000분/월 | 서버 비용 |
| 커스터마이징 | 제한적 | 무제한 |
| 레거시 연동 | 어려움 | 용이 |
| OIDC 지원 | 내장 | 플러그인 필요 |
| 권장 케이스 | GitHub 사용 팀 | 복잡한 온프레미스 |

---

## 참고 문서

- [Jenkins 공식 문서](https://www.jenkins.io/doc/)
- [Declarative Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [JCasC](https://www.jenkins.io/projects/jcasc/)
- [Shared Libraries](https://www.jenkins.io/doc/book/pipeline/shared-libraries/)
