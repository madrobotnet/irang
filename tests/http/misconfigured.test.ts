import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const original = process.env["BRAIN_GATE_PASSWORD"];

before(() => {
  delete process.env["BRAIN_GATE_PASSWORD"];
});

after(() => {
  if (original === undefined) delete process.env["BRAIN_GATE_PASSWORD"];
  else process.env["BRAIN_GATE_PASSWORD"] = original;
});

test("returns auth_misconfigured when the gate password is missing", async () => {
  const { POST } = await import("../../src/app/api/auth/login/route");
  const response = await POST(new Request("http://127.0.0.1/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "anything" }),
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "auth_misconfigured" });
});
