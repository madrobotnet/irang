import { describe, expect, it } from "vitest";
import { PWA_INSTALL_COPY } from "./install-copy";
import { homeInstallMode, settingsInstallView, showHomeInstall } from "./install-ui";

describe("PWA install chrome", () => {
  it("shows home banner and sheet for eligible and iOS hint, and hides them after dismiss or install", () => {
    expect(showHomeInstall("eligible")).toBe(true);
    expect(homeInstallMode("eligible")).toBe("prompt");
    expect(showHomeInstall("ios-share-hint")).toBe(true);
    expect(homeInstallMode("ios-share-hint")).toBe("ios");
    expect(showHomeInstall("dismissed")).toBe(false);
    expect(showHomeInstall("already-installed")).toBe(false);
    expect(showHomeInstall(null)).toBe(false);
  });

  it("keeps the settings row after dismiss and marks installed as installed", () => {
    const dismissed = settingsInstallView({
      dismissed: true,
      standalone: false,
      ios: false,
      hasPrompt: true,
    });
    expect(dismissed.showBanner).toBe(false);
    expect(dismissed.showCta).toBe(true);
    expect(dismissed.showHideBanner).toBe(false);
    expect(dismissed.pill).toBe("eligible");
    expect(dismissed.status).toBe(PWA_INSTALL_COPY.status_eligible);

    const installed = settingsInstallView({
      dismissed: false,
      standalone: true,
      ios: false,
      hasPrompt: false,
    });
    expect(installed.showBanner).toBe(false);
    expect(installed.showCta).toBe(false);
    expect(installed.showHideBanner).toBe(false);
    expect(installed.pill).toBeNull();
    expect(installed.status).toBe(PWA_INSTALL_COPY.status_installed);

    const ios = settingsInstallView({
      dismissed: false,
      standalone: false,
      ios: true,
      hasPrompt: false,
    });
    expect(ios.showBanner).toBe(true);
    expect(ios.showCta).toBe(false);
    expect(ios.showIosHint).toBe(true);
    expect(ios.showHideBanner).toBe(true);
    expect(ios.pill).toBe("eligible");
  });
});
