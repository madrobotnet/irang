import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- src/lib/ai-connections.ts ----------
export const connectionIssueCopy = {
  baseUrlRequired: t("API 기본 URL을 입력해 주세요.", "Enter the API base URL."), // :17
  customOnly: t("사용자 지정 주소·헤더는 Compatible 연결에서 설정해 주세요.", "Set a custom URL or headers on a Compatible connection."), // :20
  apiKeyRequired: t("API 키를 입력해 주세요.", "Enter an API key."), // :23
  fixedApiFormat: t("이 제공자는 API 형식이 정해져 있어요.", "This provider uses a fixed API format."), // :26
  anthropicFormat: t("Anthropic Messages 형식을 선택해 주세요.", "Choose the Anthropic Messages format."), // :29
  openAiFormat: t("OpenAI 호환 API 형식을 선택해 주세요.", "Choose an OpenAI-compatible API format."), // :32
  copilotOnly: t("API 형식과 기업 도메인은 Copilot 연결에서 설정해 주세요.", "Set the API format and enterprise domain on a Copilot connection."), // :51
  credentialMismatch: t("제공자 인증 정보가 일치하지 않아요.", "The provider credentials don't match."), // :54; also ai-auth/attempt-store.ts:33 api
  jevApiKeyRequired: t("Jev API 키를 입력해 주세요.", "Enter a Jev API key."), // :74,80 refine
} as const;

// ---------- src/lib/ai-provider-options.ts ----------
export const providerOptionIssueCopy = {
  baseUrlInvalid: t("올바른 API 기본 URL을 입력해 주세요.", "Enter a valid API base URL."), // :14
  baseUrlShape: t("인증 정보·쿼리·해시가 없는 HTTP(S) 기본 주소를 입력해 주세요.", "Enter an HTTP(S) base URL without credentials, a query or a hash."), // :18
  headerLimit: t("추가 헤더는 16개까지 입력할 수 있어요.", "You can add up to 16 extra headers."), // :35, 16 stays in code
  headerReserved: t("예약됐거나 이미 쓴 헤더 이름이에요.", "That header name is reserved or already used."), // :40
} as const;

// ---------- src/lib/ai-settings.ts ----------
export const settingsIssueCopy = {
  chatConsent: t("선택한 AI 제공자에게 질문과 관련 노트를 보내는 데 동의해 주세요.", "Agree to send your questions and related notes to the selected AI provider."), // :26
  jevConsent: t("선택한 Jev 제공자에게 캡처 내용과 최근 노트 제목을 보내는 데 동의해 주세요.", "Agree to send captured content and recent note titles to the selected Jev provider."), // :29
} as const;

export const authFlowIssueCopy = {
  copilotDomainOnly: t("기업 도메인은 GitHub Copilot에서만 써요.", "Enterprise domains are for GitHub Copilot only."), // :14 custom
  // new: built-in min/max/regex on enterpriseDomain, :10-11 and ai-connections.ts:41
  enterpriseDomain: t("올바른 기업 도메인을 입력해 주세요.", "Enter a valid enterprise domain."),
  // new: built-in min/max/regex on the Google code, :21 (never a callback URL)
  authCode: t("Google에 표시된 인증 코드를 그대로 붙여 넣어 주세요.", "Paste the authorization code exactly as Google shows it."),
  // new: z.uuid() on authAttemptId, ai-connections.ts:43,85
  attemptId: t("올바른 로그인 요청 ID가 아니에요.", "That isn't a valid sign-in request ID."),
  // setupToken min/max (:5) uses setupIssueCopy.setupTokenLength (catalog-setup.ts).
} as const;

export const setupIssueCopy = {
  passwordMismatch: t("비밀번호가 일치하지 않아요.", "The passwords don't match."), // :20 refine
  // new: built-in min(12)/max(512), :15-16
  passwordLength: t("비밀번호는 12자 이상 512자 이하로 입력해 주세요.", "Use a password of 12 to 512 characters."),
  // new: built-in min(32)/max(256), :14 and ai-auth-flow.ts:5
  setupTokenLength: t("설치 확인 코드는 32자 이상 256자 이하로 입력해 주세요.", "Enter an installation code of 32 to 256 characters."),
} as const;
