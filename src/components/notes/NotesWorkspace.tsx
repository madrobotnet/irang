"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createNote,
  getNote,
  listNotes,
  restoreNote,
  trashNote,
  updateNote,
} from "@/lib/notes/client-api";
import type { Note } from "@/lib/notes/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { useCapture } from "@/components/capture/CaptureContext";
import { NOTE_COPY } from "./copy";
import { NoteEditor } from "./NoteEditor";
import { NotesExplorer } from "./NotesExplorer";
import { TrashBanner } from "./TrashBanner";
import styles from "./NotesWorkspace.module.css";

type ViewState = "loading" | "ready" | "empty" | "error";

export function NotesWorkspace() {
  const { openCapture } = useCapture();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    activeNote !== null &&
    (draftTitle !== activeNote.title || draftBody !== activeNote.body);

  const trashed = Boolean(activeNote?.trashedAt);

  const loadList = useCallback(async () => {
    setViewState("loading");
    setError(null);
    try {
      const { items } = await listNotes();
      setNotes(items);
      if (items.length === 0) {
        setViewState("empty");
        setSelectedId(null);
        setActiveNote(null);
        return;
      }
      setViewState("ready");
      const pick = selectedId && items.some((n) => n.id === selectedId)
        ? selectedId
        : items[0].id;
      setSelectedId(pick);
    } catch {
      setViewState("error");
      setError(NOTE_COPY.loadError);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial mount only
  }, []);

  useEffect(() => {
    if (!selectedId || viewState !== "ready") return;
    let cancelled = false;
    void (async () => {
      try {
        const note = await getNote(selectedId);
        if (cancelled) return;
        setActiveNote(note);
        setDraftTitle(note.title);
        setDraftBody(note.body);
      } catch {
        if (!cancelled) setError(NOTE_COPY.loadError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, viewState]);

  const handleSave = async () => {
    if (!activeNote || trashed || saving) return;
    if (!draftTitle.trim() || !draftBody.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateNote(activeNote.id, {
        title: draftTitle.trim(),
        body: draftBody.trim(),
      });
      setActiveNote(updated);
      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n)).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    } catch {
      setError(NOTE_COPY.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleNewNote = async () => {
    setSaving(true);
    setError(null);
    try {
      const note = await createNote({
        title: "새 노트",
        body: "본문을 입력하세요",
      });
      setNotes((prev) => [note, ...prev]);
      setViewState("ready");
      setSelectedId(note.id);
      setActiveNote(note);
      setDraftTitle(note.title);
      setDraftBody(note.body);
    } catch {
      setError(NOTE_COPY.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleTrash = async () => {
    if (!activeNote) return;
    setSaving(true);
    try {
      const trashedNote = await trashNote(activeNote.id);
      setActiveNote(trashedNote);
      setNotes((prev) => prev.filter((n) => n.id !== trashedNote.id));
    } catch {
      setError(NOTE_COPY.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!activeNote?.trashedAt) return;
    setRestoring(true);
    try {
      const restored = await restoreNote(activeNote.id);
      setActiveNote(restored);
      setNotes((prev) => [restored, ...prev.filter((n) => n.id !== restored.id)]);
      setViewState("ready");
    } catch {
      setError(NOTE_COPY.saveError);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>노트</h1>
        <button
          type="button"
          className={styles.newBtn}
          onClick={() => void handleNewNote()}
          disabled={saving}
        >
          {NOTE_COPY.newNote}
        </button>
      </header>

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={() => void loadList()}
          retryLabel={NOTE_COPY.retry}
        />
      ) : null}

      {viewState === "loading" ? (
        <div className={styles.loading}>
          <SkeletonBlock lines={8} />
        </div>
      ) : null}

      {viewState === "empty" ? (
        <EmptyState
          message={NOTE_COPY.empty}
          primaryAction={{ label: NOTE_COPY.capture, onClick: () => openCapture("note") }}
          secondaryAction={{ label: NOTE_COPY.newNote, onClick: () => void handleNewNote() }}
        />
      ) : null}

      {viewState === "error" && !error ? (
        <ErrorBanner
          message={NOTE_COPY.loadError}
          onRetry={() => void loadList()}
          retryLabel={NOTE_COPY.retry}
        />
      ) : null}

      {viewState === "ready" ? (
        <div className={styles.workspace}>
          <NotesExplorer
            notes={notes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className={styles.editorColumn}>
            {trashed && activeNote?.trashedAt ? (
              <TrashBanner
                trashedAt={activeNote.trashedAt}
                onRestore={() => void handleRestore()}
                restoring={restoring}
              />
            ) : null}
            <NoteEditor
              note={activeNote}
              draftTitle={draftTitle}
              draftBody={draftBody}
              dirty={dirty}
              saving={saving}
              trashed={trashed}
              onChangeTitle={setDraftTitle}
              onChangeBody={setDraftBody}
              onSave={() => void handleSave()}
              onTrash={() => void handleTrash()}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
