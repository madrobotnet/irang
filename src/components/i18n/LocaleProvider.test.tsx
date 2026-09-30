import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { defineCopy } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { LocaleProvider, useCopy, useLocale } from "./LocaleProvider";

const PROBE_COPY = defineCopy({ ko: { title: "제목" }, en: { title: "Title" } });

function Probe() {
  const { locale } = useLocale();
  const copy = useCopy(PROBE_COPY);
  return <output data-locale={locale}>{copy.title}</output>;
}

describe("LocaleProvider", () => {
  test("server render uses the request's resolved locale for context and copy", () => {
    for (const locale of LOCALES) {
      const markup = renderToStaticMarkup(
        <LocaleProvider initialLocale={locale}>
          <Probe />
        </LocaleProvider>,
      );
      expect(markup).toBe(`<output data-locale="${locale}">${PROBE_COPY[locale].title}</output>`);
    }
  });

  test("children render inside the provider without extra wrapper elements", () => {
    const markup = renderToStaticMarkup(
      <LocaleProvider initialLocale="ko">
        <form id="draft">
          <input name="title" defaultValue="초안" />
        </form>
      </LocaleProvider>,
    );
    expect(markup).toBe('<form id="draft"><input name="title" value="초안"/></form>');
  });

  test("hooks outside the provider fail loudly instead of guessing a locale", () => {
    expect(() => renderToStaticMarkup(<Probe />)).toThrow(Error);
  });
});
