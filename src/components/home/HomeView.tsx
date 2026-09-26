import Link from "next/link";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { PwaInstallSheet } from "@/components/pwa/PwaInstallSheet";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import type { HomePageModel, RecentNoteListItemDto } from "@/lib/home/dto";
import type { PwaInstallState } from "@/lib/pwa/install";
import { homeInstallMode } from "@/lib/pwa/install-ui";
import { HOME_COPY } from "./copy";
import { HomeInboxRow } from "./HomeInboxRow";
import { HomeTop3 } from "./HomeTop3";
import type { HomeInboxRowView } from "./home-inbox-rows-ui";
import {
  INBOX_PREVIEW_LIMIT,
  inboxBadgeCount,
  showInboxPreview,
} from "./home-model";
import styles from "./HomeView.module.css";

export type HomeViewProps = {
  model: HomePageModel;
  preview: readonly HomeInboxRowView[];
  install: PwaInstallState | null;
  onRetry: () => void;
  onCapture: () => void;
  onInstall: () => void;
  onDismissInstall: () => void;
};

function continueNote(model: HomePageModel): RecentNoteListItemDto | null {
  if (model.state !== "ready") return null;
  return model.recentNotes[0] ?? null;
}

function inboxEmptyCopy(model: HomePageModel): { title: string; body?: string } {
  if (model.state === "empty_vault") {
    return { title: HOME_COPY.emptyVault, body: HOME_COPY.inboxEmptyBody };
  }
  return { title: HOME_COPY.inboxEmptyTitle, body: HOME_COPY.inboxEmptyBody };
}

export function HomeView({
  model,
  preview,
  install,
  onRetry,
  onCapture,
  onInstall,
  onDismissInstall,
}: HomeViewProps) {
  const badge = inboxBadgeCount(model);
  const count = badge ?? 0;
  const showHeroList = showInboxPreview(model, preview);
  const note = continueNote(model);
  const mode = homeInstallMode(install);
  const showContinue =
    mode === null && note !== null && model.state !== "error" && model.state !== "loading";

  return (
    <div className={styles.screen} data-home-state={model.state}>
      {model.state === "loading" ? (
        <div className={styles.skeletonTop3} aria-busy="true" aria-label={HOME_COPY.loading}>
          <SkeletonBlock />
        </div>
      ) : (
        <HomeTop3 inboxCount={badge} />
      )}

      {mode ? (
        <PwaInstallBanner mode={mode} onAdd={onInstall} onDismiss={onDismissInstall} />
      ) : null}

      {model.state === "error" ? (
        <ErrorBanner message={HOME_COPY.homeError} onRetry={onRetry} retryLabel={HOME_COPY.retry} />
      ) : null}

      {model.state === "loading" ? (
        <div className={styles.skeletonHero} aria-hidden="true">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : null}

      {model.state !== "loading" && model.state !== "error" && count > 0 ? (
        <section className={styles.hero} aria-label={HOME_COPY.inboxHeroTitle}>
          <h1 className={styles.heroTitle}>
            {HOME_COPY.inboxHeroTitle}
            <span className={styles.heroCount}> · {count}</span>
          </h1>
          {showHeroList ? (
            <ul className={styles.list}>
              {preview.slice(0, INBOX_PREVIEW_LIMIT).map((row) => (
                <HomeInboxRow key={row.id} row={row} />
              ))}
            </ul>
          ) : null}
          <div className={styles.footerRow}>
            <Link className={styles.primaryBtn} href="/inbox">{HOME_COPY.organize}</Link>
            {showContinue && note ? (
              <p className={styles.continueDesk}>
                {HOME_COPY.continuePrefix} · <strong>{note.title}</strong>
                <Link className={styles.continueMore} href="/notes">{HOME_COPY.continueMore}</Link>
              </p>
            ) : null}
          </div>
          {showContinue && note ? (
            <p className={styles.continueMob}>
              {HOME_COPY.continuePrefix} · <strong>{note.title}</strong>
              {" · "}
              <Link href="/notes">{HOME_COPY.continueMore}</Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {model.state !== "loading" && model.state !== "error" && count === 0 ? (
        <section className={styles.emptyHero} aria-label={HOME_COPY.capture}>
          <h1 className={styles.emptyTitle}>{inboxEmptyCopy(model).title}</h1>
          {inboxEmptyCopy(model).body ? (
            <p className={styles.emptyBody}>{inboxEmptyCopy(model).body}</p>
          ) : null}
          <button type="button" className={styles.primaryBtnStandalone} onClick={onCapture}>
            {HOME_COPY.capture}
          </button>
        </section>
      ) : null}

      {mode ? (
        <PwaInstallSheet mode={mode} onAdd={onInstall} onDismiss={onDismissInstall} />
      ) : null}

      {showContinue && note && count === 0 ? (
        <p className={styles.continue}>
          {HOME_COPY.continuePrefix} · <strong>{note.title}</strong>
          {" · "}
          <Link href="/notes">{HOME_COPY.continueMore}</Link>
        </p>
      ) : null}
    </div>
  );
}
