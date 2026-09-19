"use client";

import { daysUntilTrashPurge } from "@/lib/notes/client-api";
import { NOTE_COPY } from "./copy";
import styles from "./TrashBanner.module.css";

type TrashBannerProps = {
  trashedAt: string;
  onRestore: () => void;
  restoring?: boolean;
};

export function TrashBanner({ trashedAt, onRestore, restoring }: TrashBannerProps) {
  const days = daysUntilTrashPurge(trashedAt);

  return (
    <div className={styles.banner} role="status">
      <span>{NOTE_COPY.trashBanner(days)}</span>
      <button
        type="button"
        className={styles.restore}
        onClick={onRestore}
        disabled={restoring}
      >
        {restoring ? "…" : NOTE_COPY.restore}
      </button>
    </div>
  );
}
