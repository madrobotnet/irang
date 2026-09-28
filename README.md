# Second Brain

개인용 지식 작업 공간입니다. 수집한 내용을 인박스에서 정리하고, Markdown
노트와 `[[위키 링크]]`로 연결합니다. PostgreSQL에 데이터를 보관하며 Bun으로
설치·개발·테스트·빌드·실행합니다.

## 로컬 실행

Bun 1.4.2와 Docker Compose가 필요합니다.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run db:up
bun run hash-password
```

마지막 명령이 출력하는 `AUTH_PASSWORD_HASH=...` 한 줄로 `.env.local`의 빈
항목을 교체하세요. 출력된 역슬래시를 제거하지 마세요. Next의 환경 변수
확장에서 Argon2 해시의 `$`를 보존하기 위한 값입니다.

```sh
bun run dev
```

`http://localhost:3000`에서 설정한 비밀번호로 로그인합니다. 개발 DB는
`127.0.0.1:55432`에서 실행됩니다. 테스트용 `second_brain_test`는 초기화 시
별도로 만들어지므로 테스트가 개발 노트를 지우지 않습니다.

선택적으로 `bun run seed`를 실행하면 연결된 한국어 예제 노트와 캡처를
추가합니다. 기존 기록을 지우지 않으며, 기본적으로 로컬 DB에서만 실행됩니다.

```sh
bun run typecheck
bun run lint
bun test
bun run build
```

`bun run db:down`은 **로컬 개발 DB와 볼륨을 삭제**합니다. 보존할 노트가
있다면 먼저 백업하세요. 테스트 DB 주소는 `TEST_DATABASE_URL`로 변경할 수
있으며 운영 DB를 지정하면 안 됩니다.

## 선택적 AI 설정

- `TYPESAFE_API_KEY`: 인박스 분류와 태그 제안에 사용합니다. 없어도 수집,
  노트 편집과 일반 검색이 동작합니다.
- `CODEX_HOME`: ChatGPT로 로그인한 Codex의 `auth.json`이 있는 디렉터리입니다.
  없으면 기본적으로 `~/.codex`를 확인합니다.
- `CODEX_MODEL`: 채팅 모델입니다. 기본값은 `gpt-5.4-mini`입니다.

검색은 PostgreSQL 전문 검색·트라이그램·문자 n-gram 벡터를 조합합니다.
문자 유사도 벡터를 학습된 의미 임베딩으로 표현하지 않습니다. 채팅은 검색한
노트의 출처를 제공하며, AI가 제안한 태그를 자동으로 적용하지 않습니다.
홈과 오늘 노트는 브라우저의 지역 날짜를 사용합니다. 수집한 원문 URL은
노트로 승격한 뒤에도 열 수 있습니다.

## 컨테이너

`Dockerfile`의 빌드와 standalone 서버 모두 Bun을 사용합니다. 개발 번들러의
외부 모듈 해석 오류를 피하기 위해 Next의 공식 Webpack 실행 옵션을 사용합니다.

```sh
docker build -t second-brain:local .
```

실행 시에는 컨테이너 안에서 연결 가능한 PostgreSQL 주소와 로그인 해시를
환경 변수로 주입하세요. DB에는 `pgcrypto`, `pgvector`, `pg_trgm` 확장을
생성할 권한이 필요합니다. 첨부파일 디렉터리 `/app/.data/attachments`는
영속 볼륨으로 마운트해야 합니다.

Docker의 `--env-file`에 넣을 **원본 PHC 해시**는 다음 명령으로 생성합니다.
로컬 Next용 `bun run hash-password`의 이스케이프 출력과 구분하세요.

```sh
bun scripts/hash-password.mjs
```

운영에서는 HTTPS 뒤에서 실행하세요. 보안 쿠키가 기본값입니다.
`INSECURE_COOKIES=1`은 로컬 HTTP 검증에만 사용합니다. `.env*`, 인증 파일,
DB 덤프는 저장소나 이미지에 넣지 마세요.

## 기존 데이터와 업그레이드

기존 `notes`, `inbox_items`, `links`, `chat_*`, `users`, `sessions` 테이블을
유지합니다. 앱은 최초 DB 연결 시 버전별 마이그레이션을 트랜잭션으로 적용하고
`schema_migrations`에 기록합니다. 운영 적용 전에는 DB와 첨부파일을 함께
백업하고 복사본에서 마이그레이션을 확인하세요. 코드 변경만으로 운영 배포나
운영 데이터 변경을 자동 실행하지 않습니다.

구조와 API 계약은 [ARCHITECTURE.md](docs/ARCHITECTURE.md), 참고 제품에서
채택한 패턴과 근거는 [ADOPTION.md](docs/research/ADOPTION.md)에 있습니다.
재현한 결함과 실제 검증 결과는 [REBUILD-AUDIT.md](docs/REBUILD-AUDIT.md)에
기록되어 있습니다.
