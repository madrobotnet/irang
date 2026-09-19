import Link from "next/link";
import styles from "./PlaceholderPage.module.css";

type PlaceholderPageProps = {
  title: string;
  description: string;
  moreLinks?: { href: string; label: string }[];
};

export function PlaceholderPage({
  title,
  description,
  moreLinks,
}: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lead}>{description}</p>
      {moreLinks && moreLinks.length > 0 ? (
        <nav className={styles.links} aria-label="더보기 메뉴">
          {moreLinks.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
