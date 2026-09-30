import type { Metadata } from "next";
import { Suspense } from "react";
import { SEARCH_COPY } from "@/features/search/search-copy";
import { SearchPage, SearchPageFallback } from "@/features/search/SearchPage";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: SEARCH_COPY[await getRequestLocale()].title };
}

export default function Page() {
  return <Suspense fallback={<SearchPageFallback />}><SearchPage /></Suspense>;
}
