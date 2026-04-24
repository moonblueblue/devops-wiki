---
title: "Jenkins 파이프라인 — Jenkinsfile·Shared Library·K8s 플러그인"
sidebar_label: "Jenkins Pipeline"
sidebar_position: 2
date: 2026-04-18
last_verified: 2026-04-24
tags:
  - cicd
  - jenkins
  - jenkinsfile
  - declarative
  - scripted
  - shared-library
  - kubernetes-plugin
---

# Jenkins 파이프라인

> **Jenkinsfile은 Jenkins의 심장**이다. Freestyle job은 UI 클릭 기반이어서
> 재현·리뷰·롤백이 어려웠고, 2017년 Pipeline plugin이 도입되면서 CI를
> "코드로" 표현하게 됐다. 이 글은 **Declarative vs Scripted**의 선택 기준,
> **Shared Library**로 조직 표준 만들기, **Kubernetes Plugin**으로 동적
> 에이전트 운영까지 실전 깊이로 정리한다.

- **주제 경계**: 플랫폼(컨트롤러·에이전트·JCasC·보안·백업)은 자매글
  [Jenkins 기본](./jenkins-basics.md). 본 글은 **파이프라인 저작**에 집중
- **현재 기준**: Jenkins LTS 2.541.x, workflow-cps/script-security 최신,
  kubernetes-plugin 4000+
- **권장**: **새 프로젝트는 Declarative**. Shared Library는 `vars/` 중심.
  K8s 환경은 **Pod agent + yaml 직접 정의**가 2026 표준

---

## 1. Pipeline 개요

### 1.1 Freestyle에서 Pipeline으로

| 축 | Freestyle | Pipeline |
|---|---|---|
| 정의 | UI 클릭 설정 (`config.xml`) | 코드 (`Jenkinsfile`) |
| SCM 연동 | 단일 리포 단일 브랜치 | Multibranch로 모든 브랜치 자동 |
| 재현성 | 설정 복제 수동 | 리포 복제면 끝 |
| 리뷰 | XML diff 어려움 | 코드 리뷰 자연스러움 |
| 조건·병렬 | 부실, 외부 플러그인 | `when`·`parallel`·`matrix` 네이티브 |
| 체크포인트·재시작 | 없음 | Durability·resume 지원 |

**Freestyle은 레거시 전환 대상**. 2026년에 새로 Freestyle로 만들 이유는
사실상 없다.

### 1.2 Pipeline의 두 문법

```groovy
// Declarative
pipeline {
  agent any
  stages {
    stage('build') { steps { sh 'make' } }
  }
}
```

```groovy
// Scripted
node {
  stage('build') { sh 'make' }
}
```

- **Declarative**: `pipeline { }` 블록, 정해진 구조, 정적 검증·Blue Ocean·
  snippet generator 지원
- **Scripted**: `node { }` + Groovy 자유도 100%, 동적 생성·루프·커스텀
  클래스 활용 가능

### 1.3 Pipeline 저장 위치

| 방식 | 용도 |
|---|---|
| Inline (UI에 복붙) | 임시 테스트만 |
| SCM의 `Jenkinsfile` | **표준** — 앱 리포 루트에 |
| Shared Library 정의 | 조직 공용 파이프라인 템플릿 |
| Remote file (URL) | 에어갭·중앙 관리 특수 케이스 |

**Jenkinsfile은 반드시 SCM에** — "Pipeline as Code" 원칙.
상세는 [Pipeline as Code](../concepts/pipeline-as-code.md).

---

## 2. Declarative Pipeline

### 2.1 전체 구조

```groovy
pipeline {
  agent { label 'linux-build' }

  options {
    timeout(time: 30, unit: 'MINUTES')
    timestamps()
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '50'))
    disableConcurrentBuilds()
  }

  triggers {
    cron('H 2 * * *')
    // pollSCM은 레거시 — 2026 권장은 webhook/GitHub App
    // pollSCM('H/15 * * * *')
  }

  parameters {
    string(name: 'TARGET_ENV', defaultValue: 'dev')
    choice(name: 'REGION', choices: ['us-east-1', 'eu-west-1'])
    booleanParam(name: 'SKIP_TESTS', defaultValue: false)
  }

  environment {
    REGISTRY = 'registry.example.com'
    VAULT_ADDR = 'https://vault.example.com'
  }

  tools {
    jdk 'jdk21'
    maven 'maven-3.9'
  }

  stages {
    stage('build') {
      steps {
        sh 'mvn -B package'
      }
    }
    stage('test') {
      when { not { expression { params.SKIP_TESTS } } }
      steps {
        sh 'mvn verify'
      }
      post {
        always { junit 'target/surefire-reports/*.xml' }
      }
    }
    stage('deploy') {
      when {
        branch 'main'
        beforeAgent true
      }
      agent { label 'deploy-agent' }
      steps {
        withCredentials([file(credentialsId: 'kubeconfig',
                              variable: 'KUBECONFIG')]) {
          sh 'kubectl apply -f k8s/'
        }
      }
    }
  }

  post {
    success { slackSend channel: '#ci', message: "✔ ${env.JOB_NAME}" }
    failure { slackSend channel: '#ci', message: "✘ ${env.JOB_NAME}" }
    always  { cleanWs() }
  }
}
```

### 2.2 주요 디렉티브

| 디렉티브 | 역할 |
|---|---|
| `agent` | 실행할 에이전트 (pipeline·stage 수준) |
| `stages` / `stage` | 단계 정의 |
| `steps` | 한 stage 내 명령 |
| `options` | 타임아웃·로그 회전·중복 실행 금지 등 |
| `triggers` | cron·pollSCM·upstream 트리거 |
| `parameters` | 빌드 실행 시 입력 파라미터 |
| `environment` | 환경변수 (top 또는 stage 수준) |
| `tools` | 자동 설치 도구 (JDK·Maven·Gradle) |
| `when` | stage 실행 조건 |
| `post` | 완료 후 훅 (`success`/`failure`/`always`/`unstable`) |
| `input` | 사람 승인 단계 |
| `parallel` | 동시 실행 그룹 |
| `matrix` | N차원 매트릭스 빌드 |

### 2.3 `agent` 종류

| 선언 | 의미 | 적합 |
|---|---|---|
| `agent any` | 아무 에이전트 | 소규모, 에이전트 분화 없음 |
| `agent none` | pipeline 수준 미할당, stage별 지정 | input 대기·승격 파이프라인 |
| `agent { label 'x' }` | 라벨 매칭 | 베어메탈·VM 에이전트 풀 |
| `agent { docker { image 'x' } }` | 기존 에이전트 안에서 컨테이너 | Docker 있는 고정 에이전트 |
| `agent { dockerfile true }` | 리포의 Dockerfile로 이미지 빌드 후 실행 | 맞춤 빌드 환경 |
| `agent { kubernetes { ... } }` | K8s Pod을 agent로 | **클라우드 네이티브 표준** |

**`agent none` + 단계별 `agent`** 패턴이 `input` 대기·승인 게이트가 있는
파이프라인에서 리소스 낭비를 막는 정석. 에이전트를 점유하고 승인 대기
하면 다른 빌드가 대기한다.

```groovy
pipeline {
  agent none
  stages {
    stage('build') {
      agent { kubernetes { yamlFile 'k8s/build-pod.yaml' } }
      steps { sh 'make' }
    }
    stage('approve') {
      input { message 'Deploy?' }
    }
    stage('deploy') {
      agent { label 'deploy' }
      steps { sh './deploy.sh' }
    }
  }
}
```

### 2.4 `checkout scm` — 명시적 체크아웃

Multibranch Pipeline은 **첫 Pod/workspace에 자동으로 SCM을 체크아웃**한다.
그러나 **에이전트가 바뀌는 stage**(새 Pod·새 노드)는 workspace가 비어
있으므로 `checkout scm`을 명시해야 한다.

```groovy
stage('integration') {
  agent { kubernetes { yamlFile 'integ-pod.yaml' } }
  steps {
    checkout scm            // 새 Pod, 다시 체크아웃
    sh 'make integ-test'
  }
}
```

- `checkout scm` 없이 `env.GIT_COMMIT` 참조가 비어 있으면 새 agent일 가능성
- 다른 리포를 받아야 하면 `checkout([$class: 'GitSCM', ...])`로 커스텀

### 2.5 `when` 조건

```groovy
stage('prod-deploy') {
  when {
    allOf {
      branch 'main'
      not { changeRequest() }
      expression { currentBuild.previousSuccessfulBuild != null }
    }
    beforeAgent true
  }
  steps { ... }
}
```

| 조건 | 의미 |
|---|---|
| `branch 'main'` | 브랜치 이름 매치 |
| `buildingTag()` | 태그 빌드 |
| `changeRequest()` | PR/MR 빌드 |
| `changelog 'pattern'` | 커밋 메시지 패턴 |
| `changeset 'src/**'` | 변경된 파일 경로 |
| `environment name: 'X', value: 'v'` | 환경변수 매치 |
| `expression { ... }` | Groovy 표현식 (범용) |
| `triggeredBy 'TimerTrigger'` | 트리거 유형 |
| `anyOf` / `allOf` / `not` | 논리 결합 |

**단계별 조건 플래그**

| 플래그 | 의미 |
|---|---|
| `beforeAgent true` | 조건 false면 에이전트 배정 skip (Pod 기동 비용 절약) |
| `beforeInput true` | 조건 false면 input 대기 skip |
| `beforeOptions true` | options 평가 전에 조건 우선 평가 |

`beforeAgent`는 에이전트가 비싼(K8s Pod) 환경에서 사실상 필수.

### 2.6 `parallel`

```groovy
stage('tests') {
  parallel {
    stage('unit') {
      agent { label 'linux' }
      steps { sh 'make test-unit' }
    }
    stage('integration') {
      agent { label 'linux-db' }
      steps { sh 'make test-integration' }
    }
  }
}

// options에서 전체 failFast
options {
  parallelsAlwaysFailFast()
}
```

병렬 stage 중 하나가 실패하면 나머지를 즉시 중단하는 방법 두 가지.

```groovy
// (1) parallel 블록에 failFast
stage('tests') {
  failFast true
  parallel { ... }
}

// (2) 파이프라인 전역
options { parallelsAlwaysFailFast() }
```

### 2.7 `matrix`

N차원 조합을 자동 전개. OS × 버전 × 아키텍처 매트릭스 빌드.

```groovy
stage('matrix-test') {
  matrix {
    axes {
      axis { name 'OS';      values 'linux', 'windows', 'macos' }
      axis { name 'JDK';     values '17', '21', '25' }
    }
    excludes {
      exclude {
        axis { name 'OS';  values 'macos' }
        axis { name 'JDK'; values '17' }
      }
    }
    agent { label "${OS}-agent" }
    stages {
      stage('test') {
        steps { sh "make test JDK=${JDK}" }
      }
    }
  }
}
```

- `excludes`로 불필요한 조합 제거
- 각 셀은 독립 stage — `when`·`agent`도 셀별 가능
- 대규모 매트릭스는 빌드 큐를 잠식하므로 에이전트 여유 필수

### 2.8 `input` — 사람 승인

```groovy
stage('approve') {
  input {
    message 'Deploy to production?'
    ok 'Ship it'
    submitter 'alice,bob,release-team'
    parameters {
      string(name: 'TICKET', defaultValue: '')
    }
  }
  steps { sh "./deploy.sh --ticket ${TICKET}" }
}
```

- `submitter`: 승인 가능한 사용자·그룹
- `ok`: 승인 버튼 텍스트
- `timeout(time: 2, unit: 'HOURS')`(options 또는 stage)로 방치 파이프라인 정리
- **에이전트를 잡은 채 대기하지 말 것** — `input` 전 stage의 agent는 `none`
  권장, 승인 후 별도 stage가 agent 할당

### 2.9 `post` 훅

| 조건 | 트리거 |
|---|---|
| `always` | 항상 |
| `success` | 성공 |
| `failure` | 실패 |
| `unstable` | unstable (예: 테스트 일부 실패) |
| `changed` | 결과가 직전 빌드와 달라짐 |
| `fixed` | 직전 실패 → 현재 성공 |
| `regression` | 직전 성공 → 현재 실패 |
| `aborted` | 수동·timeout 중단 |
| `cleanup` | 모든 post 실행 이후, 정리용 |

`post { always { cleanWs() } }`로 워크스페이스 정리가 거의 필수.
**`cleanup`**은 `always`를 포함한 모든 post 훅이 끝난 뒤 **맨 마지막**에
한 번 실행된다.

### 2.10 유틸 step과 흐름 제어

파이프라인 저작의 일상 도구. `pipeline-utility-steps` 플러그인이
대부분 제공한다.

**파일·데이터**

| step | 역할 |
|---|---|
| `readFile` / `writeFile` | 텍스트 파일 |
| `readYaml` / `writeYaml` | YAML |
| `readJSON` / `writeJSON` | JSON |
| `readProperties` | Java `.properties` |
| `fileExists` | 존재 확인 (`when { expression { ... } }`) |
| `dir('path') { ... }` | 임시 디렉터리 전환 |
| `ws('path') { ... }` | 별도 workspace |

**아티팩트·전달**

| step | 역할 |
|---|---|
| `stash name: 'src', includes: '...'` | agent 간 workspace 전달 (임시) |
| `unstash 'src'` | 꺼내기 |
| `archiveArtifacts artifacts: 'dist/*'` | 빌드에 영구 첨부 |
| `fingerprint 'target/*.jar'` | 다운스트림 추적용 핑거프린트 |
| `publishHTML` | 리포트 HTML UI 노출 |
| `junit 'reports/*.xml'` | 테스트 결과 |

**`stash` vs `archiveArtifacts`**: stash는 **같은 파이프라인 실행 내**
에이전트 간 파일 전달용(임시). Archive는 **빌드 페이지에 영구 저장**.
stash는 용량 제한(기본 5GB)과 빠른 네트워크 전송이 장점.

**흐름 제어**

| step | 역할 |
|---|---|
| `timeout(time: 10, unit: 'MINUTES') { ... }` | 구획 타임아웃 |
| `retry(3) { ... }` | 실패 시 재시도 |
| `sleep(5)` | 지연 (초) |
| `waitUntil { fileExists('done.flag') }` | 조건 만족까지 폴링 |
| `catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') { ... }` | 실패를 잡되 상태 강등 |
| `error('message')` | 즉시 실패 |
| `unstable('message')` | UNSTABLE 강등 |

```groovy
stage('flaky-network') {
  steps {
    timeout(time: 2, unit: 'MINUTES') {
      retry(3) {
        sh './flaky-integration.sh'
      }
    }
  }
}
```

### 2.11 Scripted의 `properties` step

Declarative의 `options`·`parameters`·`triggers`에 대응하는 Scripted 측
설정은 `properties([])` step.

```groovy
properties([
  buildDiscarder(logRotator(numToKeepStr: '50')),
  disableConcurrentBuilds(),
  parameters([
    string(name: 'TARGET', defaultValue: 'dev'),
    booleanParam(name: 'DRY_RUN', defaultValue: true),
  ]),
  pipelineTriggers([
    cron('H 2 * * *'),
  ]),
])
```

Scripted는 `pipeline { }` 블록이 없어 이 step 없이는 job 설정을 코드로
제어할 방법이 없다.

---

## 3. Scripted Pipeline — 언제 쓰나

Declarative가 새 프로젝트 기본값이지만 **Scripted가 여전히 필요한 경우**.

### 3.1 선택 기준

| 상황 | 권장 |
|---|---|
| 단순·중간 복잡도 | Declarative |
| 팀 규모 큼·신규 개발자 많음 | Declarative (정적 검증 이점) |
| Blue Ocean·snippet generator 사용 | Declarative |
| **런타임 스테이지 생성** (DB·API로부터) | Scripted |
| 복잡한 루프·조건 분기 | Scripted |
| 공유 라이브러리 내부 | Scripted 자주 |
| 수백 줄 이상 파이프라인 | **Shared Library로 추출** |

### 3.2 예시 — 동적 스테이지

```groovy
node('linux') {
  def services = readJSON file: 'services.json'
  def parallelStages = [:]

  services.each { svc ->
    parallelStages[svc.name] = {
      stage("build-${svc.name}") {
        sh "./build.sh ${svc.name} ${svc.version}"
      }
    }
  }

  parallel parallelStages
}
```

Declarative로는 **시작 시점에 알 수 없는 수의 stage**를 만들기 어렵다.
Scripted가 이 지점에서 유일한 선택.

**failFast + throwLastError**

```groovy
def branches = [:]
branches['unit']        = { sh 'make test-unit' }
branches['integration'] = { sh 'make test-integ' }
branches.failFast = true    // 한 branch 실패 시 나머지 취소

parallel(branches)          // 마지막 실패를 예외로 throw
```

- `branches.failFast = true` — 맵 키로 추가되는 특수 플래그
- 실패 시 `parallel`이 예외 발생 — `try/catch`로 감싸 **결과 수집** 후
  통합 리포트 생성 가능
- `throwLastError`는 2023 이후 동일 의미로 기본 동작

### 3.3 Declarative 안에 Scripted 섞기

Declarative의 엄격함이 부담되는 지점만 `script { }` 블록으로 국소 Scripted.

```groovy
pipeline {
  agent any
  stages {
    stage('dynamic') {
      steps {
        script {
          def items = readYaml file: 'items.yaml'
          items.each { sh "./process.sh ${it.name}" }
        }
      }
    }
  }
}
```

**권장 패턴**: 전체 Declarative, `script` 블록은 3줄 이하로, 길어지면
Shared Library의 함수로 추출.

---

## 4. Shared Library

### 4.1 개념과 동기

같은 `sh 'docker build ... && docker push ...'`를 50개 Jenkinsfile에
복붙하는 대신, 조직 공용 Groovy 함수로 추출해 `myBuildAndPush(image)` 한 줄로
호출. 이것이 Shared Library.

- 버전 관리되는 Git 리포
- 조직 표준 강제 (보안 스캔·태깅 규칙·Notification)
- Jenkinsfile 단순화, 리뷰 집중
- 플러그인과 Jenkinsfile 사이의 **중간 레이어**

### 4.2 리포 구조

```text
my-shared-library/
├── vars/                        # Global Variables (step 역할)
│   ├── buildAndPush.groovy
│   ├── buildAndPush.txt         # 문서 (Markdown)
│   └── notifySlack.groovy
├── src/                         # Groovy 클래스 (유틸)
│   └── org/example/
│       ├── SemVer.groovy
│       └── GitUtils.groovy
├── resources/                   # 비-Groovy 파일 (JSON/YAML/스크립트)
│   └── org/example/
│       └── deploy-template.yaml
└── test/                        # 단위 테스트 (Jenkins Pipeline Unit)
    └── ...
```

| 디렉터리 | 역할 |
|---|---|
| `vars/` | **권장 위치**. 파일명 = 파이프라인 전역 변수명 |
| `src/` | 전통 Groovy 패키지, 상태 있는 유틸 클래스 |
| `resources/` | `libraryResource('path')` 로 로드하는 템플릿·스크립트 |
| `test/` | Jenkins Pipeline Unit Framework 테스트 |

**`vars/` 우선**: Declarative Pipeline은 `src/` 클래스를 직접 인스턴스화
하기 번거롭고, `vars/foo.groovy`의 함수는 파이프라인에서 `foo.bar()` 문법
으로 자연스럽게 호출. 대부분의 조직 표준은 `vars/`로 충분하다.

### 4.3 Trusted vs Sandboxed Libraries — 보안 경계

Shared Library는 **로드 위치에 따라 Groovy Sandbox 제약이 달라진다**.
이 경계를 잘못 두면 RCE 취약점이 된다.

| 구성 | Sandbox | 용도 |
|---|---|---|
| **Global Pipeline Libraries** (Manage Jenkins 설정) | Sandbox 해제 (Trusted) | 조직 검증 표준, 관리자 리뷰 전제 |
| **Folder-level Libraries** (Folder Properties) | Sandbox 적용 | 팀 레벨, 일반 개발자 기여 |
| **Pipeline Libraries** (`@Library` 동적 로드 + 임의 리포) | Sandbox 적용 | 실험적, 미신뢰 |

- Trusted 라이브러리의 코드는 **파이프라인과 같은 권한**으로 실행 —
  컨트롤러 API 호출·파일시스템 접근 가능
- Sandboxed 라이브러리는 일반 Jenkinsfile과 같은 제약 (Script Approval 필요)
- **Trusted = 관리자만 머지 가능한 별도 리포**로 운영. 일반 개발자 PR을
  자동 머지하면 Trusted 위치에서는 치명적

### 4.4 JCasC로 라이브러리 등록

```yaml
unclassified:
  globalLibraries:
    libraries:
      - name: "platform-shared-library"
        defaultVersion: "v1"
        implicit: false
        allowVersionOverride: true
        retriever:
          modernSCM:
            scm:
              git:
                remote: "https://git.example.com/platform/shared.git"
                credentialsId: "git-readonly"
```

- `defaultVersion`: 기본 브랜치/태그 (SemVer 태그 권장)
- `implicit: false`: Jenkinsfile에서 `@Library` 선언 필수 (보안 우선)
- `allowVersionOverride`: 일부 팀 파일럿 버전 사용 허용

### 4.5 Jenkinsfile에서 호출

```groovy
@Library('platform-shared-library@v1.3.0') _

pipeline {
  agent any
  stages {
    stage('release') {
      steps {
        buildAndPush(image: 'svc-x', tag: env.GIT_COMMIT)
        deployToK8s(cluster: 'prod', chart: 'svc-x')
      }
    }
  }
  post {
    failure { notifySlack(channel: '#ci-alerts', status: 'failed') }
  }
}
```

- `@Library('name@ref')` — 특정 버전 고정 권장
- `_` (underscore) — "라이브러리의 기본 export를 다 가져온다"는 관례
- **버전 핀이 없으면** `defaultVersion`을 사용 → 라이브러리 변경이 모든
  파이프라인에 즉시 영향. 조직 표준은 릴리즈 태그로 pin.

**동적 로드 — `library` step**

`@Library` 어노테이션은 파이프라인 파싱 시점에 버전이 고정된다. 런타임에
버전을 결정해야 한다면 `library` step으로 동적 로드.

```groovy
pipeline {
  agent any
  parameters {
    string(name: 'LIB_VERSION', defaultValue: 'v1.3.0')
  }
  stages {
    stage('load') {
      steps {
        script {
          def lib = library("platform-shared-library@${params.LIB_VERSION}")
          lib.org.example.SemVer.new('1.2.3')
        }
      }
    }
  }
}
```

- 브랜치별 파일럿, A/B 테스트에 유용
- 로드 자체가 SCM fetch를 수반 → 많이 쓰면 느림
- Trusted/Sandboxed 경계는 `@Library`와 동일 규칙

### 4.6 `vars/` 패턴

```groovy
// vars/buildAndPush.groovy
def call(Map config) {
  def image = config.image ?: error('image required')
  def tag = config.tag ?: env.BUILD_ID

  sh """
    docker build -t ${env.REGISTRY}/${image}:${tag} .
    docker push ${env.REGISTRY}/${image}:${tag}
  """
  echo "Pushed ${image}:${tag}"
  return "${env.REGISTRY}/${image}:${tag}"
}
```

- 파일명 `buildAndPush` → 파이프라인에서 `buildAndPush(image: 'x')` 호출
- `call` 메서드는 특별 — `buildAndPush(args)` = `buildAndPush.call(args)`
- 복수 함수 지원: `buildAndPush.lint()`, `buildAndPush.signOnly()` 등

**권장**: Map 파라미터로 명시적 키 사용, 필수값 검증 후 에러.
Positional args는 가독성 떨어지고 라이브러리 진화 시 깨짐.

### 4.7 `src/` 패턴

```groovy
// src/org/example/SemVer.groovy
package org.example

class SemVer implements Serializable {
  int major, minor, patch

  SemVer(String s) {
    def m = s =~ /(\d+)\.(\d+)\.(\d+)/
    major = m[0][1] as int
    minor = m[0][2] as int
    patch = m[0][3] as int
  }

  SemVer bumpMinor() {
    new SemVer("${major}.${minor + 1}.0")
  }

  String toString() { "${major}.${minor}.${patch}" }
}
```

```groovy
// Jenkinsfile
import org.example.SemVer

def v = new SemVer(env.GIT_TAG_NAME).bumpMinor()
```

**반드시 `Serializable`**: Jenkins Pipeline은 CPS로 실행되어 **매 step마다
프로그램 상태를 디스크에 직렬화**한다. Serializable 아닌 객체를 변수에
보관하면 `NotSerializableException`. 이것이 Jenkins Pipeline 최대의
함정이다.

### 4.8 `resources/` — 템플릿 로드

```groovy
// vars/deployToK8s.groovy
def call(Map config) {
  def tmpl = libraryResource('org/example/deploy-template.yaml')
  def manifest = tmpl.replaceAll('__IMAGE__', config.image)
  writeFile file: 'deploy.yaml', text: manifest
  sh 'kubectl apply -f deploy.yaml'
}
```

### 4.9 테스트 — Jenkins Pipeline Unit

`jenkinsci/JenkinsPipelineUnit`으로 Shared Library를 **Jenkins 없이** 단위
테스트 가능. Spock 또는 JUnit에서 Mock step을 등록하고 결과 검증.

```groovy
class BuildAndPushSpec extends BasePipelineTest {
  @Test void pushesWithExpectedTag() {
    binding.setVariable('env', [REGISTRY: 'r.io', BUILD_ID: '42'])
    loadScript('vars/buildAndPush.groovy').call([image: 'svc', tag: 'v1'])

    def calls = helper.callStack.findAll { it.methodName == 'sh' }
    assert calls.any { it.argsToString().contains('r.io/svc:v1') }
  }
}
```

CI 파이프라인의 CI — 조직이 성숙할수록 이 계층이 장애 예방의 핵심이 된다.

### 4.10 Shared Library vs Plugin

| 축 | Shared Library | Jenkins Plugin |
|---|---|---|
| 배포 | Git push + `@Library` 버전 교체 | `.hpi` 빌드·배포·컨트롤러 재시작 |
| 범위 | 파이프라인 step | Jenkins 내부 API 전반 |
| 개발 비용 | 낮음 (Groovy 스크립트) | 높음 (Java, Jenkins API 학습) |
| 테스트 | PipelineUnit, 단순 | Jenkins Test Harness |
| 적합 | 조직 파이프라인 표준화 | 시스템 통합 플러그인 |

**의사결정**: "Jenkinsfile에서 호출하는 추상화"는 Shared Library로.
"Jenkins 자체 UI/백엔드에 훅을 달아야 함"만 플러그인.

---

## 5. Kubernetes Plugin으로 동적 에이전트

### 5.0 `tools` 블록 vs 컨테이너 이미지 — 2026 추세

Declarative의 `tools { jdk 'jdk21'; maven 'maven-3.9' }` 블록은 **Jenkins
Tool Installer**가 런타임에 JDK/Maven을 다운로드해 에이전트에 설치하는
방식이다. 역사적으로 고정 에이전트 환경에서 유효했지만, 2026 현실에서는
트레이드오프가 불리해졌다.

| 축 | `tools` 블록 | 컨테이너 이미지 |
|---|---|---|
| 버전 재현성 | Tool installer 스냅샷 의존 | 이미지 digest로 완벽 |
| 속도 | 매 빌드 다운로드 가능성 | 이미지 프리풀 시 즉시 |
| 보안 | 에이전트 공유 설치 경로, 변조 위험 | 컨테이너 격리 |
| 에어갭 | Mirror 직접 운영 필요 | 사내 레지스트리면 충분 |
| 멀티 버전 | 병행 어려움 | 컨테이너로 자유 |

**권장**: K8s Pod agent에서는 **컨테이너 이미지로 tool 주입**. `tools`
블록은 레거시 VM 에이전트 유지보수용으로만.

### 5.1 아키텍처 재확인

Jenkins 컨트롤러가 **쿠버네티스 클러스터**에 대한 Cloud로 등록되고, job이
큐에 올라오면 플러그인이 **Pod를 생성**해 에이전트로 접속시킨다. job
종료 = Pod 삭제.

클라우드 등록 자체(JCasC 설정)는 [Jenkins 기본](./jenkins-basics.md)
3.4 참조. 이 섹션은 **Jenkinsfile에서 어떻게 활용하느냐**에 집중.

### 5.2 파이프라인에서 Pod agent 선언

**2026 권장 패턴**: `yaml` 직접 정의 + 파일 분리.

```groovy
// k8s-agent.yaml (리포에 저장)
apiVersion: v1
kind: Pod
metadata:
  labels:
    jenkins-agent: 'true'
spec:
  serviceAccountName: jenkins-agent
  containers:
    - name: jnlp
      image: jenkins/inbound-agent:3327.v868139a_d00b_0-7-jdk21
      resources:
        requests: {cpu: 200m, memory: 256Mi}
        limits:   {cpu: 500m, memory: 512Mi}
    - name: maven
      image: maven:3.9.9-eclipse-temurin-21
      command: ["sleep"]
      args: ["99d"]
      resources:
        requests: {cpu: 500m, memory: 1Gi}
        limits:   {cpu: 2,    memory: 4Gi}
    - name: docker
      image: docker:26-cli
      command: ["sleep"]
      args: ["99d"]
      volumeMounts:
        - {name: buildkit-sock, mountPath: /run/buildkit}
  volumes:
    - name: buildkit-sock
      emptyDir: {}
```

```groovy
// Jenkinsfile
pipeline {
  agent {
    kubernetes {
      yamlFile 'k8s-agent.yaml'
      defaultContainer 'maven'
    }
  }
  stages {
    stage('build') {
      steps { sh 'mvn -B package' }
    }
    stage('image') {
      steps {
        container('docker') {
          sh 'buildctl build --frontend dockerfile.v0 ...'
        }
      }
    }
  }
}
```

- `yamlFile`로 **순수 Kubernetes Pod YAML** 작성 — 일반 K8s 엔지니어링
  도구·리뷰 프로세스 그대로
- `defaultContainer`로 기본 컨테이너 지정, 다른 컨테이너는 `container('x')`
  블록으로 명시 전환
- `jnlp` 컨테이너는 **필수** — Jenkins 에이전트 자체

### 5.3 `inheritFrom` — Pod 템플릿 상속

JCasC로 **공용 템플릿** 여러 개 정의 → 파이프라인은 필요한 부분만 override.

```yaml
# JCasC — 공용 템플릿
jenkins:
  clouds:
    - kubernetes:
        templates:
          - name: "base"
            serviceAccount: "jenkins-agent"
            namespace: "jenkins-agents"
            containers:
              - name: "jnlp"
                image: "jenkins/inbound-agent:3327.v868139a_d00b_0-7-jdk21"
          - name: "jdk21"
            inheritFrom: "base"
            containers:
              - name: "java"
                image: "eclipse-temurin:21-jdk"
```

```groovy
// Jenkinsfile — 상속 활용
agent {
  kubernetes {
    inheritFrom 'jdk21'
    yaml '''
spec:
  containers:
    - name: java
      resources:
        requests: {memory: 2Gi}
'''
    yamlMergeStrategy merge()
  }
}
```

- `inheritFrom 'a b'` — 공백 구분 복수 상속, 뒤 템플릿이 앞 override
- **상속 대상**: nodeSelector, serviceAccount, imagePullSecrets, containers,
  volumes
- `yamlMergeStrategy merge()` — yaml을 부모와 병합 (기본 `override()`는
  통째 치환)
- **컨테이너 병합 키는 `name`** — 같은 이름의 컨테이너 리소스·env·mount가
  부모와 병합됨
- 디버깅이 어려울 때 `showRawYaml true`로 최종 렌더링 YAML을 빌드 로그에
  출력 (민감 정보 주의)

**기타 유용 디렉티브**

| 디렉티브 | 용도 |
|---|---|
| `podRetention always()` | Pod을 빌드 후에도 유지 (디버깅 용도만) |
| `podRetention onFailure()` | 실패 시만 유지 |
| `podRetention never()` | 기본값, 즉시 삭제 |
| `idleMinutes 5` | 재사용 가능한 에이전트를 N분 유지 |
| `instanceCap 20` | 이 템플릿 동시 Pod 최대 수 |
| `activeDeadlineSeconds 3600` | Pod 절대 수명 (폭주 방지) |

`idleMinutes`는 빌드가 촘촘한 경우 Pod 재사용으로 기동 overhead 절감.
단 **워크스페이스 오염** 위험이 있어 `cleanWs()` 필수.

### 5.4 Pod 설계 포인트

| 포인트 | 권장 |
|---|---|
| `resources.requests`·`limits` | 반드시 명시 — 공용 클러스터 자원 보호 |
| `serviceAccountName` | 빌드 전용 SA, 최소 권한 |
| `imagePullSecrets` | 사설 레지스트리 자격 |
| `securityContext` | `runAsNonRoot`, `readOnlyRootFilesystem` |
| `nodeSelector`·`tolerations` | CI 전용 노드 풀 격리 |
| `volumes` | 캐시·BuildKit 소켓·시크릿 마운트 |
| `shareProcessNamespace` | 디버깅·사이드카 정리 필요 시 |
| `activeDeadlineSeconds` | 폭주 방지 (예: 1시간) |

### 5.5 DinD / BuildKit / Kaniko — 이미지 빌드

쿠버네티스 Pod 안에서 컨테이너 이미지를 만드는 3가지.

| 방식 | 특권 | 속도 | 호환성 |
|---|---|---|---|
| Docker-in-Docker (DinD) | **privileged 필수** (위험) | 빠름 | 표준 Dockerfile |
| BuildKit (rootless) | 비특권 가능 (OCI runtime 의존) | 빠름 | 표준 Dockerfile |
| Kaniko | 비특권 | 보통 | Dockerfile 호환, 일부 제약 |

**2026 권장**: **BuildKit rootless** 또는 **Kaniko**. DinD는 특권 컨테이너
보안 이슈로 점진 폐지 추세. 속도가 중요하면 BuildKit이 Kaniko보다 우위.
Kaniko는 2024 이후 Google 유지보수 강도가 낮아졌으나 비특권 빌드에서 여전히
사용됨.

**Kaniko 캐시 + 레지스트리 인증 예시**

```yaml
# Pod YAML 일부
containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:v1.23.0-debug
    command: ["sleep"]
    args: ["99d"]
    volumeMounts:
      - name: docker-config
        mountPath: /kaniko/.docker
volumes:
  - name: docker-config
    secret:
      secretName: registry-creds
      items: [{key: .dockerconfigjson, path: config.json}]
```

```groovy
stage('image') {
  steps {
    container('kaniko') {
      sh '''
        /kaniko/executor \
          --context=$WORKSPACE \
          --destination=$REGISTRY/$IMAGE:$TAG \
          --cache=true \
          --cache-repo=$REGISTRY/$IMAGE/cache \
          --snapshot-mode=redo
      '''
    }
  }
}
```

- `--cache-repo`: 캐시 레이어를 별도 레지스트리 경로에 저장
- `--snapshot-mode=redo`: 빠른 스냅샷 (메타데이터만 비교)
- 레지스트리 자격은 **Secret으로 마운트** — 빌드 인자로 넘기지 않음

### 5.6 캐시 전략

Pod가 매번 새로 뜨면 Maven/Gradle/npm 캐시가 cold. 대응:

- **EmptyDir + PVC 마운트**: 공용 PVC로 캐시 공유 (경합 주의)
- **Nexus/Artifactory 프록시 캐시**: 네트워크 레벨 캐시
- **BuildKit inline cache**: 레지스트리에 캐시 레이어 저장
- **이미지에 프리페치**: 자주 쓰는 의존성을 에이전트 이미지에 미리 포함

### 5.7 파이프라인과 Pod의 생명주기

```mermaid
flowchart LR
  Q[빌드 큐] --> S[Pod 생성]
  S --> R[Ready 대기]
  R --> E[Agent 접속]
  E --> J[Job 실행]
  J --> C[정리]
  C --> D[Pod 삭제]
```

- **Ready 대기**가 큰 비중 — 이미지 프리풀·프리워밍으로 단축
- Spot 노드를 쓰면 중간 Eviction 가능 — 플러그인의 재시도·`activeDeadline`
  조합

---

## 6. 파이프라인 보안

### 6.1 Groovy Sandbox

Jenkinsfile은 기본적으로 **Groovy Sandbox** 안에서 실행된다. 안전 API만
허용 리스트로 제한되고, 그 외는 `ScriptApproval`이 필요.

- `sandbox: true` (Declarative 기본) → 안전 API만
- Trusted Library(관리자가 로드한 `@Library`) → Sandbox 제약 일부 해제
- **개별 Jenkinsfile의 sandbox 해제 금지** — 사실상 컨트롤러 RCE 허용

### 6.2 Script Approval

Sandbox에 없는 메서드를 호출하면 실패. 관리자가 **Manage Jenkins → In-process
Script Approval**에서 승인. 무분별한 승인은 보안 우회가 되므로:

- 승인 전 **왜 필요한지 검토** (반사·리플렉션·파일 I/O는 특히 위험)
- Shared Library에 격리된 추상으로 흡수하고 Library만 trusted 처리
- `signature approvals`는 주기 감사 대상

### 6.3 CPS 직렬화 함정

파이프라인 실행 중 **모든 변수는 매 step마다 직렬화**된다.

```groovy
// ❌ NotSerializableException
def matcher = (text =~ /pattern/)
sh 'make'   // 여기서 직렬화 실패 (Matcher는 Serializable 아님)
```

```groovy
// ✅ 매처 사용 후 즉시 값만 추출
def matcher = (text =~ /pattern/)
def v = matcher ? matcher[0][1] : null
matcher = null
sh 'make'
```

**원칙**: 매처·스트림·JDBC Connection 같은 비-Serializable 객체는 **step
경계를 넘지 않게** 사용·해제. 길어진 로직은 `@NonCPS` 메서드로 격리.

**자주 터지는 CPS 함정 정리**

| 함정 | 증상 |
|---|---|
| `Matcher` 보유 | `NotSerializableException` |
| `Iterator`/Stream 장기 보유 | 상동 |
| JDBC Connection·Socket | 상동, 추가로 리소스 누수 |
| `for (x in list) { sh(...) }` | CPS에서 비동기 재진입 시 클로저 상태 깨짐 |
| `list.collect { sh(...) }` | 클로저 내부에서 step 호출 시 예상치 못한 동작 |
| `Map`을 `@NonCPS` 경계로 넘기기 | 직렬화 안전하지 않은 타입이 섞이면 실패 |

**권장**: 컬렉션 처리(`collect`/`each`/`findAll`)는 **`@NonCPS` 안에서**
수행하고, 반환값은 기본 타입(String/int/Map/List)만. 파이프라인 본체에서
`for`·`while`을 쓰더라도 그 내부에서 직접 `sh` 호출은 Scripted에서만.

### 6.4 `@NonCPS`

`@NonCPS` 어노테이션을 붙이면 **그 메서드는 CPS 변환을 안 받는다**.
일반 Groovy처럼 실행 — 루프·람다·스트림 자유. 단 **내부에서 `sh`·`echo`
같은 Pipeline step 호출 금지**, 반환값만 파이프라인에 넘겨야 한다.

```groovy
@NonCPS
def parseJson(String s) {
  def slurper = new groovy.json.JsonSlurper()
  slurper.parseText(s)
}

stage('x') {
  steps {
    script {
      def data = parseJson(readFile('out.json'))
      sh "echo ${data.version}"
    }
  }
}
```

### 6.5 크리덴셜 노출 방지

```groovy
// ❌ 환경변수가 로그에 노출
environment { PASSWORD = credentials('db-password') }
steps { sh 'echo $PASSWORD' }   // masking 우회 가능

// ✅ withCredentials로 스코프 제한
steps {
  withCredentials([string(credentialsId: 'db-password', variable: 'PW')]) {
    sh 'psql -c "select 1" # $PW'
  }
}
```

- Declarative `environment`의 `credentials()`는 기본 마스킹 제공하지만,
  `set -x`나 echo로 우회 가능
- **`withCredentials` 블록 내부에서만** 비밀 접근, 블록 나가면 자동 정리
- Vault·AWS SM 플러그인으로 **런타임 조회** → 장기 저장 제거

---

## 7. Multibranch Pipeline & Organization Folder

### 7.1 Multibranch Pipeline

리포의 **모든 브랜치와 PR에 자동으로 파이프라인**을 생성. `Jenkinsfile`이
있는 브랜치만 인식.

- 새 브랜치 → 자동 job 생성, 스캔 주기·webhook으로 감지
- PR → 별도 job, 결과를 SCM에 상태 체크로 반영
- 브랜치 삭제 → job 정리 (Orphan Item Strategy 설정)

**Discover Behaviors — 보안에서 결정적**

Multibranch 구성의 "Behaviors" 섹션은 **무엇을 파이프라인으로 인식할지**
를 정한다. Fork PR 처리 방식이 공급망 공격 경계다.

| Behavior | 옵션 |
|---|---|
| Discover branches | All branches / Only branches not in PR / Only branches in PR |
| Discover pull requests from origin | Merge PR head / Current PR head / Both |
| **Discover pull requests from forks** | The current PR revision / Merge with target (**Trusted** mode) / **Skip** |
| Discover tags | 활성화 여부 |
| Filter by name (wildcards/regex) | `main, release/*` 등 |
| Suppress automatic SCM triggering | webhook만 허용 (스캔으로는 트리거 금지) |

**Fork PR 처리 원칙**

- 외부 기여자 fork PR은 기본적으로 **"Skip" 또는 엄격한 승인** 경로로
- "Current PR revision"은 공격자가 Jenkinsfile을 수정해 악성 코드를
  실행할 수 있음 — 오픈소스 프로젝트에서 주요 사고 원인
- "Trusted" 모드: **target 브랜치의 Jenkinsfile 사용** + PR 변경사항
  merge. 신뢰 경계를 target 리포 메인테이너가 통제

### 7.2 Orphan Item Strategy

삭제된 브랜치·PR의 job을 언제 제거할지. 방치하면 디스크·UI 부하.

| 옵션 | 의미 |
|---|---|
| Days to keep old items | N일 경과한 orphan job 제거 |
| Max # of old items | 최근 N개만 유지 |

**Job 레벨 `buildDiscarder`와 별개 설정**. Job 내부 빌드 이력은
`buildDiscarder`, Multibranch의 브랜치별 job 자체는 Orphan 정책이 관리.

### 7.3 Organization Folder

GitHub/GitLab **Organization 레벨**을 스캔해 Jenkinsfile이 있는 모든
리포를 자동 등록. "우리 조직의 모든 리포에 CI 자동 적용" 시나리오.

- GitHub Organization / Bitbucket Team / GitLab Group 지원
- 새 리포 추가 → 자동 Multibranch 생성
- 대규모 조직은 스캔 주기·API rate limit 주의

### 7.4 스캔 vs Webhook

| 모드 | 특징 |
|---|---|
| 주기 스캔 (`cron`) | 단순, API rate limit 위험 |
| Webhook | 즉시 반영, 방화벽 설정 필요 |
| GitHub App | webhook + rate limit 완화 (**권장**) |

**모노리식 Jenkins + 수백 리포** 조합은 GitHub App 필수. Personal Access
Token으로는 Rate Limit·권한 폭 문제가 금방 터진다.

### 7.5 GitHub App 설정 상세

2026 현재 대규모 조직의 표준. 설치 단위로 **시간당 15,000 API 호출**
(PAT는 계정 단위 5,000).

**설치 흐름**

1. GitHub Organization Settings → Developer settings → GitHub Apps → New
2. 권한 부여
   - Repository: Contents(read), Metadata(read), Pull requests(read/write),
     Commit statuses(read/write), **Checks(read/write)**
   - Organization: Members(read)
3. **Private Key 다운로드** (PEM)
4. App을 해당 조직에 설치, 접근 허용 리포 선택
5. Jenkins → Credentials → "GitHub App" 타입
   - App ID
   - Private Key (PEM 파일 내용)
6. Multibranch/Org Folder의 Scan Credentials로 지정

**핵심 포인트**

- **Checks API 권한**이 있어야 Jenkins가 PR 상태를 Check Run으로 보고
  (기존 Status API보다 풍부)
- App 단위로 rate limit 분리 — 다른 Jenkins·다른 용도와 경합 없음
- Private Key는 **반드시 Credentials Store**에 `GitHub App Private Key`
  타입으로 등록. 평문 파일로 보관 금지
- 만료 설정: Private Key 회전 정책을 6~12개월 주기로 (자동화 권장)

---

## 8. 파이프라인 디버깅과 테스트

### 8.1 Replay

빌드 페이지 → **Replay** → Jenkinsfile 수정 후 즉시 재실행. SCM 커밋 없이
반복 테스트. **프로덕션에서 평시 사용 금지** (변경이 SCM에 없음).

### 8.2 Pipeline Syntax Generator

Manage Jenkins → Snippet Generator. UI에서 step 선택하면 Groovy 코드 생성.
Declarative는 Directive Generator로 `options`·`when` 등 만든다.

### 8.3 Linter

```bash
# CLI linter
ssh -p 22222 jenkins@server declarative-linter < Jenkinsfile

# HTTP
curl -X POST -F "jenkinsfile=<Jenkinsfile" \
  "$JENKINS_URL/pipeline-model-converter/validate"
```

- 문법·디렉티브 레벨 오류 감지
- **pre-commit hook**으로 설정하면 PR 단계에서 차단

### 8.4 단위 테스트

- **Shared Library**: JenkinsPipelineUnit
- **Jenkinsfile 통합**: 스테이징 Jenkins 인스턴스에서 multibranch 스캔
- **Linter + Review**: 타협 가능한 조직 표준

---

## 9. 안티패턴

| 안티패턴 | 증상 | 교정 |
|---|---|---|
| 수백 줄 Jenkinsfile | 리뷰·유지보수 불가 | Shared Library로 추상화 |
| `@Library('lib@main')` 핀 없음 | 라이브러리 변경이 전 파이프라인에 즉시 영향 | 태그·SemVer 핀 |
| `sandbox: false` 상시 | 컨트롤러 RCE 허용 | Shared Library + trusted 경로 |
| `environment { SECRET = credentials(...) }` | 로그 마스킹 우회 가능 | `withCredentials` |
| `input` 대기 중 에이전트 점유 | 에이전트 수 부족 | `input` 전에 `agent none` |
| `script` 블록이 30줄 | Declarative 이점 상실 | Shared Library 함수로 |
| CPS 직렬화 실패 무시 | 간헐 실패 | 비-Serializable은 `@NonCPS` 또는 지역 변수 |
| Pod에 `resources` 없음 | 클러스터 자원 고갈 | requests/limits 명시 |
| DinD `privileged: true` 남발 | 컨테이너 탈출 위험 | BuildKit rootless / Kaniko |
| `latest` 이미지 태그 | 재현성 없음 | 고정 태그 또는 digest |
| 동일 Jenkinsfile을 리포별 복붙 | 표류 | Shared Library의 `call()` 패턴 |
| Multibranch polling 없이 scan만 | 30분 지연 | Webhook 또는 GitHub App |
| `cleanWs()` 없음 | 디스크 폭주 | `post { always { cleanWs() } }` |
| Stage 하나에 모든 step | 실패 위치 추적 어려움 | 논리 단위로 stage 분할 |
| `when`에 `beforeAgent true` 없음 | 조건 false인데 Pod 기동 | `beforeAgent true` |
| Scripted에서 매처/스트림 장기 보유 | `NotSerializableException` | 지역 범위로 축소 |

---

## 10. 도입 로드맵

1. **Freestyle → Pipeline 전환**: 기존 job을 Jenkinsfile로 단계적 이전
2. **Declarative 표준화**: 새 파이프라인은 Declarative, Scripted는 예외
3. **Shared Library 시작**: `vars/notifySlack.groovy` 같은 소형부터
4. **Library 버저닝**: SemVer 태그, `@Library('lib@v1.x')` 관례
5. **Pipeline Linter**: pre-commit·PR 체크에 통합
6. **Pod Agent 전환**: 고정 에이전트 → K8s ephemeral
7. **Pod 템플릿 표준화**: JCasC + `inheritFrom`로 팀별 베이스
8. **크리덴셜 OIDC**: `withCredentials` + Vault JWT로 장기 토큰 제거
9. **Pipeline Unit 테스트**: Library 복잡도 증가 시 회귀 방지
10. **Durability 튜닝**: PR은 PERFORMANCE_OPTIMIZED, 릴리즈 MAX_SURVIVABILITY
11. **Multibranch/Org Folder**: 조직 전체 리포 자동 스캔
12. **점진 마이그레이션**: 복잡 Groovy를 컨테이너 이미지·외부 스크립트로

---

## 11. 범위 밖 — Job DSL Seed Job

본 글은 Jenkinsfile Pipeline에 집중한다. **Job DSL**(plugin)은 Groovy
스크립트로 **job 자체를 생성·관리**하는 도구로, 본 글의 Pipeline과는
다른 레이어다.

| 역할 | 도구 |
|---|---|
| 컨트롤러 설정 | JCasC ([Jenkins 기본 §5](./jenkins-basics.md)) |
| 반복적 job 생성 | **Job DSL** (Seed Job 패턴) |
| 파이프라인 로직 | Jenkinsfile + Shared Library (본 글) |

대규모 조직에서는 **JCasC + Job DSL + Jenkinsfile** 3층 구조로:
JCasC가 컨트롤러·Cloud·Credentials, Job DSL이 팀별 수백 job 자동 생성,
Jenkinsfile은 파이프라인 본체. Multibranch/Organization Folder가 충분한
규모라면 Job DSL까지 갈 필요는 없다.

---

## 12. 관련 문서

- [Jenkins 기본](./jenkins-basics.md) — 플랫폼 아키텍처·JCasC·보안
- [Pipeline as Code](../concepts/pipeline-as-code.md) — 선언적 파이프라인 철학
- [배포 전략](../concepts/deployment-strategies.md) — 실제 배포 패턴
- [GitLab CI](../gitlab-ci/gitlab-ci.md) · [GHA 기본](../github-actions/gha-basics.md) — 비교
- [GitOps 개념](../concepts/gitops-concepts.md) — Jenkins + ArgoCD 조합
- [DORA 메트릭](../concepts/dora-metrics.md) — 파이프라인 성과 측정

---

## 참고 자료

- [Jenkins Pipeline 공식](https://www.jenkins.io/doc/book/pipeline/) — 확인: 2026-04-24
- [Pipeline Syntax](https://www.jenkins.io/doc/book/pipeline/syntax/) — 확인: 2026-04-24
- [Shared Libraries](https://www.jenkins.io/doc/book/pipeline/shared-libraries/) — 확인: 2026-04-24
- [Kubernetes Plugin README](https://github.com/jenkinsci/kubernetes-plugin/blob/master/README.md) — 확인: 2026-04-24
- [Kubernetes Plugin 공식](https://plugins.jenkins.io/kubernetes/) — 확인: 2026-04-24
- [CloudBees Pod Template Inheritance](https://docs.cloudbees.com/docs/cloudbees-ci-kb/latest/cloudbees-ci-on-modern-cloud-platforms/understanding-pod-template-inheritance) — 확인: 2026-04-24
- [workflow-cps Plugin (CPS)](https://plugins.jenkins.io/workflow-cps/) — 확인: 2026-04-24
- [In-process Script Approval](https://www.jenkins.io/doc/book/managing/script-approval/) — 확인: 2026-04-24
- [Script Security Plugin](https://plugins.jenkins.io/script-security/) — 확인: 2026-04-24
- [Pipeline Best Practices](https://www.jenkins.io/doc/book/pipeline/pipeline-best-practices/) — 확인: 2026-04-24
- [Scaling Pipelines (Durability)](https://www.jenkins.io/doc/book/pipeline/scaling-pipeline/) — 확인: 2026-04-24
- [Welcome to the Matrix](https://www.jenkins.io/blog/2019/11/22/welcome-to-the-matrix/) — 확인: 2026-04-24
- [JenkinsPipelineUnit](https://github.com/jenkinsci/JenkinsPipelineUnit) — 확인: 2026-04-24
- [pipeline-utility-steps 플러그인](https://plugins.jenkins.io/pipeline-utility-steps/) — 확인: 2026-04-24
- [workflow-multibranch 플러그인](https://plugins.jenkins.io/workflow-multibranch/) — 확인: 2026-04-24
- [GitHub Branch Source 플러그인](https://plugins.jenkins.io/github-branch-source/) — 확인: 2026-04-24
- [Pipeline Model Definition](https://plugins.jenkins.io/pipeline-model-definition/) — 확인: 2026-04-24
- [Job DSL 플러그인](https://plugins.jenkins.io/job-dsl/) — 확인: 2026-04-24
