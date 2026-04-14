---
title: "CI/CD에서 통합 테스트 자동화"
date: 2026-04-14
tags:
  - cicd
  - integration-test
  - docker
  - testcontainers
sidebar_label: "통합 테스트"
---

# CI/CD에서 통합 테스트 자동화

## 1. 통합 테스트란

실제 DB, 외부 서비스와 함께 여러 컴포넌트가
올바르게 동작하는지 검증한다.

```
단위 테스트: 함수/클래스 단독 → Mock 사용
통합 테스트: 여러 컴포넌트 + 실제 DB → 실제 의존성 사용
```

---

## 2. Service Container (GitHub Actions)

GitHub Actions에서 DB를 사이드카로 실행한다.

```yaml
jobs:
  integration-test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
        - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
        ports:
        - 6379:6379

    steps:
    - uses: actions/checkout@v4

    - run: |
        export DATABASE_URL="postgresql://testuser:testpass@localhost:5432/testdb"
        export REDIS_URL="redis://localhost:6379"
        npm run test:integration
```

---

## 3. Docker Compose로 환경 구성

```yaml
# docker-compose.test.yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://testuser:testpass@postgres/testdb
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: testdb
      POSTGRES_USER: testuser
      POSTGRES_PASSWORD: testpass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U testuser"]
      interval: 5s
      timeout: 5s
      retries: 5
```

```yaml
# GitHub Actions
steps:
- uses: actions/checkout@v4

- name: 환경 시작
  run: docker compose -f docker-compose.test.yaml up -d

- name: 통합 테스트
  run: docker compose -f docker-compose.test.yaml exec app npm run test:integration

- name: 환경 정리
  if: always()
  run: docker compose -f docker-compose.test.yaml down -v
```

---

## 4. Testcontainers

코드 안에서 Docker 컨테이너를 생성·관리한다.
별도 설정 없이 테스트 코드에서 직접 DB를 실행한다.

```java
// Java (Testcontainers)
@Testcontainers
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16")
        .withDatabaseName("testdb")
        .withUsername("testuser")
        .withPassword("testpass");

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Test
    void 사용자_저장_조회_테스트() {
        // 실제 PostgreSQL 사용
    }
}
```

```python
# Python (Testcontainers)
from testcontainers.postgres import PostgresContainer

def test_user_repository():
    with PostgresContainer("postgres:16") as postgres:
        engine = create_engine(postgres.get_connection_url())
        # 실제 PostgreSQL 사용
```

```yaml
# GitHub Actions에서 Testcontainers 사용
jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - run: ./gradlew integrationTest
    # Docker가 자동으로 사용 가능 (ubuntu-latest)
```

---

## 5. API 통합 테스트 (Newman/Postman)

```yaml
# Newman으로 Postman Collection 실행
- name: API 테스트
  run: |
    npm install -g newman
    newman run api-tests.postman_collection.json \
      --environment staging.postman_environment.json \
      --reporters cli,junit \
      --reporter-junit-export newman-results.xml

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: newman-results
    path: newman-results.xml
```

---

## 6. 데이터베이스 마이그레이션 테스트

```yaml
steps:
- name: DB 마이그레이션 테스트
  run: |
    # 마이그레이션 적용
    ./scripts/migrate.sh up

    # 마이그레이션 롤백 테스트
    ./scripts/migrate.sh down

    # 다시 최신 상태로
    ./scripts/migrate.sh up

    # 데이터 정합성 검사
    ./scripts/verify-schema.sh
```

---

## 참고 문서

- [GitHub Actions Service Containers](https://docs.github.com/en/actions/use-cases-and-examples/using-containerized-services/about-service-containers)
- [Testcontainers](https://testcontainers.com/)
- [Newman](https://learning.postman.com/docs/collections/using-newman-cli/command-line-integration-with-newman/)
