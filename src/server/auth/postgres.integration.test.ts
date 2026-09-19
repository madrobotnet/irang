import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { argon2id, hash as argon2Hash } from "argon2";
import { unauthorizedBody } from "@/lib/auth/api-contract";
import { ensureAuthSchema, getPool, resetPoolForTests } from "../db/postgres";
import {
  createAuthDepsFromEnv,
  createAuthService,
  setAuthRuntimeForTests,
} from "./runtime";
import { handleLogin, handleLogout, handleMe } from "./http";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

describe.runIf(runIntegration)("Postgres auth round-trip", () => {
  let passwordHash = "";

  beforeAll(async () => {
    passwordHash = await argon2Hash("integration-password", {
      type: argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    process.env.AUTH_PASSWORD_HASH = passwordHash;
    process.env.DATABASE_URL = databaseUrl;
    setAuthRuntimeForTests(null);
    resetPoolForTests();
    await ensureAuthSchema(databaseUrl);
  });

  afterAll(() => {
    setAuthRuntimeForTests(null);
    resetPoolForTests();
  });

  it("login, me, logout with contract bodies and audit_events", async () => {
    const deps = await createAuthDepsFromEnv();
    const service = createAuthService(deps);
    setAuthRuntimeForTests({ service, deps });
    const pool = getPool(databaseUrl);
    const clientIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;

    const login = await handleLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": clientIp },
        body: JSON.stringify({ password: "integration-password" }),
      }),
    );
    expect(login.status).toBe(200);
    expect(await login.json()).toEqual({ ok: true });
    const setCookie = login.headers.get("set-cookie")!;
    const cookiePair = setCookie.split(";")[0]!;

    const me = await handleMe(
      new Request("http://localhost/api/auth/me", { headers: { cookie: cookiePair } }),
    );
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as {
      ok: boolean;
      authenticated: boolean;
      session: { id: string; expiresAt: string; createdAt: string };
    };
    expect(meBody.ok).toBe(true);
    expect(meBody.authenticated).toBe(true);
    expect(meBody.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const auditLogin = await pool.query(
      `SELECT kind FROM audit_events WHERE client_key = $1 AND kind = 'login_ok' ORDER BY created_at DESC LIMIT 1`,
      [clientIp],
    );
    expect(auditLogin.rows.length).toBe(1);

    const logout = await handleLogout(
      new Request("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { cookie: cookiePair, "x-forwarded-for": clientIp },
      }),
    );
    expect(logout.status).toBe(204);

    const meAfter = await handleMe(
      new Request("http://localhost/api/auth/me", { headers: { cookie: cookiePair } }),
    );
    expect(meAfter.status).toBe(401);
    expect(await meAfter.json()).toEqual(unauthorizedBody());

    const auditLogout = await pool.query(
      `SELECT kind FROM audit_events WHERE client_key = $1 AND kind = 'logout' ORDER BY created_at DESC LIMIT 1`,
      [clientIp],
    );
    expect(auditLogout.rows.length).toBe(1);
  });

  it("persists lockout in auth_lockouts and returns 429 locked contract", async () => {
    const deps = await createAuthDepsFromEnv();
    setAuthRuntimeForTests({ service: createAuthService(deps), deps });
    const pool = getPool(databaseUrl);
    const clientIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;

    for (let i = 0; i < 4; i++) {
      const res = await handleLogin(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": clientIp },
          body: JSON.stringify({ password: "wrong-password" }),
        }),
      );
      expect(res.status).toBe(401);
    }

    const locked = await handleLogin(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": clientIp },
        body: JSON.stringify({ password: "wrong-password" }),
      }),
    );
    expect(locked.status).toBe(429);
    const body = (await locked.json()) as {
      ok: boolean;
      code: string;
      retryAfterSec: number;
      retryAfterSeconds: number;
      unlockAt: string;
    };
    expect(body.ok).toBe(false);
    expect(body.code).toBe("locked");
    expect(body.retryAfterSec).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBe(body.retryAfterSec);
    expect(body.unlockAt).toMatch(/Z$/);

    const row = await pool.query(
      `SELECT locked_until FROM auth_lockouts WHERE client_key = $1`,
      [clientIp],
    );
    expect(row.rows[0]?.locked_until).toBeTruthy();

    const auditLock = await pool.query(
      `SELECT kind FROM audit_events WHERE client_key = $1 AND kind = 'lockout' ORDER BY created_at DESC LIMIT 1`,
      [clientIp],
    );
    expect(auditLock.rows.length).toBe(1);
  });
});
