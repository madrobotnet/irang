"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { SearchResponse } from "@/lib/types";
import { fetcher } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { INTL_LOCALE } from "@/lib/i18n/locale";
import { useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { Badge, Button, EmptyState, Input, SkeletonLines, TagBadge } from "@/components/ui";
import { SEARCH_COPY } from "./search-copy";
import { matchLabel, searchApiUrl, searchUrl } from "./search-model";

/** Suspense fallback for the search route; a client component so it follows a language switch. */
export function SearchPageFallback() {
  const copy = useCopy(SEARCH_COPY);
  return <div className="mx-auto w-full max-w-3xl px-4 py-8 text-sm text-mute">{copy.loading}</div>;
}

export function SearchPage() {
  const params = useSearchParams();
  const { locale } = useLocale();
  const copy = useCopy(SEARCH_COPY);
  const query = (params.get("q") ?? "").trim();
  const tag = (params.get("tag") ?? "").trim().replace(/^#/, "");
  const url = searchApiUrl(query, tag);
  const { data, error, isLoading, mutate } = useSWR<SearchResponse>(url, fetcher, { shouldRetryOnError: false });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <DocumentTitle title={copy.title} />
      <header>
        <h1 className="text-2xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-1 text-sm text-mute">{copy.description}</p>
      </header>
      <Form action="/search" scroll={false}>
        <fieldset key={params.toString()} className="space-y-3">
          <div className="flex items-end gap-2">
            <Input
              name="q" label={copy.form.queryLabel} data-search-input autoFocus
              defaultValue={query} maxLength={500} placeholder={copy.form.queryPlaceholder}
              wrapperClassName="min-w-0 flex-1" className="min-h-touch"
            />
            <Button type="submit" size="lg">{copy.form.submit}</Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input name="tag" label={copy.form.tagLabel} defaultValue={tag} maxLength={100}
              placeholder={copy.form.tagPlaceholder} wrapperClassName="w-full max-w-xs" className="min-h-touch" />
            {tag ? <Link href={searchUrl(query, "")} scroll={false}
              className="inline-flex min-h-touch items-center text-sm text-accent">{copy.form.clearTag}</Link> : null}
          </div>
        </fieldset>
      </Form>
      <div aria-live="polite" aria-busy={isLoading}>
        {!query ? (
          <EmptyState title={copy.idle.title} description={copy.idle.description} />
        ) : isLoading ? (
          <SkeletonLines lines={4} />
        ) : error ? (
          <EmptyState title={copy.error.title} description={localizedApiError(error, locale, copy.error.fallback)}
            action={<Button onClick={() => void mutate()} variant="secondary">{copy.error.retry}</Button>} />
        ) : data?.hits.length === 0 ? (
          <EmptyState title={copy.empty.title} description={copy.empty.description} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mute">{copy.resultCount(data?.hits.length ?? 0)}</p>
            {data?.hits.map((hit, index) => (
              <article key={hit.noteId} className="rounded-card border border-line bg-card p-4 shadow-card">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{index + 1}</Badge>
                  {matchLabel(hit, locale).map((label) => <Badge key={label} tone="accent">{label}</Badge>)}
                </div>
                <Link className="block rounded-ctl focus-ring" href={`/notes/${encodeURIComponent(hit.noteId)}`}>
                  <h2 className="text-lg font-medium text-ink">{hit.title || copy.untitled}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-mute">{hit.snippet}</p>
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {hit.tags.map((item) => (
                    <Link key={item} href={searchUrl(query, item)} scroll={false}
                      aria-label={copy.searchTag(item)} className="inline-flex min-h-touch items-center rounded-ctl focus-ring">
                      <TagBadge tag={item} />
                    </Link>
                  ))}
                  <time className="ml-auto text-xs text-mute" dateTime={hit.updatedAt}>
                    {new Date(hit.updatedAt).toLocaleString(INTL_LOCALE[locale])}
                  </time>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
