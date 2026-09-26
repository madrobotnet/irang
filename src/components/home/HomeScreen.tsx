"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCapture } from "@/components/capture/CaptureContext";
import type { HomePageModel } from "@/lib/home/dto";
import { HOME_COPY } from "./copy";
import { HomeView } from "./HomeView";
import { loadHomeSummary } from "./home-client";
import { loadHomeInboxRowViews, type HomeInboxRowView } from "./home-inbox-rows-ui";
import {
  INSTALL_DISMISS_KEY,
  homeSwipeHref,
  installOffer,
  isIosDevice,
  type InstallOffer,
} from "./home-model";
import styles from "./HomeScreen.module.css";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function readStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function HomeScreen() {
  const router = useRouter();
  const { openCapture } = useCapture();
  const [model, setModel] = useState<HomePageModel>({ state: "loading" });
  const [preview, setPreview] = useState<HomeInboxRowView[]>([]);
  const [install, setInstall] = useState<InstallOffer>({ kind: "hidden" });
  const promptRef = useRef<DeferredInstallPrompt | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dismissedRef = useRef(false);

  const syncInstall = useCallback(() => {
    setInstall(
      installOffer({
        dismissed: dismissedRef.current,
        standalone: readStandalone(),
        ios: isIosDevice(window.navigator.userAgent),
        hasPrompt: promptRef.current !== null,
      }),
    );
  }, []);

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
    dismissedRef.current = window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1";
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as DeferredInstallPrompt;
      syncInstall();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    syncInstall();
    void load();
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [load, syncInstall]);

  const onInstall = () => {
    const event = promptRef.current;
    if (!event) return;
    void event.prompt().then(() => event.userChoice).then((choice) => {
      promptRef.current = null;
      if (choice.outcome === "accepted") {
        setInstall({ kind: "hidden" });
        return;
      }
      syncInstall();
    });
  };

  const onDismissInstall = () => {
    dismissedRef.current = true;
    window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
    setInstall({ kind: "hidden" });
  };

  return (
    <div
      className={styles.host}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("a, button, input, textarea, select, summary")) return;
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
        install={install}
        onRetry={() => {
          void load();
        }}
        onCapture={() => openCapture()}
        onInstall={onInstall}
        onDismissInstall={onDismissInstall}
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
