import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import type { SearchRow } from "@/lib/search/project";
import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter";
import { JEV_COPY } from "@/components/jev/copy";
import { SEARCH_COPY } from "./copy";
import styles from "./SearchScreen.module.css";

type ResultRowProps = {
  row: SearchRow;
  checked: boolean;
  selected: readonly string[];
  siblings: readonly { noteId: string; title: string }[];
  onToggle: (id: string) => void;
};

export function ResultRow({ row, checked, selected, siblings, onToggle }: ResultRowProps) {
  const lowConfidence =
    (row.relevance !== null && row.relevance < JEV_LOW_CONFIDENCE_THRESHOLD) ||
    (row.similarity !== null && row.similarity < JEV_LOW_CONFIDENCE_THRESHOLD);

  return (
    <article className={styles.row} data-result-id={row.noteId}>
      <label className={styles.check}>
        <input type="checkbox" checked={checked} onChange={() => onToggle(row.noteId)} />
        <span className="sr-only">
          {SEARCH_COPY.pickEvidence} {row.title}
        </span>
      </label>
      <div className={styles.rowBody}>
        <h2 className={styles.rowTitle}>{row.title}</h2>
        <p className={styles.path}>{row.path}</p>
        {row.snippet ? <p className={styles.snippet}>{row.snippet}</p> : null}
        <ConfidenceMeter confidence={row.probability} />
        {row.relevance !== null ? (
          <div className={styles.relevance}>
            <span className={styles.relevanceLabel}>{SEARCH_COPY.relevance}</span>
            <ConfidenceMeter confidence={row.relevance} />
          </div>
        ) : null}
        {row.similarity !== null ? (
          <div className={styles.similar}>
            <span className={styles.similarLabel}>{SEARCH_COPY.similar}</span>
            <ConfidenceMeter confidence={row.similarity} />
            {row.similarityLabel ? <span className={styles.chipStatic}>{row.similarityLabel}</span> : null}
          </div>
        ) : null}
        {lowConfidence ? <p className={styles.low}>{JEV_COPY.lowConfidence}</p> : null}
        {siblings.length > 0 ? (
          <div className={styles.similar}>
            <span className={styles.similarLabel}>{SEARCH_COPY.similarNotes}</span>
            <div className={styles.chips} role="list">
              {siblings.map((note) => {
                const pressed = selected.includes(note.noteId);
                return (
                  <button
                    key={note.noteId}
                    type="button"
                    role="listitem"
                    className={pressed ? styles.chipOn : styles.chip}
                    aria-pressed={pressed}
                    onClick={() => onToggle(note.noteId)}
                  >
                    {note.title}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
