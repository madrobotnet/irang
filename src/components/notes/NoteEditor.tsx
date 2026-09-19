"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Note } from "@/lib/notes/types";
import { NOTE_COPY } from "./copy";
import styles from "./NoteEditor.module.css";

export type NoteEditorProps = {
  note: Note | null;
  draftTitle: string;
  draftBody: string;
  dirty: boolean;
  saving: boolean;
  trashed: boolean;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  onSave: () => void;
  onTrash: () => void;
};

export function NoteEditor({
  note,
  draftTitle,
  draftBody,
  dirty,
  saving,
  trashed,
  onChangeTitle,
  onChangeBody,
  onSave,
  onTrash,
}: NoteEditorProps) {
  const canSave =
    !saving &&
    !trashed &&
    draftTitle.trim().length > 0 &&
    draftBody.trim().length > 0 &&
    dirty;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      onSaveRef.current();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const readOnly = trashed;

  if (!note) {
    return (
      <div className={styles.placeholder}>
        <p>목록에서 노트를 선택하거나 새 노트를 만드세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          {!trashed ? (
            <button
              type="button"
              className={styles.trashBtn}
              onClick={onTrash}
              disabled={saving}
            >
              {NOTE_COPY.trash}
            </button>
          ) : null}
          {!trashed ? (
            <button
              type="button"
              className={styles.saveBtn}
              onClick={onSave}
              disabled={!canSave}
              aria-busy={saving}
            >
              {saving ? "저장 중…" : NOTE_COPY.save}
            </button>
          ) : null}
        </div>
      </div>

      <input
        className={styles.titleInput}
        value={draftTitle}
        onChange={(e) => onChangeTitle(e.target.value)}
        placeholder={NOTE_COPY.titlePlaceholder}
        disabled={readOnly || saving}
        aria-label={NOTE_COPY.titlePlaceholder}
      />
      <textarea
        className={styles.bodyInput}
        value={draftBody}
        onChange={(e) => onChangeBody(e.target.value)}
        placeholder={NOTE_COPY.bodyPlaceholder}
        disabled={readOnly || saving}
        aria-label={NOTE_COPY.bodyPlaceholder}
      />
    </div>
  );
}
