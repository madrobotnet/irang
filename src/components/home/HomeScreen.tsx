"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCapture } from "@/components/capture/CaptureContext";
import type { HomePageModel } from "@/lib/home/dto";
import { HomeView } from "./HomeView";
import { loadHomeSummary, loadInboxPreview } from "./home-client";
import {
  INSTALL_DISMISS_KEY,
  homeSwipeHref,
  installOffer,
  isIosDevice,
  type InboxPreviewRow,
  type InstallOffer,
} from "./home-model";

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
  const [preview, setPreview] = useState<InboxPreviewRow[]>([]);
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
    setPreview(await loadInboxPreview());
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

  const onCommand = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  };

  return (
    <div
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("a, button, input, textarea, select")) return;
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
      <HomeView
        model={model}
        preview={preview}
        install={install}
        onRetry={() => {
          void load();
        }}
        onCapture={() => openCapture()}
        onCommand={onCommand}
        onInstall={onInstall}
        onDismissInstall={onDismissInstall}
      />
    </div>
  );
}
