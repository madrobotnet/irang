"use client";

import { MOBILE_NAV_COPY } from "./mobile-nav";
import { MoreMenuButton } from "./MoreMenuButton";
import styles from "./MobileTopChrome.module.css";

type MobileTopChromeProps = {
  menuOpen: boolean;
  onToggleMenu: () => void;
};

export function MobileTopChrome({ menuOpen, onToggleMenu }: MobileTopChromeProps) {
  return (
    <header className={styles.chrome} aria-label={MOBILE_NAV_COPY.topChrome} data-mobile-top-chrome="">
      <span className={styles.mark} aria-hidden="true" />
      <MoreMenuButton expanded={menuOpen} onClick={onToggleMenu} />
    </header>
  );
}
