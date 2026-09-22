"use client";

import type { Note } from "@/lib/notes/types";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import styles from "./NotesExplorer.module.css";

type NotesExplorerProps = {
  notes: Note[];
  selectedId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
};

export function NotesExplorer({
  notes,
  selectedId,
  loading,
  onSelect,
}: NotesExplorerProps) {
  if (loading) {
    return (
      <aside className={styles.explorer} aria-label="노트 목록">
        <SkeletonBlock lines={6} />
      </aside>
    );
  }

  return (
    <aside className={styles.explorer} aria-label="노트 목록">
      <ul className={styles.list}>
        {notes.map((note) => {
          const active = note.id === selectedId;
          return (
            <li key={note.id}>
              <button
                type="button"
                className={active ? styles.itemActive : styles.item}
                onClick={() => onSelect(note.id)}
                aria-current={active ? "true" : undefined}
              >
                <span className={styles.itemTitle}>{note.title || "제목 없음"}</span>
                <span className={styles.itemPreview}>
                  {note.body.replace(/\s+/g, " ").slice(0, 48)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
