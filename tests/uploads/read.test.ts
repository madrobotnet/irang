import assert from "node:assert/strict";
import { it } from "node:test";
import { readAtMost } from "../../src/lib/uploads/read";

it("rejects a body once the buffered length exceeds the cap", async () => {
  // Given
  const request = new Request("http://127.0.0.1/api/uploads", { method: "POST", body: "12345" });
  // When
  const bounded = await readAtMost(request, 4);
  // Then
  assert.deepEqual(bounded, { kind: "too_large" });
});

it("returns the body when it fits in the cap", async () => {
  // Given
  const request = new Request("http://127.0.0.1/api/uploads", { method: "POST", body: "1234" });
  // When
  const bounded = await readAtMost(request, 4);
  // Then
  assert.equal(bounded.kind, "bytes");
  if (bounded.kind !== "bytes") return;
  assert.equal(new TextDecoder().decode(bounded.bytes), "1234");
});
