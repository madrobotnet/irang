"use client";

import type { TagSuggestionDto } from "@/lib/jev/capture-types";
import { TagSuggestionChips } from "@/components/jev/TagSuggestionChips";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { CHAT_COPY } from "@/components/chat/copy";
import styles from "./AiApproveModal.module.css";

type AiApproveModalProps = {
  noteLabel: string;
  proposedTitle: string;
  proposedBody: string;
  tags?: TagSuggestionDto[];
  selectedTags?: readonly string[];
  pending?: boolean;
  error?: string | null;
  onToggleTag?: (tag: string) => void;
  onApprove: () => void;
  onCancel: () => void;
};

/** Existing-note overwrite. Nothing is written until approve. */
export function AiApproveModal({
  noteLabel,
  proposedTitle,
  proposedBody,
  tags = [],
  selectedTags = [],
  pending = false,
  error = null,
  onToggleTag,
  onApprove,
  onCancel,
}: AiApproveModalProps) {
  return (
    <div className={styles.backdrop} onClick={pending ? undefined : onCancel}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-approve-title"
        data-ai-approve="open"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !pending) onCancel();
        }}
      >
        <h2 id="ai-approve-title" className={styles.heading}>
          {CHAT_COPY.approve}
        </h2>
        <p className={styles.note}>{noteLabel}</p>
        {error ? <ErrorBanner message={error} /> : null}
        <div className={styles.fields}>
          <p className={styles.preview}>{proposedTitle}</p>
          <p className={styles.preview}>{proposedBody}</p>
        </div>
        <TagSuggestionChips tags={[...tags]} selected={selectedTags} onToggle={onToggleTag} />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={onApprove} disabled={pending}>
            {CHAT_COPY.approve}
          </button>
          <button type="button" className={styles.secondary} onClick={onCancel} disabled={pending}>
            {CHAT_COPY.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
