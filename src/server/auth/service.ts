import { evaluateLockout, lockoutFromFailures } from "@/domain/auth/lockout";
import { isSessionActive, publicIdsToDropOldest, sessionExpiry } from "@/domain/auth/session-policy";
import type { LoginResult, SessionRecord } from "@/domain/auth/types";
import { randomUUID } from "crypto";
import type { AuthDeps } from "./ports";

export class AuthService {
  constructor(private readonly deps: AuthDeps) {}

  private async passwordHash(): Promise<string | null> {
    const fromDb = await this.deps.users.getPasswordHash();
    return fromDb ?? (this.deps.passwordHashEnv || null);
  }

  async login(args: {
    password: string;
    clientKey: string;
  }): Promise<LoginResult> {
    const now = this.deps.clock.now();
    const cfg = this.deps.config;
    const hash = await this.passwordHash();
    if (!hash) {
      return { kind: "misconfigured" };
    }

    if (!args.password) {
      return { kind: "validation" };
    }

    const lockedUntil = await this.deps.lockouts.getLockedUntil(args.clientKey);
    const lock = evaluateLockout(now, lockedUntil);
    if (lock.kind === "locked") {
      return {
        kind: "locked",
        retryAfterMs: lock.retryAfterMs,
        lockedUntil: lock.lockedUntil,
      };
    }
    if (lockedUntil !== null && lockedUntil <= now) {
      await this.deps.lockouts.clearLock(args.clientKey);
    }

    const ok = await this.deps.passwords.verify(hash, args.password);
    if (!ok) {
      await this.deps.lockouts.addFailure(args.clientKey, now);
      const timestamps = await this.deps.lockouts.listFailuresSince(
        args.clientKey,
        now - cfg.failureWindowMs,
      );
      const decision = lockoutFromFailures(
        timestamps,
        now,
        cfg.maxFailures,
        cfg.lockoutMs,
      );
      if (decision.shouldLock && decision.lockedUntil !== null) {
        await this.deps.lockouts.setLockedUntil(args.clientKey, decision.lockedUntil);
        await this.deps.lockouts.clearFailures(args.clientKey);
        await this.deps.audit.append({
          kind: "lockout",
          clientKey: args.clientKey,
          sessionPublicId: null,
          meta: { failuresInWindow: decision.failuresInWindow },
          at: now,
        });
        return {
          kind: "locked",
          retryAfterMs: decision.lockedUntil - now,
          lockedUntil: decision.lockedUntil,
        };
      }
      await this.deps.audit.append({
        kind: "login_fail",
        clientKey: args.clientKey,
        sessionPublicId: null,
        meta: {},
        at: now,
      });
      return { kind: "bad_password" };
    }

    await this.deps.lockouts.clearFailures(args.clientKey);
    await this.deps.lockouts.clearLock(args.clientKey);

    const sessionToken = this.deps.tokens.nextToken();
    const tokenHashHex = await this.deps.tokenHasher.hash(sessionToken);
    const expiresAt = sessionExpiry(now, cfg.sessionTtlMs);
    const publicId = randomUUID();
    const record: SessionRecord = {
      publicId,
      tokenHashHex,
      createdAt: now,
      expiresAt,
      revokedAt: null,
    };
    await this.deps.sessions.insert(record);

    const active = await this.deps.sessions.listActiveForUser(this.deps.userId, now);
    const dropIds = publicIdsToDropOldest(active, now, cfg.maxSessions);
    if (dropIds.length > 0) {
      await this.deps.sessions.revokeByPublicIds(dropIds, now);
      for (const id of dropIds) {
        await this.deps.audit.append({
          kind: "session_drop",
          clientKey: args.clientKey,
          sessionPublicId: id,
          meta: { reason: "max_sessions" },
          at: now,
        });
      }
    }

    await this.deps.audit.append({
      kind: "login_ok",
      clientKey: args.clientKey,
      sessionPublicId: publicId,
      meta: {},
      at: now,
    });

    return { kind: "ok", sessionToken, publicSessionId: publicId, expiresAt };
  }

  async logout(sessionToken: string | null, clientKey: string): Promise<void> {
    const now = this.deps.clock.now();
    if (!sessionToken) {
      return;
    }
    const tokenHashHex = await this.deps.tokenHasher.hash(sessionToken);
    const found = await this.deps.sessions.findByTokenHashHex(tokenHashHex);
    await this.deps.sessions.revokeByTokenHashHex(tokenHashHex, now);
    if (found) {
      await this.deps.audit.append({
        kind: "logout",
        clientKey,
        sessionPublicId: found.publicId,
        meta: {},
        at: now,
      });
    }
  }

  async lookup(sessionToken: string | null): Promise<SessionRecord | null> {
    if (!sessionToken) {
      return null;
    }
    const now = this.deps.clock.now();
    const tokenHashHex = await this.deps.tokenHasher.hash(sessionToken);
    const found = await this.deps.sessions.findByTokenHashHex(tokenHashHex);
    if (!found || !isSessionActive(found, now)) {
      if (found && found.expiresAt <= now) {
        await this.deps.sessions.revokeByTokenHashHex(tokenHashHex, now);
      }
      return null;
    }
    return found;
  }
}
