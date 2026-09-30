"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("focus", onChange);
  return () => window.removeEventListener("focus", onChange);
}

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** No server-zone timestamp is shown before the browser supplies its zone. */
export function useTimeZone(): string | null {
  return useSyncExternalStore<string | null>(subscribe, browserTimeZone, () => null);
}
