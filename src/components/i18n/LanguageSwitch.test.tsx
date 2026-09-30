import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { LANGUAGE_COPY, LOCALE_NAMES } from "./copy";
import { LanguageSwitch, localeForKey } from "./LanguageSwitch";
import { LocaleProvider } from "./LocaleProvider";

type Tag = { name: string; attrs: Record<string, string>; text: string };

/** Opening tags with their attributes and the text up to the next tag. */
function tags(markup: string): Tag[] {
  return [...markup.matchAll(/<([a-z]+)((?:\s[^>]*)?)>([^<]*)/g)].map(([, name = "", raw = "", text = ""]) => ({
    name,
    attrs: Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key = "", value = ""]) => [key, value])),
    text,
  }));
}

function render(locale: Locale, hideLabel = false) {
  const markup = renderToStaticMarkup(
    <LocaleProvider initialLocale={locale}>
      <LanguageSwitch hideLabel={hideLabel} />
    </LocaleProvider>,
  );
  return { markup, tags: tags(markup) };
}

/** Text content of the (non-nested) element carrying `id`. */
function textById(markup: string, id: string): string {
  const open = markup.indexOf(`id="${id}"`);
  const start = markup.indexOf(">", open) + 1;
  const tagName = markup.slice(markup.lastIndexOf("<", open) + 1).match(/^[a-z]+/)?.[0] ?? "";
  return markup.slice(start, markup.indexOf(`</${tagName}>`, start)).replace(/<[^>]*>/g, "");
}

describe("LanguageSwitch markup", () => {
  test("is a labelled radio group whose checked option is the current locale", () => {
    for (const locale of LOCALES) {
      for (const hideLabel of [false, true]) {
        const { markup, tags: all } = render(locale, hideLabel);
        const group = all.find((tag) => tag.attrs.role === "radiogroup");
        const labelId = group?.attrs["aria-labelledby"] ?? "";
        expect(labelId).not.toBe("");
        expect(textById(markup, labelId)).toBe(LANGUAGE_COPY[locale].label);

        const radios = all.filter((tag) => tag.name === "button");
        expect(radios.map((radio) => radio.attrs.lang)).toEqual([...LOCALES]);
        for (const radio of radios) {
          const checked = radio.attrs.lang === locale;
          expect(radio.attrs.role).toBe("radio");
          expect(radio.attrs["aria-checked"]).toBe(String(checked));
          expect(radio.attrs.tabindex).toBe(checked ? "0" : "-1");
          expect(radio.text).toBe(LOCALE_NAMES[radio.attrs.lang as Locale]);
        }
      }
    }
  });

  test("never submits or joins a surrounding form", () => {
    const { markup, tags: all } = render("ko");
    const buttons = all.filter((tag) => tag.name === "button");
    expect(buttons).toHaveLength(LOCALES.length);
    for (const button of buttons) expect(button.attrs.type).toBe("button");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<input");
    expect(all.some((tag) => "name" in tag.attrs)).toBe(false);
  });

  test("renders an empty live region for the not-saved notice from the first paint", () => {
    const status = render("en").tags.find((tag) => tag.attrs.role === "status");
    expect(status?.text).toBe("");
    expect(status?.attrs.id).toBeTruthy();
  });
});

describe("localeForKey", () => {
  test("arrows move with wrap-around, Home and End jump, other keys are ignored", () => {
    expect(localeForKey("ko", "ArrowRight")).toBe("en");
    expect(localeForKey("ko", "ArrowDown")).toBe("en");
    expect(localeForKey("en", "ArrowRight")).toBe("ko");
    expect(localeForKey("en", "ArrowLeft")).toBe("ko");
    expect(localeForKey("ko", "ArrowUp")).toBe("en");
    expect(localeForKey("en", "Home")).toBe("ko");
    expect(localeForKey("ko", "End")).toBe("en");
    for (const key of ["Enter", " ", "Tab", "a", "Escape"]) expect(localeForKey("ko", key)).toBeNull();
  });
});

describe("language copy", () => {
  test("has key parity and a distinct endonym per locale", () => {
    expect(copyParityIssues(LANGUAGE_COPY)).toEqual([]);
    const names = LOCALES.map((locale) => LOCALE_NAMES[locale]);
    expect(new Set(names).size).toBe(LOCALES.length);
    for (const name of names) expect(name.trim()).not.toBe("");
  });
});
