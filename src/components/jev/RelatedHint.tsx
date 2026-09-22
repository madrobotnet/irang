import Link from "next/link";
import type { DuplicateHintDto } from "@/lib/jev/capture-types";
import { JEV_COPY } from "./copy";
import styles from "./RelatedHint.module.css";

type RelatedHintProps = {
  hint: DuplicateHintDto;
};

export function RelatedHint({ hint }: RelatedHintProps) {
  if (!hint.relatedNoteId) return null;

  const pct = Math.round(hint.confidence * 100);
  const uncertain = hint.confidence < 0.55;

  return (
    <div className={styles.row} role="status">
      <p className={styles.lead}>{JEV_COPY.relatedHint}</p>
      <span className={styles.meta}>
        신뢰도 {pct}%
        {uncertain ? ` · ${JEV_COPY.uncertain}` : ""}
      </span>
      <Link href="/notes" className={styles.link}>
        {JEV_COPY.viewRelated}
      </Link>
    </div>
  );
}
