"use client";

import { Inbox, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { DocumentTitle } from "@/components/i18n/DocumentTitle";
import { isEditableTarget } from "@/components/shell/shortcuts";
import { Badge, Button, Dialog, EmptyState, Skeleton, SkeletonLines, useToast } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { InboxItem, Note } from "@/lib/types";
import { INBOX_COPY } from "./inbox-copy";
import {
  excerpt,
  formatCreated,
  INBOX_KEY,
  moveSelection,
  neighbourAfterRemoval,
  replaceItem,
  resolveTriageKey,
  type InboxListData,
  urlStatus,
  withoutItem,
} from "./inbox-triage";
import { TriageEditor } from "./TriageEditor";
import { refreshNoteViews } from "@/features/notes/note-cache";

export function InboxView() {
  const router = useRouter();
  const { toast } = useToast();
  const { locale } = useLocale();
  const copy = useCopy(INBOX_COPY);
  const { mutate: mutateGlobal, cache } = useSWRConfig();
  const { data, error, isLoading, mutate } = useSWR<InboxListData>(INBOX_KEY, fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    refreshInterval: (current) => current?.items.some((item) => urlStatus(item.body) === "pending") ? 2000 : 0,
  });
  // `undefined` means choose the first available item; `null` is an explicit cleared selection.
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; action: "promote" | "discard" | "suggest" } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const selected = selectedId === null ? null : (items.find((item) => item.id === selectedId) ?? items[0] ?? null);

  const refreshAffected = useCallback(() => {
    void refreshNoteViews({ cache, mutate: mutateGlobal });
  }, [cache, mutateGlobal]);

  const promote = useCallback(async (item: InboxItem, draft: { title: string; body: string; tags: string[] }) => {
    setBusy({ id: item.id, action: "promote" });
    try {
      const { note } = await api<{ note: Note }>(`/api/inbox/${item.id}/promote`, { method: "POST", json: draft });
      const next = neighbourAfterRemoval(items, item.id);
      await mutate((current) => withoutItem(current, item.id), { revalidate: false });
      setSelectedId(next);
      refreshAffected();
      toast(textInEveryLocale((locale) => INBOX_COPY[locale].toast.promoted), { tone: "ok" });
      router.push(`/notes/${note.id}`);
    } catch (cause) {
      toast(textInEveryLocale((locale) => localizedApiError(cause, locale, INBOX_COPY[locale].toast.promoteFailed)), { tone: "danger", durationMs: 0 });
    } finally {
      setBusy(null);
    }
  }, [items, mutate, refreshAffected, router, toast]);

  const discard = useCallback(async (item: InboxItem) => {
    setBusy({ id: item.id, action: "discard" });
    try {
      await api<{ ok: boolean }>(`/api/inbox/${item.id}/discard`, { method: "POST" });
      const next = neighbourAfterRemoval(items, item.id);
      await mutate((current) => withoutItem(current, item.id), { revalidate: false });
      setDiscardId(null);
      setSelectedId(next);
      setDetailOpen(false);
      refreshAffected();
      toast(textInEveryLocale((locale) => INBOX_COPY[locale].toast.discarded));
    } catch (cause) {
      toast(textInEveryLocale((locale) => localizedApiError(cause, locale, INBOX_COPY[locale].toast.discardFailed)), { tone: "danger", durationMs: 0 });
    } finally {
      setBusy(null);
    }
  }, [items, mutate, refreshAffected, toast]);

  const suggest = useCallback(async (item: InboxItem) => {
    setBusy({ id: item.id, action: "suggest" });
    try {
      const { item: updated } = await api<{ item: InboxItem }>(`/api/inbox/${item.id}/suggest`, { method: "POST" });
      await mutate((current) => replaceItem(current, updated), { revalidate: false });
    } catch (cause) {
      toast(textInEveryLocale((locale) => localizedApiError(cause, locale, INBOX_COPY[locale].toast.suggestFailed)), { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }, [mutate, toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || busy || document.querySelector("dialog[open]")) return;
      const action = resolveTriageKey({
        key: event.key,
        editable: isEditableTarget(event.target),
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
      });
      if (!action) return;
      if (action === "open" && event.target instanceof Element && event.target.closest("button, a, summary")) return;
      event.preventDefault();
      if (action === "next") setSelectedId((current) => moveSelection(items, current ?? null, 1));
      else if (action === "prev") setSelectedId((current) => moveSelection(items, current ?? null, -1));
      else if (action === "first") setSelectedId(items[0]?.id ?? null);
      else if (action === "last") setSelectedId(items.at(-1)?.id ?? null);
      else if (action === "clear") { setSelectedId(null); setDetailOpen(false); }
      else if (action === "open") {
        setDetailOpen(true);
        requestAnimationFrame(() => titleRef.current?.focus());
      }
      else if (action === "discard" && selected) setDiscardId(selected.id);
      else if (action === "promote" && selected) document.querySelector<HTMLButtonElement>(`[data-promote="${selected.id}"]`)?.click();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, items, selected]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:px-10 lg:pt-10">
      <DocumentTitle title={copy.title} />
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">{copy.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-sm text-mute">{copy.intro}</p>
        </div>
        {data ? <Badge className="self-start sm:self-auto" tone={data.count ? "accent" : "neutral"}>{copy.remaining(data.count)}</Badge> : null}
      </header>

      {error && !data ? (
        <div role="alert" className="mt-6 rounded-card border border-danger/30 bg-danger-soft p-5">
          <p className="font-medium text-danger">{copy.loadError.title}</p>
          <p className="mt-1 text-sm text-mute">{localizedApiError(error, locale, copy.loadError.help)}</p>
          <Button className="mt-3" size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>
            {copy.loadError.retry}
          </Button>
        </div>
      ) : null}

      {isLoading && !data ? <InboxSkeleton /> : null}

      {data && items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Inbox}
          title={copy.emptyTitle}
          description={copy.emptyDescription}
        />
      ) : null}

      {items.length ? (
        <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]">
          <ol aria-label={copy.listLabel} className={`surface-card max-h-[calc(100dvh-13rem)] divide-y divide-line overflow-y-auto scrollbar-thin ${detailOpen ? "hidden lg:block" : ""}`}>
            {items.map((item) => {
              const active = item.id === selected?.id;
              const status = urlStatus(item.body);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    disabled={busy !== null}
                    onClick={(event) => {
                      setSelectedId(item.id);
                      setDetailOpen(true);
                      if (event.detail === 0) requestAnimationFrame(() => titleRef.current?.focus());
                    }}
                    className={`min-h-touch w-full px-4 py-3 text-left transition-colors focus-ring ${active ? "bg-accent-soft" : "hover:bg-desk"}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                      <span className="shrink-0 text-xs text-mute">{formatCreated(item.createdAt, locale)}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-mute">{excerpt(item.body) || item.url || copy.noContent}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{copy.source[item.source]}</Badge>
                      {status === "pending" ? <Badge tone="warn">{copy.badge.urlPending}</Badge> : null}
                      {status === "failed" ? <Badge tone="danger">{copy.badge.urlFailed}</Badge> : null}
                      {item.suggestions?.status === "ready" ? <Badge tone="ok">{copy.badge.suggestionsReady}</Badge> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={`min-w-0 ${detailOpen ? "" : "hidden lg:block"}`}>
            <Button className="mb-3 lg:hidden" variant="ghost" onClick={() => setDetailOpen(false)}>{copy.backToList}</Button>
            {selected ? (
            <TriageEditor
              key={selected.id}
              item={selected}
              titleRef={titleRef}
              busy={busy?.id === selected.id ? busy.action : null}
              onPromote={promote}
              onDiscard={() => setDiscardId(selected.id)}
              onSuggest={suggest}
            />
          ) : (
            <EmptyState variant="plain" title={copy.noSelectionTitle} description={copy.noSelectionDescription} />
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={discardId !== null}
        onOpenChange={(open) => !open && !busy && setDiscardId(null)}
        title={copy.discardDialog.title}
        description={copy.discardDialog.description}
        size="sm"
        footer={
          <>
            <Button disabled={busy !== null} onClick={() => setDiscardId(null)}>{copy.discardDialog.cancel}</Button>
            <Button
              variant="danger"
              loading={busy?.action === "discard"}
              leading={<Trash2 aria-hidden className="size-4" />}
              onClick={() => {
                const item = items.find((candidate) => candidate.id === discardId);
                if (item) void discard(item);
              }}
            >
              {copy.discardDialog.confirm}
            </Button>
          </>
        }
      />
    </div>
  );
}

function InboxSkeleton() {
  const copy = useCopy(INBOX_COPY);
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]" aria-label={copy.loading} aria-busy="true">
      <div className="surface-card flex flex-col gap-5 p-4"><SkeletonLines lines={3} /><SkeletonLines lines={3} /><SkeletonLines lines={3} /></div>
      <div className="surface-card flex flex-col gap-4 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-56 w-full" /><SkeletonLines lines={3} /></div>
    </div>
  );
}
