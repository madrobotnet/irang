"use client";

import { INBOX_COPY } from "./copy";
import styles from "./InboxScreen.module.css";

type EmptyStateProps = {
  onCapture: () => void;
};

export function EmptyState({ onCapture }: EmptyStateProps) {
  return (
    <div className={styles.empty} data-empty-state="true">
      <p className={styles.emptyText}>{INBOX_COPY.empty}</p>
      <button type="button" className={styles.emptyCapture} onClick={onCapture}>
        {INBOX_COPY.capture}
      </button>
    </div>
  );
}
