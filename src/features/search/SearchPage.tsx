"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import useSWR from "swr";
import type { SearchResponse } from "@/lib/types";
import { fetcher } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { formatDateTime } from "@/lib/i18n/format-date";
import { useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { Button, EmptyState, Input, SkeletonLines, TagBadge } from "@/components/ui";
import { SEARCH_COPY } from "./search-copy";
import { highlightSegments, matchLabel, searchApiUrl, searchUrl } from "./search-model";

const PAGE = "mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:px-10 lg:pt-10";

/** Suspense fallback for the search route; a client component so it follows a language switch. */
export function SearchPageFallback() {
  const copy = useCopy(SEARCH_COPY);
  return <div className={`${PAGE} text-sm text-mute`}>{copy.loading}</div>;
}

function Highlighted({ text, query }: { text: string; query: string }) {
  return highlightSegments(text, query).map((segment, index) =>
    segment.hit ? (
      <mark key={index} className="rounded-sm bg-accent-soft text-ink">{segment.text}</mark>
    ) : (
      segment.text
    ),
  );
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
    <section className={PAGE}>
      <DocumentTitle title={copy.title} />
      <div className="max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-mute">{copy.description}</p>
        </header>
        <Form action="/search" scroll={false}>
          <fieldset key={params.toString()} className="space-y-3">
            <div className="flex items-end gap-2">
              <Input
                name="q" label={copy.form.queryLabel} data-search-input autoFocus
                defaultValue={query} maxLength={500} placeholder={copy.form.queryPlaceholder}
                leading={<Search aria-hidden />}
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
              {data?.hits.map((hit) => {
                const signals = matchLabel(hit, locale);
                return (
                  <article key={hit.noteId} className="rounded-card border border-line bg-card p-4 shadow-card">
                    <Link className="block rounded-ctl focus-ring" href={`/notes/${encodeURIComponent(hit.noteId)}`}>
                      <h2 className="text-lg font-medium text-ink">
                        {hit.title ? <Highlighted text={hit.title} query={query} /> : copy.untitled}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-mute">
                        <Highlighted text={hit.snippet} query={query} />
                      </p>
                    </Link>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {hit.tags.map((item) => (
                        <Link key={item} href={searchUrl(query, item)} scroll={false}
                          aria-label={copy.searchTag(item)} className="inline-flex min-h-touch items-center rounded-ctl focus-ring">
                          <TagBadge tag={item} />
                        </Link>
                      ))}
                      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 text-xs text-mute">
                        {signals.length ? (
                          <>
                            <p>{signals.join(", ")}</p>
                            <span aria-hidden>·</span>
                          </>
                        ) : null}
                        <time dateTime={hit.updatedAt}>{formatDateTime(hit.updatedAt, locale)}</time>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
