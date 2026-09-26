"use client";

import { BackButton } from "./BackButton";
import { MOBILE_NAV_COPY } from "./mobile-nav";
import { MoreMenuButton } from "./MoreMenuButton";
import styles from "./MobileStackHeader.module.css";

type MobileStackHeaderProps = {
  title: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
};

export function MobileStackHeader({
  title,
  menuOpen,
  onToggleMenu,
}: MobileStackHeaderProps) {
  return (
    <header
      className={styles.header}
      aria-label={MOBILE_NAV_COPY.stackHeader}
      data-mobile-stack-header=""
    >
      <BackButton />
      <div className={styles.title}>{title}</div>
      <MoreMenuButton expanded={menuOpen} onClick={onToggleMenu} />
    </header>
  );
}
