---
title: "Ansible Role과 Galaxy"
date: 2026-04-14
tags:
  - ansible
  - role
  - galaxy
  - automation
sidebar_label: "Role·Galaxy"
---

# Ansible Role과 Galaxy

## 1. Role이란

재사용 가능한 Ansible 구성 단위.
관련된 tasks, handlers, templates, variables를 표준 디렉토리 구조로 묶는다.

```
roles/
└── nginx/
    ├── tasks/
    │   ├── main.yaml       # 주 태스크 진입점
    │   └── install.yaml
    ├── handlers/
    │   └── main.yaml
    ├── templates/
    │   └── nginx.conf.j2
    ├── files/
    │   └── index.html
    ├── vars/
    │   └── main.yaml       # 우선순위 높은 변수
    ├── defaults/
    │   └── main.yaml       # 재정의 가능한 기본값
    ├── meta/
    │   └── main.yaml       # 메타데이터, 의존성
    └── README.md
```

```bash
# Role 스캐폴딩 생성
ansible-galaxy role init nginx
```

---

## 2. Role 작성 예시

```yaml
# roles/nginx/defaults/main.yaml
nginx_port: 80
nginx_user: www-data
nginx_worker_processes: auto
```

```yaml
# roles/nginx/tasks/main.yaml
---
- name: nginx 설치
  ansible.builtin.package:
    name: nginx
    state: present

- name: 설정 파일 배포
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    mode: "0644"
  notify: nginx 재시작

- name: nginx 활성화 및 시작
  ansible.builtin.systemd:
    name: nginx
    state: started
    enabled: true
```

```yaml
# roles/nginx/handlers/main.yaml
---
- name: nginx 재시작
  ansible.builtin.systemd:
    name: nginx
    state: restarted
```

```jinja2
{# roles/nginx/templates/nginx.conf.j2 #}
user {{ nginx_user }};
worker_processes {{ nginx_worker_processes }};

http {
    server {
        listen {{ nginx_port }};
        server_name {{ ansible_hostname }};
    }
}
```

```yaml
# roles/nginx/meta/main.yaml
galaxy_info:
  author: myteam
  description: Nginx 웹 서버 설정
  min_ansible_version: "2.15"
  platforms:
  - name: Ubuntu
    versions: ["22.04", "24.04"]

dependencies: []
```

---

## 3. Role 호출

```yaml
# site.yaml
---
- name: 웹 서버 설정
  hosts: web
  become: true
  roles:
  - role: common
  - role: nginx
    vars:
      nginx_port: 8080
  - role: app-deploy
```

---

## 4. group_vars / host_vars

인벤토리와 분리된 변수 파일.

```
inventory.yaml
group_vars/
├── all.yaml          # 모든 호스트
├── web.yaml          # web 그룹
└── db/
    ├── vars.yaml     # db 그룹 변수
    └── vault.yaml    # ansible-vault로 암호화
host_vars/
├── web-01.yaml
└── db-01.yaml
```

```yaml
# group_vars/web.yaml
nginx_port: 80
app_version: "2.0.0"

# group_vars/all.yaml
ntp_server: ntp.example.com
timezone: Asia/Seoul
```

---

## 5. Ansible Galaxy

커뮤니티 Role과 Collection을 배포·공유하는 플랫폼.

```bash
# Role 설치
ansible-galaxy role install geerlingguy.nginx

# 버전 지정
ansible-galaxy role install geerlingguy.nginx,3.2.0

# 설치된 Role 목록
ansible-galaxy role list
```

### requirements.yaml (의존성 관리)

```yaml
roles:
- name: geerlingguy.nginx
  version: "3.2.0"
- name: geerlingguy.docker
  version: "6.1.0"

collections:
- name: community.general
  version: ">=7.0.0"
- name: ansible.posix
  version: "1.5.4"
- name: community.docker
  version: ">=3.4.0"
```

```bash
# 일괄 설치
ansible-galaxy install -r requirements.yaml
ansible-galaxy collection install -r requirements.yaml
```

---

## 6. Collection

Role보다 포괄적인 패키지 (모듈+플러그인+Role+플레이북).

```bash
ansible-galaxy collection install community.general
ansible-galaxy collection install kubernetes.core
```

```yaml
# FQCN으로 사용
- name: 파드 배포
  kubernetes.core.k8s:
    state: present
    definition: "{{ lookup('file', 'pod.yaml') }}"
```

| Collection | 용도 |
|-----------|------|
| `community.general` | 범용 모듈 모음 |
| `community.docker` | Docker 관리 |
| `kubernetes.core` | K8s 배포 |
| `ansible.posix` | POSIX 시스템 |
| `amazon.aws` | AWS 리소스 |

---

## 참고 문서

- [Ansible Galaxy](https://galaxy.ansible.com/)
- [Roles 공식 문서](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html)
- [Collections 공식 문서](https://docs.ansible.com/ansible/latest/collections_guide/)
