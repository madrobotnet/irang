"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deskIconFor, IconSettings } from "./DeskIcons";
import { DESK_RAIL_NAV, deskNavActive } from "./desk-nav";
import styles from "./DeskRail.module.css";

export function DeskRail() {
  const pathname = usePathname();

  return (
    <nav className={styles.rail} aria-label="유틸 레일">
      <div className={styles.mark} aria-hidden="true">SB</div>
      {DESK_RAIL_NAV.map((item) => {
        const active = deskNavActive(pathname, item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? `${styles.item} ${styles.itemActive}` : styles.item}
            aria-current={active ? "page" : undefined}
          >
            {deskIconFor(item.id)}
            <span>{item.label}</span>
          </Link>
        );
      })}
      <div className={styles.spacer} />
      <Link href="/settings" className={styles.settings} aria-label="설정">
        <IconSettings />
      </Link>
      <div className={styles.avatar} aria-hidden="true" />
    </nav>
  );
}
