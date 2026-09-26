"use client";

import { useRouter } from "next/navigation";
import { goStackBack, MOBILE_NAV_COPY } from "./mobile-nav";
import styles from "./BackButton.module.css";

export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className={styles.button}
      aria-label={MOBILE_NAV_COPY.back}
      data-back-button=""
      onClick={() => goStackBack(router, window.history)}
    >
      <span className={styles.chev} aria-hidden="true">
        ‹
      </span>
      <span className={styles.label}>{MOBILE_NAV_COPY.back}</span>
    </button>
  );
}
