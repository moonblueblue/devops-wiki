# 레퍼런스 소스

글 작성·검수 시 아래 레퍼런스를 우선 참조한다.
reviewer는 이 목록을 기준으로 "필수 개념"을 판정한다.

## 1순위: 재단·표준 기관

| 기관 | 역할 | 주요 리소스 |
|------|------|------------|
| CNCF | 클라우드 네이티브 프로젝트 관장 | cncf.io, CNCF Landscape, TOC |
| Linux Foundation | OSS 표준의 최상위 | linuxfoundation.org, OpenSSF |
| Apache Software Foundation | 대규모 OSS (Kafka, Spark 등) | apache.org |
| OpenInfra Foundation | 인프라 OSS (구 OpenStack) | openinfra.dev |
| OCI | 컨테이너 표준 | opencontainers.org |

## 2순위: 공식 문서

| 영역 | 소스 |
|------|------|
| Kubernetes | kubernetes.io/docs, SIG 그룹, KEP |
| 컨테이너 | docs.docker.com, containerd, podman.io |
| HashiCorp | developer.hashicorp.com |
| 관측성 | prometheus.io, grafana.com/docs, opentelemetry.io |
| GitOps | argo-cd.readthedocs.io, fluxcd.io |
| 서비스 메시 | istio.io, linkerd.io, envoyproxy.io |
| 보안 | openpolicyagent.org, falco.org, sigstore.dev |
| 클라우드 | docs.aws.amazon.com, cloud.google.com/docs, learn.microsoft.com/azure |

## 3순위: 컨퍼런스

| 컨퍼런스 | 주최 | 관점 |
|---------|------|------|
| KubeCon + CloudNativeCon | CNCF | 클라우드 네이티브 전반 |
| SREcon | USENIX | SRE 실무와 운영 철학 |
| Open Source Summit | Linux Foundation | OSS 생태계 전반 |
| PromCon | Prometheus 커뮤니티 | 관측 성능·확장 |
| ArgoCon | Argo 커뮤니티 | GitOps 심화 |
| HashiConf | HashiCorp | IaC와 인프라 자동화 |
| FOSDEM | 유럽 OSS 커뮤니티 | 중립적·기술적 |
| DevOpsDays | 지역별 | 현장 실무 사례 |
| AWS re:Invent / Google Cloud Next / MS Ignite | CSP | 클라우드 서비스 |

## 4순위: 정전(Canon) 도서

| 도서 | 저자 | 위상 |
|------|------|------|
| Google SRE Book (3권 시리즈) | Google | sre.google 무료 공개. SRE의 성경 |
| The DevOps Handbook | Gene Kim 외 | DevOps 기본 텍스트 |
| Accelerate | Nicole Forsgren | DORA 메트릭의 근거 |
| The Phoenix Project | Gene Kim | 조직 관점 고전 |
| Kubernetes Patterns | Bilgin Ibryam | K8s 아키텍처 패턴 |
| Production Kubernetes | Josh Rosso 외 | 프로덕션 운영 심화 |
| Database Reliability Engineering | Laine Campbell | 데이터 SRE |

## 5순위: 보안·컴플라이언스 표준

| 표준 | 내용 |
|------|------|
| CIS Benchmarks | Kubernetes, Docker, Linux 하드닝 기준 |
| NSA Kubernetes Hardening Guide | K8s 보안 국가 기관 표준 |
| NIST Cybersecurity Framework | 보안 프레임워크 |
| OWASP Top 10 / ASVS | 애플리케이션 보안 |
| SLSA | 공급망 보안 레벨 |
| OpenSSF Best Practices | OSS 보안 |

## 6순위: 글로벌 탑티어 엔지니어링 블로그

| 회사 | 특징 |
|------|------|
| Google Cloud Blog | 대규모 K8s, Borg 기반 철학 |
| Netflix Tech Blog | 카오스, 마이크로서비스 |
| Cloudflare Blog | 네트워크, eBPF, 보안 |
| Stripe Engineering | API·결제 시스템 SRE |
| Uber Engineering | 대규모 인프라, M3 메트릭 |
| Spotify Engineering | Backstage, 플랫폼 엔지니어링 |
| GitHub Engineering | Git·Actions 내부 |
| Datadog / Grafana Labs | 관측성 |
| HashiCorp Blog | IaC·보안 |

## 7순위: 연구·지표

| 소스 | 내용 |
|------|------|
| DORA State of DevOps Report | 연간 DevOps 성숙도 조사 |
| ThoughtWorks Technology Radar | 분기별 기술 트렌드 |
| CNCF Annual Survey | 클라우드 네이티브 채택 현황 |
| StackOverflow Developer Survey | 개발자 도구 사용 |

## 8순위: 뉴스레터·미디어

| 소스 | 특징 |
|------|------|
| KubeWeekly | CNCF 공식 주간 뉴스 |
| The New Stack | 클라우드 네이티브 심층 기사 |
| DevOps Weekly | DevOps 전반 큐레이션 |
| SRE Weekly | SRE 특화 |
| Kubernetes Podcast by Google | K8s 심층 |

## 학습 로드맵 참고

- roadmap.sh/devops
- awesome-devops, awesome-kubernetes, awesome-sre (GitHub)
