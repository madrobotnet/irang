"use client";

import { useEffect } from "react";
import { BRAND_NAMES, brandName, documentTitle } from "@/lib/brand";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { useLocale } from "./LocaleProvider";

/** What the controller reads and writes: `document` in the browser, a plain object in tests. */
export type TitleTarget = { title: string };

export type TitleClaim = { release: () => void };

export type TitleController = {
  /** Show `text` until released; while several claims are live, the newest wins. */
  claim: (text: string) => TitleClaim;
  /** Locale of the root default title (the brand alone). */
  setLocale: (locale: Locale) => void;
  /** Re-apply after anything else (Next metadata on navigation) may have rewritten the title. */
  sync: () => void;
};

/** document.title strips and collapses ASCII whitespace; claims use that form so a re-sync never rewrites. */
const collapseWhitespace = (text: string) => text.replace(/[\t\n\f\r ]+/g, " ").trim();

/** Root metadata's default title is the brand alone; show it in the current locale. */
function localizeDefault(title: string, locale: Locale | null): string {
  return locale && LOCALES.some((each) => BRAND_NAMES[each] === title) ? brandName(locale) : title;
}

/**
 * Arbitrates the tab title between Next metadata (server-rendered, rewritten on navigation) and
 * client screens whose title follows the locale. It tracks the latest title written by anyone else,
 * so releasing the last claim restores what metadata currently wants rather than a stale value.
 */
export function createTitleController(target: TitleTarget): TitleController {
  const claims: { text: string }[] = [];
  let locale: Locale | null = null;
  let underlying = target.title;
  let written = target.title;

  const sync = () => {
    const current = target.title;
    if (current !== written) underlying = current;
    const wanted = claims.at(-1)?.text ?? localizeDefault(underlying, locale);
    if (current !== wanted) target.title = wanted;
    written = target.title;
  };

  return {
    claim(text) {
      const entry = { text: collapseWhitespace(text) };
      claims.push(entry);
      sync();
      return {
        release() {
          const index = claims.indexOf(entry);
          if (index < 0) return;
          claims.splice(index, 1);
          sync();
        },
      };
    },
    setLocale(next) {
      locale = next;
      sync();
    },
    sync,
  };
}

const controllers = new WeakMap<Document, TitleController>();

/** One controller per document; it re-syncs whenever <head> changes (Next swaps <title> on navigation). */
function documentTitles(doc: Document): TitleController {
  const existing = controllers.get(doc);
  if (existing) return existing;
  const controller = createTitleController(doc);
  const observer = new MutationObserver(controller.sync);
  observer.observe(doc.head, { childList: true, subtree: true, characterData: true });
  controllers.set(doc, controller);
  return controller;
}

/**
 * Sets the tab title to "Title · Brand" in the current locale while mounted and hands the title
 * back to Next metadata on unmount. Use it on client screens whose title is translated or
 * data-driven; one per screen (if several are mounted, the most recently set one wins).
 */
export function DocumentTitle({ title }: { title: string }) {
  const { locale } = useLocale();
  const text = documentTitle(title, locale);
  useEffect(() => {
    const claim = documentTitles(document).claim(text);
    return claim.release;
  }, [text]);
  return null;
}

/** Mount once in the root layout: the root default title (the brand alone) follows a language switch. */
export function DefaultDocumentTitle() {
  const { locale } = useLocale();
  useEffect(() => {
    documentTitles(document).setLocale(locale);
  }, [locale]);
  return null;
}
