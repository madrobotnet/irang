"use client";

import { PwaInstallSettingsRow } from "@/components/pwa/PwaInstallSettingsRow";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import { PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import { settingsInstallView } from "@/lib/pwa/install-ui";
import styles from "./SettingsScreen.module.css";

const NAV = ["일반", PWA_INSTALL_COPY.settings_nav, "보안", "정보"] as const;

export function SettingsScreen() {
  const { signals, promptInstall, dismiss } = usePwaInstall();
  const view = settingsInstallView(signals);

  return (
    <div className={styles.page}>
      <aside className={styles.rail} aria-label="설정">
        <p className={styles.railLabel}>설정</p>
        <nav className={styles.nav}>
          {NAV.map((label) => (
            <span
              key={label}
              className={label === PWA_INSTALL_COPY.settings_nav ? styles.navActive : styles.navItem}
              aria-current={label === PWA_INSTALL_COPY.settings_nav ? "page" : undefined}
            >
              {label}
            </span>
          ))}
        </nav>
      </aside>
      <div className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.heading}>{PWA_INSTALL_COPY.settings_nav}</h1>
          <p className={styles.lead}>{PWA_INSTALL_COPY.body_desk}</p>
        </header>
        <PwaInstallSettingsRow view={view} onAdd={promptInstall} onHideBanner={dismiss} />
      </div>
    </div>
  );
}
