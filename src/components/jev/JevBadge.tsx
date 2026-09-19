import type { JevUiState } from "@/lib/jev/jev-state";
import { JEV_COPY } from "./copy";
import styles from "./JevBadge.module.css";

type JevBadgeProps = {
  state: JevUiState;
};

export function JevBadge({ state }: JevBadgeProps) {
  if (state === "jev_idle" || state === "jev_loading") {
    return null;
  }

  const className =
    state === "jev_error" || state === "key_missing"
      ? styles.error
      : state === "jev_ready" || state === "jev_low_confidence"
        ? styles.on
        : styles.off;

  return (
    <span className={[styles.badge, className].join(" ")} aria-label={JEV_COPY.badgeOn}>
      {JEV_COPY.badgeOn}
    </span>
  );
}
