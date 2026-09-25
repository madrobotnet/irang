import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import type { HomePageModel, RecentNoteListItemDto } from "@/lib/home/dto";
import { formatInboxTime } from "@/components/inbox/format-time";
import { HOME_COPY } from "./copy";
import { HomeTop3 } from "./HomeTop3";
import { InstallBanner } from "./InstallBanner";
import {
  INBOX_PREVIEW_LIMIT,
  inboxBadgeCount,
  showInboxPreview,
  visibleRecentNotes,
  type InboxPreviewRow,
  type InstallOffer,
} from "./home-model";
import styles from "./HomeView.module.css";

export type HomeViewProps = {
  model: HomePageModel;
  preview: readonly InboxPreviewRow[];
  install: InstallOffer;
  onRetry: () => void;
  onCapture: () => void;
  onCommand: () => void;
  onInstall: () => void;
  onDismissInstall: () => void;
};

export function RecentNotesList({ notes }: { notes: readonly RecentNoteListItemDto[] }) {
  const visible = visibleRecentNotes(notes);
  return (
    <section className={styles.section} aria-label={HOME_COPY.recent}>
      <h2 className={styles.sectionTitle}>{HOME_COPY.recent}</h2>
      <ul className={styles.list}>
        {visible.map((note) => (
          <li key={note.id}>
            <Link className={styles.row} href={`/notes?note=${encodeURIComponent(note.id)}`}>
              <span className={styles.rowTitle}>{note.title}</span>
              <time className={styles.rowMeta} dateTime={note.updatedAt}>
                {formatInboxTime(note.updatedAt)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InboxPreview({ rows }: { rows: readonly InboxPreviewRow[] }) {
  const visible = rows.slice(0, INBOX_PREVIEW_LIMIT);
  return (
    <section className={styles.section} aria-label={HOME_COPY.preview}>
      <h2 className={styles.sectionTitle}>{HOME_COPY.preview}</h2>
      <ul className={styles.list}>
        {visible.map((row) => (
          <li key={row.id}>
            <Link className={styles.row} href="/inbox">
              <span className={styles.rowTitle}>{row.title}</span>
              {row.summary ? <span className={styles.rowSummary}>{row.summary}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeView({
  model,
  preview,
  install,
  onRetry,
  onCapture,
  onCommand,
  onInstall,
  onDismissInstall,
}: HomeViewProps) {
  const badge = inboxBadgeCount(model);

  return (
    <div className={styles.screen} data-home-state={model.state}>
      <header className={styles.header}>
        <h1 className={styles.title}>{HOME_COPY.greeting}</h1>
        <button
          type="button"
          className={styles.command}
          title={HOME_COPY.commandTitle}
          aria-keyshortcuts="Meta+K"
          onClick={onCommand}
        >
          {HOME_COPY.command}
        </button>
      </header>

      {install.kind === "hidden" ? null : (
        <InstallBanner offer={install} onInstall={onInstall} onDismiss={onDismissInstall} />
      )}

      {model.state === "loading" ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label={HOME_COPY.loading}>
          <div className={styles.skeletonCard}>
            <SkeletonBlock />
          </div>
          <div className={styles.skeletonCard}>
            <SkeletonBlock />
          </div>
          <div className={styles.skeletonCard}>
            <SkeletonBlock />
          </div>
        </div>
      ) : (
        <HomeTop3 inboxCount={badge} />
      )}

      {model.state === "ready" ? <RecentNotesList notes={model.recentNotes} /> : null}

      {model.state === "empty_vault" ? (
        <EmptyState
          message={HOME_COPY.emptyVault}
          primaryAction={{ label: HOME_COPY.capture, onClick: onCapture }}
        />
      ) : null}

      {model.state === "error" ? (
        <ErrorBanner message={HOME_COPY.homeError} onRetry={onRetry} retryLabel={HOME_COPY.retry} />
      ) : null}

      {showInboxPreview(model, preview) ? <InboxPreview rows={preview} /> : null}
    </div>
  );
}
