import type { LocalizedText } from "@/lib/i18n/locale";
import { authFlowIssueCopy, setupIssueCopy } from "@/lib/i18n/ai-validation-copy";
import { setupCopy } from "./setup-copy";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- zod built-in checks (src/lib/ai-provider-options.ts unless noted) ----------
export const fieldIssueCopy = {
  model: t("모델 ID는 영문, 숫자, ._:@~/- 기호로 160자 이하로 입력해 주세요.", "Enter a model ID of up to 160 characters, using only letters, numbers and ._:@~/-."), // :5
  apiKey: t("API 키는 공백 없이 4,096자 이하로 입력해 주세요.", "Enter an API key of up to 4,096 characters, with no spaces."), // :6
  name: t("연결 이름을 80자 이하로 입력해 주세요.", "Enter a connection name of up to 80 characters."), // :7 name, chatName, jevName
  baseUrl: t("API 기본 URL을 2,048자 이하로 입력해 주세요.", "Enter an API base URL of up to 2,048 characters."), // :9 min/max
  headerName: t("헤더 이름은 80자 이하이며 HTTP 헤더에 쓸 수 있는 문자만 사용할 수 있습니다.", "Header names can be up to 80 characters, using only characters allowed in HTTP headers."), // :30
  headerValue: t("헤더 값은 줄바꿈 없이 4,096자 이하로 입력해 주세요.", "Header values must be one line of up to 4,096 characters."), // :31
  maxOutputTokens: t("최대 출력 토큰은 1부터 128,000 사이의 정수로 입력해 주세요.", "Max output tokens must be a whole number from 1 to 128,000."), // :50
  provider: t("이 연결 방식에서 지원하지 않는 제공자입니다.", "That provider isn't supported for this connection method."), // ai-providers.ts, ai-connections.ts:38 enums
  apiFormat: t("지원하지 않는 API 형식입니다.", "That API format isn't supported."), // :3
  connectionId: t("올바른 연결 ID가 아닙니다.", "That isn't a valid connection ID."), // ai-settings.ts:14 saved id
} as const;

// Field copy for issueText() in catalog-zod-text.ts, keyed by the issue path's
// last segment; "headers.name"/"headers.value" are issues inside a headers
// record. Pass it only on /api/setup, /api/settings/ai/** and /api/ai/auth/**;
// other routes reuse names like id, name or code with other meanings.
export const AI_FIELD_COPY: Readonly<Record<string, LocalizedText>> = {
  setupToken: setupIssueCopy.setupTokenLength,
  password: setupIssueCopy.passwordLength,
  passwordConfirmation: setupIssueCopy.passwordLength,
  enterpriseDomain: authFlowIssueCopy.enterpriseDomain,
  code: authFlowIssueCopy.authCode,
  authAttemptId: authFlowIssueCopy.attemptId,
  consent: setupCopy.consent,
  id: fieldIssueCopy.connectionId,
  model: fieldIssueCopy.model,
  apiKey: fieldIssueCopy.apiKey,
  name: fieldIssueCopy.name,
  chatName: fieldIssueCopy.name,
  jevName: fieldIssueCopy.name,
  baseUrl: fieldIssueCopy.baseUrl,
  "headers.name": fieldIssueCopy.headerName,
  "headers.value": fieldIssueCopy.headerValue,
  maxOutputTokens: fieldIssueCopy.maxOutputTokens,
  provider: fieldIssueCopy.provider,
  apiFormat: fieldIssueCopy.apiFormat,
};
