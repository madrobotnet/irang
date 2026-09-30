import { defineCopy } from "@/lib/i18n/copy";

/** Provider sign-in result window (/connect/complete). `tab` names the tab the user started from. */
export const CONNECT_COPY = defineCopy({
  ko: {
    metaTitle: "AI 연결 확인",
    setupTab: "최초 설정",
    settingsTab: "설정",
    pending: {
      title: "로그인 확인 중",
      body: (tab: string) => `제공자 응답이 늦어지고 있어요. 원래 ${tab} 탭으로 돌아가면 자동으로 다시 확인해요.`,
    },
    success: {
      title: "로그인을 확인했어요",
      body: (tab: string) => `원래 ${tab} 탭으로 돌아가 연결을 저장하세요. 이 창에는 코드나 자격 증명을 보여 주지 않아요.`,
    },
    failure: {
      title: "로그인을 완료하지 못했어요",
      body: (tab: string) => `원래 ${tab} 탭으로 돌아가 로그인 상태를 확인한 뒤 다시 시도하세요.`,
    },
    close: "이 창은 닫아도 돼요.",
  },
  en: {
    metaTitle: "AI connection",
    setupTab: "setup",
    settingsTab: "Settings",
    pending: {
      title: "Checking sign-in",
      body: (tab) => `The provider is slow to respond. Go back to your original ${tab} tab and it'll check again automatically.`,
    },
    success: {
      title: "Sign-in confirmed",
      body: (tab) => `Go back to your original ${tab} tab and save the connection. This window doesn't show any codes or credentials.`,
    },
    failure: {
      title: "Couldn't finish signing in",
      body: (tab) => `Go back to your original ${tab} tab, check the sign-in status, and try again.`,
    },
    close: "You can close this window.",
  },
});

export type ConnectOutcome = "pending" | "success" | "failure";
