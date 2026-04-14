---
title: "Jenkins 플러그인 관리"
date: 2026-04-14
tags:
  - jenkins
  - plugins
  - cicd
sidebar_label: "Jenkins 플러그인"
---

# Jenkins 플러그인 관리

## 1. 필수 플러그인 목록

### 파이프라인

| 플러그인 | 역할 |
|--------|------|
| `workflow-aggregator` | Pipeline 전체 기능 |
| `pipeline-stage-view` | Stage View UI |
| `blueocean` | 시각적 파이프라인 UI |

### 소스 연동

| 플러그인 | 역할 |
|--------|------|
| `git` | Git 기본 연동 |
| `github` | GitHub Webhook, PR 상태 |
| `github-branch-source` | GitHub Organization |
| `gitlab-plugin` | GitLab 연동 |

### 빌드 도구

| 플러그인 | 역할 |
|--------|------|
| `docker-workflow` | Docker 빌드 |
| `kubernetes` | Kubernetes 에이전트 |
| `maven-plugin` | Maven 빌드 |
| `nodejs` | Node.js 버전 관리 |

### 알림

| 플러그인 | 역할 |
|--------|------|
| `slack` | Slack 알림 |
| `email-ext` | 이메일 알림 |
| `mattermost-notification` | Mattermost |

### 보안

| 플러그인 | 역할 |
|--------|------|
| `role-strategy` | 역할 기반 권한 |
| `credentials-binding` | 자격증명 주입 |
| `matrix-auth` | 매트릭스 권한 |
| `owasp-markup-formatter` | XSS 방지 |

---

## 2. 플러그인 설치 방법

### UI에서 설치

```
Manage Jenkins → Plugins → Available plugins
→ 검색 → Install
```

### Jenkins CLI

```bash
# CLI JAR 다운로드
wget http://jenkins:8080/jnlpJars/jenkins-cli.jar

# 플러그인 설치
java -jar jenkins-cli.jar \
  -s http://jenkins:8080/ \
  -auth admin:password \
  install-plugin git workflow-aggregator kubernetes

# 재시작 후 적용
java -jar jenkins-cli.jar \
  -s http://jenkins:8080/ \
  -auth admin:password \
  safe-restart
```

### JCasC (plugins.txt)

```bash
# 도커 이미지 빌드 시 플러그인 사전 설치
FROM jenkins/jenkins:lts-jdk21

COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt
```

```text
# plugins.txt
workflow-aggregator:latest
git:latest
github:latest
github-branch-source:latest
kubernetes:latest
docker-workflow:latest
blueocean:latest
role-strategy:latest
slack:latest
configuration-as-code:latest
```

---

## 3. 플러그인 업데이트 전략

```
1. 스테이징 Jenkins에서 먼저 업데이트 테스트
2. 업데이트 전 Jenkins 설정 백업
3. 플러그인 CHANGELOG 확인 (breaking changes)
4. 한 번에 많은 플러그인 업데이트 금지
```

```bash
# 현재 설치된 플러그인 목록 추출
java -jar jenkins-cli.jar \
  -s http://jenkins:8080/ \
  -auth admin:password \
  list-plugins | awk '{print $1":"$NF}' > current-plugins.txt
```

---

## 4. 플러그인 의존성 확인

```bash
# 특정 플러그인의 의존성 확인
java -jar jenkins-cli.jar \
  -s http://jenkins:8080/ \
  -auth admin:password \
  list-plugins | grep 'required by'
```

---

## 5. 보안 권장사항

```
□ 업데이트 보안 알림 구독 (jenkins-security@)
□ 사용하지 않는 플러그인 제거
□ Script Approval 최소화
□ Groovy 스크립트 샌드박스 활성화
□ 플러그인 버전 고정 (Dockerfile)
```

---

## 참고 문서

- [Jenkins Plugin Index](https://plugins.jenkins.io/)
- [Plugin 설치 가이드](https://www.jenkins.io/doc/book/managing/plugins/)
