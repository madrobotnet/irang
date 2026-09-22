import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, it } from "node:test";
import { z } from "zod";
import { startApp, sessionCookie } from "./fixture.test";

let app: Awaited<ReturnType<typeof startApp>>;
before(async () => { app = await startApp(); }, { timeout: 150_000 });
beforeEach(async () => { await app.reset(); });
after(async () => { if (app) await app.close(); });

for (const cookie of ["", "brain_session=forged-token"]) {
  it(`redirects without the shell when the cookie is ${cookie ? "forged" : "absent"}`, async () => {
    // Given / When
    const response = await app.request("/", { headers: { cookie } });
    // Then
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get("location") ?? "", app.origin).pathname, "/login");
    assert.equal((await response.text()).includes("data-app-shell"), false);
  });
}

for (const path of ["/api/private", "/api/auth/sessions", `/api/auth/sessions/${randomUUID()}`]) {
  it(`returns JSON unauthorized when a forged cookie requests ${path}`, async () => {
    // Given / When
    const response = await app.request(path, {
      method: path.startsWith("/api/auth/sessions/") ? "DELETE" : "GET", headers: { cookie: "brain_session=forged" },
    });
    // Then
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });
}

it("serves the public login without a protected shell when logged out", async () => {
  // Given / When
  const response = await app.request("/login");
  // Then
  assert.equal(response.status, 200);
  assert.equal((await response.text()).includes("data-app-shell"), false);
});

it("audits a failed login when the password is wrong", async () => {
  // Given / When
  const response = await app.login(`${app.password}-wrong`);
  // Then
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "invalid_credentials" });
  const failures = await app.database`SELECT ip FROM login_failures`;
  assert.equal(failures.length, 1);
  const events = await app.database`SELECT action FROM audit_events`;
  assert.deepEqual(Array.from(events), [{ action: "login_failure" }]);
});

it("rejects even the right password when a lock is active", async () => {
  // Given
  const retryAt = new Date("2099-01-01T00:00:00Z");
  await app.database`INSERT INTO login_locks (ip, locked_until) VALUES ('192.0.2.1', ${retryAt})`;
  // When
  const response = await app.login();
  // Then
  assert.equal(response.status, 423);
  assert.deepEqual(await response.json(), { error: "locked", retryAt: retryAt.toISOString() });
  assert.equal((await app.database`SELECT id FROM sessions`).length, 0);
  assert.equal((await app.database`SELECT id FROM audit_events`).length, 0);
});

it("starts a lock when five wrong passwords precede a correct login", async () => {
  // Given
  for (let i = 0; i < 5; i++) assert.equal((await app.login("wrong")).status, 401);
  // When
  const response = await app.login();
  // Then
  assert.equal(response.status, 423);
});

it("creates an audited session and clears failures when the password is right", async () => {
  // Given
  await app.database`INSERT INTO login_failures (ip, attempted_at) VALUES ('192.0.2.1', now())`;
  // When
  const response = await app.login();
  // Then
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  const attributes = response.headers.get("set-cookie")?.split("; ").slice(1).sort();
  assert.deepEqual(attributes, ["HttpOnly", "Max-Age=604800", "Path=/", "SameSite=Lax"].sort());
  assert.equal((await app.database`SELECT id FROM sessions`).length, 1);
  assert.equal((await app.database`SELECT id FROM login_failures`).length, 0);
  assert.deepEqual(Array.from(await app.database`SELECT action FROM audit_events`), [{ action: "login_success" }]);
});

it("renders the protected shell with a logout form when a real session is presented", async () => {
  // Given
  const cookie = sessionCookie(await app.login());
  // When
  const response = await app.request("/", { headers: { cookie } });
  // Then
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.equal(html.includes('data-app-shell="brain"'), true);
  assert.equal(/<form[^>]*action="\/api\/auth\/logout"[^>]*method="post"/.test(html), true);
});

it("lists only public session metadata when logged in", async () => {
  // Given
  const cookie = sessionCookie(await app.login());
  // When
  const response = await app.request("/api/auth/sessions", { headers: { cookie } });
  // Then
  assert.equal(response.status, 200);
  const body = z.object({ sessions: z.array(z.object({ id: z.uuid() }).passthrough()) }).parse(await response.json());
  assert.equal(body.sessions.length, 1);
  assert.equal(body.sessions.some((session) => "token" in session || "token_hash" in session), false);
});

it("revokes another session when its ID is deleted by the logged-in user", async () => {
  // Given
  const first = sessionCookie(await app.login());
  const second = sessionCookie(await app.login());
  const [target] = await app.database<{ readonly id: string }[]>`SELECT id FROM sessions ORDER BY created_at DESC LIMIT 1`;
  assert.ok(target);
  // When
  const response = await app.request(`/api/auth/sessions/${target.id}`, { method: "DELETE", headers: { cookie: first } });
  // Then
  assert.equal(response.status, 204);
  assert.equal((await app.request("/", { headers: { cookie: second } })).status, 302);
  assert.equal((await app.request("/", { headers: { cookie: first } })).status, 200);
});

it("logs out and invalidates the cookie when a session exists", async () => {
  // Given
  const cookie = sessionCookie(await app.login());
  // When
  const response = await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
  // Then
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), "brain_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  assert.equal((await app.request("/", { headers: { cookie } })).status, 302);
  assert.equal((await app.database`SELECT id FROM audit_events WHERE action = 'logout'`).length, 1);
});

for (const cookie of ["", "brain_session=forged"]) {
  it(`clears cookies safely when logout has ${cookie ? "an unknown" : "no"} session`, async () => {
    // Given / When
    const response = await app.request("/api/auth/logout", { method: "POST", headers: { cookie } });
    // Then
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("set-cookie")?.includes("Max-Age=0"), true);
  });
}

for (const path of ["/login", "/", "/api/private"]) {
  it(`sends security headers when requesting ${path}`, async () => {
    // Given / When
    const response = await app.request(path);
    // Then
    assert.equal(response.headers.get("content-security-policy"), "default-src 'self'; frame-ancestors 'none'");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
    assert.equal(response.headers.has("strict-transport-security"), false);
  });
}

it("sets HSTS when the proxy reports HTTPS", async () => {
  // Given / When
  const response = await app.request("/", { headers: { "x-forwarded-proto": "https" } });
  // Then
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
});
