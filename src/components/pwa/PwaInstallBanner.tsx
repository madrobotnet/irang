"use client";

import { PWA_ICON_192_SRC, PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import type { HomeInstallMode } from "@/lib/pwa/install-ui";
import styles from "./PwaInstallBanner.module.css";

type PwaInstallBannerProps = {
  mode: HomeInstallMode;
  onAdd: () => void;
  onDismiss: () => void;
};

export function PwaInstallBanner({ mode, onAdd, onDismiss }: PwaInstallBannerProps) {
  return (
    <div
      className={styles.banner}
      data-pwa-install="banner"
      data-pwa-mode={mode}
      role="region"
      aria-label={PWA_INSTALL_COPY.banner_title}
    >
      <img
        className={styles.icon}
        src={PWA_ICON_192_SRC}
        alt=""
        width={192}
        height={192}
      />
      <div className={styles.copy}>
        <p className={styles.title}>{PWA_INSTALL_COPY.banner_title}</p>
        <p className={styles.sub}>{PWA_INSTALL_COPY.banner_sub}</p>
        {mode === "ios" ? <p className={styles.hint}>{PWA_INSTALL_COPY.ios_hint}</p> : null}
      </div>
      <div className={styles.actions}>
        {mode === "prompt" ? (
          <button type="button" className={styles.add} data-pwa-cta="add" onClick={onAdd}>
            {PWA_INSTALL_COPY.banner_add}
          </button>
        ) : null}
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label={PWA_INSTALL_COPY.dismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
