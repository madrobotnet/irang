import Link from "next/link";
import styles from "./HomeTop3.module.css";

const CARDS = [
  { href: "/search", label: "검색" },
  { href: "/inbox", label: "Inbox" },
  { href: "/chat", label: "AI 채팅" },
] as const;

export function HomeTop3() {
  return (
    <nav className={styles.top3} aria-label="바로가기">
      {CARDS.map((card) => (
        <Link key={card.href} href={card.href} className={styles.card}>
          {card.label}
        </Link>
      ))}
    </nav>
  );
}
