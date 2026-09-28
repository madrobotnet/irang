"use client";

import { Archive, Pin, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Badge, Button, EmptyState, Input, SkeletonLines, useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { Note } from "@/lib/types";
import { MarkdownEditor } from "./MarkdownEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { NoteConnections } from "./NoteConnections";
import { forgetNoteDraft, getNoteDraft } from "./draft-store";
import { refreshNoteViews } from "./note-cache";

export function NoteDetail({ noteId }: { noteId: string }) {
  const detail = useSWR<{ note: Note }>(`/api/notes/${noteId}`, { revalidateOnFocus: true });
  if (detail.isLoading) return <section className="min-w-0 flex-1 p-5"><SkeletonLines lines={8} /></section>;
  if (detail.error || !detail.data) return <section className="min-w-0 flex-1 p-5"><EmptyState title="노트를 열지 못했습니다" description="노트가 삭제되었거나 연결에 문제가 있습니다." action={<Button onClick={() => void detail.mutate()}>다시 시도</Button>} /></section>;
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
  useEffect(() => () => {
    void controller.flush().then((saved) => {
      if (!saved) toast("노트를 저장하지 못했습니다. 돌아가서 다시 시도해 주세요.", { tone: "danger", durationMs: 0 });
    });
  }, [controller, toast]);
  return { controller, snapshot };
}

function LoadedNote({ note, refresh }: { note: Note; refresh: () => Promise<unknown> }) {
  const router = useRouter();
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
        toast("변경 내용을 먼저 저장해 주세요.", { tone: "danger" });
        return;
      }
      await api(`/api/notes/${note.id}`, { method: "PATCH", json: patch });
      await Promise.all([refresh(), refreshLists()]);
    } catch (error) { toast(message(error, "노트를 변경하지 못했습니다."), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };
  const trash = async () => {
    setActionBusy(true);
    try {
      if (!await controller.flush()) {
        toast("변경 내용을 저장하지 못해 휴지통으로 옮기지 않았습니다.", { tone: "danger" });
        return;
      }
      await api(`/api/notes/${note.id}`, { method: "DELETE" });
      forgetNoteDraft(note.id);
      await refreshLists();
      router.push("/notes?view=trash");
    } catch (error) { toast(message(error, "휴지통으로 옮기지 못했습니다."), { tone: "danger" }); }
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
    } catch (error) { toast(message(error, "노트를 복원하지 못했습니다."), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };
  const purge = async () => {
    if (!window.confirm("이 노트를 영구 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    setActionBusy(true);
    try {
      await api(`/api/notes/${note.id}?purge=1`, { method: "DELETE" });
      forgetNoteDraft(note.id);
      await refreshLists();
      router.push("/notes?view=trash");
    } catch (error) { toast(message(error, "노트를 영구 삭제하지 못했습니다."), { tone: "danger" }); }
    finally { setActionBusy(false); }
  };

  if (note.deletedAt) {
    return <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl"><Link href="/notes?view=trash" className="text-sm text-accent">← 휴지통</Link><EmptyState className="mt-5" icon={Trash2} title={note.title} description="휴지통의 노트는 복원한 뒤 편집할 수 있습니다." action={<><Button loading={actionBusy} leading={<RotateCcw aria-hidden className="size-4" />} onClick={() => void restore()}>복원</Button><Button variant="danger" disabled={actionBusy} onClick={() => void purge()}>영구 삭제</Button></>} /></div></section>;
  }

  return (
    <section className="min-w-0 flex-1 overflow-y-auto bg-canvas p-3 pb-24 sm:p-6 lg:pb-6 scrollbar-thin">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Link href="/notes" className="mr-auto text-sm text-mute hover:text-ink lg:hidden">← 노트 목록</Link>
          <SaveIndicator state={snapshot.state} error={snapshot.error} retry={() => void controller.retry()} />
          <Button size="sm" variant={note.pinned ? "primary" : "secondary"} disabled={actionBusy} leading={<Pin aria-hidden className="size-4" />} onClick={() => void patchFlag({ pinned: !note.pinned })}>{note.pinned ? "고정 해제" : "고정"}</Button>
          <Button size="sm" disabled={actionBusy} leading={<Archive aria-hidden className="size-4" />} onClick={() => void patchFlag({ archived: !note.archived })}>{note.archived ? "보관 해제" : "보관"}</Button>
          <Button size="sm" variant="danger" disabled={actionBusy} iconOnly aria-label="휴지통으로 이동" onClick={() => void trash()}><Trash2 aria-hidden className="size-4" /></Button>
        </div>
        <Input aria-label="노트 제목" className="min-h-touch border-transparent bg-transparent px-1 py-2 font-semibold shadow-none hover:border-line focus:bg-card"
          style={{ fontSize: "var(--text-2xl)", lineHeight: "var(--text-2xl--line-height)", height: "auto" }}
          value={snapshot.title} onChange={(event) => controller.update({ title: event.target.value })} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <CommaField label="태그" defaultValue={snapshot.tags.join(", ")} placeholder="프로젝트, 아이디어" onCommit={(tags) => controller.update({ tags })} />
          <CommaField label="별칭" defaultValue={snapshot.aliases.join(", ")} placeholder="다른 이름" onCommit={(aliases) => controller.update({ aliases })} />
        </div>
        <div className="mt-4 flex rounded-ctl bg-desk p-1 sm:w-fit"><button type="button" className={`rounded-ctl px-4 py-1.5 text-sm ${mode === "edit" ? "bg-card font-medium shadow-card" : "text-mute"}`} onClick={() => setMode("edit")}>편집</button><button type="button" className={`rounded-ctl px-4 py-1.5 text-sm ${mode === "preview" ? "bg-card font-medium shadow-card" : "text-mute"}`} onClick={() => setMode("preview")}>미리보기</button></div>
        <div className="mt-3">{mode === "edit" ? <MarkdownEditor noteId={note.id} value={snapshot.body} onChange={(body) => controller.update({ body })} onAppend={(markdown) => {
          const body = controller.getSnapshot().body;
          controller.update({ body: `${body}${body && !body.endsWith("\n") ? "\n" : ""}${markdown}` });
          void controller.flush().then((saved) => {
            if (!saved) toast("첨부 링크를 저장하지 못했습니다. 노트에서 다시 시도해 주세요.", { tone: "danger", durationMs: 0 });
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

function SaveIndicator({ state, error, retry }: { state: string; error: string | null; retry: () => void }) {
  if (state === "failed") return <span className="flex items-center gap-1 text-sm text-danger">저장 실패<Button size="sm" variant="ghost" onClick={retry}>다시 시도</Button><span className="sr-only">{error}</span></span>;
  if (state === "saving" || state === "dirty") return <Badge tone="warn">저장 중…</Badge>;
  return <Badge tone="ok">저장됨</Badge>;
}

function message(error: unknown, fallback: string): string { return error instanceof Error ? error.message : fallback; }
