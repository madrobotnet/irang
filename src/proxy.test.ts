import { expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

test("serves public login fonts without a session", () => {
  const response = proxy(new NextRequest("https://brain.example/fonts/PretendardVariable.woff2"));

  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(response.headers.get("location")).toBeNull();
});

test("keeps note APIs protected without a session", () => {
  const response = proxy(new NextRequest("https://brain.example/api/notes"));

  expect(response.status).toBe(401);
});

test("redirects protected pages without a session", () => {
  const response = proxy(new NextRequest("https://brain.example/notes?tag=work"));
  const location = response.headers.get("location");

  expect(response.status).toBe(307);
  expect(location).toBe("https://brain.example/login?next=%2Fnotes%3Ftag%3Dwork");
});

test("allows only the exact installer entry points without a session", () => {
  for (const path of ["/setup", "/api/setup"]) {
    expect(proxy(new NextRequest(`https://brain.example${path}`)).headers.get("x-middleware-next")).toBe("1");
  }
  expect(proxy(new NextRequest("https://brain.example/api/setup/secrets")).status).toBe(401);
  expect(proxy(new NextRequest("https://brain.example/api/settings/ai")).status).toBe(401);
});

test("establishes a private browser nonce before parallel provider logins", () => {
  const response = proxy(new NextRequest("https://brain.example/setup"));
  const cookie = response.cookies.get("sb_ai_auth");
  expect(cookie?.value).toMatch(/^[a-f0-9]{64}$/);
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("lax");
  expect(cookie?.path).toBe("/");
  const next = proxy(new NextRequest("https://brain.example/setup", {
    headers: { cookie: `sb_ai_auth=${cookie?.value}` },
  }));
  expect(next.headers.get("set-cookie")).toBeNull();
});

test("allows provider login handlers to perform their own owner or installer checks", () => {
  for (const path of ["/api/ai/auth", `/api/ai/auth/${crypto.randomUUID()}`, `/api/ai/auth/openrouter/callback/${crypto.randomUUID()}`, "/connect/complete"]) {
    expect(proxy(new NextRequest(`https://brain.example${path}`)).headers.get("x-middleware-next")).toBe("1");
  }
  expect(proxy(new NextRequest("https://brain.example/api/settings/ai/connections")).status).toBe(401);
});
