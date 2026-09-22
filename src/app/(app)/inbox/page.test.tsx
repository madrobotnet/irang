import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProviders } from "@/components/shell/AppProviders";
import InboxPage from "./page";

describe("inbox route", () => {
  it("does not mount PlaceholderPage", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain("PlaceholderPage");
    expect(source).toContain("InboxScreen");
  });

  it("renders the inbox screen instead of the P1 placeholder", () => {
    const html = renderToStaticMarkup(
      <AppProviders>
        <InboxPage />
      </AppProviders>,
    );
    expect(html).toContain('data-inbox-state="loading"');
    expect(html).toContain("Inbox");
    expect(html).toContain("캡처");
    expect(html).not.toContain("캡처 승격");
    expect(html).not.toContain("P1 준비 중");
  });
});
