---
title: "ArgoCD Image Updater"
date: 2026-04-14
tags:
  - argocd
  - image-updater
  - gitops
  - ci-cd
sidebar_label: "Image Updater"
---

# ArgoCD Image Updater

컨테이너 레지스트리를 모니터링해 새 이미지 출시 시
자동으로 Git을 업데이트하는 컴포넌트.

## 1. 동작 방식

```
레지스트리에 새 이미지 태그 push
    → Image Updater가 감지
        → Git에 이미지 태그 자동 커밋
            → ArgoCD가 변경 감지
                → 클러스터에 새 버전 배포
```

CI에서 이미지를 빌드한 후 GitOps 저장소를 수동으로 업데이트할 필요가 없다.

---

## 2. 설치

```bash
kubectl apply -n argocd \
  -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
```

---

## 3. Application 어노테이션 설정

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app
  namespace: argocd
  annotations:
    # 모니터링할 이미지 (별칭: 실제이미지 형식)
    argocd-image-updater.argoproj.io/image-list: >-
      myapp=ghcr.io/myorg/myapp

    # 업데이트 전략
    # semver: v1.2.3 형식 태그
    # latest: latest 태그 (digest 기반)
    # digest: sha256 기반
    # name: 태그 이름 정렬
    argocd-image-updater.argoproj.io/myapp.update-strategy: semver

    # 허용할 태그 패턴
    argocd-image-updater.argoproj.io/myapp.allow-tags: >-
      regexp:^v[0-9]+\.[0-9]+\.[0-9]+$

    # Git write-back 방식 (GitOps 방식 권장)
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
```

---

## 4. 업데이트 전략 비교

| 전략 | 설명 | 사용 예 |
|-----|------|---------|
| `semver` | v1.2.3 형식 중 최신 버전 | 정식 릴리즈 |
| `latest` | `:latest` 태그 (digest 변경 감지) | 개발 환경 |
| `digest` | SHA256 다이제스트 변경 감지 | 고정 태그 재빌드 |
| `name` | 태그 이름 알파벳 정렬 | 날짜 기반 태그 |

---

## 5. Write-back 방법

### Git 방식 (GitOps 권장)

```yaml
annotations:
  argocd-image-updater.argoproj.io/write-back-method: git
  argocd-image-updater.argoproj.io/git-branch: main
```

Image Updater가 `.argocd-source-<app-name>.yaml` 파일을 Git에 커밋한다.
변경 이력이 Git에 남아 GitOps 원칙을 준수한다.

### ArgoCD 직접 방식

```yaml
annotations:
  argocd-image-updater.argoproj.io/write-back-method: argocd
```

Git 커밋 없이 ArgoCD Application 오브젝트를 직접 수정한다.
재시작 시 원래대로 돌아갈 수 있어 권장하지 않는다.

---

## 6. 레지스트리 인증 설정

```yaml
# Secret으로 레지스트리 자격증명 등록
apiVersion: v1
kind: Secret
metadata:
  name: registry-credentials
  namespace: argocd
  labels:
    app.kubernetes.io/part-of: argocd-image-updater
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64>
```

```yaml
annotations:
  # 위 Secret 참조
  argocd-image-updater.argoproj.io/myapp.pull-secret: >-
    secret:argocd/registry-credentials#.dockerconfigjson
```

---

## 참고 문서

- [ArgoCD Image Updater 공식 문서](https://argocd-image-updater.readthedocs.io/)
- [Write-back Methods](https://argocd-image-updater.readthedocs.io/en/stable/configuration/applications/)
