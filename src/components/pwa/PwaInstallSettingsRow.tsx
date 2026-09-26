"use client";

import { PWA_ICON_192_SRC, PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import type { SettingsInstallView } from "@/lib/pwa/install-ui";
import { PwaInstallBanner } from "./PwaInstallBanner";
import styles from "./PwaInstallSettingsRow.module.css";

type PwaInstallSettingsRowProps = {
  view: SettingsInstallView;
  onAdd: () => void;
  onHideBanner: () => void;
};

export function PwaInstallSettingsRow({ view, onAdd, onHideBanner }: PwaInstallSettingsRowProps) {
  const mode = view.state === "ios-share-hint" ? "ios" : "prompt";
  const title =
    view.offer === "installed" ? PWA_INSTALL_COPY.status_installed : PWA_INSTALL_COPY.title;
  const meta = view.showIosHint
    ? PWA_INSTALL_COPY.ios_hint
    : view.offer === "installed"
      ? null
      : view.status;

  return (
    <section
      className={styles.block}
      data-pwa-install="settings"
      data-pwa-offer={view.offer}
      aria-label={PWA_INSTALL_COPY.settings_nav}
    >
      {view.showBanner ? (
        <PwaInstallBanner mode={mode} onAdd={onAdd} onDismiss={onHideBanner} />
      ) : null}
      <div className={styles.card}>
        <div className={styles.row}>
          <img className={styles.icon} src={PWA_ICON_192_SRC} alt="" width={192} height={192} />
          <div className={styles.copy}>
            <p className={styles.title}>{title}</p>
            {meta ? <p className={styles.meta}>{meta}</p> : null}
          </div>
          {view.pill ? <span className={styles.pill}>{view.pill}</span> : null}
          {view.showCta ? (
            <button type="button" className={styles.cta} data-pwa-cta="install" onClick={onAdd}>
              {PWA_INSTALL_COPY.cta}
            </button>
          ) : null}
        </div>
        {view.showHideBanner ? (
          <div className={`${styles.row} ${styles.rowHide}`}>
            <span className={styles.hideMark} aria-hidden="true" />
            <div className={styles.copy}>
              <p className={styles.title}>{PWA_INSTALL_COPY.hide_banner}</p>
            </div>
            <button type="button" className={styles.hide} onClick={onHideBanner}>
              {PWA_INSTALL_COPY.hide_banner}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
