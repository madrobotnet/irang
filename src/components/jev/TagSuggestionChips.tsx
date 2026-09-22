"use client";

import { useMemo, useState } from "react";
import type { TagSuggestionDto } from "@/lib/jev/capture-types";
import { JEV_COPY } from "./copy";
import styles from "./TagSuggestionChips.module.css";

type TagSuggestionChipsProps = {
  tags: TagSuggestionDto[];
  /** Capture writes tags from this row. Inbox leaves approval to PromoteSheet. */
  onApply?: (selected: string[]) => void;
  onSkip?: () => void;
  /** Parent-owned selection. Hides the inline apply/skip row. */
  selected?: readonly string[];
  onToggle?: (tag: string) => void;
};

export function TagSuggestionChips({
  tags,
  onApply,
  onSkip,
  selected: selectedProp,
  onToggle,
}: TagSuggestionChipsProps) {
  const [internal, setInternal] = useState<Set<string>>(() => new Set());
  const controlled = selectedProp !== undefined;
  const selected = controlled ? new Set(selectedProp) : internal;

  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.probability - a.probability),
    [tags],
  );

  if (sorted.length === 0) return null;

  const toggle = (tag: string) => {
    onToggle?.(tag);
    if (controlled) return;
    setInternal((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className={styles.root}>
      <span className={styles.label}>제안 태그</span>
      <div className={styles.chips} role="group" aria-label="제안 태그">
        {sorted.map((item) => {
          const on = selected.has(item.tag);
          return (
            <button
              key={item.tag}
              type="button"
              className={on ? styles.chipSelected : styles.chip}
              onClick={() => toggle(item.tag)}
              aria-pressed={on}
            >
              {item.tag}
              <span className={styles.prob}>{Math.round(item.probability * 100)}%</span>
            </button>
          );
        })}
      </div>
      {controlled || !onApply || !onSkip ? null : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.apply}
            disabled={selected.size === 0}
            onClick={() => onApply([...selected])}
          >
            {JEV_COPY.applyTags}
          </button>
          <button type="button" className={styles.skip} onClick={onSkip}>
            {JEV_COPY.skipTags}
          </button>
        </div>
      )}
    </div>
  );
}
