import { GRAPH_COPY } from "@/lib/graph/copy";
import styles from "./GraphEmpty.module.css";

type GraphEmptyProps = {
  onCapture: () => void;
};

export function GraphEmpty({ onCapture }: GraphEmptyProps) {
  return (
    <div className={styles.empty} data-graph-empty="true">
      <span className={styles.orb} aria-hidden="true" />
      <p className={styles.sentence}>{GRAPH_COPY.empty}</p>
      <p className={styles.hint}>{GRAPH_COPY.emptyHint}</p>
      <button type="button" className={styles.cta} onClick={onCapture}>
        {GRAPH_COPY.capture}
      </button>
    </div>
  );
}
