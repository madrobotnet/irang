import styles from "./SkeletonBlock.module.css";

type SkeletonBlockProps = {
  className?: string;
  lines?: number;
};

export function SkeletonBlock({ className, lines = 1 }: SkeletonBlockProps) {
  const count = Math.max(1, lines);
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={styles.line}
          style={i === count - 1 && count > 1 ? { width: "72%" } : undefined}
        />
      ))}
    </div>
  );
}
