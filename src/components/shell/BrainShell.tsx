"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCapture } from "@/components/capture/CaptureContext";
import { CAPTURE_COPY } from "@/components/capture/copy";
import styles from "./BrainShell.module.css";

const MOBILE_TOOL_ROUTES_HIDE = ["/chat"];

function showMobileToolRow(pathname: string): boolean {
  if (pathname === "/login") return false;
  return !MOBILE_TOOL_ROUTES_HIDE.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

export function BrainShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openCapture } = useCapture();
  const mobileTool = showMobileToolRow(pathname);
  const graphPage = pathname === "/graph" || pathname.startsWith("/graph/");

  return (
    <div
      className={styles.root}
      data-mobile-tool={mobileTool ? "on" : "off"}
      data-graph={graphPage ? "on" : "off"}
    >
      <header className={styles.instrument} aria-label="앱 도구">
        <details className={styles.wordmarkMenu}>
          <summary className={styles.wordmark}>
            <span className={styles.mark} aria-hidden="true" />
            <span>세컨드 브레인</span>
          </summary>
          <div className={styles.menuPanel} role="menu">
            <Link href="/notes" className={styles.menuItem} role="menuitem">노트</Link>
            <Link href="/graph" className={styles.menuItem} role="menuitem">그래프</Link>
            <Link href="/settings" className={styles.menuItem} role="menuitem">설정</Link>
            <form method="post" action="/api/auth/logout" className={styles.menuLogout}>
              <button type="submit" className={styles.menuItem} role="menuitem">나가기</button>
            </form>
          </div>
        </details>
        <button
          type="button"
          className={styles.captureQuiet}
          onClick={() => openCapture("inbox")}
        >
          {CAPTURE_COPY.fab}
        </button>
      </header>

      <div className={styles.stage}>
        <main className={styles.main}>{children}</main>
      </div>

      {mobileTool ? (
        <div className={styles.mobileTool} aria-label="하단 도구">
          <Link href="/search" className={styles.searchField}>
            <span className={styles.searchIcon} aria-hidden="true">⌕</span>
            <span className={styles.searchLabel}>노트 검색</span>
          </Link>
          <button
            type="button"
            className={styles.captureMobile}
            onClick={() => openCapture("inbox")}
          >
            {CAPTURE_COPY.fab}
          </button>
        </div>
      ) : null}
    </div>
  );
}
