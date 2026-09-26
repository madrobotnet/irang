"use client";

import { PWA_ICON_192_SRC, PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import type { HomeInstallMode } from "@/lib/pwa/install-ui";
import styles from "./PwaInstallSheet.module.css";

type PwaInstallSheetProps = {
  mode: HomeInstallMode;
  onAdd: () => void;
  onDismiss: () => void;
};

export function PwaInstallSheet({ mode, onAdd, onDismiss }: PwaInstallSheetProps) {
  return (
    <div
      className={styles.scrim}
      data-pwa-install="sheet"
      data-pwa-mode={mode}
      onClick={onDismiss}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.hero}>
          <img
            className={styles.icon}
            src={PWA_ICON_192_SRC}
            alt=""
            width={192}
            height={192}
          />
          <div>
            <h2 id="pwa-install-sheet-title" className={styles.title}>
              {PWA_INSTALL_COPY.title}
            </h2>
            <p className={styles.body}>{PWA_INSTALL_COPY.body_mob}</p>
          </div>
        </div>
        <ul className={styles.benefits}>
          <li>{PWA_INSTALL_COPY.benefit_1}</li>
          <li>{PWA_INSTALL_COPY.benefit_2}</li>
          <li>{PWA_INSTALL_COPY.benefit_3}</li>
        </ul>
        {mode === "ios" ? <p className={styles.hint}>{PWA_INSTALL_COPY.ios_hint}</p> : null}
        {mode === "prompt" ? (
          <button type="button" className={styles.cta} data-pwa-cta="install" onClick={onAdd}>
            {PWA_INSTALL_COPY.cta}
          </button>
        ) : null}
        <button type="button" className={styles.later} onClick={onDismiss}>
          {PWA_INSTALL_COPY.dismiss}
        </button>
      </div>
    </div>
  );
}
