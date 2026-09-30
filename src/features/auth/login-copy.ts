import { defineCopy } from "@/lib/i18n/copy";
import type { Locale } from "@/lib/i18n/locale";

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

/** Login screen copy (single owner, password only). The product name comes from `brandName(locale)`. */
export const LOGIN_COPY = defineCopy({
  ko: {
    metaTitle: "로그인",
    heading: "다시 시작하기",
    lead: "비밀번호를 입력하면 노트 작업대로 돌아갑니다.",
    passwordLabel: "비밀번호",
    passwordPlaceholder: "비밀번호",
    submit: "들어가기",
    submitting: "확인 중…",
    success: "확인되었습니다. 이동 중…",
    errors: {
      wrongPassword: "비밀번호가 맞지 않습니다. 다시 확인해 주세요.",
      unavailable: "로그인이 아직 설정되지 않았습니다. 서버의 AUTH_PASSWORD_HASH를 확인해 주세요.",
      network: "서버에 연결할 수 없습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.",
      unknown: "로그인을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
    locked: (remaining: string) => `시도가 너무 많아 잠시 잠겼습니다. ${remaining} 후 다시 시도할 수 있습니다.`,
    lockedReady: "다시 시도할 수 있습니다.",
    duration: (minutes: number, seconds: number) =>
      minutes === 0 ? `${seconds}초` : seconds === 0 ? `${minutes}분` : `${minutes}분 ${seconds}초`,
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    footnote: "한 사람만 쓰는 개인 작업 공간입니다. 비밀번호 하나로 어느 기기에서나 열 수 있습니다.",
  },
  en: {
    metaTitle: "Log in",
    heading: "Welcome back",
    lead: "Enter your password to get back to your notes.",
    passwordLabel: "Password",
    passwordPlaceholder: "Password",
    submit: "Log in",
    submitting: "Checking…",
    success: "You're in. Taking you back…",
    errors: {
      wrongPassword: "That password isn't right. Check it and try again.",
      unavailable: "Login isn't set up yet. Check AUTH_PASSWORD_HASH on the server.",
      network: "Can't reach the server. Check your connection and try again.",
      unknown: "Couldn't log you in. Try again in a moment.",
    },
    locked: (remaining) => `Too many attempts. You can try again in ${remaining}.`,
    lockedReady: "You can try again now.",
    duration: (minutes, seconds) =>
      minutes === 0
        ? plural(seconds, "second", "seconds")
        : seconds === 0
          ? plural(minutes, "minute", "minutes")
          : `${plural(minutes, "minute", "minutes")} ${plural(seconds, "second", "seconds")}`,
    showPassword: "Show password",
    hidePassword: "Hide password",
    footnote: "A private workspace for one person. The same password opens it on any device.",
  },
});

/** Locale-neutral login failure; the message is looked up only when rendered. */
export type LoginErrorKey = keyof (typeof LOGIN_COPY)["ko"]["errors"];

/** Whole minutes and seconds left, rounded up to the next second and never negative. */
export function splitRemaining(totalSeconds: number): { readonly minutes: number; readonly seconds: number } {
  const whole = Math.max(0, Math.ceil(totalSeconds));
  return { minutes: Math.floor(whole / 60), seconds: whole % 60 };
}

/** "1분 5초" / "1 minute 5 seconds" style remaining-time label. */
export function formatRemaining(totalSeconds: number, locale: Locale): string {
  const { minutes, seconds } = splitRemaining(totalSeconds);
  return LOGIN_COPY[locale].duration(minutes, seconds);
}
