import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import { ConfidenceMeter } from "@/components/jev/ConfidenceMeter";
import { CHAT_COPY } from "./copy";
import type { ChatMessageView } from "./parse";
import { SourceLink } from "./SourceLink";
import styles from "./ChatScreen.module.css";

type CitationPanelProps = {
  message: ChatMessageView | null;
  activeIndex: number | null;
};

export function CitationPanel({ message, activeIndex }: CitationPanelProps) {
  const citations = message?.citations ?? [];
  return (
    <aside className={styles.panel} aria-label={CHAT_COPY.citations} data-citation-panel="open" data-citation-count={citations.length}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{CHAT_COPY.citations}</h2>
        {citations.length === 0 ? (
          <span className={styles.warnChip} data-no-citations="true">
            {CHAT_COPY.noCitations}
          </span>
        ) : null}
      </div>
      {citations.length > 0 ? (
        <ol className={styles.citeList}>
          {citations.map((citation) => {
            const active = activeIndex === citation.index;
            const low =
              citation.confidence !== null && citation.confidence < JEV_LOW_CONFIDENCE_THRESHOLD;
            return (
              <li
                key={`${citation.noteId}-${citation.index}`}
                id={`citation-${citation.index}`}
                className={active ? styles.citeRowActive : styles.citeRow}
                data-citation-index={citation.index}
                data-active={active ? "true" : "false"}
              >
                <span className={styles.index}>[{citation.index}]</span>
                <SourceLink citation={citation} />
                {citation.snippet ? <p className={styles.snippet}>{citation.snippet}</p> : null}
                <ConfidenceMeter confidence={citation.confidence} />
                {low ? <p className={styles.low}>{CHAT_COPY.lowConfidence}</p> : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </aside>
  );
}
