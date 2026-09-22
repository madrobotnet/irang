# Second Brain

개인용 Second Brain 프로젝트입니다. MVP가 아니라 장기적으로 확장하는 개인 지식 관리 시스템입니다.

## 기술 스택

- Next.js App Router
- Postgres + pgvector
- Docker Compose
- Traefik

## 에픽 순서

E1 Auth부터 E6 Home/PWA까지 다음 순서로 진행합니다.

## 운영 도메인

프로덕션 도메인은 아직 정해지지 않았으며, 나중에 `BRAIN_HOST`로 제공해야 합니다.

## 계획된 트리

```text
README.md
.gitignore
.env.example
Dockerfile
.dockerignore
docker-compose.yml
docker-compose.prod.yml
db/migrations/001_auth.sql
src/app/layout.tsx
src/app/page.tsx
src/app/globals.css
src/app/login/page.tsx
src/middleware.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/sessions/route.ts
src/lib/auth/
src/db/
docs/SECURITY.md
tests/auth/
tests/http/
```
