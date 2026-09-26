import { describe, expect, it } from "vitest";
import {
  PWA_INSTALL_DISMISS_KEY,
  isIosUserAgent,
  isStandaloneDisplay,
  readNavigatorStandalone,
  persistPwaInstallDismiss,
  pwaInstallSettingsOffer,
  readPwaInstallDismissed,
  resolvePwaInstallState,
  subscribeBeforeInstallPrompt,
  takeBeforeInstallPrompt,
  type DismissStorage,
} from "./install";

function memoryStorage(): DismissStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function promptEvent(): Event {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome: "accepted" as const }),
  });
  return event;
}

describe("PWA install state", () => {
  it("returns eligible when the browser has deferred the install prompt", () => {
    expect(
      resolvePwaInstallState({
        dismissed: false,
        standalone: false,
        ios: false,
        hasPrompt: true,
      }),
    ).toBe("eligible");
  });

  it("prefers the deferred prompt over the iOS share hint", () => {
    expect(
      resolvePwaInstallState({
        dismissed: false,
        standalone: false,
        ios: true,
        hasPrompt: true,
      }),
    ).toBe("eligible");
  });

  it("returns the iOS share hint when Safari cannot fire beforeinstallprompt", () => {
    expect(
      resolvePwaInstallState({
        dismissed: false,
        standalone: false,
        ios: true,
        hasPrompt: false,
      }),
    ).toBe("ios-share-hint");
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe(false);
  });

  it("returns dismissed after a local dismiss and keeps the settings offer", () => {
    const signals = {
      dismissed: true,
      standalone: false,
      ios: false,
      hasPrompt: true,
    };
    expect(resolvePwaInstallState(signals)).toBe("dismissed");
    expect(pwaInstallSettingsOffer(signals)).toBe("prompt");
    expect(
      pwaInstallSettingsOffer({
        dismissed: true,
        standalone: false,
        ios: true,
        hasPrompt: false,
      }),
    ).toBe("ios-share-hint");
  });

  it("returns already-installed for a standalone display, even after dismiss", () => {
    expect(
      resolvePwaInstallState({
        dismissed: true,
        standalone: true,
        ios: true,
        hasPrompt: true,
      }),
    ).toBe("already-installed");
    expect(
      pwaInstallSettingsOffer({
        dismissed: true,
        standalone: true,
        ios: false,
        hasPrompt: true,
      }),
    ).toBe("installed");
    expect(isStandaloneDisplay({ navigatorStandalone: true, displayModeStandalone: false })).toBe(
      true,
    );
    expect(isStandaloneDisplay({ displayModeStandalone: true })).toBe(true);
    expect(isStandaloneDisplay({ navigatorStandalone: false, displayModeStandalone: false })).toBe(
      false,
    );
    expect(readNavigatorStandalone({ standalone: true })).toBe(true);
    expect(readNavigatorStandalone({ standalone: false })).toBe(false);
    expect(readNavigatorStandalone({})).toBe(false);
  });

  it("returns null when this browser has no install path", () => {
    expect(
      resolvePwaInstallState({
        dismissed: false,
        standalone: false,
        ios: false,
        hasPrompt: false,
      }),
    ).toBeNull();
    expect(
      pwaInstallSettingsOffer({
        dismissed: true,
        standalone: false,
        ios: false,
        hasPrompt: false,
      }),
    ).toBe("unavailable");
  });

  it("persists dismiss in the provided storage under the shared key", () => {
    const storage = memoryStorage();
    expect(readPwaInstallDismissed(storage)).toBe(false);
    persistPwaInstallDismiss(storage);
    expect(readPwaInstallDismissed(storage)).toBe(true);
    expect(storage.values.get(PWA_INSTALL_DISMISS_KEY)).toBe("1");
    persistPwaInstallDismiss(storage);
    expect(storage.values.get(PWA_INSTALL_DISMISS_KEY)).toBe("1");
  });

  it("captures beforeinstallprompt and ignores a second listen after unsubscribe", () => {
    const listeners = new Set<(event: Event) => void>();
    const target = {
      addEventListener(_type: "beforeinstallprompt", listener: (event: Event) => void) {
        listeners.add(listener);
      },
      removeEventListener(_type: "beforeinstallprompt", listener: (event: Event) => void) {
        listeners.delete(listener);
      },
    };
    const seen: Event[] = [];
    const stop = subscribeBeforeInstallPrompt(target, (event) => {
      seen.push(event);
    });

    const first = promptEvent();
    for (const listener of listeners) listener(first);
    expect(first.defaultPrevented).toBe(true);
    expect(seen).toEqual([first]);

    const plain = new Event("beforeinstallprompt", { cancelable: true });
    for (const listener of listeners) listener(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(seen).toEqual([first]);
    expect(takeBeforeInstallPrompt(plain)).toBeNull();

    stop();
    const third = promptEvent();
    for (const listener of listeners) listener(third);
    expect(seen).toEqual([first]);
    expect(third.defaultPrevented).toBe(false);
  });
});
