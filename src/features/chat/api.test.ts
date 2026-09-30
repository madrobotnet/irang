import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { sendChatMessage } from "./api";

afterEach(() => mock.restore());

test("returns a terminal error for a gateway response without the app error shape", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "gateway failure" }, { status: 503 }));

  const result = await sendChatMessage({ threadId: "qa", content: "question", signal: new AbortController().signal });

  expect(result).toEqual({ kind: "error", code: "http_error", message: "" });
});

test("keeps the server's localized text so a retained error can follow a language switch", async () => {
  const localized = { ko: "잠시 후 다시 시도해 주세요.", en: "Try again in a moment." };
  spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: { code: "rate_limited", message: "Too many requests", localized } }, { status: 429 }),
  );

  const result = await sendChatMessage({ threadId: "qa", content: "question", signal: new AbortController().signal });

  expect(result).toEqual({ kind: "error", code: "rate_limited", message: "Too many requests", localized });
});
