import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { brandName } from "@/lib/brand";
import { createTitleController, DefaultDocumentTitle, DocumentTitle } from "./DocumentTitle";
import { LocaleProvider } from "./LocaleProvider";

/** document.title semantics without a DOM: writes are whitespace-collapsed and counted. */
class FakeDocument {
  writes = 0;
  #title: string;
  constructor(title: string) {
    this.#title = title;
  }
  get title() {
    return this.#title;
  }
  set title(next: string) {
    this.writes += 1;
    this.#title = next.replace(/[\t\n\f\r ]+/g, " ").trim();
  }
}

const ko = brandName("ko");
const en = brandName("en");

describe("document title controller", () => {
  test("a claim shows its title and releasing it restores the metadata title", () => {
    const doc = new FakeDocument(`Meta · ${ko}`);
    const titles = createTitleController(doc);
    const claim = titles.claim(`Screen · ${ko}`);
    expect(doc.title).toBe(`Screen · ${ko}`);
    claim.release();
    expect(doc.title).toBe(`Meta · ${ko}`);
  });

  test("a claim survives a metadata rewrite and releases to the newest metadata title", () => {
    const doc = new FakeDocument(`Meta · ${ko}`);
    const titles = createTitleController(doc);
    const claim = titles.claim("Screen");
    doc.title = `Next page · ${ko}`; // Next metadata on navigation
    titles.sync(); // what the <head> observer does
    expect(doc.title).toBe("Screen");
    claim.release();
    expect(doc.title).toBe(`Next page · ${ko}`);
  });

  test("the root default follows the locale; other metadata titles are left alone", () => {
    const doc = new FakeDocument(ko);
    const titles = createTitleController(doc);
    titles.setLocale("en");
    expect(doc.title).toBe(en);
    titles.setLocale("ko");
    expect(doc.title).toBe(ko);

    const page = new FakeDocument(`Meta · ${ko}`);
    createTitleController(page).setLocale("en");
    expect(page.title).toBe(`Meta · ${ko}`);
  });

  test("a root default hidden by a claim comes back in the locale current at release", () => {
    const doc = new FakeDocument(ko);
    const titles = createTitleController(doc);
    titles.setLocale("ko");
    const claim = titles.claim("Screen");
    titles.setLocale("en");
    expect(doc.title).toBe("Screen");
    claim.release();
    expect(doc.title).toBe(en);
  });

  test("the newest claim wins and releasing twice is harmless", () => {
    const doc = new FakeDocument("Meta");
    const titles = createTitleController(doc);
    const first = titles.claim("First");
    const second = titles.claim("Second");
    expect(doc.title).toBe("Second");
    second.release();
    expect(doc.title).toBe("First");
    second.release();
    expect(doc.title).toBe("First");
    first.release();
    expect(doc.title).toBe("Meta");
  });

  test("re-syncing after its own write never rewrites, even for titles the browser normalizes", () => {
    const doc = new FakeDocument("Meta");
    const titles = createTitleController(doc);
    titles.claim("  Spaced   title ");
    const writes = doc.writes;
    titles.sync();
    titles.sync();
    expect(doc.title).toBe("Spaced title");
    expect(doc.writes).toBe(writes);
  });
});

test("title components render nothing on the server", () => {
  const markup = renderToStaticMarkup(
    <LocaleProvider initialLocale="en">
      <DefaultDocumentTitle />
      <DocumentTitle title="Probe" />
    </LocaleProvider>,
  );
  expect(markup).toBe("");
});
