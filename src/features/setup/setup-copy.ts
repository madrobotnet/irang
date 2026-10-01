import { defineCopy } from "@/lib/i18n/copy";

/**
 * First-run setup screen: page intro, installer-code and password fields, their
 * validation and the save failures. Inline code such as `DATABASE_URL` sits between
 * `before` and `after` so each language keeps its own word order.
 */
export const SETUP_COPY = defineCopy({
  ko: {
    metaTitle: "처음 시작하기",
    heading: "내 노트 공간 만들기",
    lead: "로그인 비밀번호만 정하면 준비가 끝나요. AI\u00a0연결은\u00a0선택\u00a0사항이고, 나중에 설정 화면에서도 바꿀\u00a0수\u00a0있어요.",
    points: {
      token: "설치 확인 코드로 최초 설정을 보호해요.",
      offline: "AI 없이도 노트, 캡처, 검색, 그래프를 모두 쓸 수 있어요.",
      server: "데이터와 연결 설정은 이 서버에 저장돼요. 외부에 공개할 때는 HTTPS로 여세요.",
    },
    formHeading: "최초 설정",
    notReady: {
      status: "먼저 서버를 준비해야 해요.",
      database: { before: "Docker나 서버 환경에 PostgreSQL 연결 주소인 ", after: "을 설정하세요." },
      token: {
        before: "설치자가 저장소 README의 Docker 명령으로 설치 확인 코드를 만들어 환경 변수 ",
        after: "에 넣고 앱을 다시 시작해야 해요.",
      },
      note: "이 코드는 로그인 비밀번호와 달라요. 설치자만 보관하고, 공유 링크나 주소에는 넣지 마세요.",
      recheck: "준비 상태 다시 확인",
    },
    form: {
      tokenLegend: "설치 확인",
      tokenLabel: "설치 확인 코드",
      showToken: "확인 코드 보기",
      hideToken: "확인 코드 숨기기",
      tokenHint: "설치자가 서버에서 만든 32자 이상의 코드예요. 공유 링크나 주소창에 넣지 마세요.",
      passwordLegend: "로그인 비밀번호",
      passwordLabel: "새 비밀번호",
      showPassword: "비밀번호 보기",
      hidePassword: "비밀번호 숨기기",
      passwordHint: "12자 이상으로 정하세요. 이 비밀번호로 모든 기기에서 로그인해요.",
      confirmLabel: "비밀번호 확인",
      aiHeading: "AI 연결 (선택)",
      aiLead: "기본은 꺼져 있어요. 지금 정하지 않아도 설정 화면에서 언제든 바꿀 수 있어요.",
      submit: "설정 완료하고 시작하기",
      submitting: "설정 저장 중…",
      success: "설정을 저장했어요. 로그인 화면으로 이동하는 중…",
    },
    secretErrors: {
      setupTokenShort: "설치자에게 받은 32자 이상의 설치 확인 코드를 입력해 주세요.",
      passwordShort: "비밀번호는 12자 이상으로 정해 주세요.",
      passwordLong: "비밀번호는 512자를 넘을 수 없어요.",
      passwordMismatch: "비밀번호가 일치하지 않아요.",
    },
    failure: {
      token: "설치 확인 코드가 맞지 않아요.",
      save: "설정을 저장하지 못했어요. 다시 시도하세요.",
      network: "서버에 연결하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도하세요.",
    },
  },
  en: {
    metaTitle: "Get started",
    heading: "Set up your notes space",
    lead: "Choose a login password and you're ready. AI connections are optional, and you can change them later in Settings.",
    points: {
      token: "An installation code protects first-time setup.",
      offline: "Notes, capture, search and the graph all work without AI.",
      server: "Your data and connection settings are stored on this server. Serve public instances over HTTPS.",
    },
    formHeading: "First-time setup",
    notReady: {
      status: "The server needs to be prepared first.",
      database: { before: "Set ", after: ", the PostgreSQL connection URL, in Docker or your server environment." },
      token: {
        before: "The installer needs to create an installation code with the Docker command in the repository README, set it as the ",
        after: " environment variable, and restart the app.",
      },
      note: "This code isn't your login password. Only the installer should keep it. Never put it in a shared link or URL.",
      recheck: "Check again",
    },
    form: {
      tokenLegend: "Installation check",
      tokenLabel: "Installation code",
      showToken: "Show installation code",
      hideToken: "Hide installation code",
      tokenHint: "A code of 32 or more characters that the installer created on the server. Don't put it in a shared link or the address bar.",
      passwordLegend: "Login password",
      passwordLabel: "New password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      passwordHint: "Use at least 12 characters. You'll log in with this password on every device.",
      confirmLabel: "Confirm password",
      aiHeading: "AI connections (optional)",
      aiLead: "Off by default. You can skip this now and change it anytime in Settings.",
      submit: "Finish setup and start",
      submitting: "Saving setup…",
      success: "Setup saved. Taking you to the login page…",
    },
    secretErrors: {
      setupTokenShort: "Enter the installation code from your installer (32 or more characters).",
      passwordShort: "Use at least 12 characters for your password.",
      passwordLong: "Your password can't be longer than 512 characters.",
      passwordMismatch: "The passwords don't match.",
    },
    failure: {
      token: "The installation code doesn't match.",
      save: "Couldn't save your setup. Try again.",
      network: "Couldn't reach the server. Check your network connection and try again.",
    },
  },
});

export type SetupSecretErrorKey = keyof (typeof SETUP_COPY)["ko"]["secretErrors"];
