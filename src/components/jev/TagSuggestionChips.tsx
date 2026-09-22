"use client";

import { useMemo, useState } from "react";
import type { TagSuggestionDto } from "@/lib/jev/capture-types";
import { JEV_COPY } from "./copy";
import styles from "./TagSuggestionChips.module.css";

type TagSuggestionChipsProps = {
  tags: TagSuggestionDto[];
  onApply: (selected: string[]) => void;
  onSkip: () => void;
};

export function TagSuggestionChips({ tags, onApply, onSkip }: TagSuggestionChipsProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.probability - a.probability),
    [tags],
  );

  if (sorted.length === 0) return null;

  const toggle = (tag: string) => {
    setSelected((prev) => {
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
    </div>
  );
}
