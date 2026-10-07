import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "@/components/i18n";
import { RelatedEvidenceLink } from "@/features/notes/NoteConnections";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import type { RelatedNote } from "@/lib/types";
import { SEARCH_COPY } from "./search-copy";

const note: RelatedNote = { id: "source", title: "Stored title", excerpt: "The supplied supporting excerpt.", score: 0.8 };
const passage = { heading: "Actual heading", startLine: 6, endLine: 9 };
const updatedAt = "2026-10-07T06:00:00.000Z";

function renderRelated(item: RelatedNote, locale: Locale): string {
  return renderToStaticMarkup(<LocaleProvider initialLocale={locale}><RelatedEvidenceLink note={item} /></LocaleProvider>);
}

function linkUrl(markup: string): URL {
  const href = markup.match(/\bhref="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&") ?? "";
  return new URL(href, "https://irang.invalid");
}

describe("related note evidence", () => {
  test("opens the supplied supporting passage with its source version", () => {
    const markup = renderRelated({ ...note, matchedBy: ["learned"], passage, updatedAt }, "en");
    const url = linkUrl(markup);
    expect(url.pathname).toBe("/notes/source");
    expect(url.searchParams.get("line")).toBe("6");
    expect(url.searchParams.get("at")).toBe(updatedAt);
    expect(markup).toContain(note.excerpt);
    expect(markup).toContain(passage.heading);
  });

  test("does not create a passage link without the source timestamp", () => {
    const markup = renderRelated({ ...note, passage }, "en");
    expect(linkUrl(markup).pathname).toBe("/notes/source");
    expect(linkUrl(markup).search).toBe("");
  });

  test("legacy and absent match signals never claim learned evidence in either locale", () => {
    for (const locale of LOCALES) {
      const legacy = renderRelated({ ...note, matchedBy: ["semantic"] }, locale);
      expect(legacy).toContain(SEARCH_COPY[locale].signals.characterSimilarity);
      expect(legacy).not.toContain(SEARCH_COPY[locale].signals.learnedMeaning);
      expect(renderRelated(note, locale)).not.toContain(SEARCH_COPY[locale].signals.learnedMeaning);
    }
  });

  test("uses the shipped learned label only when the returned signal includes learned", () => {
    for (const locale of LOCALES) {
      const markup = renderRelated({ ...note, matchedBy: ["learned"] }, locale);
      expect(markup).toContain(SEARCH_COPY[locale].signals.learnedMeaning);
      expect(markup).not.toContain(SEARCH_COPY[locale].signals.characterSimilarity);
    }
  });
});
