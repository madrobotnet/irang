import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { ApiError, json, parseJson, withPublicApi } from "./http";
import { clientIp } from "./auth/client-ip";
import { localizedIssue } from "@/lib/i18n/validation";
import { genericIssueCopy } from "@/lib/i18n/validation-copy";
import { SEARCH_COPY } from "@/features/search/search-copy";

const handler = withPublicApi(async (request) => {
  const input = await parseJson(request, z.object({ title: z.string() }));
  return json(input, { status: 201 });
});

describe("mutation request boundaries", () => {
  test("query validation names the same field as the search form without exposing its value", async () => {
    const query = "private-query-".repeat(40);
    const validate = withPublicApi(async (request) => json(z.object({ q: z.string().max(500) }).parse({
      q: new URL(request.url).searchParams.get("q"),
    })));
    const response = await validate(new Request(`https://brain.example/api/search?q=${query}`), {});
    const body = await response.json();
    const text = genericIssueCopy.maxChars("500");
    expect(response.status).toBe(400);
    expect(body.error.localized).toEqual({
      ko: `${SEARCH_COPY.ko.form.queryLabel}: ${text.ko}`,
      en: `${SEARCH_COPY.en.form.queryLabel}: ${text.en}`,
    });
    expect(JSON.stringify(body)).not.toContain(query);
  });

  test("custom validation retains each issue's translations without matching diagnostic prose", async () => {
    const first = { ko: "shared-diagnostic", en: "first-marker" };
    const second = { ko: "shared-diagnostic", en: "second-marker" };
    const schema = z.object({
      first: z.string().refine(() => false, localizedIssue(first)),
      second: z.string().refine(() => false, localizedIssue(second)),
    });
    const validate = withPublicApi(async (request) => json(await parseJson(request, schema)));
    const response = await validate(new Request("https://brain.example/api/example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ first: "private-one", second: "private-two" }),
    }), {});
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation");
    expect(body.error.localized).toEqual({
      ko: `first: ${first.ko}; second: ${second.ko}`,
      en: `first: ${first.en}; second: ${second.en}`,
    });
    expect(JSON.stringify(body)).not.toContain("private-one");
    expect(JSON.stringify(body)).not.toContain("private-two");
  });

  test("built-in validation produces both languages from the issue code and limit", async () => {
    const schema = z.object({ title: z.string().min(3) });
    const validate = withPublicApi(async (request) => json(await parseJson(request, schema)));
    const response = await validate(new Request("https://brain.example/api/example", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "a" }),
    }), {});
    const text = genericIssueCopy.minChars("3");
    expect((await response.json()).error.localized).toEqual({
      ko: `title: ${text.ko}`,
      en: `title: ${text.en}`,
    });
  });

  test("retains both locales while preserving status, retry headers and diagnostic message", async () => {
    const localized = { ko: "ko-marker", en: "en-marker" };
    const failure = new ApiError("rate_limited", localized, { retryAfterSeconds: 11 });
    const localizedHandler = withPublicApi(async () => { throw failure; });
    const response = await localizedHandler(new Request("https://brain.example/api/example"), {});
    expect(failure.message).toBe(localized.en);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("11");
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", message: localized.en, localized, retryAfterSeconds: 11 },
    });
  });

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
