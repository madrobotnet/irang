"use client";

import { daysUntilPurge } from "@/lib/notes/client-api";
import { NOTE_COPY } from "./copy";
import styles from "./TrashBanner.module.css";

type TrashBannerProps = {
  deletedAt: string;
  purgeAt: string | null;
  onRestore: () => void;
  restoring?: boolean;
};

export function TrashBanner({ deletedAt, purgeAt, onRestore, restoring }: TrashBannerProps) {
  const days = daysUntilPurge(purgeAt, deletedAt);

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
