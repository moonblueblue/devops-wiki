# Moon Blue's DevOps - Wiki

DevOps 엔지니어를 위한 한국어 기술 위키.
Obsidian 으로 집필하고 Claude 로 리서치·검수하며, Docusaurus 로 GitHub Pages 에 배포한다.

- 사이트: https://moonblueblue.github.io/devops-wiki/
- 운영 규칙: [CLAUDE.md](./CLAUDE.md)
- 레퍼런스 우선순위: [REFERENCES.md](./REFERENCES.md)

## 카테고리 (9개, 3-티어)

| # | 카테고리 | 티어 | 범위 |
|:-:|---|:-:|---|
| 01 | `linux/` | 서브 | 커널, systemd, 성능, 보안, 스토리지 |
| 02 | `network/` | 서브 | TCP/IP, DNS, TLS, 라우팅, LB |
| 03 | `container/` | 서브 | Docker, OCI, BuildKit, 런타임 |
| 04 | `kubernetes/` | 메인 | 아키텍처, 리소스, 스케줄링, 운영 |
| 05 | `cicd/` | 메인 | GitHub Actions, Jenkins, ArgoCD, Flux (GitOps 포함) |
| 06 | `observability/` | 메인 | 메트릭, 로그, 트레이스, SLO 도구 |
| 07 | `iac/` | 성장 | Terraform, Ansible, Crossplane |
| 08 | `security/` | 성장 | DevSecOps, 공급망, Zero Trust |
| 09 | `sre/` | 성장 | SLO, 포스트모템, 런북, 카오스 |

메인은 "빠짐없이", 서브·성장은 "필수만" 다룬다. 각 카테고리의 `index.md` 가 학습 로드맵이다.

## 디렉터리

| 경로 | 내용 |
|---|---|
| `content/` | 위키 글 (Obsidian vault, Docusaurus docs 루트) |
| `src/css/custom.css` | 사이트 스타일 |
| `static/img/` | 로고·파비콘 |
| `docusaurus.config.ts`, `sidebars.ts` | 사이트 설정, 사이드바(디렉터리 자동 생성) |
| `.github/workflows/deploy.yml` | `main` 푸시 시 GitHub Pages 배포 |

## 로컬 실행

Node 20 이상이 필요하다.

```bash
npm ci && npm start
```

배포 전 확인은 `npm run build` 로 한다. 깨진 링크가 있으면 빌드가 실패한다.

## 운영 흐름

1. 공식 문서·릴리스 노트를 리서치해 `content/` 에 작성한다. 출처는 글 하단 `## 참고 자료` 에 확인 날짜와 함께 적는다.
2. `.claude/agents/reviewer.md` 기준으로 검수한다.
3. `main` 에 직접 커밋·푸시하면 GitHub Actions 가 배포한다.
