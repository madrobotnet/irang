"use client";

import Link from "next/link";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { SearchResponse } from "@/lib/types";
import { fetcher } from "@/lib/api-client";
import { Badge, Button, EmptyState, Input, SkeletonLines, TagBadge } from "@/components/ui";
import { matchLabel, searchApiUrl, searchUrl } from "./search-model";

export function SearchPage() {
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const tag = (params.get("tag") ?? "").trim().replace(/^#/, "");
  const url = searchApiUrl(query, tag);
  const { data, error, isLoading, mutate } = useSWR<SearchResponse>(url, fetcher, { shouldRetryOnError: false });

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-ink">검색</h1>
        <p className="mt-1 text-sm text-mute">제목, 내용, 태그로 기록을 다시 찾아보세요.</p>
      </header>
      <Form action="/search" scroll={false}>
        <fieldset key={params.toString()} className="space-y-3">
          <div className="flex items-end gap-2">
            <Input
              name="q" label="검색어" data-search-input autoFocus
              defaultValue={query} maxLength={500} placeholder="제목이나 내용을 검색하세요"
              wrapperClassName="min-w-0 flex-1" className="min-h-touch"
            />
            <Button type="submit">검색</Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Input name="tag" label="태그 (선택)" defaultValue={tag} maxLength={100}
              placeholder="태그 이름" wrapperClassName="w-full max-w-xs" className="min-h-touch" />
            {tag ? <Link href={searchUrl(query, "")} scroll={false}
              className="inline-flex min-h-touch items-center text-sm text-accent">태그 필터 지우기</Link> : null}
          </div>
        </fieldset>
      </Form>
      <div aria-live="polite" aria-busy={isLoading}>
        {!query ? (
          <EmptyState title="검색어를 입력하세요" description="노트 제목이나 내용에서 찾을 수 있습니다." />
        ) : isLoading ? (
          <SkeletonLines lines={4} />
        ) : error ? (
          <EmptyState title="검색하지 못했습니다" description="연결을 확인한 뒤 다시 시도하세요."
            action={<Button onClick={() => void mutate()} variant="secondary">다시 시도</Button>} />
        ) : data?.hits.length === 0 ? (
          <EmptyState title="검색 결과가 없습니다" description="다른 검색어나 태그를 입력해 보세요." />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mute">{data?.hits.length ?? 0}개의 노트</p>
            {data?.hits.map((hit, index) => (
              <article key={hit.noteId} className="rounded-card border border-line bg-card p-4 shadow-card">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{index + 1}</Badge>
                  {matchLabel(hit).map((label) => <Badge key={label} tone="accent">{label}</Badge>)}
                </div>
                <Link className="block rounded-ctl focus-ring" href={`/notes/${encodeURIComponent(hit.noteId)}`}>
                  <h2 className="text-lg font-medium text-ink">{hit.title || "제목 없는 노트"}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-mute">{hit.snippet}</p>
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {hit.tags.map((item) => (
                    <Link key={item} href={searchUrl(query, item)} scroll={false}
                      aria-label={`태그 ${item}로 검색`} className="inline-flex min-h-touch items-center rounded-ctl focus-ring">
                      <TagBadge tag={item} />
                    </Link>
                  ))}
                  <time className="ml-auto text-xs text-mute" dateTime={hit.updatedAt}>
                    {new Date(hit.updatedAt).toLocaleString("ko-KR")}
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
