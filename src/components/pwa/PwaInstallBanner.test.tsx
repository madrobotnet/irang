import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import { settingsInstallView } from "@/lib/pwa/install-ui";
import { PwaInstallBanner } from "./PwaInstallBanner";
import { PwaInstallSheet } from "./PwaInstallSheet";
import { PwaInstallSettingsRow } from "./PwaInstallSettingsRow";

function banner(mode: "prompt" | "ios") {
  return renderToStaticMarkup(
    <PwaInstallBanner mode={mode} onAdd={() => undefined} onDismiss={() => undefined} />,
  );
}

function sheet(mode: "prompt" | "ios") {
  return renderToStaticMarkup(
    <PwaInstallSheet mode={mode} onAdd={() => undefined} onDismiss={() => undefined} />,
  );
}

function settings(signals: Parameters<typeof settingsInstallView>[0]) {
  return renderToStaticMarkup(
    <PwaInstallSettingsRow
      view={settingsInstallView(signals)}
      onAdd={() => undefined}
      onHideBanner={() => undefined}
    />,
  );
}

describe("PWA install UI", () => {
  it("shows the desk banner and mob sheet when eligible", () => {
    const desk = banner("prompt");
    const mob = sheet("prompt");
    expect(desk).toContain('data-pwa-install="banner"');
    expect(desk).toContain(PWA_INSTALL_COPY.banner_title);
    expect(desk).toContain(PWA_INSTALL_COPY.banner_sub);
    expect(desk).toContain(PWA_INSTALL_COPY.banner_add);
    expect(desk).toContain("/icons/icon-192.png");
    expect(mob).toContain('data-pwa-install="sheet"');
    expect(mob).toContain(PWA_INSTALL_COPY.title);
    expect(mob).toContain(PWA_INSTALL_COPY.body_mob);
    expect(mob).toContain(PWA_INSTALL_COPY.benefit_1);
    expect(mob).toContain(PWA_INSTALL_COPY.benefit_2);
    expect(mob).toContain(PWA_INSTALL_COPY.benefit_3);
    expect(mob).toContain(PWA_INSTALL_COPY.cta);
    expect(mob).toContain(PWA_INSTALL_COPY.dismiss);
    expect(mob).toContain("/icons/icon-192.png");
    expect(`${desk}${mob}`).not.toContain("오프라인");
    expect(`${desk}${mob}`).not.toContain("Play Store");
  });

  it("shows the iOS share hint instead of the install prompt", () => {
    const desk = banner("ios");
    const mob = sheet("ios");
    expect(desk).toContain(PWA_INSTALL_COPY.ios_hint);
    expect(desk).not.toContain('data-pwa-cta="add"');
    expect(mob).toContain(PWA_INSTALL_COPY.ios_hint);
    expect(mob).toContain(PWA_INSTALL_COPY.dismiss);
    expect(mob).not.toContain('data-pwa-cta="install"');
  });

  it("keeps the settings row after dismiss and hides home chrome copy there", () => {
    const html = settings({
      dismissed: true,
      standalone: false,
      ios: false,
      hasPrompt: true,
    });
    expect(html).toContain('data-pwa-install="settings"');
    expect(html).toContain(PWA_INSTALL_COPY.cta);
    expect(html).toContain(PWA_INSTALL_COPY.status_eligible);
    expect(html).toContain("eligible");
    expect(html).not.toContain('data-pwa-install="banner"');
    expect(html).not.toContain(PWA_INSTALL_COPY.hide_banner);
  });

  it("marks settings as installed and drops the CTA", () => {
    const html = settings({
      dismissed: false,
      standalone: true,
      ios: false,
      hasPrompt: false,
    });
    expect(html).toContain(PWA_INSTALL_COPY.status_installed);
    expect(html).not.toContain('data-pwa-cta="install"');
    expect(html).not.toContain('data-pwa-install="banner"');
    expect(html).not.toContain(PWA_INSTALL_COPY.hide_banner);
  });

  it("uses the share hint on the settings row for iOS", () => {
    const html = settings({
      dismissed: false,
      standalone: false,
      ios: true,
      hasPrompt: false,
    });
    expect(html).toContain(PWA_INSTALL_COPY.ios_hint);
    expect(html).toContain(PWA_INSTALL_COPY.hide_banner);
    expect(html).toContain('data-pwa-install="banner"');
    expect(html).not.toContain('data-pwa-cta="install"');
  });
});
