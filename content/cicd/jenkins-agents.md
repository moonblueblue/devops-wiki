---
title: "Jenkins 멀티 노드와 빌드 속도 최적화"
date: 2026-04-14
tags:
  - jenkins
  - agent
  - node
  - cicd
  - performance
sidebar_label: "멀티 노드·최적화"
---

# Jenkins 멀티 노드와 빌드 속도 최적화

## 1. Controller vs Agent 아키텍처

```
Jenkins Controller (컨트롤러)
    │ JNLP 또는 SSH
    ├── Agent 1 (linux, docker)
    ├── Agent 2 (linux, docker)
    └── Agent 3 (windows)
```

- **Controller**: UI, 스케줄링, 파이프라인 조정 (빌드 실행 금지)
- **Agent**: 실제 빌드 실행

> 컨트롤러에서 빌드를 실행하면 보안 위험이 있으므로
> `numExecutors: 0`으로 설정하고 전용 에이전트만 사용한다.

---

## 2. 에이전트 연결 방식

### SSH 방식

```
# Manage Jenkins → Nodes → New Node
이름: linux-agent-1
타입: Permanent Agent
# 설정:
Remote root directory: /home/jenkins
Labels: linux docker
Launch method: Launch agents via SSH
Host: 192.168.1.10
Credentials: jenkins-ssh-key
```

### JNLP 방식 (에이전트에서 연결)

```bash
# 에이전트 서버에서 실행
curl -sO http://jenkins:8080/jnlpJars/agent.jar
java -jar agent.jar \
  -url http://jenkins:8080/ \
  -secret <secret-key> \
  -name "linux-agent-1" \
  -workDir "/home/jenkins"
```

### Kubernetes Dynamic Agent (권장)

```yaml
# values.yaml (Helm)
agent:
  enabled: true
  podTemplates:
    default: |
      - name: default
        label: "k8s-agent"
        containers:
        - name: jnlp
          image: jenkins/inbound-agent:latest
        - name: docker
          image: docker:dind
          privileged: true
        - name: kubectl
          image: bitnami/kubectl:latest
          command: ["cat"]
          tty: true
```

```groovy
// Kubernetes 에이전트 사용
pipeline {
    agent {
        kubernetes {
            yaml '''
                spec:
                  containers:
                  - name: maven
                    image: maven:3.9-eclipse-temurin-21
                    command: [cat]
                    tty: true
                  - name: docker
                    image: docker:dind
                    securityContext:
                      privileged: true
            '''
        }
    }
    stages {
        stage('Build') {
            steps {
                container('maven') {
                    sh 'mvn package -DskipTests'
                }
            }
        }
    }
}
```

---

## 3. 빌드 속도 최적화

### 의존성 캐시

```groovy
// npm 캐시
stage('Install') {
    steps {
        sh '''
            npm ci --cache /var/jenkins_home/.npm \
              --prefer-offline
        '''
    }
}
```

### 병렬 실행

```groovy
stage('테스트') {
    parallel {
        stage('Unit') {
            steps { sh 'npm run test:unit' }
        }
        stage('E2E') {
            steps { sh 'npm run test:e2e' }
        }
        stage('Lint') {
            steps { sh 'npm run lint' }
        }
    }
}
```

### Stash / Unstash

빌드 결과를 에이전트 간에 전달한다.

```groovy
stage('Build') {
    agent { label 'builder' }
    steps {
        sh 'make build'
        stash name: 'build-output', includes: 'dist/**'
    }
}

stage('Deploy') {
    agent { label 'deployer' }
    steps {
        unstash 'build-output'
        sh 'rsync -av dist/ server:/var/www/'
    }
}
```

---

## 4. 레이블 전략

```groovy
// 레이블로 적합한 에이전트 선택
pipeline {
    agent {
        label 'linux && high-memory && docker'
    }
}

// 특정 레이블이 없으면 fallback
pipeline {
    agent {
        label 'docker || linux'
    }
}
```

```
에이전트 레이블 예시:
- linux, windows, macos
- docker, k8s
- high-memory (빌드 집약적 작업)
- gpu (ML 빌드)
- production-deploy (배포 전용)
```

---

## 참고 문서

- [Jenkins Agents](https://www.jenkins.io/doc/book/using/using-agents/)
- [Kubernetes Plugin](https://plugins.jenkins.io/kubernetes/)
