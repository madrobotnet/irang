"use client";

import { useCopy } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { GRAPH_COPY } from "./graph-copy";

/** Client-rendered so the heading and document title follow a language switch in place. */
export function GraphPageHeader() {
  const copy = useCopy(GRAPH_COPY).page;
  return (
    <header className="mb-6 border-b border-line pb-5">
      <DocumentTitle title={copy.title} />
      <p className="text-sm font-medium text-accent">{copy.eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink lg:text-3xl">{copy.title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-mute">{copy.description}</p>
    </header>
  );
}
