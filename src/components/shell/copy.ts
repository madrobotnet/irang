import { defineCopy } from "@/lib/i18n/copy";
import { LOCALES, type Locale, type LocalizedText } from "@/lib/i18n/locale";

/**
 * Shell copy: rail, mobile bars, command palette and session prompts. Nav labels are keyed by
 * NavId (nav.ts owns routes, icons and chord keys). The product name comes from @/lib/brand.
 */
export const SHELL_COPY = defineCopy({
  ko: {
    nav: { home: "홈", inbox: "인박스", notes: "노트", daily: "오늘", search: "검색", graph: "그래프", chat: "채팅", settings: "설정" },
    actions: { capture: "빠르게 캡처", palette: "명령 팔레트", openPalette: "명령 팔레트 열기", logout: "로그아웃" },
    rail: { navLabel: "주 메뉴", collapse: "메뉴 접기", expand: "메뉴 펼치기", pending: (count: number) => `${count}개 대기 중` },
    mobile: { navLabel: "하단 메뉴", more: "더보기" },
    theme: {
      rail: { light: "밝은 테마", dark: "어두운 테마", system: "시스템 테마" },
      short: { light: "밝게", dark: "어둡게", system: "시스템" },
      palette: { light: "밝게", dark: "어둡게", system: "시스템 설정 따르기" },
      value: (name: string) => `테마: ${name}`,
    },
    palette: {
      switcherLabel: "노트 전환",
      placeholder: "명령이나 노트 제목 입력…",
      switcherPlaceholder: "노트 제목으로 이동…",
      notesOnly: "노트만",
      all: "전체",
      searching: "노트를 검색하는 중…",
      loadFailed: "노트 목록을 불러오지 못했어요.",
      empty: "일치하는 항목이 없어요.",
      failed: "요청을 처리하지 못했어요. 다시 시도하세요.",
      groups: { actions: "동작", go: "이동", theme: "테마", notes: "노트" },
      newNote: "새 노트",
      openDaily: "오늘 노트 열기",
      createPrefix: "새 노트:",
      current: "현재",
      hints: { move: "이동", open: "열기" },
      keywords: { capture: "캡처 빠른 입력", newNote: "새 노트 만들기", daily: "오늘 데일리 일지", theme: "테마" },
    },
    session: {
      confirmUnsaved: "저장하지 않은 노트 변경 내용이 있어요. 로그아웃할까요?",
      logoutFailed: "로그아웃하지 못했어요. 잠시 후 다시 시도하세요.",
    },
  },
  en: {
    nav: { home: "Home", inbox: "Inbox", notes: "Notes", daily: "Today", search: "Search", graph: "Graph", chat: "Chat", settings: "Settings" },
    actions: { capture: "Quick capture", palette: "Command palette", openPalette: "Open command palette", logout: "Log out" },
    rail: {
      navLabel: "Main menu",
      collapse: "Collapse menu",
      expand: "Expand menu",
      pending: (count: number) => (count === 1 ? "1 item waiting" : `${count} items waiting`),
    },
    mobile: { navLabel: "Bottom menu", more: "More" },
    theme: {
      rail: { light: "Light theme", dark: "Dark theme", system: "System theme" },
      short: { light: "Light", dark: "Dark", system: "System" },
      palette: { light: "Light", dark: "Dark", system: "Match system" },
      value: (name: string) => `Theme: ${name}`,
    },
    palette: {
      switcherLabel: "Switch note",
      placeholder: "Type a command or note title…",
      switcherPlaceholder: "Go to a note by title…",
      notesOnly: "Notes only",
      all: "All",
      searching: "Searching notes…",
      loadFailed: "Couldn't load notes.",
      empty: "No matches.",
      failed: "Couldn't complete that. Try again.",
      groups: { actions: "Actions", go: "Go to", theme: "Theme", notes: "Notes" },
      newNote: "New note",
      openDaily: "Open today's note",
      createPrefix: "New note:",
      current: "Current",
      hints: { move: "Move", open: "Open" },
      keywords: { capture: "quick capture", newNote: "new note create", daily: "today daily journal", theme: "theme appearance" },
    },
    session: {
      confirmUnsaved: "You have unsaved note changes. Log out anyway?",
      logoutFailed: "Couldn't log out. Try again in a moment.",
    },
  },
});

/** Root not-found / error / global-error screens. */
export const BOUNDARY_COPY = defineCopy({
  ko: {
    notFound: {
      documentTitle: "페이지 없음",
      title: "페이지를 찾을 수 없어요",
      body: "주소가 바뀌었거나 없는 페이지예요. 홈에서 다시 찾아보세요.",
    },
    error: {
      documentTitle: "오류",
      title: "화면을 표시하지 못했어요",
      body: "일시적인 문제일 수 있어요. 다시 시도하거나 홈으로 이동하세요.",
      retry: "다시 시도",
      reference: (digest: string) => `오류 코드: ${digest}`,
    },
    home: "홈으로",
  },
  en: {
    notFound: {
      documentTitle: "Page not found",
      title: "Page not found",
      body: "The address may have changed, or the page doesn't exist. Try finding it from home.",
    },
    error: {
      documentTitle: "Error",
      title: "Couldn't show this screen",
      body: "This may be a temporary problem. Try again, or go home.",
      retry: "Try again",
      reference: (digest: string) => `Error code: ${digest}`,
    },
    home: "Go home",
  },
});

export type ShellCopy = (typeof SHELL_COPY)[Locale];

/** One shell entry in every locale, e.g. for a toast that stays open across a language switch. */
export function everyLocale(pick: (copy: ShellCopy) => string): LocalizedText {
  return { ko: pick(SHELL_COPY.ko), en: pick(SHELL_COPY.en) };
}

/** Search keywords from every locale, so the palette matches either language whichever one is showing. */
export function keywordsInEveryLocale(...picks: ((copy: ShellCopy) => string)[]): string[] {
  return LOCALES.flatMap((locale) => picks.map((pick) => pick(SHELL_COPY[locale])));
}
