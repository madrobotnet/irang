"use client";

import { INBOX_COPY } from "./copy";
import styles from "./PromoteSheet.module.css";

type DiscardConfirmProps = {
  busy: boolean;
  error: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DiscardConfirm({ busy, error, onConfirm, onCancel }: DiscardConfirmProps) {
  return (
    <div className={styles.backdrop} onClick={busy ? undefined : onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-confirm-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onCancel();
        }}
      >
        <h2 id="discard-confirm-title" className={styles.question}>
          {INBOX_COPY.discardConfirm}
        </h2>
        {error ? (
          <div aria-live="assertive">
            <p className={styles.warn} role="alert">
              {INBOX_COPY.discardFail}
            </p>
          </div>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.danger} onClick={onConfirm} disabled={busy}>
            {INBOX_COPY.discard}
          </button>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>
            {INBOX_COPY.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
