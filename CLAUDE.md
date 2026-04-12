# DevOps Wiki - Claude 운영 규칙

## 프로젝트 개요
DevOps 엔지니어를 위한 오픈 테크 블로그/위키.
쿠버네티스, 네트워크, 옵저버빌리티, 컨테이너, 리눅스 등을 다룬다.

## 디렉토리 구조
- `raw/` : 수집한 원본 소스. 절대 수정하지 말 것
- `content/` : 최종 글. LLM이 작성·관리
- `CLAUDE.md` : 운영 규칙 (이 파일)

## 운영 방식

### ingest (수집)
- 웹 검색으로 최신 DevOps 관련 글, 공식문서, 릴리즈 노트 수집
- raw/ 폴더에 마크다운으로 저장
- 주제별 서브폴더 사용 (raw/kubernetes/, raw/network/ 등)

### compile (작성)
- raw/ 의 소스를 읽고 content/ 에 글 작성
- 기존 글과 새 정보를 비교해서 업데이트
- 기술적 깊이는 실무 DevOps 엔지니어 수준 유지
- 한국어로 작성

### PR
- 작업 완료 후 feature 브랜치 생성
- GitHub PR 생성
- 호성님이 검토 후 merge

## 글 형식
- frontmatter 필수: title, date, tags
- 실무 예제 코드 포함
- 공식 문서 링크 첨부

## 주요 주제
- kubernetes
- network
- observability
- container
- linux
- cicd
