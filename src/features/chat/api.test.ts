import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { sendChatMessage } from "./api";

afterEach(() => mock.restore());

test("returns a terminal error for a gateway response without the app error shape", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "gateway failure" }, { status: 503 }));

  const result = await sendChatMessage({ threadId: "qa", content: "question", signal: new AbortController().signal });

  expect(result).toEqual({ kind: "error", code: "http_error", message: "" });
});
