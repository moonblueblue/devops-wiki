---
title: "Nix와 NixOS (선언적 패키지 관리)"
sidebar_label: "Nix / NixOS"
sidebar_position: 6
date: 2026-04-16
last_verified: 2026-04-16
tags:
  - linux
  - nix
  - nixos
  - package-management
  - reproducibility
---

# Nix와 NixOS (선언적 패키지 관리)

Nix는 패키지 관리를 **함수형 모델**로 재정의한다.
모든 빌드 입력이 해시로 고정되어 동일한 입력은
항상 동일한 출력을 보장한다.

## 버전 현황 (2026)

| 소프트웨어 | 버전 | 상태 |
|-----------|------|------|
| Nix | 2.34.6 (2026-04-12) | 유일한 지원 버전 (하위 EOL) |
| NixOS | 25.11 (2025-11) | 지원 2026-06-30 |
| NixOS | 25.05 (2025-05) | **EOL** (2025-12-31) |
| Determinate Nix | 3.x (최신: 3.17) | Flakes 안정성 자체 보증 |

---

## 핵심 개념: /nix/store

모든 패키지는 `/nix/store/<hash>-<name>-<version>/` 경로에
설치된다. 해시는 소스 코드·의존성·빌드 스크립트·환경변수를
SHA-256으로 압축한 32자 base32 문자열이다.

```
/nix/store/
  ├── 7hd63g2p4…-nginx-1.24.0/        ← 이 빌드만의 고유 경로
  ├── 9ab3f1m2c…-nginx-1.24.0/        ← 다른 옵션으로 빌드된 동명 패키지
  ├── 2dq8r7k1s…-openssl-3.3.1/
  └── …
```

결과:
- **DLL Hell 없음**: 같은 이름이라도 해시가 다르면 완전히 독립
- **원자적 업그레이드**: 심링크 교체 → 실패해도 이전 상태 유지
- **불변(immutable)**: 한 번 빌드된 경로는 내용 변경 불가

### Derivation (.drv)

derivation은 Nix의 빌드 명세서다.
필수 속성 3개: `name`, `system`, `builder`.
나머지 모든 속성은 빌드 환경의 환경변수로 전달된다.

```nix
derivation {
  name    = "hello-2.12.1";
  system  = "x86_64-linux";
  builder = "${pkgs.bash}/bin/bash";
  args    = [ ./build.sh ];
  src     = fetchTarball "https://...";
}
```

```
/nix/store/<hash>-hello-2.12.1.drv   ← 명세서
/nix/store/<hash>-hello-2.12.1/      ← 결과물
```

`nix derivation show nixpkgs#hello` 명령으로 내용 확인 가능.

---

## Generations과 Rollback

설치·삭제가 일어날 때마다 새 generation이 생성된다.
**실제 데이터는 /nix/store에 그대로 있고**,
프로파일 심링크만 교체되므로 롤백은 즉각적이다.

```
~/.nix-profile
  → /nix/var/nix/profiles/per-user/alice/profile
    → profile-43-link → /nix/store/<hash>-user-environment/
```

```bash
# generation 목록 확인
nix-env --list-generations

# 특정 generation으로 롤백
nix-env --rollback               # 직전으로
nix-env --switch-generation 41   # 지정 번호로
```

---

## Nix CLI: 레거시 vs 새 CLI

| 도구 | 상태 | 특징 |
|------|------|------|
| `nix-env` | 레거시, 비권장 | 명령형, 채널 기반 |
| `nix profile` | `nix-command` experimental 필요 | nix-env 대체, manifest.json |
| `nix build/develop/run` | `nix-command` + `flakes` 필요 | Flakes 연동, 재현 가능 |

`nix profile`, `nix build`, `nix develop` 등 새 CLI는
모두 `experimental-features = nix-command flakes` 활성화가
필요하다. `nix-env`로 수정한 프로파일과 `nix profile`은
호환되지 않으므로 처음부터 새 CLI로 시작한다.

---

## Flakes

Flakes는 Nix 의존성을 `flake.lock`으로 완전히 고정하여
채널 기반의 비재현성 문제를 해결한다.

### 2026년 현재 상태

| 구분 | 상태 |
|------|------|
| Upstream Nix (2.34) | `experimental` 딱지 유지 |
| Determinate Nix 3.x | 독자적으로 안정성 보증 (upstream과 별개) |
| RFC 0136 (안정화 계획) | 2023-08 승인, 진행 중 |

Flakes는 공식 안정화 전이지만, 커뮤니티 전체가 사용하며
"experimental"은 "unstable"을 의미하지 않는다.
활성화가 필요하다:

```bash
# /etc/nix/nix.conf 또는 ~/.config/nix/nix.conf
experimental-features = nix-command flakes
```

### flake.nix 구조

```nix
{
  description = "DevOps 프로젝트 환경";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";  # 동일 nixpkgs 사용
    };
  };

  outputs = { self, nixpkgs, home-manager, ... }:
    let
      system = "x86_64-linux";
      pkgs   = import nixpkgs { inherit system; };
    in {
      # 패키지 빌드
      packages.${system}.default = pkgs.hello;

      # 개발 셸
      devShells.${system}.default = pkgs.mkShell {
        buildInputs = with pkgs; [
          go_1_24 kubectl terraform_1_11
        ];
      };

      # NixOS 시스템
      nixosConfigurations.myserver =
        nixpkgs.lib.nixosSystem {
          inherit system;
          modules = [ ./configuration.nix ];
        };
    };
}
```

### 주요 Flakes 명령어

| 명령어 | 용도 |
|--------|------|
| `nix build .#myapp` | 패키지 빌드 |
| `nix develop` | devShell 진입 |
| `nix run .#myapp` | 패키지 즉시 실행 |
| `nix flake update` | 모든 inputs 업데이트 |
| `nix flake update nixpkgs` | nixpkgs만 업데이트 |
| `nix flake check` | Flake 유효성 검사 |
| `nix flake show` | outputs 목록 확인 |

`flake.lock`은 모든 inputs의 정확한 git commit hash를
고정한다. VCS에 반드시 커밋한다.

---

## NixOS

### configuration.nix — 선언적 시스템 관리

```nix
{ config, pkgs, lib, ... }:
{
  # 시스템 패키지
  environment.systemPackages = with pkgs; [
    vim git curl wget htop
  ];

  # 서비스 선언
  services.nginx = {
    enable = true;
    virtualHosts."example.com" = {
      root = "/var/www/html";
    };
  };

  # 사용자
  users.users.devops = {
    isNormalUser = true;
    extraGroups  = [ "wheel" "docker" ];
    openssh.authorizedKeys.keys = [
      "ssh-ed25519 AAAA..."
    ];
  };

  # 방화벽
  networking.firewall = {
    enable          = true;
    allowedTCPPorts = [ 22 80 443 ];
  };

  # GC 자동화
  nix.gc = {
    automatic = true;
    dates     = "weekly";
    options   = "--delete-older-than 30d";
  };
  nix.optimise.automatic = true;

  system.stateVersion = "25.11";
}
```

### nixos-rebuild 명령어

| 명령어 | 동작 |
|--------|------|
| `nixos-rebuild switch` | 빌드 → 활성화 → 부트로더 업데이트 |
| `nixos-rebuild test` | 빌드 → 활성화 (재부팅 시 이전으로 복귀) |
| `nixos-rebuild boot` | 빌드 → 부트로더 (다음 부팅 시 적용) |
| `nixos-rebuild build` | 빌드만 (적용 안함) |
| `nixos-rebuild build-image` | 디스크 이미지 생성 (25.05+) |

> **nixos-rebuild-ng**: NixOS 25.11부터 기본값.
> bash 기반 구현을 Python으로 재작성.
> 25.05에서는 `system.rebuild.enableNg = true;`로 옵트인 가능.

### nixpkgs 채널

| 채널 | 용도 |
|------|------|
| `nixos-25.11` | 안정판 서버/프로덕션 권장 |
| `nixos-25.05` | 이전 안정판 (2025-12 EOL) |
| `nixos-unstable` | 최신 패키지, 개발 환경 |

### 모듈 시스템

모든 NixOS 설정은 모듈 함수의 병합 결과다.
커스텀 서비스를 선언적으로 추가할 수 있다:

```nix
# modules/myapp.nix
{ config, pkgs, lib, ... }:
with lib;
{
  options.services.myapp = {
    enable = mkEnableOption "myapp";
    port   = mkOption {
      type    = types.port;
      default = 8080;
    };
  };

  config = mkIf config.services.myapp.enable {
    systemd.services.myapp = {
      wantedBy      = [ "multi-user.target" ];
      serviceConfig = {
        ExecStart =
          "${pkgs.myapp}/bin/myapp"
          + " --port ${toString config.services.myapp.port}";
      };
    };
  };
}
```

핵심 함수:

| 함수 | 용도 |
|------|------|
| `mkIf <cond> <cfg>` | 조건부 설정 |
| `mkMerge [<cfg1> <cfg2>]` | 설정 블록 병합 |
| `mkEnableOption` | `services.X.enable` 토글 옵션 |
| `mkOption { type; default; description; }` | 커스텀 옵션 선언 |
| `mkBefore/mkAfter` | 병합 우선순위 제어 |

---

## DevOps 실무 활용

### devShell — 프로젝트별 환경 재현

팀원 모두 동일한 버전의 툴체인을 사용할 수 있다.
OS 레벨 패키지 설치 없이 `nix develop`만으로 충분하다.

```nix
devShells.x86_64-linux.default = pkgs.mkShell {
  buildInputs = with pkgs; [
    terraform_1_11
    kubectl
    helm
    go_1_24
    awscli2
    docker-compose
  ];
  shellHook = ''
    export KUBECONFIG=$PWD/.kubeconfig
    echo "Terraform: $(terraform version -json \
      | jq -r '.terraform_version')"
  '';
};
```

| | `nix-shell` | `nix develop` |
|-|------------|---------------|
| 방식 | 채널 기반 (레거시) | Flakes 기반 (권장) |
| 재현성 | 낮음 | 높음 (flake.lock 고정) |
| 상태 | 유지, 비권장 | 표준 |

### nix-direnv — 자동 환경 전환

```bash
# .envrc (프로젝트 루트)
use flake
```

`cd`만으로 `nix develop` 환경이 자동 로드된다.
nix-direnv는 GC root를 생성하여 `nix-collect-garbage`에서
devShell 경로가 삭제되지 않도록 보호한다.

```bash
# flake.nix / flake.lock 변경 시에만 재평가
# 이후 진입은 캐시에서 즉시 로딩
direnv allow   # .envrc 활성화
```

### Docker 이미지 빌드 (dockerTools)

Dockerfile 없이 Nix 표현식으로 재현 가능한
OCI 이미지를 빌드한다. 불필요한 셸/패키지가 없는
최소 이미지가 만들어진다.

```nix
packages.x86_64-linux.dockerImage =
  pkgs.dockerTools.buildLayeredImage {
    name     = "myapp";
    tag      = "latest";
    contents = [ pkgs.myapp pkgs.cacert ];
    config   = {
      Cmd          = [ "${pkgs.myapp}/bin/myapp" ];
      Env          = [
        "SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt"
      ];
      ExposedPorts = { "8080/tcp" = {}; };
    };
    maxLayers = 100;
  };
```

```bash
nix build .#dockerImage
docker load < result
docker run myapp:latest
```

### CI/CD — GitHub Actions + Cachix

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: cachix/install-nix-action@v31
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes

      - uses: cachix/cachix-action@v17
        with:
          name: my-cache
          authToken: '${{ secrets.CACHIX_AUTH_TOKEN }}'

      - run: nix build .#myapp
      - run: nix flake check
```

**Cachix 동작 방식**:
1. 신규 빌드된 derivation을 바이너리 캐시에 자동 푸시
2. 이후 빌드는 캐시에서 즉시 가져옴 (재빌드 없음)
3. 팀 전체가 동일한 바이너리 공유 가능

**바이너리 캐시 신뢰 모델**: Nix는 캐시에서 받은 바이너리의
GPG/ed25519 서명을 검증한다. 서드파티 캐시는
`trusted-public-keys`에 공개 키를 등록해야 사용 가능하다:

```bash
# /etc/nix/nix.conf
substituters = https://cache.nixos.org https://my-cache.cachix.org
trusted-public-keys = cache.nixos.org-1:6NCH… my-cache.cachix.org-1:abCD…
```

**CI 디스크 주의**: GitHub-hosted runner의 기본 디스크는 14GB.
`/nix/store`가 채워지면 "no space left on device" 오류가 발생한다.
Cachix를 사용하거나 빌드 전 GC를 실행하면 해결된다:

```yaml
- run: nix-collect-garbage --delete-older-than 1d
```

---

## home-manager

개인 사용자 환경(dotfile, 사용자 패키지, systemd user 서비스)을
Nix로 선언적으로 관리한다.

```nix
# home.nix
{ pkgs, ... }:
{
  home.packages = with pkgs; [
    ripgrep fd bat eza
  ];

  programs.git = {
    enable    = true;
    userName  = "DevOps Engineer";
    userEmail = "devops@example.com";
    extraConfig.pull.rebase = true;
  };

  home.stateVersion = "25.11";
}
```

NixOS 모듈로 통합하거나 독립 실행으로 사용 가능하다.

---

## 시크릿 관리

`configuration.nix`는 Git에 커밋된다.
**시크릿(비밀번호, API 키, 개인 키)을 평문으로 넣으면 안 된다.**
대표적인 솔루션 두 가지:

| 도구 | 방식 | 특징 |
|------|------|------|
| **sops-nix** | SOPS(age/GPG) 암호화 | YAML/JSON 시크릿 파일 암호화, 팀 키 관리 용이 |
| **agenix** | age 암호화 | 단순한 파일 기반, SSH 키로 암호화 |

```nix
# sops-nix 예시 (configuration.nix)
sops.secrets."nginx/tls_key" = {
  owner = "nginx";
};

services.nginx.virtualHosts."example.com".sslCertificateKey =
  config.sops.secrets."nginx/tls_key".path;
```

두 도구 모두 암호화된 파일을 Git에 커밋하고,
배포 시 `/run/secrets/` 아래에 복호화된 파일을 마운트한다.

---

## macOS — nix-darwin

macOS 환경도 NixOS처럼 선언적으로 관리한다.
Apple Silicon (aarch64-darwin) 완전 지원.

```nix
darwinConfigurations.my-mac =
  nix-darwin.lib.darwinSystem {
    system  = "aarch64-darwin";
    modules = [
      ({ pkgs, ... }: {
        environment.systemPackages = with pkgs; [
          vim git kubectl
        ];
        services.nix-daemon.enable = true;
        nix.settings.experimental-features =
          [ "nix-command" "flakes" ];
        system.stateVersion = 6;  # 설치 시점 버전 유지
      })
    ];
  };
```

---

## 디스크 관리

`/nix/store`는 자동으로 정리되지 않는다.
GC root(심링크)가 없는 경로만 삭제 대상이 된다.

```bash
# GC root가 없는 경로 삭제
nix-collect-garbage

# 30일 이전 generation 삭제 후 GC
nix-collect-garbage --delete-older-than 30d

# 현재 generation 제외 전부 삭제
nix-collect-garbage -d

# 하드링크로 중복 제거
nix store optimise
```

```nix
# NixOS 자동화
nix.gc = {
  automatic = true;
  dates     = "weekly";
  options   = "--delete-older-than 30d";
};
nix.optimise.automatic = true;
```

GC root 위치: `/nix/var/nix/gcroots/` 하위 심링크.
nix-direnv는 devShell을 자동으로 GC root로 등록한다.

---

## 트레이드오프

| 항목 | Nix/NixOS | apt/dnf/brew |
|------|-----------|-------------|
| 재현성 | 완전 보장 | 채널·시간에 따라 다름 |
| 롤백 | 즉각적 (심링크 교체) | 수동 또는 불가 |
| 패키지 충돌 | 없음 (해시 격리) | 발생 가능 |
| devShell | 팀 환경 동기화 | 별도 도구 필요 |
| Docker 이미지 | 최소·재현 가능 | Dockerfile 수작업 |
| 학습 곡선 | 높음 (Nix 언어) | 낮음 |
| 디스크 사용 | 증가 (GC 필요) | 효율적 |
| Flakes 안정성 | experimental (upstream) | 해당 없음 |
| macOS | 부분 지원 (nix-darwin) | 기본 지원 |

---

## 참고 자료

- [Nix Reference Manual 2.34](https://nix.dev/manual/nix/2.34/)
  (확인: 2026-04-16)
- [NixOS 25.11 Released](https://nixos.org/blog/announcements/2025/nixos-2511/)
  (확인: 2026-04-16)
- [NixOS 25.05 Released](https://nixos.org/blog/announcements/2025/nixos-2505/)
  (확인: 2026-04-16)
- [Flakes — NixOS Wiki](https://wiki.nixos.org/wiki/Flakes)
  (확인: 2026-04-16)
- [Determinate Nix 3.0](https://determinate.systems/blog/determinate-nix-30/)
  (확인: 2026-04-16)
- [RFC 0136: Stabilize the new CLI and Flakes](https://github.com/NixOS/rfcs/pull/136)
  (확인: 2026-04-16)
- [nix | endoflife.date](https://endoflife.date/nix)
  (확인: 2026-04-16)
- [nixos-rebuild-ng](https://discourse.nixos.org/t/nixos-rebuild-ng-a-nixos-rebuild-rewrite/55606)
  (확인: 2026-04-16)
- [CI with GitHub Actions — nix.dev](https://nix.dev/guides/recipes/continuous-integration-github-actions.html)
  (확인: 2026-04-16)
- [pkgs.dockerTools — nixpkgs manual](https://ryantm.github.io/nixpkgs/builders/images/dockertools/)
  (확인: 2026-04-16)
- [Effortless dev environments with Nix and direnv](https://determinate.systems/blog/nix-direnv/)
  (확인: 2026-04-16)
