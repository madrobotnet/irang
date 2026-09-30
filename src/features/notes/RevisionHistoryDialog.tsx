"use client";

import { History, RotateCcw, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import useSWR from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Button, cn, EmptyState, SkeletonLines, TagBadge, UI_COPY, useModalDialog } from "@/components/ui";
import { localizedApiError } from "@/lib/i18n/api-error";
import { formatDateTime } from "@/lib/i18n/format-date";
import type { NoteRevision, NoteRevisionSummary } from "@/lib/note-revisions";
import { MarkdownPreview } from "./MarkdownPreview";
import { NOTES_COPY } from "./copy";
import { diffLines, type LineDiff } from "./revision-diff";

export type RestoreOutcome = { ok: true } | { ok: false; reason: "unsaved" } | { ok: false; reason: "failed"; error: unknown };
type RestoreFailure = Exclude<RestoreOutcome, { ok: true }>;

type HistoryProps = {
  noteId: string;
  /** What the diff compares with: the live draft, or the stored body of a trashed note. */
  currentBody: string;
  /** Trashed notes keep their history viewable, but restoring a version is disabled. */
  readOnly: boolean;
  onRestore: (revisionId: string) => Promise<RestoreOutcome>;
};

const SEGMENT_TRACK = "flex rounded-ctl bg-canvas p-1 ring-1 ring-inset ring-line";
const segment = (active: boolean) => cn(
  "min-h-touch flex-1 rounded-ctl px-3 py-1.5 text-sm transition-colors sm:min-h-0 sm:flex-none",
  active ? "bg-card font-medium text-ink shadow-card ring-1 ring-line-strong" : "text-mute hover:text-ink",
);

export function RevisionHistoryDialog({ open, onOpenChange, ...props }: HistoryProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { ref, onClose, onBackdropClick } = useModalDialog(open, onOpenChange);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => { if (busy) event.preventDefault(); }}
      onClick={busy ? undefined : onBackdropClick}
      aria-labelledby={titleId}
      className={cn(
        "m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 border-line bg-card p-0 text-ink shadow-pop backdrop:bg-scrim open:flex open:flex-col",
        "sm:m-auto sm:h-[min(calc(100dvh-4rem),52rem)] sm:w-[calc(100%-2rem)] sm:max-w-5xl sm:rounded-card sm:border",
      )}
    >
      {open ? <HistoryBody {...props} titleId={titleId} busy={busy} setBusy={setBusy} onDismiss={() => onOpenChange(false)} /> : null}
    </dialog>
  );
}

function HistoryBody({ noteId, currentBody, readOnly, onRestore, titleId, busy, setBusy, onDismiss }: HistoryProps & {
  titleId: string;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDismiss: () => void;
}) {
  const copy = useCopy(NOTES_COPY);
  const closeLabel = useCopy(UI_COPY).close;
  const list = useSWR<{ revisions: NoteRevisionSummary[] }>(`/api/notes/${noteId}/revisions`);
  const revisions = list.data?.revisions ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  // Phones show the list or one version; from `sm` both panes are visible side by side.
  const [pane, setPane] = useState<"list" | "detail">("list");
  const selected = revisions.find((revision) => revision.id === picked) ?? revisions[0] ?? null;
  const showDetail = pane === "detail" && selected !== null;

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:px-5 sm:pb-3 sm:pt-4">
        {showDetail ? <Button variant="ghost" size="sm" className="mr-auto min-h-touch sm:hidden" onClick={() => setPane("list")}>{copy.history.back}</Button> : null}
        <h2 id={titleId} className={cn("min-w-0 flex-1 truncate px-1 text-lg font-semibold tracking-tight", showDetail && "max-sm:sr-only")}>{copy.history.open}</h2>
        <Button variant="ghost" size="sm" iconOnly aria-label={closeLabel} disabled={busy} className="min-h-touch min-w-touch sm:min-h-0 sm:min-w-0" onClick={onDismiss}><X aria-hidden className="size-4" /></Button>
      </header>
      {list.isLoading ? <div className="p-5"><SkeletonLines lines={5} /></div>
        : list.error ? <div className="p-5"><EmptyState title={copy.history.loadFailed} action={<Button size="sm" onClick={() => void list.mutate()}>{copy.retry}</Button>} /></div>
        : !selected ? <div className="p-5"><EmptyState icon={History} title={copy.history.emptyTitle} description={copy.history.emptyDescription} /></div>
        : (
          <div className="flex min-h-0 flex-1">
            <div className={cn("min-h-0 w-full flex-col overflow-y-auto bg-desk scrollbar-thin sm:flex sm:w-72 sm:shrink-0 sm:border-r sm:border-line lg:w-80", showDetail ? "hidden" : "flex")}>
              <ol aria-label={copy.history.listLabel} className="space-y-1 p-2">
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <RevisionItem revision={revision} current={revision.id === selected.id} onSelect={() => { setPicked(revision.id); setPane("detail"); }} />
                  </li>
                ))}
              </ol>
              <p className="mt-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3 text-xs text-mute">{copy.history.retention}</p>
            </div>
            <section aria-labelledby={`${titleId}-version`} className={cn("min-h-0 min-w-0 flex-1 flex-col overflow-y-auto scrollbar-thin sm:flex", showDetail ? "flex" : "hidden")}>
              <RevisionView key={selected.id} headingId={`${titleId}-version`} noteId={noteId} summary={selected} currentBody={currentBody} readOnly={readOnly}
                busy={busy} onRestore={async () => {
                  setBusy(true);
                  try {
                    return await onRestore(selected.id);
                  } finally {
                    setBusy(false);
                  }
                }} />
            </section>
          </div>
        )}
    </>
  );
}

function RevisionItem({ revision, current, onSelect }: { revision: NoteRevisionSummary; current: boolean; onSelect: () => void }) {
  const copy = useCopy(NOTES_COPY);
  const { locale } = useLocale();
  return (
    <button type="button" aria-current={current || undefined} onClick={onSelect}
      className={cn("block w-full rounded-card px-3 py-2.5 text-left transition-colors focus-ring", current ? "bg-accent-soft" : "hover:bg-card")}>
      <time dateTime={revision.createdAt} className="block text-sm font-medium text-ink">{formatDateTime(revision.createdAt, locale)}</time>
      <span className="mt-0.5 block text-xs text-mute">{copy.history.reasons[revision.reason]}</span>
      {revision.excerpt ? <span className="mt-1 line-clamp-2 block text-sm text-mute">{revision.excerpt}</span> : null}
    </button>
  );
}

function RevisionView({ headingId, noteId, summary, currentBody, readOnly, busy, onRestore }: {
  headingId: string;
  noteId: string;
  summary: NoteRevisionSummary;
  currentBody: string;
  readOnly: boolean;
  busy: boolean;
  onRestore: () => Promise<RestoreOutcome>;
}) {
  const copy = useCopy(NOTES_COPY);
  const { locale } = useLocale();
  const detail = useSWR<{ revision: NoteRevision }>(`/api/notes/${noteId}/revisions/${summary.id}`);
  const revision = detail.data?.revision;
  const [tab, setTab] = useState<"content" | "compare">("content");
  const [failure, setFailure] = useState<RestoreFailure | null>(null);
  const diff = useMemo(() => (revision ? diffLines(revision.body, currentBody) : null), [revision, currentBody]);

  const restore = async () => {
    setFailure(null);
    const outcome = await onRestore();
    if (!outcome.ok) setFailure(outcome);
  };

  return (
    <div className="px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:px-6 sm:py-5">
      <p className="text-sm text-mute">
        <time dateTime={summary.createdAt}>{formatDateTime(summary.createdAt, locale)}</time>
        <span aria-hidden> · </span>{copy.history.reasons[summary.reason]}
      </p>
      <h3 id={headingId} className="mt-1 text-xl font-semibold tracking-tight">{summary.title}</h3>
      {revision && revision.tags.length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{revision.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button variant="primary" className="min-h-touch sm:min-h-0" loading={busy} disabled={readOnly || !revision} leading={<RotateCcw aria-hidden className="size-4" />} onClick={() => void restore()}>{copy.history.restore}</Button>
        {readOnly ? <p className="text-sm text-mute">{copy.history.restoreTrashed}</p> : null}
      </div>
      {failure ? <p role="alert" className="mt-3 rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
        {failure.reason === "unsaved" ? copy.history.restoreUnsaved : localizedApiError(failure.error, locale, copy.history.restoreFailed)}
      </p> : null}

      <div role="group" aria-label={copy.history.viewsLabel} className={cn(SEGMENT_TRACK, "mt-5 sm:w-fit")}>
        <button type="button" aria-pressed={tab === "content"} className={segment(tab === "content")} onClick={() => setTab("content")}>{copy.history.content}</button>
        <button type="button" aria-pressed={tab === "compare"} className={segment(tab === "compare")} onClick={() => setTab("compare")}>{copy.history.compare}</button>
      </div>
      <div className="mt-3">
        {detail.error ? <EmptyState title={copy.history.versionLoadFailed} action={<Button size="sm" onClick={() => void detail.mutate()}>{copy.retry}</Button>} />
          : !revision || !diff ? <SkeletonLines lines={6} />
          : tab === "content" ? <MarkdownPreview body={revision.body} />
          : <DiffView diff={diff} />}
      </div>
    </div>
  );
}

function DiffView({ diff }: { diff: LineDiff }) {
  const copy = useCopy(NOTES_COPY);
  if (diff.status === "too-large") return <EmptyState variant="plain" title={copy.history.diffTooLarge} />;
  if (diff.rows.length === 0) return <p className="px-1 py-4 text-sm text-mute">{copy.history.diffSame}</p>;
  return (
    <>
      <p className="text-sm text-mute">{copy.history.diffSummary(diff.added, diff.removed)}</p>
      <ol className="mt-2 overflow-hidden rounded-card border border-line bg-card py-1 text-sm">
        {diff.rows.map((row, index) => {
          if (row.kind === "skip") {
            return <li key={index} className="my-1 border-y border-line bg-desk px-3 py-1 text-xs text-mute">{copy.history.unchangedLines(row.count)}</li>;
          }
          const marker = row.kind === "add" ? "+" : row.kind === "del" ? "\u2212" : "";
          return (
            <li key={index} className={cn("flex gap-2 px-3 py-0.5", row.kind === "add" && "bg-ok-soft", row.kind === "del" && "bg-danger-soft")}>
              <span aria-hidden className={cn("w-3 shrink-0 select-none text-center font-medium", row.kind === "add" ? "text-ok" : "text-danger")}>{marker}</span>
              {row.kind === "same" ? null : <span className="sr-only">{row.kind === "add" ? copy.history.diffAdded : copy.history.diffRemoved}: </span>}
              <span className="min-w-0 flex-1 whitespace-pre-wrap">{row.text || "\u00a0"}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
