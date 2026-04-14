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

## 1. Role 구조

Role은 재사용 가능한 Ansible 구성 단위다.

```
roles/
└── nginx/
    ├── tasks/
    │   ├── main.yaml       # 주 태스크 진입점
    │   └── install.yaml    # 태스크 분리 파일
    ├── handlers/
    │   └── main.yaml       # 핸들러 정의
    ├── templates/
    │   └── nginx.conf.j2   # Jinja2 템플릿
    ├── files/
    │   └── index.html      # 정적 파일
    ├── vars/
    │   └── main.yaml       # 우선순위 높은 변수
    ├── defaults/
    │   └── main.yaml       # 기본값 (재정의 가능)
    ├── meta/
    │   └── main.yaml       # 메타데이터, 의존성
    └── README.md
```

```bash
# Role 생성 (스캐폴딩)
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
    group: root
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

- name: nginx 설정 재로드
  ansible.builtin.systemd:
    name: nginx
    state: reloaded
```

```jinja2
{# roles/nginx/templates/nginx.conf.j2 #}
user {{ nginx_user }};
worker_processes {{ nginx_worker_processes }};

events {
    worker_connections 1024;
}

http {
    server {
        listen {{ nginx_port }};
        server_name {{ ansible_hostname }};
        root /var/www/html;
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
    versions: ["20.04", "22.04"]

dependencies: []   # 다른 Role 의존성
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
  - role: nginx
    vars:
      nginx_port: 8080

  # 또는
  - role: common
  - role: nginx
  - role: app-deploy
```

---

## 4. group_vars / host_vars

인벤토리와 분리된 변수 파일.

```
inventory.yaml
group_vars/
├── all.yaml         # 모든 호스트
├── web.yaml         # web 그룹
└── db/
    ├── vars.yaml    # db 그룹 변수
    └── vault.yaml   # 암호화된 민감 변수
host_vars/
├── web-01.yaml      # 특정 호스트
└── db-01.yaml
```

```yaml
# group_vars/web.yaml
nginx_port: 80
app_version: "2.0.0"
```

```yaml
# group_vars/all.yaml
ntp_server: ntp.example.com
timezone: Asia/Seoul
```

---

## 5. Ansible Galaxy

커뮤니티 Role과 Collection을 배포·공유하는 플랫폼.

```bash
# Role 검색
ansible-galaxy search nginx

# Role 설치
ansible-galaxy role install geerlingguy.nginx

# 버전 지정 설치
ansible-galaxy role install geerlingguy.nginx,3.2.0

# 설치된 Role 목록
ansible-galaxy role list

# Role 삭제
ansible-galaxy role remove geerlingguy.nginx
```

### requirements.yaml (의존성 관리)

```yaml
# requirements.yaml
roles:
- name: geerlingguy.nginx
  version: "3.2.0"
- name: geerlingguy.docker
  version: "6.1.0"
- src: https://github.com/myorg/my-role.git
  scm: git
  version: main
  name: my-role

collections:
- name: community.general
  version: ">=7.0.0"
- name: ansible.posix
  version: "1.5.4"
- name: community.docker
  version: ">=3.4.0"
```

```bash
# requirements.yaml로 일괄 설치
ansible-galaxy install -r requirements.yaml
ansible-galaxy collection install -r requirements.yaml
```

---

## 6. Collection

Role보다 더 포괄적인 패키지 (모듈+플러그인+Role+플레이북 포함).

```bash
# Collection 설치
ansible-galaxy collection install community.general
ansible-galaxy collection install kubernetes.core

# Collection 사용 (FQCN)
- name: 파드 배포
  kubernetes.core.k8s:
    state: present
    definition: "{{ lookup('file', 'pod.yaml') }}"
```

### 주요 Collection

| Collection | 용도 |
|-----------|------|
| `community.general` | 범용 모듈 모음 |
| `community.docker` | Docker 관리 |
| `kubernetes.core` | K8s 배포 |
| `ansible.posix` | POSIX 시스템 |
| `community.postgresql` | PostgreSQL 관리 |
| `amazon.aws` | AWS 리소스 |

---

## 7. Ansible vs Terraform 역할 구분

| 용도 | 도구 |
|-----|------|
| 클라우드 인프라 생성 (VPC, EC2, RDS) | Terraform |
| 서버 소프트웨어 설치·설정 | Ansible |
| 배포 자동화 (앱 배포, 설정 변경) | Ansible |
| 인프라 상태 관리, 드리프트 감지 | Terraform |
| 긴급 패치, OS 설정 변경 | Ansible |

**일반적인 조합**:
```
Terraform → 서버 프로비저닝
    ↓
Ansible → 서버 설정 및 앱 배포
```

---

## 8. ansible-lint

플레이북 품질 검사 도구.

```bash
# 설치
pip install ansible-lint

# 실행
ansible-lint site.yaml

# 전체 검사
ansible-lint

# 특정 규칙 무시
ansible-lint --skip-list yaml[line-length]
```

---

## 참고 문서

- [Ansible Galaxy](https://galaxy.ansible.com/)
- [Roles 공식 문서](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html)
- [Collections 공식 문서](https://docs.ansible.com/ansible/latest/collections_guide/)
