import Link from "next/link";
import { HOME_TOP3_TARGETS } from "@/lib/home/dto";
import styles from "./HomeTop3.module.css";

type HomeTop3Props = {
  inboxCount?: number | null;
  /** When true, Inbox door is the active segment (home route). */
  homeActive?: boolean;
};

export function HomeTop3({ inboxCount = null, homeActive = true }: HomeTop3Props) {
  const badge = inboxCount !== null && inboxCount > 0 ? inboxCount : null;

  return (
    <nav className={styles.top3} aria-label="바로가기">
      {HOME_TOP3_TARGETS.map((card) => {
        const onHome = homeActive && card.id === "inbox";
        const className = onHome ? `${styles.door} ${styles.doorActive}` : styles.door;
        return (
          <Link
            key={card.href}
            href={card.href}
            className={className}
            aria-current={onHome ? "page" : undefined}
          >
            <span>{card.label}</span>
            {card.id === "inbox" && badge !== null ? (
              <span className={styles.badge} aria-label={`미처리 ${badge}`}>
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
