import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import { JEV_COPY } from "./copy";
import styles from "./ConfidenceMeter.module.css";

type ConfidenceMeterProps = {
  /** 0–1 */
  confidence: number | null;
};

function bandLabel(confidence: number): string {
  if (confidence < JEV_LOW_CONFIDENCE_THRESHOLD) return JEV_COPY.uncertain;
  if (confidence < 0.75) return "중";
  return "고";
}

export function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  if (confidence === null) return null;
  const pct = Math.round(confidence * 100);
  const low = confidence < JEV_LOW_CONFIDENCE_THRESHOLD;

  return (
    <div className={styles.meter} aria-label={`신뢰도 ${pct}%`}>
      <span>{bandLabel(confidence)}</span>
      <div className={styles.bar}>
        <div
          className={[styles.fill, low ? styles.low : ""].filter(Boolean).join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>{pct}%</span>
    </div>
  );
}
