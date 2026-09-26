import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProviders } from "@/components/shell/AppProviders";
import { PWA_INSTALL_COPY } from "@/lib/pwa/install-copy";
import SettingsPage from "./page";

describe("settings route", () => {
  it("does not mount PlaceholderPage", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain("PlaceholderPage");
    expect(source).toContain("SettingsScreen");
  });

  it("renders the 앱 · PWA install row", () => {
    const html = renderToStaticMarkup(
      <AppProviders>
        <SettingsPage />
      </AppProviders>,
    );
    expect(html).toContain(PWA_INSTALL_COPY.settings_nav);
    expect(html).toContain(PWA_INSTALL_COPY.body_desk);
    expect(html).toContain('data-pwa-install="settings"');
    expect(html).not.toContain("P1 준비 중");
    expect(html).not.toContain("오프라인");
  });
});
