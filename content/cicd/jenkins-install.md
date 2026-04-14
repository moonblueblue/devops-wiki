---
title: "Jenkins 설치 (standalone, Docker)"
date: 2026-04-14
tags:
  - jenkins
  - cicd
  - install
sidebar_label: "Jenkins 설치"
---

# Jenkins 설치

## 1. 설치 방법 비교

| 방법 | 특징 | 적합한 경우 |
|-----|------|-----------|
| Docker Compose | 빠른 시작, 이식성 | 개발·테스트 |
| Kubernetes (Helm) | 확장성, 운영 편의 | 프로덕션 |
| Standalone (WAR) | 단순, 직접 제어 | 소규모 팀 |
| CloudBees CI | 엔터프라이즈 지원 | 대규모 조직 |

---

## 2. Docker Compose 설치

```yaml
# docker-compose.yaml
services:
  jenkins:
    image: jenkins/jenkins:lts-jdk21
    container_name: jenkins
    user: root
    ports:
    - "8080:8080"
    - "50000:50000"   # 에이전트 연결 포트
    volumes:
    - jenkins_home:/var/jenkins_home
    - /var/run/docker.sock:/var/run/docker.sock  # Docker-in-Docker
    environment:
      JAVA_OPTS: "-Xmx2g -Xms512m"
    restart: unless-stopped

volumes:
  jenkins_home:
```

```bash
docker compose up -d

# 초기 관리자 비밀번호 확인
docker logs jenkins 2>&1 | grep -A5 "initial Admin"
# 또는
docker exec jenkins \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

---

## 3. Kubernetes (Helm) 설치

```bash
helm repo add jenkins https://charts.jenkins.io
helm repo update

helm install jenkins jenkins/jenkins \
  --namespace jenkins \
  --create-namespace \
  -f jenkins-values.yaml
```

```yaml
# jenkins-values.yaml
controller:
  tag: "2.504"
  numExecutors: 0    # 에이전트만 사용 (컨트롤러에서 빌드 금지)
  resources:
    requests:
      cpu: "500m"
      memory: "512Mi"
    limits:
      cpu: "2"
      memory: "2Gi"

  installPlugins:
  - kubernetes:latest
  - workflow-aggregator:latest
  - git:latest
  - configuration-as-code:latest
  - blueocean:latest

persistence:
  storageClass: "standard"
  size: "20Gi"

agent:
  enabled: true
  defaultsProviderTemplate: ""
```

```bash
# 관리자 비밀번호 확인
kubectl exec -n jenkins -it svc/jenkins \
  -- cat /run/secrets/additional/chart-admin-password
```

---

## 4. Standalone (WAR 파일)

```bash
# Java 21 필요
java -version

# Jenkins WAR 다운로드
wget https://get.jenkins.io/war-stable/latest/jenkins.war

# 실행
java -jar jenkins.war \
  --httpPort=8080 \
  --prefix=/jenkins

# 서비스로 등록 (systemd)
sudo tee /etc/systemd/system/jenkins.service << 'EOF'
[Unit]
Description=Jenkins

[Service]
ExecStart=/usr/bin/java -jar /opt/jenkins/jenkins.war
User=jenkins
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now jenkins
```

---

## 5. 초기 설정 체크리스트

```
□ 초기 비밀번호로 로그인
□ 권장 플러그인 설치
□ 관리자 계정 설정
□ 시스템 설정 (실행자 수, URL)
□ 보안 설정 (매트릭스 권한 또는 Role-based)
□ 자격증명 (GitHub 토큰, 레지스트리 계정) 등록
□ JCasC 설정으로 모든 설정 코드화
```

---

## 참고 문서

- [Jenkins 공식 설치 가이드](https://www.jenkins.io/doc/book/installing/)
- [Jenkins Helm Chart](https://github.com/jenkinsci/helm-charts)
