import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { json, parseJson, withPublicApi } from "./http";
import { clientIp } from "./auth/client-ip";

const handler = withPublicApi(async (request) => {
  const input = await parseJson(request, z.object({ title: z.string() }));
  return json(input, { status: 201 });
});

describe("mutation request boundaries", () => {
  test("rejects a browser request from another origin before mutation", async () => {
    const request = new Request("https://brain.example/api/capture", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "cross-origin" }),
    });
    const response = await handler(request, {});
    expect(response.status).toBe(403);
  });

  test("rejects JSON disguised as a simple text form submission", async () => {
    const request = new Request("https://brain.example/api/capture", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ title: "text body" }),
    });
    const response = await handler(request, {});
    expect(response.status).toBe(400);
  });

  test("allows same-origin JSON and preserves validation errors", async () => {
    const request = new Request("https://brain.example/api/capture", {
      method: "POST",
      headers: { origin: "https://brain.example", "content-type": "application/json" },
      body: JSON.stringify({ title: "내 기록" }),
    });
    const response = await handler(request, {});
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ title: "내 기록" });
  });

  test("does not pass an invalid IP literal to Postgres inet", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3" }))).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8::10" }))).toBe("2001:db8::10");
  });
});
