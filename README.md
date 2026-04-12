# DevOps Wiki

Obsidian + LLM(Claude)으로 운영하는 DevOps 테크 위키.
웹 검색·공식문서·교육자료 등을 수집하고, LLM이 실무 수준의 한국어 위키 글로 정리하여 Quartz로 퍼블리싱한다.

## 디렉토리 구조

```
devops-wiki/
├── content/                 # 최종 발행 글 (Obsidian vault)
│   ├── index.md             # 메인 페이지
│   └── kubernetes/          # 주제별 서브폴더
├── raw/                     # 수집한 원본 소스 (git 추적 제외)
├── quartz/                  # Quartz v4 엔진 (SSG 빌드)
├── quartz.config.ts         # Quartz 설정
├── quartz.layout.ts         # Quartz 레이아웃
├── docs/                    # Quartz 기본 문서
├── .github/                 # GitHub Actions, PR 템플릿
├── .obsidian/               # Obsidian 설정
├── CLAUDE.md                # LLM 운영 규칙
└── package.json             # Quartz 의존성
```

## 운영 흐름

1. **수집 (ingest)** — 최신 DevOps 자료를 `raw/`에 저장
2. **작성 (compile)** — `raw/` 소스를 기반으로 `content/`에 위키 글 작성
3. **발행 (publish)** — feature 브랜치 → PR → 리뷰 → merge → Quartz 빌드

## 주요 주제

kubernetes · network · observability · container · linux · cicd
