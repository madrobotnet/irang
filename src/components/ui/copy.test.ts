import { expect, test } from "bun:test";
import { copyParityIssues, textInEveryLocale } from "@/lib/i18n/copy";
import { LOCALES, type LocalizedText } from "@/lib/i18n/locale";
import { UI_COPY } from "./copy";
import { toastText, type ToastText } from "./Toast";

type RequiresLocalizedText<T extends LocalizedText> = T;
export type ToastLocaleContract = RequiresLocalizedText<ToastText>;

test("common UI copy has key parity", () => {
  expect(copyParityIssues(UI_COPY)).toEqual([]);
});

test("retained toast text resolves again in the selected locale", () => {
  const text = textInEveryLocale((locale) => `${locale}-marker`);
  expect(Object.keys(text)).toEqual([...LOCALES]);
  for (const locale of LOCALES) {
    expect(toastText(text, locale)).toBe(`${locale}-marker`);
  }
});

test("locale-neutral toast content stays verbatim", () => {
  const text = textInEveryLocale(() => "plain-marker");
  for (const locale of LOCALES) {
    expect(toastText(text, locale)).toBe("plain-marker");
  }
});
