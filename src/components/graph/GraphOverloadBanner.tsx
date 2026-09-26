"use client";

import { GRAPH_COPY } from "@/lib/graph/copy";
import styles from "./GraphOverloadBanner.module.css";

type GraphOverloadBannerProps = {
  onDismiss: () => void;
};

export function GraphOverloadBanner({ onDismiss }: GraphOverloadBannerProps) {
  return (
    <div className={styles.banner} data-graph-overload="true" role="status">
      <p>{GRAPH_COPY.overload}</p>
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        {GRAPH_COPY.dismiss}
      </button>
    </div>
  );
}
