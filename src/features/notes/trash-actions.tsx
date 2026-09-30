"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { useCopy, useLocale } from "@/components/i18n";
import { Button, Dialog, useToast } from "@/components/ui";
import { api } from "@/lib/api-client";
import { localizedApiError } from "@/lib/i18n/api-error";
import { textInEveryLocale } from "@/lib/i18n/copy";
import type { NoteListItem } from "@/lib/types";
import { NOTES_COPY } from "./copy";
import { forgetNoteDraft } from "./draft-store";
import { refreshNoteViews, TRASH_COUNT_KEY } from "./note-cache";

const COUNT_LIMIT = 100;
type TrashPage = { notes: NoteListItem[]; nextCursor: string | null };

export function TrashBar({ selectedId }: { selectedId?: string }) {
  const copy = useCopy(NOTES_COPY);
  const router = useRouter();
  const { mutate, cache } = useSWRConfig();
  const { toast } = useToast();
  // Counted without the list's search and tag filters, because emptying deletes every trashed note.
  const count = useSWR<TrashPage>(TRASH_COUNT_KEY, () => api<TrashPage>(`/api/notes?trash=1&limit=${COUNT_LIMIT}`));
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const total = count.data?.notes.length ?? 0;
  const more = Boolean(count.data?.nextCursor);

  const emptyTrash = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { purged } = await api<{ purged: number }>("/api/notes/trash", { method: "DELETE" });
      setOpen(false);
      toast(textInEveryLocale((locale) => NOTES_COPY[locale].trash.emptied(purged)), { tone: "ok" });
      if (selectedId) router.replace("/notes?view=trash");
    } catch {
      // Notes purged before the failure stay purged; the refreshed count shows what is left to retry.
      setFailed(true);
    } finally {
      setBusy(false);
      await refreshNoteViews({ cache, mutate });
    }
  };

  return (
    <div className="mb-2 flex items-center gap-3 px-2 py-1">
      <p className="min-w-0 flex-1 text-xs text-mute">{copy.trash.retentionHint}</p>
      <Button variant="danger" size="sm" className="min-h-touch sm:min-h-0" disabled={total === 0} leading={<Trash2 aria-hidden className="size-4" />}
        onClick={() => { setFailed(false); setOpen(true); }}>{copy.trash.empty}</Button>
      <Dialog open={open} onOpenChange={setOpen} size="sm" dismissible={!busy} initialFocusRef={cancelRef} title={copy.trash.confirmTitle}
        footer={<>
          <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{copy.trash.cancel}</Button>
          <Button variant="danger" loading={busy} onClick={() => void emptyTrash()}>{copy.trash.confirm}</Button>
        </>}>
        <p className="text-base">{more ? copy.trash.confirmBodyMore(total) : copy.trash.confirmBody(total)}</p>
        {failed ? <p role="alert" className="mt-3 rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">{copy.trash.emptyFailed}</p> : null}
      </Dialog>
    </div>
  );
}

/** Permanent delete of one trashed note, confirmed like emptying the trash (focus starts on Cancel). */
export function PurgeNoteDialog({ noteId, open, onOpenChange }: { noteId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const copy = useCopy(NOTES_COPY);
  const { locale } = useLocale();
  const router = useRouter();
  const { mutate, cache } = useSWRConfig();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  // The failure itself, not its text, so a language switch re-renders the message.
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const change = (next: boolean) => {
    if (next) setFailure(null);
    onOpenChange(next);
  };

  const purge = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await api(`/api/notes/${noteId}?purge=1`, { method: "DELETE" });
      forgetNoteDraft(noteId);
      onOpenChange(false);
      await refreshNoteViews({ cache, mutate }, { removedId: noteId });
      router.push("/notes?view=trash");
    } catch (error) {
      setFailure({ error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={change} size="sm" dismissible={!busy} initialFocusRef={cancelRef} title={copy.detail.purge}
      footer={<>
        <Button ref={cancelRef} variant="ghost" disabled={busy} onClick={() => change(false)}>{copy.trash.cancel}</Button>
        <Button variant="danger" loading={busy} onClick={() => void purge()}>{copy.detail.purge}</Button>
      </>}>
      <p className="text-base">{copy.detail.purgeConfirm}</p>
      {failure ? <p role="alert" className="mt-3 rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">{localizedApiError(failure.error, locale, copy.detail.purgeFailed)}</p> : null}
    </Dialog>
  );
}
