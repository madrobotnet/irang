"use client";

import { HOME_COPY } from "./copy";
import type { InstallOffer } from "./home-model";
import styles from "./InstallBanner.module.css";

type InstallBannerProps = {
  offer: Exclude<InstallOffer, { kind: "hidden" }>;
  onInstall: () => void;
  onDismiss: () => void;
};

export function InstallBanner({ offer, onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div className={styles.banner} role="region" aria-label={HOME_COPY.install}>
      <div className={styles.copy}>
        <p className={styles.title}>{HOME_COPY.install}</p>
        {offer.kind === "ios" ? <p className={styles.hint}>{HOME_COPY.installIos}</p> : null}
      </div>
      <div className={styles.actions}>
        {offer.kind === "prompt" ? (
          <button type="button" className={styles.install} onClick={onInstall}>
            {HOME_COPY.install}
          </button>
        ) : null}
        <button type="button" className={styles.later} onClick={onDismiss}>
          {HOME_COPY.installDismiss}
        </button>
      </div>
    </div>
  );
}
