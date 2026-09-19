"use client";

import type { CaptureJudgmentPayload } from "@/lib/jev/capture-types";
import {
  captureJudgmentConfidence,
  derivePostCaptureJevState,
  shouldShowDuplicateActions,
} from "@/lib/jev/jev-state";
import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter";
import { JevBadge } from "@/components/jev/JevBadge";
import { JEV_COPY } from "@/components/jev/copy";
import { RelatedHint } from "@/components/jev/RelatedHint";
import { TagSuggestionChips } from "@/components/jev/TagSuggestionChips";
import { CAPTURE_COPY } from "./copy";
import styles from "./CaptureJevPanel.module.css";

type CaptureJevPanelProps = {
  judgments: CaptureJudgmentPayload;
  onApplyTags: (tags: string[]) => void;
  onSkipTags: () => void;
  onDuplicateChoice: (choice: "merge" | "version" | "cancel") => void;
};

export function CaptureJevPanel({
  judgments,
  onApplyTags,
  onSkipTags,
  onDuplicateChoice,
}: CaptureJevPanelProps) {
  const jevState = derivePostCaptureJevState(judgments);
  const confidence = captureJudgmentConfidence(judgments);
  const showDup = shouldShowDuplicateActions(judgments.duplicateHint);

  return (
    <div className={styles.panel}>
      <div className={styles.jevHeader}>
        <JevBadge state={jevState} />
        <ConfidenceMeter confidence={confidence} />
      </div>

      {jevState === "jev_low_confidence" ? (
        <p className={styles.lowWarn} role="status">{JEV_COPY.lowConfidence}</p>
      ) : null}

      {judgments.duplicateHint ? (
        <RelatedHint hint={judgments.duplicateHint} />
      ) : null}

      {showDup ? (
        <div className={styles.duplicate} role="status">
          <p className={styles.duplicateLead}>{CAPTURE_COPY.duplicateTitle}</p>
          <div className={styles.duplicateActions}>
            <button type="button" onClick={() => onDuplicateChoice("merge")}>
              {CAPTURE_COPY.merge}
            </button>
            <button type="button" onClick={() => onDuplicateChoice("version")}>
              {CAPTURE_COPY.newVersion}
            </button>
            <button type="button" onClick={() => onDuplicateChoice("cancel")}>
              {CAPTURE_COPY.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <TagSuggestionChips
        tags={judgments.suggestions.tags}
        onApply={onApplyTags}
        onSkip={onSkipTags}
      />
    </div>
  );
}
