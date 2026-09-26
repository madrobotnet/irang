export const PWA_INSTALL_DISMISS_KEY = "sb-install-dismissed";

export const PWA_INSTALL_STATES = [
  "eligible",
  "dismissed",
  "already-installed",
  "ios-share-hint",
] as const;

export type PwaInstallState = (typeof PWA_INSTALL_STATES)[number];

export type PwaInstallSignals = {
  dismissed: boolean;
  standalone: boolean;
  ios: boolean;
  hasPrompt: boolean;
};

export type PwaInstallSettingsOffer = "prompt" | "ios-share-hint" | "installed" | "unavailable";

type InstallCapability = "installed" | "prompt" | "ios" | "none";

function capability(input: PwaInstallSignals): InstallCapability {
  if (input.standalone) return "installed";
  if (input.hasPrompt) return "prompt";
  if (input.ios) return "ios";
  return "none";
}

export function resolvePwaInstallState(input: PwaInstallSignals): PwaInstallState | null {
  const kind = capability(input);
  if (kind === "installed") return "already-installed";
  if (kind === "none") return null;
  if (input.dismissed) return "dismissed";
  if (kind === "ios") return "ios-share-hint";
  return "eligible";
}

export function pwaInstallSettingsOffer(input: PwaInstallSignals): PwaInstallSettingsOffer {
  const kind = capability(input);
  if (kind === "installed") return "installed";
  if (kind === "prompt") return "prompt";
  if (kind === "ios") return "ios-share-hint";
  return "unavailable";
}

export type DismissStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readPwaInstallDismissed(storage: DismissStorage): boolean {
  return storage.getItem(PWA_INSTALL_DISMISS_KEY) === "1";
}

export function persistPwaInstallDismiss(storage: DismissStorage): void {
  storage.setItem(PWA_INSTALL_DISMISS_KEY, "1");
}

export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function isStandaloneDisplay(signals: {
  navigatorStandalone?: boolean;
  displayModeStandalone: boolean;
}): boolean {
  return signals.navigatorStandalone === true || signals.displayModeStandalone;
}

export function readNavigatorStandalone(nav: object): boolean {
  if (!("standalone" in nav)) return false;
  return nav.standalone === true;
}

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  if (!("prompt" in event) || !("userChoice" in event)) return false;
  const prompt = event.prompt;
  const userChoice = event.userChoice;
  return typeof prompt === "function" && typeof userChoice === "object" && userChoice !== null;
}

export function takeBeforeInstallPrompt(event: Event): BeforeInstallPromptEvent | null {
  if (!isBeforeInstallPromptEvent(event)) return null;
  event.preventDefault();
  return event;
}

export type InstallPromptTarget = {
  addEventListener(type: "beforeinstallprompt", listener: (event: Event) => void): void;
  removeEventListener(type: "beforeinstallprompt", listener: (event: Event) => void): void;
};

export function subscribeBeforeInstallPrompt(
  target: InstallPromptTarget,
  onPrompt: (event: BeforeInstallPromptEvent) => void,
): () => void {
  const listener = (event: Event) => {
    const promptEvent = takeBeforeInstallPrompt(event);
    if (promptEvent) onPrompt(promptEvent);
  };
  target.addEventListener("beforeinstallprompt", listener);
  return () => target.removeEventListener("beforeinstallprompt", listener);
}
