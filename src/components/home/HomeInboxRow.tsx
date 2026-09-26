import Link from "next/link";
import type { InboxSource } from "@/lib/inbox/types";
import { formatHomeInboxWhen } from "./format-home-time";
import type { HomeInboxRowView } from "./home-inbox-rows-ui";
import { inboxPreviewMetaDesktop, inboxPreviewMetaMobile } from "./inbox-preview-meta";
import styles from "./HomeView.module.css";

type HomeInboxRowProps = {
  row: HomeInboxRowView;
};

function rowIconClass(source: InboxSource): string {
  if (source === "share" || source === "file") return styles.icoDoc;
  if (source === "web" || source === "url") return styles.icoLink;
  return styles.icoIdea;
}

export function HomeInboxRow({ row }: HomeInboxRowProps) {
  const when = formatHomeInboxWhen(row.createdAt);
  const deskMeta = inboxPreviewMetaDesktop(row);
  const mobMeta = inboxPreviewMetaMobile(row, when);

  return (
    <li>
      <Link className={styles.row} href="/inbox">
        <span className={`${styles.rowIcon} ${rowIconClass(row.source)}`} aria-hidden="true" />
        <span className={styles.rowBody}>
          <span className={styles.rowTitle}>{row.title}</span>
          <span className={styles.rowMetaDesk}>
            <span className={styles.metaPill}>{deskMeta.pill}</span>
            {deskMeta.detail}
          </span>
          <span className={styles.rowMetaMob}>{mobMeta}</span>
        </span>
        <time className={styles.rowWhen} dateTime={row.createdAt}>{when}</time>
        <span className={styles.chev} aria-hidden="true">›</span>
      </Link>
    </li>
  );
}
