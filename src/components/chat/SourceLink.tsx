import Link from "next/link";
import type { CitationView } from "./parse";
import { noteHref } from "./scope";
import styles from "./ChatScreen.module.css";

type SourceLinkProps = {
  citation: CitationView;
};

export function SourceLink({ citation }: SourceLinkProps) {
  return (
    <Link
      href={noteHref(citation.noteId)}
      className={styles.source}
      data-source-link={citation.noteId}
    >
      <span className={styles.sourceTitle}>{citation.title}</span>
      <span className={styles.sourcePath}>{citation.path}</span>
    </Link>
  );
}
