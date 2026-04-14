---
title: "Ansible Module과 Handler"
date: 2026-04-14
tags:
  - ansible
  - module
  - handler
  - iac
sidebar_label: "Module·Handler"
---

# Ansible Module과 Handler

## 1. Module이란

Ansible의 실행 단위. 각 Task는 하나의 모듈을 호출한다.
Python으로 작성되어 원격 노드에서 실행된다.

```yaml
tasks:
- name: nginx 설치
  apt:                   # ← 이게 모듈 이름
    name: nginx
    state: present
```

---

## 2. 자주 쓰는 내장 모듈

### 파일 시스템

```yaml
# 파일 복사
- copy:
    src: ./nginx.conf
    dest: /etc/nginx/nginx.conf
    owner: root
    mode: "0644"

# Jinja2 템플릿 렌더링
- template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf

# 파일/디렉토리 생성·권한
- file:
    path: /var/log/myapp
    state: directory
    mode: "0755"
    owner: ubuntu

# 파일 라인 수정
- lineinfile:
    path: /etc/hosts
    line: "10.0.0.1 db.internal"
    state: present
```

### 패키지 관리

```yaml
# APT (Debian/Ubuntu)
- apt:
    name:
    - nginx
    - curl
    - git
    state: present
    update_cache: true

# YUM/DNF (RHEL/CentOS)
- dnf:
    name: httpd
    state: latest

# 패키지 제거
- apt:
    name: apache2
    state: absent
```

### 서비스 관리

```yaml
- systemd:
    name: nginx
    state: started      # started / stopped / restarted / reloaded
    enabled: true       # 부팅 시 자동 시작
    daemon_reload: true # systemd 유닛 재로드 후 적용
```

### 명령어 실행

```yaml
# 멱등성 없음 - 신중히 사용
- command:
    cmd: /opt/app/setup.sh
    creates: /opt/app/.installed   # 파일 있으면 스킵

# 쉘 기능 필요 시 (파이프, 리다이렉션)
- shell:
    cmd: "ps aux | grep nginx | grep -v grep"
    register: ps_result

# 결과 출력
- debug:
    var: ps_result.stdout
```

### 사용자 관리

```yaml
- user:
    name: deploy
    groups: "sudo,docker"
    shell: /bin/bash
    create_home: true
    state: present

- authorized_key:
    user: deploy
    key: "{{ lookup('file', '~/.ssh/id_rsa.pub') }}"
    state: present
```

---

## 3. register와 결과 활용

모듈 실행 결과를 변수에 저장해 후속 태스크에서 활용한다.

```yaml
- name: 현재 nginx 버전 확인
  command: nginx -v
  register: nginx_version
  ignore_errors: true

- name: nginx 버전 출력
  debug:
    msg: "nginx 버전: {{ nginx_version.stderr }}"

- name: nginx가 없으면 설치
  apt:
    name: nginx
    state: present
  when: nginx_version.rc != 0
```

---

## 4. Handler

태스크가 변경(changed)을 일으킬 때만 실행되는 특수 태스크.
설정 파일이 변경된 경우에만 서비스를 재시작하는 패턴에 사용한다.

```yaml
tasks:
- name: nginx 설정 파일 배포
  template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
  notify: nginx 재시작    # 변경이 있을 때만 handler 호출

- name: nginx 인증서 업데이트
  copy:
    src: ssl.crt
    dest: /etc/nginx/ssl/
  notify:
  - nginx 설정 검사       # 여러 handler 호출 가능
  - nginx 재시작

handlers:
- name: nginx 재시작
  systemd:
    name: nginx
    state: restarted

- name: nginx 설정 검사
  command: nginx -t
```

### Handler 동작 규칙

```
태스크 실행 → changed 발생 → notify 등록
    → 플레이 끝날 때 handler 실행 (한 번만)

같은 handler를 여러 태스크가 notify해도
플레이당 한 번만 실행된다.
```

### 즉시 실행이 필요한 경우

```yaml
tasks:
- name: systemd 유닛 파일 배포
  copy:
    src: myapp.service
    dest: /etc/systemd/system/
  notify: systemd reload

- meta: flush_handlers   # 여기서 즉시 handler 실행

- name: 서비스 시작
  systemd:
    name: myapp
    state: started
```

---

## 5. FQCN (Fully Qualified Collection Name)

Ansible 2.10+부터 권장하는 모듈 명명 방식.

```yaml
# 구식 (여전히 동작하나 비권장)
- apt:
    name: nginx

# 권장 방식 (FQCN)
- ansible.builtin.apt:
    name: nginx

- community.general.ufw:
    rule: allow
    port: 80
```

---

## 참고 문서

- [모듈 인덱스](https://docs.ansible.com/ansible/latest/collections/index_module.html)
- [Handler 공식 문서](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html)
