import type { Metadata } from "next";
import { GraphExplorer, GraphPageHeader } from "@/features/graph";
import { GRAPH_COPY } from "@/features/graph/graph-copy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: GRAPH_COPY[await getRequestLocale()].page.title };
}

export default function GraphPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 sm:px-6 lg:px-10 lg:pt-10">
      <GraphPageHeader />
      <GraphExplorer />
    </div>
  );
}
