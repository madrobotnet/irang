import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider } from "@/components/ui/Toast";
import ChatPage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("evidence=note-1&scope=selected"),
  useRouter: () => ({ replace: () => undefined }),
}));

describe("chat route", () => {
  it("does not mount PlaceholderPage", () => {
    const source = readFileSync(fileURLToPath(new URL("./page.tsx", import.meta.url)), "utf8");
    expect(source).not.toContain("PlaceholderPage");
    expect(source).toContain("ChatScreen");
  });

  it("renders the chat screen instead of the P1 placeholder", () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <ChatPage />
      </ToastProvider>,
    );
    expect(html).toContain('data-chat-state="idle"');
    expect(html).toContain("AI 채팅");
    expect(html).toContain("무엇이든 물어보세요");
    expect(html).toContain("보내기");
    expect(html).toContain('data-scope="selected"');
    expect(html).toContain("근거(1)");
    expect(html).not.toContain("P1 준비 중");
  });
});
