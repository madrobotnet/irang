import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { brandName } from "@/lib/brand";
import { LOCALES } from "@/lib/i18n/locale";
import { BOUNDARY_COPY } from "./copy";
import { StatusScreen } from "./StatusScreen";

/** The escaping renderToStaticMarkup applies to text, so shipped copy can be compared exactly. */
const html = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("StatusScreen", () => {
  test("error screen renders the locale's copy, a retry button, a home link and the digest", () => {
    for (const locale of LOCALES) {
      const copy = BOUNDARY_COPY[locale];
      const markup = renderToStaticMarkup(
        <LocaleProvider initialLocale={locale}>
          <StatusScreen kind="error" onRetry={() => undefined} digest="digest-marker" />
        </LocaleProvider>,
      );
      expect(markup).toContain(html(copy.error.title));
      expect(markup).toContain(html(copy.error.retry));
      expect(markup).toContain(html(copy.error.reference("digest-marker")));
      expect(markup).toContain(html(brandName(locale)));
      expect(markup).toContain('href="/"');
    }
  });

  test("not-found screen has no retry button", () => {
    for (const locale of LOCALES) {
      const copy = BOUNDARY_COPY[locale];
      const markup = renderToStaticMarkup(
        <LocaleProvider initialLocale={locale}>
          <StatusScreen kind="notFound" />
        </LocaleProvider>,
      );
      expect(markup).toContain(html(copy.notFound.title));
      expect(markup).not.toContain("<button");
      expect(markup).toContain('href="/"');
    }
  });
});
