import { defineCopy } from "@/lib/i18n/copy";
import type { Locale } from "@/lib/i18n/locale";

/** Language names are endonyms: each option reads the same in every UI language. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = { ko: "한국어", en: "English" };

/** Copy for the language switch and the settings section that hosts it. */
export const LANGUAGE_COPY = defineCopy({
  ko: {
    label: "언어",
    description: "메뉴와 안내 문구의 언어를 바꿔요. 이 브라우저에 저장되고, 노트 내용은 그대로예요.",
    notSaved: "이 브라우저에 저장하지 못했어요. 새로고침하기 전까지 이 탭에서만 적용돼요.",
  },
  en: {
    label: "Language",
    description: "Changes the language of menus and messages. Saved in this browser; your notes stay as written.",
    notSaved: "Couldn't save this in your browser. It applies to this tab until you reload.",
  },
});
