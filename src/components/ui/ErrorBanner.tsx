"use client";

import styles from "./ErrorBanner.module.css";

type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = "다시",
}: ErrorBannerProps) {
  return (
    <div className={styles.banner} role="alert">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
