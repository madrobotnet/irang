"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  MOBILE_NAV_COPY,
  MORE_SHEET_LINKS,
  MORE_SHEET_LOGOUT_ACTION,
} from "./mobile-nav";
import styles from "./MoreSheet.module.css";

type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className={styles.scrim}
        aria-label={MOBILE_NAV_COPY.closeMenu}
        onClick={onClose}
      />
      <div
        className={styles.sheet}
        role="dialog"
        aria-label={MOBILE_NAV_COPY.menu}
        aria-modal="true"
        data-more-sheet="open"
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.title}>{MOBILE_NAV_COPY.menu}</div>
        {MORE_SHEET_LINKS.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className={styles.row}
            onClick={onClose}
          >
            <span className={styles.glyph} aria-hidden="true">
              {row.glyph}
            </span>
            {row.label}
            <span className={styles.chev} aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
        <div className={styles.hairline} />
        <form method="post" action={MORE_SHEET_LOGOUT_ACTION} className={styles.logout}>
          <button type="submit" className={`${styles.row} ${styles.danger}`}>
            <span className={styles.glyph} aria-hidden="true">
              ⎋
            </span>
            {MOBILE_NAV_COPY.logout}
          </button>
        </form>
      </div>
    </>
  );
}
