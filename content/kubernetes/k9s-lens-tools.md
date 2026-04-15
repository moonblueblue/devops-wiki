---
title: "k9s, Lens, kubectx/kubens"
date: 2026-04-14
tags:
  - kubernetes
  - k9s
  - lens
  - kubectx
  - kubectl
  - tools
sidebar_label: "k9s·Lens·kubectx"
---

# k9s, Lens, kubectx/kubens

## 1. k9s

터미널 기반 Kubernetes UI.
kubectl 명령어 없이 키보드만으로 클러스터를 관리한다.

```bash
# 설치
brew install k9s        # macOS
# Linux: https://github.com/derailed/k9s/releases
```

### 기본 단축키

```
:           명령 모드 진입
/           검색·필터
d           Describe
e           Edit (YAML 편집기)
l           Logs
s           Shell (exec)
Shift+F     Port Forward
y           YAML 보기
Ctrl+D      Delete
?           전체 단축키 목록
q           뒤로 가기 / 종료
```

### 명령 모드

`:` 입력 후 리소스 이름 입력:

```
:pods           :deployments    :services
:nodes          :configmaps     :secrets
:pvc            :ingress        :events
:statefulsets   :daemonsets     :jobs
```

### 로그 보기

```
l       로그 보기
f       follow 토글
p       이전 컨테이너 로그
Shift+O 타임스탬프 토글
Shift+C 로그 복사
```

### 플러그인 예시

`~/.config/k9s/plugins.yaml`:

```yaml
plugins:
  # Deployment 재시작
  restart:
    shortCut: Ctrl-R
    confirm: false
    description: "Restart deployment"
    scopes: [deployments]
    command: sh
    args:
    - -c
    - "kubectl rollout restart deploy/$NAME -n $NAMESPACE"

  # stern으로 멀티 Pod 로그
  multi-logs:
    shortCut: Shift-L
    confirm: false
    description: "Tail logs (stern)"
    scopes: [pods]
    command: sh
    args:
    - -c
    - "stern $NAME -n $NAMESPACE"
```

### 설정 파일

`~/.config/k9s/config.yaml`:

```yaml
k9s:
  refreshRate: 2
  readOnly: false
  ui:
    skin: dracula
  logger:
    tail: 200
    showTime: true
```

---

## 2. Lens / FreeLens

### 2025-2026 현황

| 도구 | 상태 | 비고 |
|-----|------|------|
| Lens (Mirantis) | 유료 상용 | 기업용 |
| FreeLens | 오픈소스 활성 | 커뮤니티 관리 대안 |
| OpenLens | 아카이브됨 | 더 이상 관리 안 됨 |

**FreeLens** (https://github.com/freelensapp/freelens) 가
현재 가장 활발한 오픈소스 대안이다.

```bash
# macOS
brew install freelens

# Ubuntu/Debian
wget https://github.com/freelensapp/freelens/releases/latest/download/freelens_amd64.deb
sudo dpkg -i freelens_amd64.deb
```

### 주요 기능

- 멀티 클러스터 컨텍스트 전환
- 실시간 Pod/Deployment/Service 모니터링
- YAML 편집기 (검증 포함)
- Pod 로그 뷰어 & 터미널
- 리소스 CPU/메모리 메트릭
- 포트 포워딩 GUI

---

## 3. kubectx / kubens

Context(클러스터)와 Namespace를 빠르게 전환한다.
fzf 설치 시 인터랙티브 퍼지 검색이 가능하다.

```bash
# macOS
brew install kubectx fzf

# Linux
sudo git clone https://github.com/ahmetb/kubectx \
  /opt/kubectx
sudo ln -s /opt/kubectx/kubectx /usr/local/bin/kubectx
sudo ln -s /opt/kubectx/kubens /usr/local/bin/kubens

# krew 플러그인으로 설치
kubectl krew install ctx ns
```

### kubectx 사용법

```bash
kubectx              # 컨텍스트 목록 (fzf 대화형)
kubectx production   # production 컨텍스트로 전환
kubectx -            # 이전 컨텍스트로 돌아가기
```

### kubens 사용법

```bash
kubens               # 네임스페이스 목록 (fzf 대화형)
kubens production    # production으로 전환
kubens -             # 이전 네임스페이스로 돌아가기
kubens --current     # 현재 네임스페이스 출력
```

### 별칭 설정

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
alias kctx='kubectx'
alias kns='kubens'
alias kctx-prod='kubectx production && kubens production'
alias kctx-dev='kubectx minikube && kubens development'
```

---

## 4. stern (멀티 Pod 로그)

여러 Pod의 로그를 동시에 색상으로 구분해 보여준다.

```bash
# 설치
brew install stern
kubectl krew install stern
```

```bash
# 라벨로 여러 Pod 로그
stern -l app=myapp

# Deployment의 Pod 로그
stern deployment/myapp

# 네임스페이스 지정
stern myapp -n production

# 특정 컨테이너만
stern myapp --container=api

# JSON 출력
stern myapp --output json

# 패턴 제외
stern myapp --exclude=debug
```

---

## 5. 도구 선택 가이드

```
터미널 환경에서 빠른 클러스터 탐색
  → k9s

GUI가 필요한 경우
  → FreeLens

클러스터·네임스페이스 전환 자동화
  → kubectx + kubens

여러 Pod 로그 동시 모니터링
  → stern
```

---

## 참고 문서

- [k9s](https://k9scli.io/)
- [FreeLens](https://github.com/freelensapp/freelens)
- [kubectx](https://github.com/ahmetb/kubectx)
- [stern](https://github.com/stern/stern)
