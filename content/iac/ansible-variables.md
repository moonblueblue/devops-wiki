---
title: "Ansible 변수, 반복문, 조건문"
date: 2026-04-14
tags:
  - ansible
  - variables
  - loop
  - when
  - iac
sidebar_label: "변수·반복문·조건문"
---

# Ansible 변수, 반복문, 조건문

## 1. 변수 정의 방법

### 우선순위 (높을수록 우선 적용)

```
1. 커맨드라인 -e 옵션        (최우선)
2. task vars
3. block vars
4. role vars (vars/main.yaml)
5. play vars
6. host_vars/hostname.yaml
7. group_vars/groupname.yaml
8. role defaults (defaults/main.yaml)  (최저 우선순위)
```

### 선언 위치별 예시

```yaml
# 플레이 레벨
- hosts: web
  vars:
    http_port: 80
    app_name: myapp

  # 외부 파일 로드
  vars_files:
  - vars/common.yaml
  - vars/prod.yaml

  tasks:
  - name: 포트 출력
    debug:
      msg: "포트: {{ http_port }}"
```

```yaml
# group_vars/web.yaml
nginx_version: "1.25"
max_connections: 1024

# host_vars/web-01.yaml
server_id: 1
```

---

## 2. 변수 타입과 사용

```yaml
# 문자열
app_version: "2.0.0"

# 숫자
worker_processes: 4

# 불리언
ssl_enabled: true

# 리스트
packages:
- nginx
- git
- curl

# 딕셔너리
database:
  host: db.internal
  port: 5432
  name: myapp

# 변수 참조
- debug:
    msg: "DB: {{ database.host }}:{{ database.port }}"

# 리스트 인덱스
- debug:
    msg: "첫 번째 패키지: {{ packages[0] }}"
```

---

## 3. Facts (팩트)

Ansible이 자동 수집하는 시스템 정보.

```yaml
- name: OS 정보 출력
  debug:
    msg: "{{ ansible_distribution }} {{ ansible_distribution_version }}"

- name: IP 주소 확인
  debug:
    msg: "IP: {{ ansible_default_ipv4.address }}"
```

```bash
# 팩트 직접 확인
ansible web -m setup
ansible web -m setup -a "filter=ansible_distribution*"
```

```yaml
# 팩트 수집 비활성화 (속도 향상)
- hosts: web
  gather_facts: false
```

---

## 4. 조건문 (when)

```yaml
tasks:
# OS 분기
- name: Ubuntu에서만 apt 실행
  apt:
    name: nginx
    state: present
  when: ansible_distribution == "Ubuntu"

- name: CentOS에서만 dnf 실행
  dnf:
    name: nginx
    state: present
  when: ansible_distribution == "CentOS"

# 변수 값 비교
- name: 프로덕션에서만 실행
  command: /opt/app/migrate.sh
  when: env == "prod"

# 복합 조건
- name: Ubuntu 22.04 이상에서만
  apt:
    name: podman
  when:
  - ansible_distribution == "Ubuntu"
  - ansible_distribution_major_version | int >= 22

# register 결과 활용
- name: 서비스 상태 확인
  command: systemctl is-active nginx
  register: nginx_status
  ignore_errors: true

- name: nginx가 꺼져 있으면 시작
  systemd:
    name: nginx
    state: started
  when: nginx_status.rc != 0
```

---

## 5. 반복문 (loop)

```yaml
# 단순 리스트
- name: 여러 패키지 설치
  apt:
    name: "{{ item }}"
    state: present
  loop:
  - nginx
  - git
  - curl

# 딕셔너리 리스트
- name: 여러 사용자 생성
  user:
    name: "{{ item.name }}"
    groups: "{{ item.groups }}"
    state: present
  loop:
  - { name: alice, groups: "sudo,docker" }
  - { name: bob,   groups: "docker" }

# 변수 리스트 사용
- name: 파일 생성
  file:
    path: "{{ item }}"
    state: directory
  loop: "{{ app_dirs }}"
  # vars에서: app_dirs: [/opt/app, /var/log/app, /etc/app]
```

---

## 6. loop_control

```yaml
# 루프 변수 이름 변경 (중첩 루프 시 필요)
- name: 서비스 설정
  template:
    src: "{{ service.name }}.conf.j2"
    dest: "/etc/{{ service.name }}.conf"
  loop: "{{ services }}"
  loop_control:
    loop_var: service    # item 대신 service로 참조
    label: "{{ service.name }}"  # 출력 레이블 간소화
    pause: 1             # 반복 사이 대기 (초)
```

---

## 7. Jinja2 필터

```yaml
# 대소문자 변환
- debug:
    msg: "{{ app_name | upper }}"

# 기본값
- debug:
    msg: "{{ undefined_var | default('없음') }}"

# 타입 변환
- debug:
    msg: "{{ '42' | int + 1 }}"

# 리스트 조작
- debug:
    msg: "{{ packages | join(', ') }}"

# 조건부 값
- debug:
    msg: "{{ 't3.large' if env == 'prod' else 't2.micro' }}"
```

---

## 참고 문서

- [변수 우선순위](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html)
- [조건문](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_conditionals.html)
- [반복문](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_loops.html)
