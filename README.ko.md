<p align="center">
  <img src="docs/images/irang-mark.svg" width="88" alt="이랑 로고: 이음매로 맞물린 두 도형">
</p>

<h1 align="center">이랑 · Irang</h1>

<p align="center">
  Markdown 노트를 서로 이어 쓰는 1인용 자체 호스팅 노트장.<br>
  <a href="README.md">English</a> · <a href="docs/SETUP.md">설치 안내</a> · <a href="LICENSE">MIT</a>
</p>

![인박스와 고정 노트, 최근 노트를 보여주는 이랑 홈](docs/images/irang-workbench.png)

이랑은 직접 운영하는 서버에서 소유자 한 명이 쓰는 노트 도구입니다. 링크와 짧은
생각을 인박스에 먼저 담고, Markdown 노트로 옮겨 적으면서 노트 사이의 연결을
쌓아 갑니다. 기본 기능에는 AI 계정이 필요하지 않습니다.

## 주요 기능

- **수집과 인박스**: URL이나 짧은 메모를 먼저 저장하고, 정리가 되면 노트로
  옮깁니다.
- **연결된 Markdown 노트**: `[[위키 링크]]`, 태그, 별칭을 쓰고 노트마다
  백링크와 연결되지 않은 언급을 확인합니다.
- **그래프**: 노트장 전체 또는 한 노트 주변의 연결을 살펴봅니다.
- **검색**: PostgreSQL 전문 검색, 트라이그램, 문자 n-gram을 함께 써서 정확한
  단어는 물론 오타가 섞인 검색어로도 노트를 찾습니다. 뜻이 아니라 글자를
  비교합니다. 임베딩도 로컬에서 만든 해시 기반 문자 n-gram이라, 학습된 의미
  벡터나 외부 임베딩 API는 쓰지 않습니다.
- **첨부파일**: 노트에 붙인 파일을 서버에 함께 보관합니다.
- **채팅(선택)**: 노트 내용을 물으면 답변에 참고한 노트를 출처로 보여 줍니다.
  관련 노트를 찾지 못하면 출처 없이 답할 수도 있습니다.
- **Jev(선택)**: 채팅과 따로 연결하며, 인박스 항목의 분류·태그·중복 후보를
  제안합니다. 제안은 항목에 저장되고, 노트로 옮길 때 붙일 태그는 직접 고릅니다.

이랑은 한 사람이 쓰는 웹 앱이라 팀 협업 기능이 없습니다. 네이티브 앱, 오프라인
편집과 동기화, 종단 간 암호화, 내장 가져오기·내보내기, 자동 백업도 없습니다.

## 빠른 시작

Docker와 **Docker Compose 5.1.0 이상**이 필요합니다. 버전은
`docker compose version`으로 볼 수 있습니다. 그보다 오래된 Compose에는 올바른
설정까지 거부할 수 있는 변수 보간 버그가 있습니다. 호스트에 Bun이나 Node는
설치하지 않아도 됩니다. 아래 명령은 POSIX 셸 기준이며 Linux에서 실행해 봤고,
macOS와 Windows에서는 아직 확인하지 않았습니다.

```sh
git clone https://github.com/madrobotnet/second-brain.git
cd second-brain

# 일회성 Bun 컨테이너: ./.env를 만들고 설치 확인 코드를 출력
docker run --rm -v "$PWD":/repo -w /repo --user "$(id -u):$(id -g)" \
  oven/bun:1.4.2-slim bun --no-env-file scripts/setup-env.mjs

# 소스에서 앱 이미지를 빌드하고 실행(루프백 HTTP)
INSECURE_COOKIES=1 docker compose up -d --build
```

이어서 `http://127.0.0.1:3000/setup`을 열고 설치 확인 코드와 새 소유자
비밀번호(12자 이상)를 입력합니다.

단계별로 하는 일:

1. `setup-env`는 임시 Bun 컨테이너에서 실행됩니다. 앱 DB 비밀번호, DB 관리자
   비밀번호, 설치 확인 코드(`SETUP_TOKEN`) 세 가지 무작위 비밀을 담은 `.env`
   (권한 0600)를 만들고 코드를 한 번 출력합니다. `.env`가 이미 있으면 아무것도
   바꾸지 않고 종료합니다. 호스트에서 `bun install`을 실행해도 이 파일이나
   코드는 생기지 않습니다.
2. `docker compose up -d --build`는 이 저장소의 `Dockerfile`로 앱 이미지를
   빌드합니다. 미리 공개된 이미지는 없습니다. DB 상태 검사가 통과하면 앱이
   시작됩니다.
3. 앱은 `127.0.0.1`에만 바인딩됩니다. `INSECURE_COOKIES=1`은 이 로컬 HTTP
   확인에만 사용하세요.

설치 확인 코드는 최초 설정에만 쓰입니다. AI 제공자 계정을 연결할 때 표시되는
일회용 코드와는 다릅니다.

### 화면 없는 서버에서

앱이 루프백에만 열려 있으므로 내 컴퓨터에서 SSH 터널을 엽니다.

```sh
ssh -L 3000:127.0.0.1:3000 you@your-server
```

그다음 로컬 브라우저에서 `http://127.0.0.1:3000/setup`을 엽니다.

### 공개 서비스로 운영할 때

루프백 포트 앞에 TLS를 처리하는 리버스 프록시를 두고 `INSECURE_COOKIES=0`을
유지하세요. `Host` 헤더는 바꾸지 말고 그대로 전달하고, `TRUSTED_PROXY_HOPS`는
프록시 구성에 맞춥니다. 자세한 내용은
[쿠키, HTTPS, 리버스 프록시 신뢰](docs/SETUP.md#6-cookies-http-vs-https-and-reverse-proxy-trust)를
참고하세요.

## 기존 설치 업그레이드

> [!WARNING]
> **업그레이드 전에는 항상 백업하세요.** `docker compose down -v`는 데이터
> 볼륨을 삭제하므로 절대 실행하지 마세요.
>
> **1.x 설치**는 다른 볼륨 키(`second_brain_pg18`)와 비밀번호 이름을
> 사용했습니다. 업그레이드 전에
> [기존 배포 이전 절차](docs/SETUP.md#10-existing-deployments)에 따라
> `POSTGRES_DATA_VOLUME`을 지정하고, 기존 `DATABASE_URL`과 비밀번호를
> 유지하고, 컨테이너를 다시 만들기 **전에** 첨부파일을 복사해 두세요. 이전
> Compose 파일은 첨부파일을 보존하지 않았습니다.

2.1 이후 같은 Compose 프로젝트라면 백업한 뒤 `git pull`과
`docker compose up -d --build`로 업그레이드합니다. 백업과 복원 절차는
[데이터, 백업, 업그레이드](docs/SETUP.md#9-data-backup-and-upgrades)에 있습니다.

## 데이터와 네트워크

노트, 인박스, 대화, 설정은 직접 운영하는 PostgreSQL에 저장되고, 검색 인덱스도
같은 DB에 있습니다. 첨부파일은 `app-data` 볼륨에 저장됩니다. 서버와 볼륨,
`.env`, 백업은 운영자가 직접 지켜야 합니다.

이랑은 스스로 노트를 외부로 보내지 않습니다. 데이터는 사용자가 직접 설정하거나
실행한 경우에만 서버 밖으로 나갑니다.

- **채팅**: 제공자를 연결하고 데이터 전송에 동의한 뒤, 질문, 최근 대화 12개,
  관련 노트 발췌를 그 제공자에게 보냅니다.
- **Jev**: 연결하고 동의한 뒤, 캡처 제목, 본문 앞 4,000자, 최근 노트 제목과
  ID를 보냅니다.
- **계정 로그인과 자격 증명 갱신**: 해당 제공자의 인증 서비스와 통신합니다.
- **URL 수집**: 서버가 해당 페이지를 가져옵니다.
- **외부 Markdown 리소스**: 이미지 등을 브라우저가 불러올 수 있습니다.
- 리버스 프록시, 패키지 설치와 컨테이너 빌드에도 외부 통신이 발생할 수 있습니다.

두 AI 기능은 기본적으로 꺼져 있습니다. API 키와 계정 인증 정보는 서버에만
보관되고 브라우저로 다시 전달되지 않습니다. 다만 이랑이 네트워크를 전혀 쓰지
않는 오프라인 앱은 아닙니다. AI 전송 동의는 채팅과 Jev에만 적용되고, 그 밖의
네트워크 요청까지 막지는 않습니다.

## AI 제공자(선택)

채팅은 ChatGPT/OpenAI, Claude, Gemini, GitHub Copilot, OpenRouter, xAI,
OpenAI·Anthropic 호환 엔드포인트를 지원합니다. API 키를 쓰거나, 제공자가
허용하는 경우 계정으로 로그인합니다. Jev는 TypeSafe 또는 OpenRouter를
사용합니다. 모델, 로그인 방식, 엔드포인트는
[AI 설정](docs/SETUP.md#8-ai-configuration-optional-per-provider)에 정리되어
있습니다.

**Gemini 계정 로그인 안내.** 이랑은 공식 Gemini CLI의 공개 OAuth 클라이언트로
Google 인증 코드를 직접 교환하고, 추론은 그 CLI로 실행합니다. Google이 이랑을
검토하거나 승인한 것은 아닙니다. Google의
[Gemini CLI 약관 및 개인정보 안내](https://github.com/google-gemini/gemini-cli/blob/main/docs/resources/tos-privacy.md)는
CLI 뒤에 있는 서비스에 제삼자가 직접 접근하는 것을 제한합니다. 이 안내를 읽고
사용 목적에 맞는지 직접 판단하세요. API 키 방식은 언제든 쓸 수 있습니다.

## 개발

Bun 1.4.2와 Docker가 필요합니다.

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run hash-password    # AUTH_PASSWORD_HASH=... 한 줄을 출력
```

출력된 줄을 역슬래시까지 그대로 `.env.local`에 붙여 넣은 뒤, 개발 DB와 앱을
실행합니다.

```sh
bun run db:up
bun run dev    # http://localhost:3000
```

개발 DB는 별도 `second-brain-dev` Compose 프로젝트로, 55432 포트를 씁니다.
다른 명령과 테스트 DB 안전 조건은
[개발 안내](docs/SETUP.md#12-development-commands-and-test-databases)에 있습니다.

## 문서

- [docs/SETUP.md](docs/SETUP.md): 설치, HTTPS, 업그레이드, 백업, 복구
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): 구조와 API 계약
- [docs/REBUILD-AUDIT.md](docs/REBUILD-AUDIT.md): 재현한 결함과 검증 결과

## 라이선스

[MIT](LICENSE)
