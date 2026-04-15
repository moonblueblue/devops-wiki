---
title: "파이썬으로 리눅스 커맨드 구현"
date: 2026-04-13
tags:
  - linux
  - python
  - devops
  - automation
  - scripting
sidebar_label: "Python 자동화"
---

# 파이썬으로 리눅스 커맨드 구현

DevOps 환경에서 Python은 Bash를 보완하는
강력한 자동화 도구다.
이 문서는 실무에서 바로 쓸 수 있는 Python 스크립트를 다룬다.

---

## 1. Python vs Bash 선택 기준

어떤 언어를 선택할지는 작업의 복잡도와
실행 환경에 따라 결정한다.
아래 표를 기준으로 판단하자.

| 기준 | Bash | Python |
|------|------|--------|
| 간단한 파일 조작 | 적합 | 과도함 |
| CLI 도구 조합 | 적합 | 불필요 |
| 복잡한 로직/조건 | 어려움 | 적합 |
| JSON/YAML 파싱 | jq 필요 | 내장 지원 |
| API 호출 | curl 조합 | requests |
| 에러 핸들링 | 제한적 | try/except |
| 크로스 플랫폼 | Linux 전용 | 모든 OS |
| 외부 라이브러리 | 없음 | pip 생태계 |

**실무 가이드라인:**

- 5줄 이하 파이프라인 조합은 Bash
- 조건 분기가 3개 이상이면 Python
- JSON 파싱이 필요하면 Python
- 팀이 공유하는 도구는 Python

> 공식 문서:
> [Python 표준 라이브러리](https://docs.python.org/3/library/)

---

## 2. subprocess - 외부 명령 실행

`subprocess` 모듈은 Python에서 쉘 명령을
실행하는 표준 방법이다.
`os.system()`은 더 이상 권장되지 않는다.

### subprocess.run() 기본 사용

```python
import subprocess

# 기본 실행
result = subprocess.run(
    ["ls", "-la", "/var/log"],
    capture_output=True,
    text=True,
    check=True
)
print(result.stdout)
```

주요 파라미터 정리:

| 파라미터 | 설명 | 기본값 |
|----------|------|--------|
| `capture_output` | stdout/stderr 캡처 | False |
| `text` | 문자열 모드 (vs 바이트) | False |
| `check` | 에러 시 예외 발생 | False |
| `timeout` | 타임아웃 (초) | None |
| `cwd` | 작업 디렉토리 | None |
| `env` | 환경 변수 딕셔너리 | None |

### 에러 핸들링

```python
import subprocess

def safe_run(cmd, timeout=30):
    """안전한 명령 실행 래퍼 함수."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            timeout=timeout
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"명령 실패: {e.cmd}")
        print(f"종료 코드: {e.returncode}")
        print(f"에러: {e.stderr}")
        return None
    except subprocess.TimeoutExpired:
        print(f"타임아웃: {timeout}초 초과")
        return None
```

### Popen - 스트리밍 처리

장시간 실행되는 프로세스의 출력을
실시간으로 읽어야 할 때 사용한다.

```python
import subprocess

proc = subprocess.Popen(
    ["tail", "-f", "/var/log/syslog"],
    stdout=subprocess.PIPE,
    text=True
)

try:
    for line in proc.stdout:
        if "error" in line.lower():
            print(f"[ALERT] {line.strip()}")
except KeyboardInterrupt:
    proc.terminate()
    proc.wait()
```

### 보안 주의사항

```python
# 위험: shell injection 가능
subprocess.run(f"ls {user_input}", shell=True)

# 안전: 리스트 형태 사용
subprocess.run(["ls", user_input])

# 문자열을 안전하게 분리
import shlex
cmd = shlex.split("ls -la /var/log")
subprocess.run(cmd)
```

> 공식 문서:
> [subprocess](https://docs.python.org/3/library/subprocess.html)

---

## 3. 파일·디렉토리 관리

Python은 `os`, `shutil`, `pathlib` 세 모듈로
파일 시스템을 다룬다.
`pathlib`이 현대적인 권장 방식이다.

### pathlib - 모던 경로 처리

```python
from pathlib import Path

# 경로 생성 및 조합
log_dir = Path("/var/log")
app_log = log_dir / "myapp" / "app.log"

# 파일 존재 확인
if app_log.exists():
    content = app_log.read_text()
    size = app_log.stat().st_size
    print(f"크기: {size} bytes")

# 디렉토리 생성 (mkdir -p)
Path("/tmp/backup/2026").mkdir(
    parents=True, exist_ok=True
)

# 파일 검색 (glob)
for f in Path("/var/log").glob("*.log"):
    print(f.name, f.stat().st_size)

# 재귀 검색 (find -name)
for f in Path("/etc").rglob("*.conf"):
    print(f)
```

pathlib 주요 메서드 정리:

| Bash 명령 | pathlib 코드 |
|-----------|-------------|
| `pwd` | `Path.cwd()` |
| `ls` | `path.iterdir()` |
| `find -name` | `path.rglob(pattern)` |
| `cat` | `path.read_text()` |
| `mkdir -p` | `path.mkdir(parents=True)` |
| `rm` | `path.unlink()` |
| `basename` | `path.name` |
| `dirname` | `path.parent` |
| `file ext` | `path.suffix` |

### os 모듈 - 시스템 인터페이스

```python
import os

# 환경 변수 (echo $HOME)
home = os.environ.get("HOME", "/root")
path = os.environ.get("PATH", "").split(":")

# 프로세스 정보
pid = os.getpid()
uid = os.getuid()

# 디렉토리 순회 (find)
for root, dirs, files in os.walk("/var/log"):
    for f in files:
        full = os.path.join(root, f)
        size = os.path.getsize(full)
        if size > 100 * 1024 * 1024:  # 100MB
            print(f"대용량: {full} ({size})")
```

### shutil - 고수준 파일 작업

```python
import shutil

# 파일 복사 (cp)
shutil.copy2("src.conf", "src.conf.bak")

# 디렉토리 복사 (cp -r)
shutil.copytree("/etc/nginx", "/backup/nginx")

# 이동 (mv)
shutil.move("old.log", "/archive/old.log")

# 디렉토리 삭제 (rm -rf)
shutil.rmtree("/tmp/old_build")

# 디스크 사용량 (df)
usage = shutil.disk_usage("/")
print(f"전체: {usage.total // (1024**3)} GB")
print(f"사용: {usage.used // (1024**3)} GB")
print(f"여유: {usage.free // (1024**3)} GB")
```

> 공식 문서:
> [pathlib](https://docs.python.org/3/library/pathlib.html),
> [os](https://docs.python.org/3/library/os.html),
> [shutil](https://docs.python.org/3/library/shutil.html)

---

## 4. 시스템 모니터링 (psutil)

`psutil`은 CPU, 메모리, 디스크, 네트워크,
프로세스 정보를 크로스 플랫폼으로 제공한다.
설치: `pip install psutil`

### CPU 모니터링

```python
import psutil

# CPU 사용률 (top)
cpu = psutil.cpu_percent(interval=1)
print(f"CPU 사용률: {cpu}%")

# 코어별 사용률
per_cpu = psutil.cpu_percent(
    interval=1, percpu=True
)
for i, pct in enumerate(per_cpu):
    print(f"  코어 {i}: {pct}%")

# CPU 정보
print(f"물리 코어: {psutil.cpu_count(logical=False)}")
print(f"논리 코어: {psutil.cpu_count(logical=True)}")
```

### 메모리 모니터링

```python
import psutil

# RAM 정보 (free -h)
mem = psutil.virtual_memory()
print(f"전체: {mem.total // (1024**3)} GB")
print(f"사용: {mem.used // (1024**3)} GB")
print(f"사용률: {mem.percent}%")

# 스왑 정보
swap = psutil.swap_memory()
print(f"스왑 사용: {swap.used // (1024**3)} GB")
```

### 디스크 모니터링

```python
import psutil

# 파티션 목록 (lsblk)
for part in psutil.disk_partitions():
    print(f"{part.device} -> {part.mountpoint}")
    usage = psutil.disk_usage(part.mountpoint)
    pct = usage.percent
    print(f"  사용률: {pct}%")
    if pct > 90:
        print("  [경고] 디스크 부족!")
```

### 네트워크 모니터링

```python
import psutil

# 네트워크 I/O (ifstat)
net = psutil.net_io_counters()
sent_mb = net.bytes_sent / (1024**2)
recv_mb = net.bytes_recv / (1024**2)
print(f"송신: {sent_mb:.1f} MB")
print(f"수신: {recv_mb:.1f} MB")

# 활성 연결 (ss -tuln) — root 권한 없으면 일부 연결 누락 가능
try:
    for conn in psutil.net_connections(kind="inet"):
        if conn.status == "LISTEN":
            addr = conn.laddr
            print(f"LISTEN {addr.ip}:{addr.port}")
except psutil.AccessDenied:
    print("연결 목록 조회 실패: root 권한 필요")
```

### 프로세스 관리

```python
import psutil

# 메모리 상위 프로세스 (ps aux --sort=-%mem)
procs = []
for p in psutil.process_iter(
    ['pid', 'name', 'memory_percent', 'cpu_percent']
):
    procs.append(p.info)

top_mem = sorted(
    procs,
    key=lambda x: x['memory_percent'] or 0,
    reverse=True
)[:10]

print("메모리 상위 10 프로세스:")
for p in top_mem:
    print(
        f"  PID {p['pid']:>6} "
        f"{p['name']:<20} "
        f"{p['memory_percent']:.1f}%"
    )
```

psutil 함수와 리눅스 명령 대응:

| 리눅스 명령 | psutil 함수 |
|-------------|-------------|
| `top` | `cpu_percent()` |
| `free -h` | `virtual_memory()` |
| `df -h` | `disk_usage()` |
| `lsblk` | `disk_partitions()` |
| `ifstat` | `net_io_counters()` |
| `ss -tuln` | `net_connections()` |
| `ps aux` | `process_iter()` |
| `kill` | `Process.kill()` |

> 공식 문서:
> [psutil](https://psutil.readthedocs.io/)

---

## 5. SSH 자동화 (paramiko)

`paramiko`는 SSHv2 프로토콜의 순수 Python 구현으로
원격 서버 관리를 자동화한다.
설치: `pip install paramiko`

### 기본 연결 및 명령 실행

```python
import paramiko

def ssh_exec(host, user, key_path, command):
    """SSH로 원격 명령을 실행한다."""
    client = paramiko.SSHClient()
    # ⚠️ AutoAddPolicy는 MITM 공격에 취약 (Bandit B507)
    # 프로덕션에서는 RejectPolicy + known_hosts 사전 등록 사용:
    #   client.set_missing_host_key_policy(paramiko.RejectPolicy())
    #   client.load_host_keys(os.path.expanduser("~/.ssh/known_hosts"))
    client.set_missing_host_key_policy(
        paramiko.AutoAddPolicy()  # 개발/테스트 환경 전용
    )
    try:
        client.connect(
            hostname=host,
            username=user,
            key_filename=key_path,
            timeout=10
        )
        stdin, stdout, stderr = client.exec_command(
            command, timeout=30
        )
        exit_code = stdout.channel.recv_exit_status()
        output = stdout.read().decode().strip()
        error = stderr.read().decode().strip()

        if exit_code != 0:
            print(f"에러 ({exit_code}): {error}")
            return None
        return output
    finally:
        client.close()

# 사용 예시
result = ssh_exec(
    "10.0.1.10", "deploy",
    "~/.ssh/id_ed25519",
    "df -h && free -h"
)
print(result)
```

### SFTP 파일 전송

```python
import paramiko

def sftp_upload(host, user, key_path,
                local, remote):
    """SFTP로 파일을 업로드한다."""
    transport = paramiko.Transport((host, 22))
    key = paramiko.Ed25519Key.from_private_key_file(
        key_path
    )
    transport.connect(username=user, pkey=key)

    sftp = paramiko.SFTPClient.from_transport(
        transport
    )
    try:
        sftp.put(local, remote)
        print(f"업로드 완료: {local} -> {remote}")
    finally:
        sftp.close()
        transport.close()
```

### 다중 서버 실행

```python
import paramiko
from concurrent.futures import ThreadPoolExecutor

SERVERS = [
    {"host": "10.0.1.10", "user": "deploy"},
    {"host": "10.0.1.11", "user": "deploy"},
    {"host": "10.0.1.12", "user": "deploy"},
]

def run_on_server(server, command, key_path):
    """단일 서버에 명령을 실행한다."""
    client = paramiko.SSHClient()
    # ⚠️ AutoAddPolicy: 개발/테스트 전용, 프로덕션 사용 금지
    client.set_missing_host_key_policy(
        paramiko.AutoAddPolicy()
    )
    try:
        client.connect(
            hostname=server["host"],
            username=server["user"],
            key_filename=key_path
        )
        _, stdout, stderr = client.exec_command(
            command
        )
        return {
            "host": server["host"],
            "output": stdout.read().decode().strip(),
            "error": stderr.read().decode().strip(),
        }
    finally:
        client.close()

# 병렬 실행
from pathlib import Path
key = str(Path("~/.ssh/id_ed25519").expanduser())  # ~ 자동 확장
with ThreadPoolExecutor(max_workers=5) as pool:
    futures = [
        pool.submit(
            run_on_server, s, "uptime", key
        )
        for s in SERVERS
    ]
    for f in futures:
        r = f.result()
        print(f"[{r['host']}] {r['output']}")
```

> 공식 문서:
> [Paramiko](https://www.paramiko.org/),
> [Fabric](https://www.fabfile.org/)

---

## 6. CLI 도구 만들기

DevOps 도구는 CLI 인터페이스가 필수다.
`argparse`(표준)와 `click`(서드파티)을
상황에 맞게 선택한다.

### argparse vs click 비교

| 기준 | argparse | click |
|------|----------|-------|
| 설치 | 불필요 (표준) | `pip install click` |
| 문법 | 절차적 | 데코레이터 |
| 서브커맨드 | add_subparsers | @group |
| 자동 도움말 | 기본 | 더 깔끔 |
| 타입 변환 | type= | @option type |
| 프롬프트 입력 | 수동 구현 | prompt=True |
| 점유율 (2025) | 표준 | 38.7% |

### argparse 예제

```python
#!/usr/bin/env python3
"""서비스 상태 확인 CLI."""
import argparse
import subprocess

def check_service(name):
    """systemctl로 서비스 상태를 확인한다."""
    result = subprocess.run(
        ["systemctl", "is-active", name],
        capture_output=True, text=True
    )
    status = result.stdout.strip()
    return status == "active"

def main():
    parser = argparse.ArgumentParser(
        description="서비스 상태 확인 도구"
    )
    parser.add_argument(
        "services", nargs="+",
        help="확인할 서비스 이름"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="상세 출력"
    )
    args = parser.parse_args()

    for svc in args.services:
        ok = check_service(svc)
        icon = "OK" if ok else "FAIL"
        print(f"[{icon}] {svc}")

if __name__ == "__main__":
    main()
```

실행: `python svc_check.py nginx redis -v`

### click 예제

```python
#!/usr/bin/env python3
"""디스크 모니터링 CLI (click 기반)."""
import click
import psutil

@click.group()
def cli():
    """시스템 모니터링 도구."""
    pass

@cli.command()
@click.option(
    "--threshold", "-t", default=80,
    help="경고 임계값 (%)"
)
def disk(threshold):
    """디스크 사용량을 점검한다."""
    for part in psutil.disk_partitions():
        usage = psutil.disk_usage(part.mountpoint)
        status = (
            "WARN" if usage.percent > threshold
            else "OK"
        )
        click.echo(
            f"[{status}] {part.mountpoint}: "
            f"{usage.percent}%"
        )

@cli.command()
def memory():
    """메모리 사용량을 출력한다."""
    mem = psutil.virtual_memory()
    click.echo(f"사용률: {mem.percent}%")
    click.echo(
        f"사용: {mem.used // (1024**3)} GB / "
        f"전체: {mem.total // (1024**3)} GB"
    )

if __name__ == "__main__":
    cli()
```

실행:
```bash
python monitor.py disk --threshold 90
python monitor.py memory
```

> 공식 문서:
> [argparse](https://docs.python.org/3/library/argparse.html),
> [click](https://click.palletsprojects.com/)

---

## 7. 실전 스크립트 예제

### 시스템 정보 수집기

서버 상태를 한 번에 수집하는 스크립트다.
cron에 등록하면 정기 모니터링에 활용할 수 있다.

```python
#!/usr/bin/env python3
"""시스템 정보를 JSON으로 수집한다."""
import json
import socket
from datetime import datetime
from pathlib import Path
import psutil

def collect_system_info():
    """시스템 전체 정보를 딕셔너리로 반환."""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()

    return {
        "hostname": socket.gethostname(),
        "timestamp": datetime.now().isoformat(),
        "cpu": {
            "percent": psutil.cpu_percent(
                interval=1
            ),
            "cores": psutil.cpu_count(),
        },
        "memory": {
            "total_gb": round(
                mem.total / (1024**3), 1
            ),
            "used_gb": round(
                mem.used / (1024**3), 1
            ),
            "percent": mem.percent,
        },
        "disk": {
            "total_gb": round(
                disk.total / (1024**3), 1
            ),
            "used_gb": round(
                disk.used / (1024**3), 1
            ),
            "percent": disk.percent,
        },
        "network": {
            "sent_mb": round(
                net.bytes_sent / (1024**2), 1
            ),
            "recv_mb": round(
                net.bytes_recv / (1024**2), 1
            ),
        },
    }

if __name__ == "__main__":
    info = collect_system_info()
    output = Path("/tmp/sysinfo.json")
    output.write_text(
        json.dumps(info, indent=2, ensure_ascii=False)
    )
    print(json.dumps(info, indent=2))
```

### 로그 파서

특정 패턴의 로그를 분석하고 통계를 낸다.
Nginx 에러 로그 분석 예제다.

```python
#!/usr/bin/env python3
"""로그 파일에서 에러 패턴을 분석한다."""
import re
from collections import Counter
from pathlib import Path

def parse_log(log_path, pattern=r"\[error\]"):
    """로그에서 패턴 매칭 라인을 추출한다."""
    path = Path(log_path)
    if not path.exists():
        print(f"파일 없음: {log_path}")
        return []

    matches = []
    regex = re.compile(pattern, re.IGNORECASE)
    # read_text() 대신 스트리밍 처리 → 대용량 로그 OOM 방지
    with path.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            if regex.search(line):
                matches.append(line.strip())
    return matches

def summarize(matches):
    """에러 유형별 빈도를 요약한다."""
    types = Counter()
    for line in matches:
        # 에러 메시지 핵심 부분 추출
        m = re.search(
            r"\[error\]\s+\d+#\d+:\s+(.+)", line
        )
        if m:
            msg = m.group(1)[:60]
            types[msg] += 1

    print(f"\n총 에러: {len(matches)}건")
    print("-" * 40)
    for msg, count in types.most_common(10):
        print(f"  {count:>4}건  {msg}")

if __name__ == "__main__":
    errors = parse_log("/var/log/nginx/error.log")
    summarize(errors)
```

### 포트 스캐너

지정한 호스트의 열린 포트를 확인한다.
보안 점검이나 서비스 상태 확인에 활용한다.

```python
#!/usr/bin/env python3
"""TCP 포트를 스캔한다."""
import socket
from concurrent.futures import ThreadPoolExecutor

def check_port(host, port, timeout=1):
    """TCP 포트 연결을 시도한다."""
    try:
        with socket.socket(
            socket.AF_INET, socket.SOCK_STREAM
        ) as s:
            s.settimeout(timeout)
            result = s.connect_ex((host, port))
            return port if result == 0 else None
    except socket.error:
        return None

def scan_ports(host, ports, workers=50):
    """여러 포트를 병렬로 스캔한다."""
    open_ports = []
    with ThreadPoolExecutor(
        max_workers=workers
    ) as pool:
        futures = {
            pool.submit(check_port, host, p): p
            for p in ports
        }
        # futures는 {Future: port} 딕셔너리 → .items()로 순회
        for f, port in futures.items():
            result = f.result()
            if result:
                open_ports.append(result)

    return sorted(open_ports)

if __name__ == "__main__":
    target = "localhost"
    common_ports = [
        22, 80, 443, 3306, 5432,
        6379, 8080, 8443, 9090, 27017
    ]
    print(f"스캔 대상: {target}")
    open_p = scan_ports(target, common_ports)

    if open_p:
        print(f"열린 포트: {open_p}")
    else:
        print("열린 포트 없음")
```

### 서비스 헬스 체커

HTTP 엔드포인트와 systemd 서비스를
동시에 점검하는 통합 도구다.

```python
#!/usr/bin/env python3
"""서비스 상태를 종합 점검한다."""
import subprocess
import urllib.request
import json
from datetime import datetime

CHECKS = {
    "http": [
        {"name": "API", "url": "http://localhost:8080/health"},
        {"name": "Web", "url": "http://localhost:80/"},
    ],
    "systemd": ["nginx", "redis", "postgresql"],
}

def check_http(name, url, timeout=5):
    """HTTP GET으로 헬스 체크한다."""
    try:
        req = urllib.request.urlopen(
            url, timeout=timeout
        )
        return {
            "name": name,
            "status": "OK",
            "code": req.getcode(),
        }
    except Exception as e:
        return {
            "name": name,
            "status": "FAIL",
            "error": str(e),
        }

def check_systemd(service):
    """systemctl로 서비스 상태를 확인한다."""
    result = subprocess.run(
        ["systemctl", "is-active", service],
        capture_output=True, text=True
    )
    active = result.stdout.strip() == "active"
    return {
        "name": service,
        "status": "OK" if active else "FAIL",
        "state": result.stdout.strip(),
    }

if __name__ == "__main__":
    report = {
        "timestamp": datetime.now().isoformat(),
        "results": [],
    }

    for svc in CHECKS["http"]:
        r = check_http(svc["name"], svc["url"])
        report["results"].append(r)
        mark = "OK" if r["status"] == "OK" else "FAIL"
        print(f"[{mark}] HTTP {r['name']}")

    for svc in CHECKS["systemd"]:
        r = check_systemd(svc)
        report["results"].append(r)
        mark = "OK" if r["status"] == "OK" else "FAIL"
        print(f"[{mark}] SVC  {svc}")

    print(json.dumps(report, indent=2))
```

> 관련 도구:
> [psutil](https://psutil.readthedocs.io/),
> [paramiko](https://www.paramiko.org/),
> [click](https://click.palletsprojects.com/)

---

## 요약

Python은 Bash를 대체하는 것이 아니라 보완한다.
간단한 파이프라인은 Bash, 복잡한 로직은 Python이
각자의 영역에서 최적이다.

| 작업 | 추천 모듈 |
|------|----------|
| 외부 명령 실행 | `subprocess` |
| 파일/경로 관리 | `pathlib` + `shutil` |
| 시스템 모니터링 | `psutil` |
| SSH 자동화 | `paramiko` |
| CLI 도구 | `click` 또는 `argparse` |
| 네트워크 점검 | `socket` |
