"use client";

import { GRAPH_COPY } from "@/lib/graph/copy";
import styles from "./GraphError.module.css";

type GraphErrorProps = {
  onRetry: () => void;
};

export function GraphError({ onRetry }: GraphErrorProps) {
  return (
    <div className={styles.error} data-graph-error="true" role="alert">
      <p className={styles.sentence}>{GRAPH_COPY.error}</p>
      <button type="button" className={styles.cta} onClick={onRetry}>
        {GRAPH_COPY.retry}
      </button>
    </div>
  );
}
