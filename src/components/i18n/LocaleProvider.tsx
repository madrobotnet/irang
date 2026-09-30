"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CopyCatalog, CopyShape, CopyTree } from "@/lib/i18n/copy";
import { LOCALE_CHANGE_EVENT, readDocumentLocale, writeDocumentLocale, type Locale } from "@/lib/i18n/locale";

export type { Locale } from "@/lib/i18n/locale";

export type LocaleContextValue = {
  locale: Locale;
  /**
   * Apply an explicit choice everywhere in this tab and persist it for future requests.
   * Returns false when the browser refused the cookie; the choice still applies until reload.
   */
  setLocale: (next: Locale) => boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribeLocale(onChange: () => void): () => void {
  // Cookies have no storage event: another tab's choice is picked up when this one regains focus.
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

/**
 * Mount once in the root layout with the locale the server resolved for this request.
 * Server render and hydration both use `initialLocale` (the server snapshot), so markup
 * matches; afterwards the persisted cookie is authoritative. Switching only changes the
 * context value: the subtree is never keyed, remounted or refreshed, so form state,
 * drafts and pending sign-ins survive.
 */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  // This tab's choice when the browser refused the cookie; cleared once a write succeeds.
  const [unpersisted, setUnpersisted] = useState<Locale | null>(null);
  const readClient = useCallback(() => unpersisted ?? readDocumentLocale() ?? initialLocale, [unpersisted, initialLocale]);
  const locale = useSyncExternalStore(subscribeLocale, readClient, () => initialLocale);

  useEffect(() => {
    // The root layout renders <html lang> from the request; keep it true after a client switch.
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const persisted = writeDocumentLocale(next);
    setUnpersisted(persisted ? null : next);
    return persisted;
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

/** The current locale's entries of a feature catalog: `const copy = useCopy(LOGIN_COPY)`. */
export function useCopy<T extends CopyTree>(catalog: CopyCatalog<T>): T | CopyShape<T> {
  return catalog[useLocale().locale];
}
