import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { api } from "./api-client";

afterEach(() => mock.restore());

test("preserves HTTP failure status when a gateway returns unexpected JSON", async () => {
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ message: "gateway failure" }, { status: 503 }));

  await expect(api("/api/notes")).rejects.toMatchObject({ name: "ApiClientError", status: 503, code: "http_error" });
});
