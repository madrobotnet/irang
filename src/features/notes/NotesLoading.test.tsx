import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/i18n";
import { LOCALES } from "@/lib/i18n/locale";
import { NOTES_COPY } from "./copy";
import { NotesLoading } from "./NotesLoading";

test("the notes route fallback renders the request locale's shipped copy", () => {
  for (const locale of LOCALES) {
    const markup = renderToStaticMarkup(<LocaleProvider initialLocale={locale}><NotesLoading /></LocaleProvider>);
    expect(markup).toContain(NOTES_COPY[locale].loading);
  }
});
