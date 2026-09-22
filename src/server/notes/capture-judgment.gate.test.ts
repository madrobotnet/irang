import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCaptureJudgmentFields } from "@/domain/judgments/guards";
import { MemoryNotesStore } from "./memory-store";
import { setNotesStoreForTests, resetNotesRuntimeForTests } from "./runtime";
import { handleCapture } from "./http";
import { setSystemOneInvokerForTests } from "@/server/typesafe/runtime";
import { mockSystemOneInvoker } from "@/server/typesafe/test-helpers";

beforeEach(() => {
  process.env.TYPESAFE_API_KEY = "test-key";
  setSystemOneInvokerForTests(mockSystemOneInvoker());
  setNotesStoreForTests(new MemoryNotesStore());
});

afterEach(() => {
  setSystemOneInvokerForTests(null);
  delete process.env.TYPESAFE_API_KEY;
  resetNotesRuntimeForTests();
});

describe("capture judgment gate (Layer 2 — consume typed judgment in tests)", () => {
  it("201 responses always include suggestions + duplicateHint fields", async () => {
    const res = await handleCapture(
      new Request("http://localhost/api/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Gate", body: "Check", target: "note" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const judgments = parseCaptureJudgmentFields(body);
    expect(judgments).not.toBeNull();
    expect(judgments!.suggestions.tags).toBeInstanceOf(Array);
    expect("duplicateHint" in (body as object)).toBe(true);
  });
});
