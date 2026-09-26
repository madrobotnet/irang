"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  isIosUserAgent,
  isStandaloneDisplay,
  persistPwaInstallDismiss,
  pwaInstallSettingsOffer,
  readNavigatorStandalone,
  readPwaInstallDismissed,
  resolvePwaInstallState,
  subscribeBeforeInstallPrompt,
  type BeforeInstallPromptEvent,
  type PwaInstallSettingsOffer,
  type PwaInstallSignals,
  type PwaInstallState,
} from "@/lib/pwa/install";

type PwaInstallContextValue = {
  ready: boolean;
  signals: PwaInstallSignals;
  state: PwaInstallState | null;
  offer: PwaInstallSettingsOffer;
  promptInstall: () => void;
  dismiss: () => void;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function readStandalone(): boolean {
  return isStandaloneDisplay({
    navigatorStandalone: readNavigatorStandalone(window.navigator),
    displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
  });
}

export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [hasPrompt, setHasPrompt] = useState(false);

  useEffect(() => {
    setDismissed(readPwaInstallDismissed(window.localStorage));
    setStandalone(readStandalone());
    setIos(isIosUserAgent(window.navigator.userAgent));
    const stopPrompt = subscribeBeforeInstallPrompt(window, (event) => {
      promptRef.current = event;
      setHasPrompt(true);
    });
    const media = window.matchMedia("(display-mode: standalone)");
    const onDisplay = () => setStandalone(readStandalone());
    media.addEventListener("change", onDisplay);
    const onInstalled = () => {
      promptRef.current = null;
      setHasPrompt(false);
      setStandalone(true);
    };
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      stopPrompt();
      media.removeEventListener("change", onDisplay);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(() => {
    const event = promptRef.current;
    if (!event) return;
    void event.prompt().then(() => event.userChoice).then((choice) => {
      promptRef.current = null;
      setHasPrompt(false);
      if (choice.outcome === "accepted") setStandalone(true);
    });
  }, []);

  const dismiss = useCallback(() => {
    persistPwaInstallDismiss(window.localStorage);
    setDismissed(true);
  }, []);

  const value = useMemo<PwaInstallContextValue>(() => {
    const signals = { dismissed, standalone, ios, hasPrompt };
    return {
      ready,
      signals,
      state: resolvePwaInstallState(signals),
      offer: pwaInstallSettingsOffer(signals),
      promptInstall,
      dismiss,
    };
  }, [dismiss, dismissed, hasPrompt, ios, promptInstall, ready, standalone]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallContextValue {
  const value = useContext(PwaInstallContext);
  if (!value) {
    throw new Error("usePwaInstall needs PwaInstallProvider");
  }
  return value;
}
