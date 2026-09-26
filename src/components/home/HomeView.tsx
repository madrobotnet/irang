import Link from "next/link";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { PwaInstallSheet } from "@/components/pwa/PwaInstallSheet";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import type { HomePageModel, RecentNoteListItemDto } from "@/lib/home/dto";
import type { PwaInstallState } from "@/lib/pwa/install";
import { homeInstallMode } from "@/lib/pwa/install-ui";
import { HOME_COPY } from "./copy";
import type { HomeInboxRowView } from "./home-inbox-rows-ui";
import { inboxBadgeCount } from "./home-model";
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

function formatNoteMeta(updatedAt: string): string {
  try {
    const d = new Date(updatedAt);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return `오늘 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    return "어제";
  } catch {
    return "";
  }
}

function recentNotes(model: HomePageModel): RecentNoteListItemDto[] {
  if (model.state !== "ready") return [];
  return [...model.recentNotes].slice(0, 4);
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
  const inboxCount = badge ?? 0;
  const notes = recentNotes(model);
  const isEmptyVault = model.state === "empty_vault" || (model.state === "ready" && notes.length === 0);
  const mode = homeInstallMode(install);
  const noteTotal = model.state === "ready" ? model.recentNotes.length : 0;

  return (
    <div className={styles.screen} data-home-state={model.state}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>{HOME_COPY.eyebrow}</div>
          <h1 className={styles.heroTitle}>{HOME_COPY.heroTitle}</h1>
        </div>
        <div className={styles.topActions}>
          <button type="button" className={styles.btn} onClick={onCapture}>
            + {HOME_COPY.quickCapture}
          </button>
          <Link href="/chat" className={`${styles.btn} ${styles.btnPrimary}`}>
            {HOME_COPY.startSynth}
          </Link>
        </div>
      </header>

      {mode ? (
        <PwaInstallBanner mode={mode} onAdd={onInstall} onDismiss={onDismissInstall} />
      ) : null}

      {model.state === "error" ? (
        <ErrorBanner message={HOME_COPY.homeError} onRetry={onRetry} retryLabel={HOME_COPY.retry} />
      ) : null}

      {model.state === "loading" ? (
        <div className={styles.skeletonBlock} aria-busy="true" aria-label={HOME_COPY.loading}>
          <SkeletonBlock lines={4} />
        </div>
      ) : null}

      {model.state !== "loading" && model.state !== "error" ? (
        <>
          <section className={styles.cmdSurface} aria-label="검색 커맨드">
            <span className={styles.cmdLabel}>{HOME_COPY.cmdLabel}</span>
            <Link href="/search" className={styles.searchLink}>
              <span className={styles.searchIcon} aria-hidden="true">✦</span>
              <span className={styles.searchPlaceholder}>
                {isEmptyVault ? HOME_COPY.cmdPlaceholderEmpty : HOME_COPY.cmdPlaceholder}
              </span>
              <span className={styles.kbd}>{HOME_COPY.cmdKbd}</span>
            </Link>
          </section>

          <div className={styles.grid}>
            {isEmptyVault ? (
              <section className={`${styles.panel} ${styles.emptyPanel}`} aria-label={HOME_COPY.emptyDeskTitle}>
                <div className={styles.emptyGlyph} aria-hidden="true">+</div>
                <h2 className={styles.emptyTitle}>{HOME_COPY.emptyDeskTitle}</h2>
                <p className={styles.emptyBody}>{HOME_COPY.emptyDeskBody}</p>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onCapture}>
                  + {HOME_COPY.firstCapture}
                </button>
              </section>
            ) : (
              <section className={styles.panel} aria-label={HOME_COPY.recentLibrary}>
                <div className={styles.panelHead}>
                  <h2>{HOME_COPY.recentLibrary}</h2>
                  <Link href="/notes" className={styles.moreLink}>{HOME_COPY.viewAll}</Link>
                </div>
                {notes.map((note, index) => (
                  <Link key={note.id} href={`/notes/${note.id}`} className={styles.libCard}>
                    <div className={index % 2 === 0 ? `${styles.ico} ${styles.icoN}` : `${styles.ico} ${styles.icoM}`}>
                      {index % 2 === 0 ? "노" : "메"}
                    </div>
                    <div>
                      <div className={styles.rowT}>{note.title}</div>
                      <div className={styles.rowM}>노트 · {formatNoteMeta(note.updatedAt)}</div>
                    </div>
                    <div className={styles.rowMeta}>{formatNoteMeta(note.updatedAt).startsWith("오늘") ? "오늘" : "어제"}</div>
                  </Link>
                ))}
                {preview.length > 0 && inboxCount > 0 ? (
                  <Link href="/inbox" className={styles.libCard}>
                    <div className={`${styles.ico} ${styles.icoM}`}>웹</div>
                    <div>
                      <div className={styles.rowT}>{preview[0]?.title ?? HOME_COPY.inboxHeroTitle}</div>
                      <div className={styles.rowM}>수집 · 미처리 {inboxCount}</div>
                    </div>
                    <div className={styles.rowMeta}>대기</div>
                  </Link>
                ) : null}
                <div className={styles.statRow}>
                  <div className={styles.stat}>
                    <div className={styles.statN}>{noteTotal > 0 ? noteTotal : "—"}</div>
                    <div className={styles.statL}>{HOME_COPY.statNotes}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statN}>{inboxCount}</div>
                    <div className={styles.statL}>{HOME_COPY.statInbox}</div>
                  </div>
                  <div className={styles.stat}>
                    <div className={styles.statN}>—</div>
                    <div className={styles.statL}>{HOME_COPY.statGraph}</div>
                  </div>
                </div>
              </section>
            )}

            <aside className={styles.panel} aria-label={HOME_COPY.synthTitle}>
              <div className={styles.panelHead}>
                <h2>{HOME_COPY.synthTitle}</h2>
                <Link href="/chat" className={styles.moreLink}>{HOME_COPY.newChat}</Link>
              </div>
              <div className={styles.synth}>
                <div className={styles.bubbleAi}>
                  <div className={styles.tag}>{HOME_COPY.synthTag}</div>
                  {isEmptyVault ? HOME_COPY.synthIdle : HOME_COPY.synthPrompt}
                </div>
                <div className={styles.composer}>
                  <span>{HOME_COPY.synthComposer}</span>
                  <Link href="/chat" className={styles.send} aria-label="채팅 열기">→</Link>
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : null}

      {mode ? (
        <PwaInstallSheet mode={mode} onAdd={onInstall} onDismiss={onDismissInstall} />
      ) : null}
    </div>
  );
}
