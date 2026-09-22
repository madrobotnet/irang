"use client";

import { INBOX_COPY } from "./copy";
import styles from "./IngestFailBadge.module.css";

type IngestFailBadgeProps = {
  open: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onConfirm: () => void;
};

export function IngestFailBadge({ open, onToggle, onRetry, onConfirm }: IngestFailBadgeProps) {
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.badge}
        aria-expanded={open}
        onClick={onToggle}
      >
        {INBOX_COPY.ingestFail}
      </button>
      {open ? (
        <div className={styles.panel} role="group" aria-label={INBOX_COPY.ingestFail}>
          <button type="button" className={styles.action} onClick={onRetry}>
            {INBOX_COPY.retry}
          </button>
          <button type="button" className={styles.action} onClick={onConfirm}>
            {INBOX_COPY.ingestConfirm}
          </button>
        </div>
      ) : null}
    </div>
  );
}
