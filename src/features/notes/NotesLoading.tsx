"use client";

import { useCopy } from "@/components/i18n";
import { NOTES_COPY } from "./copy";

/** Suspense fallback for the notes routes; a client component so it follows a language switch. */
export function NotesLoading() {
  const copy = useCopy(NOTES_COPY);
  return <div className="p-6 text-sm text-mute">{copy.loading}</div>;
}
