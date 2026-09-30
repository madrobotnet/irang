"use client";

import { Archive, Pin, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Badge, Button, EmptyState, Input, SkeletonLines, useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { Note } from "@/lib/types";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { NoteConnections } from "./NoteConnections";
import { NOTES_COPY } from "./copy";
import { forgetNoteDraft, getNoteDraft } from "./draft-store";
import { refreshNoteViews } from "./note-cache";

export function NoteDetail({ noteId }: { noteId: string }) {
  const copy = useCopy(NOTES_COPY);
  const detail = useSWR<{ note: Note }>(`/api/notes/${noteId}`, { revalidateOnFocus: true });
  if (detail.isLoading) return <section className="min-w-0 flex-1 p-5"><SkeletonLines lines={8} /></section>;
  if (detail.error || !detail.data) return <section className="min-w-0 flex-1 p-5"><EmptyState title={copy.detail.openFailedTitle} description={copy.detail.openFailedDescription} action={<Button onClick={() => void detail.mutate()}>{copy.retry}</Button>} /></section>;
  return <LoadedNote note={detail.data.note} refresh={() => detail.mutate()} />;
}

function useDraft(note: Note) {
  const { mutate, cache } = useSWRConfig();
  const { toast } = useToast();
  const controller = useMemo(() => getNoteDraft(note, async (id, value) => {
    const { note: saved } = await api<{ note: Note }>(`/api/notes/${id}`, { method: "PATCH", json: value });
    void mutate(`/api/notes/${id}`, { note: saved }, { revalidate: false });
    void refreshNoteViews({ cache, mutate });
    return saved;
  }), [note, mutate, cache]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => controller.hydrate(note), [controller, note]);
  useEffect(() => {
    if (snapshot.state !== "dirty") return;
    const timer = window.setTimeout(() => void controller.flush(), 700);
    return () => window.clearTimeout(timer);
  }, [controller, snapshot.state, snapshot.version]);
  // Keep both translations; a switch must not re-run the cleanup below, which flushes the draft.
  const reportLeaveFailure = useEffectEvent(() => {
    toast(textInEveryLocale((locale) => NOTES_COPY[locale].detail.leaveSaveFailed), { tone: "danger", durationMs: 0 });
  });
  useEffect(() => () => {
    void controller.flush().then((saved) => {
      if (!saved) reportLeaveFailure();
    });
  }, [controller]);
  return { controller, snapshot };
}

function LoadedNote({ note, refresh }: { note: Note; refresh: () => Promise<unknown> }) {
  const router = useRouter();
  const copy = useCopy(NOTES_COPY);
  const { mutate: mutateAll, cache } = useSWRConfig();
  const { toast } = useToast();
  const { controller, snapshot } = useDraft(note);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [actionBusy, setActionBusy] = useState(false);
  const refreshLists = () => refreshNoteViews({ cache, mutate: mutateAll });
  const patchFlag = async (patch: Partial<Pick<Note, "pinned" | "archived">>) => {
    setActionBusy(true);
    try {
      if (!await controller.flush()) {
        toast(textInEveryLocale((locale) => NOTES_COPY[locale].detail.saveFirst), { tone: "danger" });
        return;
      }
      await api(`/api/notes/${note.id}`, { method: "PATCH", json: patch });
      await Promise.all([refresh(), refreshLists()]);
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].detail.updateFailed)), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };
  const trash = async () => {
    setActionBusy(true);
    try {
      if (!await controller.flush()) {
        toast(textInEveryLocale((locale) => NOTES_COPY[locale].detail.trashBlocked), { tone: "danger" });
        return;
      }
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      forgetNoteDraft(note.id);
      await refreshLists();
      router.push("/notes?view=trash");
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].detail.trashFailed)), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };
  const restore = async () => {
    setActionBusy(true);
    try {
      await api(`/api/notes/${note.id}/restore`, { method: "POST" });
      forgetNoteDraft(note.id);
      await refreshLists();
      router.push(`/notes/${note.id}`);
      await refresh();
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].detail.restoreFailed)), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };
  const purge = async () => {
    if (!window.confirm(copy.detail.purgeConfirm)) return;
    setActionBusy(true);
    try {
      await api(`/api/notes/${note.id}?purge=1`, { method: "DELETE" });
      forgetNoteDraft(note.id);
      await refreshLists();
      router.push("/notes?view=trash");
    } catch (error) { toast(textInEveryLocale((locale) => localizedApiError(error, locale, NOTES_COPY[locale].detail.purgeFailed)), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };

  if (note.deletedAt) {
    return <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl"><Link href="/notes?view=trash" className="text-sm text-accent">{copy.detail.backToTrash}</Link><EmptyState className="mt-5" icon={Trash2} title={note.title} description={copy.detail.trashedDescription} action={<><Button loading={actionBusy} leading={<RotateCcw aria-hidden className="size-4" />} onClick={() => void restore()}>{copy.detail.restore}</Button><Button variant="danger" disabled={actionBusy} onClick={() => void purge()}>{copy.detail.purge}</Button></>} /></div></section>;
  }

  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-canvas p-3 pb-24 sm:p-6 lg:pb-6 scrollbar-thin">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/notes" className="mr-auto inline-flex min-h-touch items-center text-sm text-mute hover:text-ink lg:hidden">{copy.detail.backToList}</Link>
          <SaveIndicator state={snapshot.state} error={snapshot.error} retry={() => void controller.retry()} />
          <Button size="sm" className="min-h-touch sm:min-h-0" variant={note.pinned ? "primary" : "secondary"} disabled={actionBusy} leading={<Pin aria-hidden className="size-4" />} onClick={() => void patchFlag({ pinned: !note.pinned })}>{note.pinned ? copy.detail.unpin : copy.detail.pin}</Button>
          <Button size="sm" className="min-h-touch sm:min-h-0" disabled={actionBusy} leading={<Archive aria-hidden className="size-4" />} onClick={() => void patchFlag({ archived: !note.archived })}>{note.archived ? copy.detail.unarchive : copy.detail.archive}</Button>
          <Button size="sm" className="min-h-touch min-w-touch sm:min-h-0 sm:min-w-0" variant="danger" disabled={actionBusy} iconOnly aria-label={copy.detail.moveToTrash} onClick={() => void trash()}><Trash2 aria-hidden className="size-4" /></Button>
        </div>
        <Input aria-label={copy.detail.titleLabel} placeholder={copy.detail.titleLabel} className="min-h-touch border-transparent bg-transparent px-1 py-2 font-semibold shadow-none hover:border-line focus:bg-card"
          style={{ fontSize: "var(--text-2xl)", lineHeight: "var(--text-2xl--line-height)", height: "auto" }}
          value={snapshot.title} onChange={(event) => controller.update({ title: event.target.value })} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <CommaField label={copy.detail.tags} defaultValue={snapshot.tags.join(", ")} placeholder={copy.detail.tagsPlaceholder} onCommit={(tags) => controller.update({ tags })} />
          <CommaField label={copy.detail.aliases} defaultValue={snapshot.aliases.join(", ")} placeholder={copy.detail.aliasesPlaceholder} onCommit={(aliases) => controller.update({ aliases })} />
        </div>
        {note.sourceUrl ? <p className="mt-2 flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 text-mute">{copy.detail.source}</span>
          <a href={note.sourceUrl} target="_blank" rel="noreferrer noopener" className="min-w-0 truncate text-accent underline underline-offset-2 focus-ring">{note.sourceUrl}</a>
        </p> : null}
        <div className="mt-4 flex rounded-ctl bg-desk p-1 sm:w-fit"><button type="button" className={`min-h-touch rounded-ctl px-4 py-1.5 text-sm sm:min-h-0 ${mode === "edit" ? "bg-card font-medium shadow-card" : "text-mute"}`} onClick={() => setMode("edit")}>{copy.detail.edit}</button><button type="button" className={`min-h-touch rounded-ctl px-4 py-1.5 text-sm sm:min-h-0 ${mode === "preview" ? "bg-card font-medium shadow-card" : "text-mute"}`} onClick={() => setMode("preview")}>{copy.detail.preview}</button></div>
        <div className="mt-3">{mode === "edit" ? <MarkdownEditor noteId={note.id} value={snapshot.body} onChange={(body) => controller.update({ body })} onAppend={(markdown) => {
          const body = controller.getSnapshot().body;
          controller.update({ body: `${body}${body && !body.endsWith("\n") ? "\n" : ""}${markdown}` });
          void controller.flush().then((saved) => {
            if (!saved) toast(textInEveryLocale((locale) => NOTES_COPY[locale].detail.attachmentLinkFailed), { tone: "danger", durationMs: 0 });
          });
        }} /> : <MarkdownPreview body={snapshot.body} />}</div>
        <NoteConnections noteId={note.id} />
      </div>
    </section>
  );
}

function CommaField({ label, defaultValue, placeholder, onCommit }: { label: string; defaultValue: string; placeholder: string; onCommit: (items: string[]) => void }) {
  const [draft, setDraft] = useState({ base: defaultValue, value: defaultValue });
  if (draft.base !== defaultValue && draft.value === draft.base) {
    setDraft({ base: defaultValue, value: defaultValue });
  }
  return <Input label={label} value={draft.value} placeholder={placeholder}
    onChange={(event) => setDraft({ ...draft, value: event.target.value })} onBlur={(event) => {
    const parse = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
    const base = new Set(parse(draft.base));
    // Retain aliases/inline tags added by an acknowledgement while this field was edited.
    const incoming = parse(defaultValue).filter((item) => !base.has(item));
    const values = [...new Set([...parse(event.target.value), ...incoming])];
    setDraft({ base: values.join(", "), value: values.join(", ") });
    if (values.join(", ") !== defaultValue) onCommit(values);
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />;
}

function SaveIndicator({ state, error, retry }: { state: string; error: unknown; retry: () => void }) {
  const { locale } = useLocale();
  const copy = useCopy(NOTES_COPY);
  if (state === "failed") return <div role="alert" className="order-last w-full rounded-ctl border border-danger/30 bg-danger-soft px-3 py-2 text-sm">
    <div className="flex items-center justify-between gap-2"><span className="font-medium text-danger">{copy.detail.saveFailed}</span><Button size="sm" className="min-h-touch sm:min-h-0" variant="ghost" onClick={retry}>{copy.retry}</Button></div>
    <p>{localizedApiError(error, locale, copy.detail.saveFailedDetail)}</p>
  </div>;
  if (state === "saving" || state === "dirty") return <Badge tone="warn">{copy.detail.saving}</Badge>;
  return <Badge tone="ok">{copy.detail.saved}</Badge>;
}
