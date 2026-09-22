"use client";

import type { Proposal } from "@/lib/inbox/types";
import { isLowConfidence } from "@/lib/inbox/judgment";
import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter";
import { JEV_COPY } from "@/components/jev/copy";
import { TagSuggestionChips } from "@/components/jev/TagSuggestionChips";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { INBOX_COPY } from "./copy";
import styles from "./PromoteSheet.module.css";

function jevFailureMessage(reason: "jev_error" | "key_missing"): string {
  if (reason === "key_missing") return JEV_COPY.keyMissing;
  return JEV_COPY.jevErrorRetry;
}

type PromoteSheetProps = {
  proposal: Proposal;
  promoting: boolean;
  promoteError: boolean;
  onToggleTag: (tag: string) => void;
  onApprove: () => void;
  onLater: () => void;
  onRetryJev: () => void;
  onRetryPromote: () => void;
};

export function PromoteSheet({
  proposal,
  promoting,
  promoteError,
  onToggleTag,
  onApprove,
  onLater,
  onRetryJev,
  onRetryPromote,
}: PromoteSheetProps) {
  const manual = proposal.mode === "manual";
  const low = !manual && isLowConfidence(proposal.confidence);
  const canApprove = proposal.title.trim().length > 0 && !promoting;
  const title = proposal.title.trim();
  const summary = proposal.summary.trim();

  return (
    <div className={styles.backdrop} onClick={promoting ? undefined : onLater}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="promote-sheet-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !promoting) onLater();
        }}
      >
        <h2 id="promote-sheet-title" className={styles.heading}>
          {manual ? INBOX_COPY.manualPromote : INBOX_COPY.promote}
        </h2>

        {proposal.jevError ? (
          <div aria-live="assertive">
            <ErrorBanner
              message={jevFailureMessage(proposal.jevError)}
              onRetry={onRetryJev}
              retryLabel={INBOX_COPY.retry}
            />
          </div>
        ) : null}

        {promoteError ? (
          <div aria-live="assertive">
            <ErrorBanner
              message={INBOX_COPY.promoteFail}
              onRetry={onRetryPromote}
              retryLabel={INBOX_COPY.retry}
            />
          </div>
        ) : null}

        <div className={styles.fields}>
          <div className={styles.label}>
            {INBOX_COPY.fieldTitle}
            <p className={styles.preview}>{title || INBOX_COPY.capture}</p>
          </div>
          {summary ? (
            <div className={styles.label}>
              {INBOX_COPY.fieldSummary}
              <p className={styles.preview}>{summary}</p>
            </div>
          ) : null}
        </div>

        {manual ? null : (
          <TagSuggestionChips
            tags={proposal.tags}
            selected={proposal.selectedTags}
            onToggle={onToggleTag}
          />
        )}

        {manual ? null : <ConfidenceMeter confidence={proposal.confidence} />}

        {low ? (
          <p className={styles.warn} role="status">
            {JEV_COPY.lowConfidence}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={onApprove}
            disabled={!canApprove}
          >
            {manual ? INBOX_COPY.manualPromote : INBOX_COPY.apply}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={onLater}
            disabled={promoting}
          >
            {INBOX_COPY.later}
          </button>
        </div>
      </div>
    </div>
  );
}
