import { evidenceChatHref } from "@/lib/search/href";
import type { SearchRow } from "@/lib/search/project";
import { SEARCH_COPY } from "./copy";
import { ResultRow } from "./ResultRow";
import styles from "./SearchScreen.module.css";

type EvidencePickerProps = {
  rows: SearchRow[];
  selected: readonly string[];
  chatReady: boolean;
  onToggle: (id: string) => void;
};

export function EvidencePicker({ rows, selected, chatReady, onToggle }: EvidencePickerProps) {
  return (
    <div className={styles.evidence}>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.noteId}>
            <ResultRow
              row={row}
              checked={selected.includes(row.noteId)}
              selected={selected}
              siblings={rows
                .filter((item) => item.noteId !== row.noteId)
                .map((item) => ({ noteId: item.noteId, title: item.title }))}
              onToggle={onToggle}
            />
          </li>
        ))}
      </ul>
      {chatReady ? (
        <a href={evidenceChatHref(selected)} className={styles.primary} data-evidence-cta="ready">
          {SEARCH_COPY.evidenceCta}
        </a>
      ) : (
        <button type="button" className={styles.primary} disabled data-evidence-cta="disabled">
          {SEARCH_COPY.evidenceCta}
        </button>
      )}
    </div>
  );
}
