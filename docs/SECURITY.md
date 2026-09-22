# 배포 전 보안 체크리스트

운영 호스트는 아직 정해지지 않았다. `BRAIN_HOST`와 `ACME_EMAIL`을 넣기 전에는 운영 Compose가 기동을 거부한다. 코드에 도메인을 하드코딩하지 않는다.

- TLS: 운영은 Traefik과 Let's Encrypt. HTTP는 HTTPS로 보낸다.
- 쿠키: `brain_session`은 HttpOnly, SameSite=Lax, Path=/. `BRAIN_COOKIE_SECURE=true`이면 Secure를 붙인다. 운영 Compose는 이 값을 강제한다.
- 시크릿: `BRAIN_GATE_PASSWORD`, DB 비밀번호, `TYPESAFE_API_KEY`는 환경 변수만 사용한다. 레포와 로그에 넣지 않는다.
- 잠금: 같은 IP에서 15분 안에 5번 실패하면 15분 잠금. 잠긴 동안에는 잠금을 연장하지 않는다.
- 세션: TTL 7일, 동시 5개. 초과하면 가장 오래된 세션을 폐기한다. 토큰 원문은 저장하지 않고 SHA-256만 저장한다.
- 복구: 비밀번호 찾기와 이메일 재설정은 없다. 비밀번호를 잃으면 재설치한다.
- 위조 쿠키: 알 수 없는 `brain_session`은 로그아웃으로 본다. 보호 페이지는 302 `/login`이고 `data-app-shell="brain"`을 렌더하지 않는다. 보호 API는 401이다.
- 설정 누락: `BRAIN_GATE_PASSWORD`가 없으면 로그인은 503 `{ "error": "auth_misconfigured" }`다. 키워드 폴백은 없다.
- 헤더: CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`. HSTS는 HTTPS 또는 `BRAIN_COOKIE_SECURE=true`일 때만.
