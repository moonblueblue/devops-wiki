---
title: "kubectl 사용법과 팁"
date: 2026-04-14
tags:
  - kubernetes
  - kubectl
  - cli
sidebar_label: "kubectl 팁"
---

# kubectl 사용법과 팁

## 1. 자주 쓰는 명령어

```bash
# 리소스 조회
kubectl get pods -A                    # 전체 네임스페이스
kubectl get pods -n production -o wide # IP, Node 포함
kubectl get all -n production          # 모든 리소스 유형

# 상세 확인 (Events 섹션이 핵심)
kubectl describe pod <pod-name>
kubectl describe node <node-name>

# 로그
kubectl logs <pod>                     # 현재 로그
kubectl logs <pod> -c <container>      # 특정 컨테이너
kubectl logs <pod> -f                  # 실시간
kubectl logs <pod> --previous          # 이전 컨테이너 로그

# 접속
kubectl exec -it <pod> -- /bin/sh
kubectl exec <pod> -- env | grep DB

# 포트 포워딩
kubectl port-forward pod/<pod> 8080:8080
kubectl port-forward svc/<svc> 8080:80
```

---

## 2. 출력 포맷 (-o)

```bash
# 넓게 보기 (IP, Node 포함)
kubectl get pods -o wide

# YAML로 전체 스펙 확인
kubectl get deployment myapp -o yaml

# JSONPath로 특정 필드 추출
kubectl get pods -o jsonpath=\
'{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\n"}{end}'

# Node IP 일괄 추출
kubectl get nodes \
  -o jsonpath='{.items[*].status.addresses[0].address}'

# 커스텀 컬럼
kubectl get pods \
  -o custom-columns=\
'NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName'
```

---

## 3. 필터링

```bash
# Label 필터
kubectl get pods -l app=myapp
kubectl get pods -l "env in (prod,staging)"
kubectl get pods -l app=myapp,tier=backend

# Field 필터
kubectl get pods --field-selector=status.phase=Running
kubectl get pods --field-selector=spec.nodeName=node-1

# 정렬
kubectl get pods --sort-by=.metadata.creationTimestamp
kubectl get events --sort-by=.lastTimestamp
```

---

## 4. dry-run & diff

적용 전에 반드시 확인하라.

```bash
# 클라이언트 dry-run (API 호출 없음)
kubectl apply -f deployment.yaml --dry-run=client

# 서버 dry-run (Admission까지 검증)
kubectl apply -f deployment.yaml --dry-run=server

# 현재 상태와 차이 비교
kubectl diff -f deployment.yaml

# YAML 생성 (apply 없이)
kubectl create deployment myapp \
  --image=myapp:latest --dry-run=client -o yaml
```

---

## 5. Context / Namespace 관리

```bash
# Context 목록
kubectl config get-contexts

# Context 전환
kubectl config use-context production

# 현재 Namespace 고정
kubectl config set-context --current --namespace=production

# 임시 Namespace 지정
kubectl get pods -n staging
```

### kubectx / kubens (krew 플러그인)

```bash
# krew 설치
kubectl krew install ctx ns

# Context 전환 (인터랙티브)
kubectl ctx

# Namespace 전환
kubectl ns production
kubectl ns -       # 이전 namespace로 돌아가기
```

---

## 6. 유용한 krew 플러그인

```bash
# krew 설치
(
  set -x; cd "$(mktemp -d)" &&
  curl -fsSLO \
    "https://github.com/kubernetes-sigs/krew/releases/latest/download/krew-linux_amd64.tar.gz" &&
  tar zxvf krew-linux_amd64.tar.gz &&
  ./krew-linux_amd64 install krew
)
# PATH에 krew bin 추가 (~/.bashrc 또는 ~/.zshrc)
export PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH"

# 추천 플러그인
kubectl krew install ctx       # context 전환
kubectl krew install ns        # namespace 전환
kubectl krew install stern     # 여러 Pod 동시 로그
kubectl krew install neat      # YAML 정리 (불필요 필드 제거)
kubectl krew install tree      # 리소스 계층 구조
```

---

## 7. kubectl explain

리소스 스펙을 문서 없이 확인한다.

```bash
# 최상위 필드 목록
kubectl explain deployment

# 중첩 필드 확인
kubectl explain deployment.spec
kubectl explain deployment.spec.template.spec.containers
kubectl explain pod.spec.affinity.nodeAffinity

# 전체 구조 재귀적으로
kubectl explain pod --recursive | grep -A2 "affinity"
```

---

## 8. 유용한 alias

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
alias k=kubectl
alias kg='kubectl get'
alias kd='kubectl describe'
alias kl='kubectl logs'
alias ka='kubectl apply -f'
alias kdel='kubectl delete'
alias kns='kubectl ns'
alias kctx='kubectl ctx'
alias kgp='kubectl get pods'
alias kgpa='kubectl get pods -A'
alias kgn='kubectl get nodes'
```

---

## 참고 문서

- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [krew 플러그인](https://krew.sigs.k8s.io/plugins/)
