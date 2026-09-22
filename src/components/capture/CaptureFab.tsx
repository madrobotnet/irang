"use client";

import { useCapture } from "./CaptureContext";
import { CAPTURE_COPY } from "./copy";
import styles from "./CaptureFab.module.css";

export function CaptureFab() {
  const { openCapture } = useCapture();

  return (
    <button
      type="button"
      className={styles.fab}
      onClick={() => openCapture("inbox")}
      aria-label={CAPTURE_COPY.fab}
    >
      {CAPTURE_COPY.fab}
    </button>
  );
}
