"use client";

import { useSyncExternalStore } from "react";
import { INTL_LOCALE, type Locale } from "@/lib/i18n/locale";
import { localDateKey } from "./home-model";

function subscribe(onChange: () => void): () => void {
  // A tab left open past midnight re-reads the date when the owner comes back to it.
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

const readLocalDate = () => localDateKey(new Date());

/** Viewer's local YYYY-MM-DD; null during SSR and hydration so markup never depends on the server clock. */
export function useLocalDate(): string | null {
  return useSyncExternalStore(subscribe, readLocalDate, () => null);
}

/** "9월 27일 일요일" / "Sunday, September 27" for a YYYY-MM-DD key, formatted as a local calendar date. */
export function formatDateKey(key: string, locale: Locale, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", weekday: "long" }): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], options).format(new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}
