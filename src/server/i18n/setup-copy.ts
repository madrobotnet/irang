import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- ApiError (src/server/setup), all api role ----------
export const setupCopy = {
  alreadyComplete: t("최초 설정이 이미 완료되었습니다. 로그인해 주세요.", "Setup is already complete. Please log in."), // access.ts:24
  tokenMissing: t("서버에 32자 이상의 SETUP_TOKEN을 먼저 설정해 주세요.", "Set a SETUP_TOKEN of at least 32 characters on the server first."), // access.ts:27
  wrongCode: t("설치 확인 코드가 맞지 않습니다.", "That setup code isn't correct."), // access.ts:32
  alreadySetUp: t("이미 설정된 서버입니다.", "This server is already set up."), // access.ts:34
  hasData: t("기존 데이터가 있는 서버는 최초 설정으로 변경할 수 없습니다.", "A server that already has data can't run first-time setup."), // service.ts:45
  saveFailed: t("설정을 저장하지 못했습니다.", "Couldn't save the setup."), // service.ts:51
  setupFirst: t("최초 설정을 먼저 완료해 주세요.", "Complete first-time setup before continuing."), // ai-profile-store.ts:85; ai-profiles.ts:57,71; settings.ts:18,62
  selectedMissing: t("선택한 AI 연결을 찾을 수 없습니다. 설정에서 다시 선택해 주세요.", "Couldn't find the selected AI connection. Choose one again in Settings."), // ai-profile-store.ts:88
  purposeLocked: t("연결 용도는 바꿀 수 없습니다. 새 연결을 추가해 주세요.", "A connection's purpose can't be changed. Add a new connection instead."), // ai-profiles.ts:18
  limit: t("연결은 40개까지 저장할 수 있어요.", "You can save up to 40 connections."), // ai-profiles.ts:25, 40 stays in code
  notFound: t("저장된 연결을 찾을 수 없습니다.", "Saved connection not found."), // ai-profiles.ts:60,73
  purposeMismatch: t("선택한 용도에 맞는 저장된 연결을 골라 주세요.", "Choose a saved connection made for this purpose."), // ai-settings-resolve.ts:15
  consent: t("선택한 제공자에게 데이터를 보내는 데 동의해 주세요.", "Agree to send data to the selected provider."), // ai-settings-resolve.ts:30; also zod consent literal(true)
  keyOrKeyless: t("API 키를 입력하거나 키 없는 연결을 명시적으로 선택해 주세요.", "Enter an API key, or explicitly choose a connection without one."), // ai-profile-resolve.ts:29
  apiKey: t("선택한 제공자의 API 키를 입력해 주세요.", "Enter the API key for the selected provider."), // ai-profile-resolve.ts:30
  signInFirst: t("제공자 로그인을 완료한 뒤 연결을 저장해 주세요.", "Finish the provider sign-in, then save the connection."), // ai-profile-resolve.ts:55
  domainChanged: t("로그인한 GitHub 기업 도메인과 설정이 다릅니다. 다시 연결해 주세요.", "This enterprise domain doesn't match the one you signed in to GitHub with. Reconnect to continue."), // ai-profile-resolve.ts:57
  openRouterFirst: t("OpenRouter 로그인을 완료한 뒤 Jev 연결을 저장해 주세요.", "Finish the OpenRouter sign-in, then save the Jev connection."), // ai-profile-resolve.ts:84
  jevApiKey: t("선택한 Jev 제공자의 API 키를 입력해 주세요.", "Enter the API key for the selected Jev provider."), // ai-profile-resolve.ts:93
} as const;
