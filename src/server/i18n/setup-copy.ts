import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- ApiError (src/server/setup), all api role ----------
export const setupCopy = {
  alreadyComplete: t("최초 설정을 이미 마쳤어요. 로그인하세요.", "Setup is already complete. Log in to continue."), // access.ts:24
  tokenMissing: t("서버에 32자 이상의 SETUP_TOKEN을 먼저 설정해 주세요.", "Set a SETUP_TOKEN of at least 32 characters on the server first."), // access.ts:27
  wrongCode: t("설치 확인 코드가 맞지 않아요.", "That installation code isn't correct."), // access.ts:32
  alreadySetUp: t("이미 설정을 마친 서버예요.", "This server is already set up."), // access.ts:34
  hasData: t("데이터가 이미 있는 서버에서는 최초 설정을 할 수 없어요.", "A server that already has data can't run first-time setup."), // service.ts:45
  saveFailed: t("설정을 저장하지 못했어요.", "Couldn't save the setup."), // service.ts:51
  setupFirst: t("최초 설정을 먼저 완료해 주세요.", "Complete first-time setup before continuing."), // ai-profile-store.ts:85; ai-profiles.ts:57,71; settings.ts:18,62
  selectedMissing: t("선택한 AI 연결을 찾지 못했어요. 설정에서 다시 선택하세요.", "Couldn't find the selected AI connection. Choose one again in Settings."), // ai-profile-store.ts:88
  purposeLocked: t("연결 용도는 바꿀 수 없어요. 새 연결을 추가하세요.", "A connection's purpose can't be changed. Add a new connection instead."), // ai-profiles.ts:18
  limit: t("연결은 40개까지 저장할 수 있어요.", "You can save up to 40 connections."), // ai-profiles.ts:25, 40 stays in code
  notFound: t("저장된 연결을 찾지 못했어요.", "Couldn't find the saved connection."), // ai-profiles.ts:60,73
  purposeMismatch: t("선택한 용도에 맞는 저장된 연결을 골라 주세요.", "Choose a saved connection made for this purpose."), // ai-settings-resolve.ts:15
  consent: t("선택한 제공자에게 데이터를 보내는 데 동의해 주세요.", "Agree to send data to the selected provider."), // ai-settings-resolve.ts:30; also zod consent literal(true)
  keyOrKeyless: t("API 키를 입력하거나 키 없이 연결하도록 직접 선택해 주세요.", "Enter an API key, or explicitly choose a connection without one."), // ai-profile-resolve.ts:29
  apiKey: t("선택한 제공자의 API 키를 입력해 주세요.", "Enter the API key for the selected provider."), // ai-profile-resolve.ts:30
  signInFirst: t("제공자 로그인을 완료한 뒤 연결을 저장해 주세요.", "Finish the provider sign-in, then save the connection."), // ai-profile-resolve.ts:55
  domainChanged: t("GitHub에 로그인할 때 쓴 기업 도메인과 설정한 도메인이 달라요. 다시 연결하세요.", "This enterprise domain doesn't match the one you signed in to GitHub with. Reconnect to continue."), // ai-profile-resolve.ts:57
  openRouterFirst: t("OpenRouter 로그인을 완료한 뒤 Jev 연결을 저장해 주세요.", "Finish the OpenRouter sign-in, then save the Jev connection."), // ai-profile-resolve.ts:84
  jevApiKey: t("선택한 Jev 제공자의 API 키를 입력해 주세요.", "Enter the API key for the selected Jev provider."), // ai-profile-resolve.ts:93
} as const;
