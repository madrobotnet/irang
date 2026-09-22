import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  message: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
};

export function EmptyState({
  message,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <p className={styles.message}>{message}</p>
      {(primaryAction || secondaryAction) && (
        <div className={styles.actions}>
          {primaryAction ? (
            <button type="button" className={styles.primary} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button type="button" className={styles.secondary} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
