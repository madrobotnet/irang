"use client";

import { MOBILE_NAV_COPY } from "./mobile-nav";
import styles from "./MoreMenuButton.module.css";

type MoreMenuButtonProps = {
  expanded: boolean;
  onClick: () => void;
};

export function MoreMenuButton({ expanded, onClick }: MoreMenuButtonProps) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-label={MOBILE_NAV_COPY.menu}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      onClick={onClick}
    >
      ⋯
    </button>
  );
}
