"use client";

import { useCopy } from "@/components/i18n";
import { Skeleton, SkeletonLines } from "@/components/ui";
import { NOTES_COPY } from "./copy";

/** Suspense fallback for the notes routes, shaped like NotesWorkspace; a client component so it follows a language switch. */
export function NotesLoading() {
  const copy = useCopy(NOTES_COPY);
  return (
    <div aria-busy="true" className="mx-auto flex h-[var(--workspace-h)] w-full max-w-[100rem] overflow-hidden lg:h-dvh">
      <span role="status" className="sr-only">{copy.loading}</span>
      <div className="w-full shrink-0 border-r border-line bg-desk p-4 lg:w-80 xl:w-96">
        <SkeletonLines lines={6} />
      </div>
      <div className="hidden min-w-0 flex-1 p-6 lg:block">
        <Skeleton className="h-9 w-1/2" />
        <SkeletonLines lines={8} className="mt-6" />
      </div>
    </div>
  );
}
