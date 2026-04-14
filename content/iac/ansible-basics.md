---
title: "Ansible 기초 (Inventory, Playbook)"
date: 2026-04-14
tags:
  - ansible
  - automation
  - iac
sidebar_label: "Ansible 기초"
---

# Ansible 기초

## 1. 개요

에이전트리스 IT 자동화 도구.
SSH만으로 수백 대 서버를 동시에 관리한다.

```
Control Node (Ansible 설치)
    │ SSH
    ├── Managed Node 1
    ├── Managed Node 2
    └── Managed Node 3
```

| 특징 | 설명 |
|-----|------|
| 에이전트리스 | 대상 서버에 소프트웨어 설치 불필요 |
| 멱등성 | 같은 플레이북을 여러 번 실행해도 안전 |
| YAML 문법 | 낮은 학습 곡선 |

> 현재 버전: ansible-core 2.19.x (2026 기준)

---

## 2. 설치

```bash
pip install ansible
ansible --version
```

---

## 3. Inventory

관리할 서버 목록을 정의한다.

### INI 형식

```ini
# inventory.ini
[web]
web-01.example.com
web-02.example.com ansible_port=2222

[db]
db-01.example.com ansible_user=dbadmin

[production:children]
web
db

[web:vars]
http_port=80
```

### YAML 형식

```yaml
# inventory.yaml
all:
  children:
    web:
      hosts:
        web-01.example.com:
        web-02.example.com:
          ansible_port: 2222
    db:
      hosts:
        db-01.example.com:
          ansible_user: dbadmin
      vars:
        db_port: 5432
```

### 접속 변수

| 변수 | 설명 |
|-----|------|
| `ansible_host` | 접속 IP/도메인 |
| `ansible_port` | SSH 포트 (기본 22) |
| `ansible_user` | SSH 사용자 |
| `ansible_ssh_private_key_file` | SSH 키 경로 |
| `ansible_become` | sudo 사용 여부 |

---

## 4. ansible.cfg

```ini
[defaults]
inventory        = ./inventory.yaml
remote_user      = ubuntu
private_key_file = ~/.ssh/my-key.pem
host_key_checking = False
stdout_callback  = yaml

[privilege_escalation]
become        = True
become_method = sudo
become_user   = root
```

---

## 5. Ad-hoc 명령어

```bash
# 연결 확인
ansible all -m ping -i inventory.yaml

# 명령 실행
ansible web -m command -a "uptime"
ansible web -m shell -a "df -h | grep /dev/sda"

# 패키지 설치
ansible web -m apt -a "name=nginx state=present" --become

# 서비스 재시작
ansible web -m systemd \
  -a "name=nginx state=restarted" --become

# 팩트 수집
ansible web -m setup
```

---

## 6. Playbook 구조

```yaml
---
- name: 웹 서버 설정
  hosts: web
  become: true
  vars:
    http_port: 80

  tasks:
  - name: nginx 설치
    apt:
      name: nginx
      state: present
      update_cache: true

  - name: nginx 설정 파일 배포
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
      mode: "0644"
    notify: nginx 재시작

  - name: nginx 서비스 시작
    systemd:
      name: nginx
      state: started
      enabled: true

  handlers:
  - name: nginx 재시작
    systemd:
      name: nginx
      state: restarted
```

---

## 7. Playbook 실행

```bash
# 기본 실행
ansible-playbook site.yaml -i inventory.yaml

# dry-run (실제 변경 없음)
ansible-playbook site.yaml --check

# 특정 태스크만 (태그)
ansible-playbook site.yaml --tags nginx

# 특정 호스트만
ansible-playbook site.yaml --limit web-01

# 변수 오버라이드
ansible-playbook site.yaml -e "http_port=8080"

# 상세 출력
ansible-playbook site.yaml -vvv
```

---

## 참고 문서

- [Ansible 공식 문서](https://docs.ansible.com/)
- [Ansible Quickstart](https://docs.ansible.com/ansible/latest/getting_started/)
