"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deskIconFor, IconSearch } from "./DeskIcons";
import { DESK_DOCK_NAV, deskNavActive } from "./desk-nav";
import styles from "./DeskDock.module.css";

export function DeskDock() {
  const pathname = usePathname();

  return (
    <nav className={styles.dock} aria-label="하단 도크">
      {DESK_DOCK_NAV.map((item) => {
        if (item.id === "search") {
          const active = deskNavActive(pathname, item.href);
          return (
            <div key={item.id} className={styles.fabSlot}>
              <Link
                href={item.href}
                className={styles.fab}
                aria-current={active ? "page" : undefined}
                aria-label="검색"
              >
                <IconSearch />
              </Link>
              <span className={styles.fabLabel}>{item.label}</span>
            </div>
          );
        }
        const active = deskNavActive(pathname, item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={active ? `${styles.slot} ${styles.slotActive}` : styles.slot}
            aria-current={active ? "page" : undefined}
          >
            {deskIconFor(item.id)}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
