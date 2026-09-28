"use client";

import { Inbox, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { isEditableTarget } from "@/components/shell/shortcuts";
import { Badge, Button, Dialog, EmptyState, Skeleton, SkeletonLines, useToast } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import type { InboxItem, Note } from "@/lib/types";
import {
  excerpt,
  formatCreated,
  INBOX_KEY,
  moveSelection,
  neighbourAfterRemoval,
  replaceItem,
  resolveTriageKey,
  SOURCE_LABEL,
  type InboxListData,
  urlStatus,
  withoutItem,
} from "./inbox-triage";
import { TriageEditor } from "./TriageEditor";
import { refreshNoteViews } from "@/features/notes/note-cache";

export function InboxView() {
  const router = useRouter();
  const { toast } = useToast();
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
      toast("노트로 만들었습니다.", { tone: "ok" });
      router.push(`/notes/${note.id}`);
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "노트로 만들지 못했습니다.", { tone: "danger", durationMs: 0 });
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
      toast("인박스에서 버렸습니다.");
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "항목을 버리지 못했습니다.", { tone: "danger", durationMs: 0 });
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
      toast(cause instanceof Error ? cause.message : "제안을 확인하지 못했습니다.", { tone: "danger" });
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
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">정리할 곳</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">인박스</h1>
          <p className="mt-1 text-sm text-mute">캡처를 검토해 노트로 만들거나 버리세요.</p>
        </div>
        {data ? <Badge className="self-start sm:self-auto" tone={data.count ? "accent" : "neutral"}>{data.count}개 남음</Badge> : null}
      </header>

      {error && !data ? (
        <div role="alert" className="mt-6 rounded-card border border-danger/30 bg-danger-soft p-5">
          <p className="font-medium text-danger">인박스를 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-mute">{error instanceof Error ? error.message : "네트워크 상태를 확인해 주세요."}</p>
          <Button className="mt-3" size="lg" leading={<RefreshCw aria-hidden className="size-4" />} onClick={() => void mutate()}>
            다시 불러오기
          </Button>
        </div>
      ) : null}

      {isLoading && !data ? <InboxSkeleton /> : null}

      {data && items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={Inbox}
          title="인박스가 비어 있습니다."
          description="새 생각이나 링크를 캡처하면 여기에 모입니다."
        />
      ) : null}

      {items.length ? (
        <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]">
          <ol aria-label="인박스 항목" className={`surface-card max-h-[calc(100dvh-13rem)] divide-y divide-line overflow-y-auto scrollbar-thin ${detailOpen ? "hidden lg:block" : ""}`}>
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
                      <span className="shrink-0 text-xs text-mute">{formatCreated(item.createdAt)}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-sm leading-relaxed text-mute">{excerpt(item.body) || item.url || "내용 없음"}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge>{SOURCE_LABEL[item.source]}</Badge>
                      {status === "pending" ? <Badge tone="warn">URL 불러오는 중</Badge> : null}
                      {status === "failed" ? <Badge tone="danger">URL 불러오기 실패</Badge> : null}
                      {item.suggestions?.status === "ready" ? <Badge tone="ok">제안 준비됨</Badge> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={`min-w-0 ${detailOpen ? "" : "hidden lg:block"}`}>
            <Button className="mb-3 lg:hidden" variant="ghost" onClick={() => setDetailOpen(false)}>← 인박스 목록</Button>
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
            <EmptyState variant="plain" title="검토할 항목을 선택하세요." description="목록에서 항목을 선택하면 내용을 수정해 노트로 만들 수 있습니다." />
            )}
          </div>
        </div>
      ) : null}

      <Dialog
        open={discardId !== null}
        onOpenChange={(open) => !open && !busy && setDiscardId(null)}
        title="이 캡처를 버릴까요?"
        description="인박스에서 사라지며 이 작업은 되돌릴 수 없습니다."
        size="sm"
        footer={
          <>
            <Button disabled={busy !== null} onClick={() => setDiscardId(null)}>취소</Button>
            <Button
              variant="danger"
              loading={busy?.action === "discard"}
              leading={<Trash2 aria-hidden className="size-4" />}
              onClick={() => {
                const item = items.find((candidate) => candidate.id === discardId);
                if (item) void discard(item);
              }}
            >
              버리기
            </Button>
          </>
        }
      />
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(17rem,0.8fr)_minmax(0,1.6fr)]" aria-label="인박스를 불러오는 중" aria-busy="true">
      <div className="surface-card flex flex-col gap-5 p-4"><SkeletonLines lines={3} /><SkeletonLines lines={3} /><SkeletonLines lines={3} /></div>
      <div className="surface-card flex flex-col gap-4 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-56 w-full" /><SkeletonLines lines={3} /></div>
    </div>
  );
}
