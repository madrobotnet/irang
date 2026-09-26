"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCapture } from "@/components/capture/CaptureContext";
import { usePwaInstall } from "@/components/pwa/PwaInstallProvider";
import type { HomePageModel } from "@/lib/home/dto";
import { HOME_COPY } from "./copy";
import { HomeView } from "./HomeView";
import { loadHomeSummary } from "./home-client";
import { loadHomeInboxRowViews, type HomeInboxRowView } from "./home-inbox-rows-ui";
import { homeSwipeHref } from "./home-model";
import styles from "./HomeScreen.module.css";

export function HomeScreen() {
  const router = useRouter();
  const { openCapture } = useCapture();
  const { ready, state, promptInstall, dismiss } = usePwaInstall();
  const [model, setModel] = useState<HomePageModel>({ state: "loading" });
  const [preview, setPreview] = useState<HomeInboxRowView[]>([]);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setModel({ state: "loading" });
    setPreview([]);
    const next = await loadHomeSummary();
    setModel(next);
    if (next.state !== "ready" && next.state !== "empty_vault") return;
    if (next.inboxBadge.count <= 0) return;
    setPreview(await loadHomeInboxRowViews());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className={styles.host}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("a, button, input, textarea, select, summary, [data-pwa-install]")) return;
        origin.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const start = origin.current;
        origin.current = null;
        if (!start) return;
        const href = homeSwipeHref(event.clientX - start.x, event.clientY - start.y);
        if (href) router.push(href);
      }}
      onPointerCancel={() => {
        origin.current = null;
      }}
    >
      <span className={styles.peekLeft} aria-hidden="true" />
      <span className={styles.peekRight} aria-hidden="true" />
      <HomeView
        model={model}
        preview={preview}
        install={ready ? state : null}
        onRetry={() => {
          void load();
        }}
        onCapture={() => openCapture()}
        onInstall={promptInstall}
        onDismissInstall={dismiss}
      />
      <nav className={styles.pager} aria-label="화면">
        <LinkDot href="/search" label={HOME_COPY.pagerSearch} active={false} />
        <span className={styles.dotActive} aria-current="page">{HOME_COPY.pagerHome}</span>
        <LinkDot href="/chat" label={HOME_COPY.pagerChat} active={false} />
      </nav>
    </div>
  );
}

function LinkDot({ href, label, active }: { href: string; label: string; active: boolean }) {
  if (active) {
    return <span className={styles.dotActive} aria-current="page">{label}</span>;
  }
  return (
    <Link href={href} className={styles.dot} aria-label={label}>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
