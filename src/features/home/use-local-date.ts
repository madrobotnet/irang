"use client";

import { useSyncExternalStore } from "react";
import { formatDayHeading } from "@/lib/i18n/format-date";
import type { Locale } from "@/lib/i18n/locale";
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

const readLocalDate = () => localDateKey();

/** Viewer's local YYYY-MM-DD; null during SSR and hydration so markup never depends on the server clock. */
export function useLocalDate(): string | null {
  return useSyncExternalStore(subscribe, readLocalDate, () => null);
}

/** "9월 27일 일요일" / "Sunday, September 27" for a YYYY-MM-DD key; `weekday: false` drops the weekday. */
export function formatDateKey(key: string, locale: Locale, options: { weekday?: boolean } = {}): string {
  return formatDayHeading(key, locale, options);
}
