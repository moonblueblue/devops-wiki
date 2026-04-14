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

- **에이전트리스**: 대상 서버에 소프트웨어 설치 불필요
- **멱등성**: 같은 플레이북을 여러 번 실행해도 안전
- **YAML 문법**: 낮은 학습 곡선

> 현재 버전: ansible-core 2.19.x (2026 기준)

---

## 2. 설치

```bash
# pip로 설치
pip install ansible

# 버전 확인
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
| `ansible_python_interpreter` | Python 경로 |

---

## 4. ansible.cfg

```ini
# ansible.cfg
[defaults]
inventory      = ./inventory.yaml
remote_user    = ubuntu
private_key_file = ~/.ssh/my-key.pem
host_key_checking = False
stdout_callback = yaml
retry_files_enabled = False

[privilege_escalation]
become      = True
become_method = sudo
become_user = root
```

---

## 5. Ad-hoc 명령어

플레이북 없이 즉석에서 명령을 실행한다.

```bash
# 연결 확인
ansible all -m ping -i inventory.yaml

# 명령 실행
ansible web -m command -a "uptime"
ansible web -m shell -a "df -h | grep /dev/sda"

# 패키지 설치
ansible web -m apt -a "name=nginx state=present" --become

# 파일 복사
ansible web -m copy \
  -a "src=./nginx.conf dest=/etc/nginx/nginx.conf" \
  --become

# 서비스 재시작
ansible web -m systemd -a "name=nginx state=restarted" --become

# 팩트 수집
ansible web -m setup
ansible web -m setup -a "filter=ansible_distribution*"
```

---

## 6. Playbook 구조

```yaml
---
# site.yaml
- name: 웹 서버 설정
  hosts: web          # 대상 호스트 그룹
  become: true        # sudo 실행
  vars:               # 플레이 변수
    http_port: 80
    nginx_version: "1.25"

  tasks:
  - name: nginx 설치
    apt:
      name: "nginx={{ nginx_version }}"
      state: present
      update_cache: true

  - name: nginx 설정 파일 배포
    template:
      src: nginx.conf.j2
      dest: /etc/nginx/nginx.conf
      mode: "0644"
    notify: nginx 재시작    # 변경 시 handler 호출

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

### 실행

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
ansible-playbook site.yaml -e "nginx_version=1.26"

# 상세 출력
ansible-playbook site.yaml -v     # verbose
ansible-playbook site.yaml -vvv   # 매우 상세
```

---

## 7. 조건문 (when)

```yaml
tasks:
- name: Ubuntu에서만 apt 실행
  apt:
    name: nginx
    state: present
  when: ansible_distribution == "Ubuntu"

- name: 서비스가 없을 때만 설치
  package:
    name: git
    state: present
  when: git_installed is not defined or not git_installed
```

---

## 8. 반복문 (loop)

```yaml
tasks:
- name: 여러 패키지 설치
  apt:
    name: "{{ item }}"
    state: present
  loop:
    - nginx
    - git
    - curl

- name: 여러 사용자 생성
  user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
    state: present
  loop:
    - { name: alice, groups: "sudo,docker" }
    - { name: bob,   groups: "docker" }
```

---

## 참고 문서

- [Ansible 공식 문서](https://docs.ansible.com/)
- [Ansible Quickstart](https://docs.ansible.com/ansible/latest/getting_started/)
