import type { LocalizedText } from "@/lib/i18n/locale";

const t = (ko: string, en: string): LocalizedText => ({ ko, en });

// ---------- ApiError (src/server/ai-auth), all api role ----------
export const aiAuthCopy = {
  loginOrSetupCode: t("로그인하거나 설치 확인 코드를 입력해 주세요.", "Log in, or enter the installation code."), // access.ts:29
  attemptGone: t("로그인 요청이 만료됐거나 취소됐어요.", "This sign-in request expired or was canceled."), // attempt-data.ts:45
  wrongBrowser: t("로그인을 시작한 브라우저에서 다시 시도하세요.", "Try again in the browser where you started signing in."), // attempt-data.ts:53; callback.ts:14
  browserUnknown: t("이 로그인을 시작한 브라우저를 확인하지 못했어요.", "Couldn't verify the browser for this sign-in."), // start.ts:17
  tooManyPending: t("아직 끝나지 않은 로그인을 취소한 뒤 다시 시도하세요.", "Cancel a sign-in that's in progress, then try again."), // start.ts:29, limit 8 stays in code
  startCanceled: t("로그인 요청이 취소됐어요.", "The sign-in request was canceled."), // start.ts:79
  startFailed: t("제공자 로그인을 시작하지 못했어요. 잠시 후 다시 시도하세요.", "Couldn't start the provider sign-in. Try again in a moment."), // start.ts:84
  alreadyHandled: t("이미 처리한 로그인 요청이에요.", "This sign-in request was already handled."), // callback.ts:16,18
  callbackNoCode: t("로그인 확인 코드가 없어요.", "The sign-in confirmation code is missing."), // callback.ts:24
  codeUnsupported: t("이 로그인은 인증 코드 입력을 지원하지 않아요.", "This sign-in doesn't take an authorization code."), // code.ts:16
  codePending: t("이미 코드를 제출했어요. 확인 결과를 기다려 주세요.", "You already submitted a code. Wait for its result."), // code.ts:25
  refreshFailed: t("AI 계정 인증을 갱신하지 못했어요. 설정에서 다시 연결하세요.", "Couldn't renew the AI account sign-in. Reconnect it in Settings."), // refresh.ts:41
  saveInStartBrowser: t("로그인을 시작한 브라우저에서 저장해 주세요.", "Save from the browser where you started signing in."), // attempt-store.ts:15
  wrongConnection: t("이 연결에는 쓸 수 없는 로그인 요청이에요.", "This sign-in request can't be used for this connection."), // attempt-store.ts:27
  notReady: t("로그인을 완료하거나 다시 연결한 뒤 저장해 주세요.", "Finish signing in or reconnect, then save."), // attempt-store.ts:30
  // attempt-store.ts:33 uses connectionIssueCopy.credentialMismatch
  // (catalog-ai-schema.ts), which has the same Korean text.
} as const;
