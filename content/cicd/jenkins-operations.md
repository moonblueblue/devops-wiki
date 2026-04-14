---
title: "Jenkins 운영 (백업, 모니터링, 보안)"
date: 2026-04-14
tags:
  - jenkins
  - jcasc
  - operations
  - cicd
sidebar_label: "Jenkins 운영"
---

# Jenkins 운영

## 1. JCasC (Configuration as Code)

Jenkins 전체 설정을 YAML로 코드화한다.
UI 클릭 없이 Jenkins를 일관되게 복구·재현할 수 있다.

```yaml
# jenkins.yaml
jenkins:
  systemMessage: "Jenkins managed by JCasC"
  numExecutors: 0    # 컨트롤러에서 빌드 실행 금지

  securityRealm:
    local:
      allowsSignup: false
      users:
      - id: admin
        password: "${JENKINS_ADMIN_PASSWORD}"

  authorizationStrategy:
    roleBased:
      roles:
        global:
        - name: admin
          permissions:
          - Overall/Administer
          assignments:
          - admin

credentials:
  system:
    domainCredentials:
    - credentials:
      - usernamePassword:
          scope: GLOBAL
          id: github-registry
          username: "${GITHUB_USER}"
          password: "${GITHUB_TOKEN}"
      - string:
          scope: GLOBAL
          id: slack-token
          secret: "${SLACK_TOKEN}"

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

  slackNotifier:
    teamDomain: mycompany
    tokenCredentialId: slack-token
    room: "#jenkins-alerts"
```

```bash
# JCasC 플러그인 설치 후 경로 지정
CASC_JENKINS_CONFIG=/path/to/jenkins.yaml
# 또는
# Manage Jenkins → System → Configuration as Code → Apply new configuration
```

---

## 2. 백업

### 백업 대상

```
/var/jenkins_home/
├── config.xml               # Jenkins 전체 설정
├── jobs/                    # Job 설정 및 빌드 히스토리
├── plugins/                 # 설치된 플러그인
├── secrets/                 # 자격증명 암호화 키
└── casc_configs/            # JCasC 파일
```

### 백업 스크립트

```bash
#!/bin/bash
# jenkins-backup.sh
JENKINS_HOME="/var/jenkins_home"
BACKUP_DIR="/backup/jenkins"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "${BACKUP_DIR}"

# 설정 파일만 백업 (빌드 히스토리 제외)
tar -czf "${BACKUP_DIR}/jenkins-config-${DATE}.tar.gz" \
  --exclude="${JENKINS_HOME}/jobs/*/builds" \
  --exclude="${JENKINS_HOME}/workspace" \
  "${JENKINS_HOME}"

# 오래된 백업 삭제 (30일 이상)
find "${BACKUP_DIR}" -name "*.tar.gz" -mtime +30 -delete
```

```bash
# Kubernetes에서 PV 스냅샷
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: jenkins-backup-$(date +%Y%m%d)
  namespace: jenkins
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: jenkins
EOF
```

---

## 3. 모니터링

### Prometheus + Grafana 연동

```bash
# Prometheus Plugin 설치
# Manage Jenkins → Plugins → prometheus
```

```yaml
# prometheus.yaml (스크레이프 설정)
scrape_configs:
- job_name: jenkins
  metrics_path: /prometheus
  static_configs:
  - targets: ['jenkins:8080']
```

**주요 메트릭**:

| 메트릭 | 의미 |
|-------|------|
| `jenkins_builds_total` | 전체 빌드 수 |
| `jenkins_build_duration_seconds` | 빌드 시간 분포 |
| `jenkins_executors_available` | 가용 실행자 수 |
| `jenkins_queue_size_value` | 대기 중인 빌드 수 |
| `jenkins_plugins_active` | 활성 플러그인 수 |

---

## 4. 보안 설정

```groovy
// Manage Jenkins → Security → Script Approval
// 승인 없이 실행 가능한 스크립트를 제한

// Sandbox 모드 (파이프라인 스크립트)
// 대부분의 경우 sandbox에서 실행 가능
// 특수 기능 필요 시 Script Approval에 추가
```

```yaml
# JCasC 보안 설정
jenkins:
  authorizationStrategy:
    roleBased:
      roles:
        global:
        - name: developer
          permissions:
          - Job/Build
          - Job/Cancel
          - Job/Read
          - View/Read
          assignments:
          - "authenticated"

  remotingSecurity:
    enabled: true    # 에이전트 공격 방지
```

---

## 5. 업그레이드 전략

```
1. 릴리즈 노트 확인 (LTS 채널 추천)
2. 스테이징 Jenkins에서 먼저 업그레이드
3. 업그레이드 전 전체 백업
4. 플러그인 호환성 확인
5. 프로덕션 업그레이드 (낮은 트래픽 시간대)
6. 문제 발생 시 즉시 롤백
```

```bash
# Docker 이미지 태그 고정 (예측 가능한 업그레이드)
image: jenkins/jenkins:2.504-jdk21   # 버전 명시
# 절대: jenkins/jenkins:latest 사용 금지
```

---

## 참고 문서

- [JCasC 공식 문서](https://www.jenkins.io/projects/jcasc/)
- [Prometheus Plugin](https://plugins.jenkins.io/prometheus/)
- [Jenkins 보안 가이드](https://www.jenkins.io/doc/book/security/)
