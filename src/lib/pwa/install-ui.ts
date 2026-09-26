import { PWA_INSTALL_COPY } from "./install-copy";
import {
  pwaInstallSettingsOffer,
  resolvePwaInstallState,
  type PwaInstallSettingsOffer,
  type PwaInstallSignals,
  type PwaInstallState,
} from "./install";

export type HomeInstallMode = "prompt" | "ios";

export function homeInstallMode(state: PwaInstallState | null): HomeInstallMode | null {
  if (state === "eligible") return "prompt";
  if (state === "ios-share-hint") return "ios";
  return null;
}

export function showHomeInstall(state: PwaInstallState | null): boolean {
  return homeInstallMode(state) !== null;
}

export type SettingsInstallView = {
  offer: PwaInstallSettingsOffer;
  state: PwaInstallState | null;
  showBanner: boolean;
  showCta: boolean;
  showIosHint: boolean;
  showHideBanner: boolean;
  pill: "eligible" | null;
  status: string | null;
};

export function settingsInstallView(signals: PwaInstallSignals): SettingsInstallView {
  const state = resolvePwaInstallState(signals);
  const offer = pwaInstallSettingsOffer(signals);
  const showCta = offer === "prompt";
  const showIosHint = offer === "ios-share-hint";
  const installed = offer === "installed";
  return {
    offer,
    state,
    showBanner: showHomeInstall(state),
    showCta,
    showIosHint,
    showHideBanner: !installed && !signals.dismissed && offer !== "unavailable",
    pill: installed || offer === "unavailable" ? null : "eligible",
    status: installed
      ? PWA_INSTALL_COPY.status_installed
      : offer === "unavailable"
        ? null
        : PWA_INSTALL_COPY.status_eligible,
  };
}
