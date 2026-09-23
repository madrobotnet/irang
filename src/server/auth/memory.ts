import type { AuditKind, SessionRecord } from "@/domain/auth/types";
import { lockoutFromFailures } from "@/domain/auth/lockout";
import type {
  AuditRepository,
  FailureRecordResult,
  LockoutRepository,
  LockoutWindow,
  SessionRepository,
  UserRepository,
} from "./ports";

function createMutex(): <T>(fn: () => Promise<T>) => Promise<T> {
  let gate: Promise<void> = Promise.resolve();
  return async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = gate;
    let release: () => void = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly byHash = new Map<string, SessionRecord>();
  private readonly exclusive = createMutex();

  async insert(session: SessionRecord): Promise<void> {
    this.byHash.set(session.tokenHashHex, { ...session });
  }

  async insertEnforcingCap(
    session: SessionRecord,
    userId: string,
    now: number,
    maxSessions: number,
  ): Promise<string[]> {
    return this.exclusive(async () => {
      const active = await this.listActiveForUser(userId, now);
      const keep = Math.max(0, maxSessions - 1);
      const newestFirst = [...active].sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return b.createdAt - a.createdAt;
        }
        return b.publicId.localeCompare(a.publicId);
      });
      const dropIds = newestFirst.slice(keep).map((row) => row.publicId);
      await this.revokeByPublicIds(dropIds, now);
      await this.insert(session);
      return dropIds;
    });
  }

  async findByTokenHashHex(tokenHashHex: string): Promise<SessionRecord | null> {
    const found = this.byHash.get(tokenHashHex);
    return found ? { ...found } : null;
  }

  async revokeByTokenHashHex(tokenHashHex: string, at: number): Promise<void> {
    const found = this.byHash.get(tokenHashHex);
    if (found) {
      this.byHash.set(tokenHashHex, { ...found, revokedAt: at });
    }
  }

  async listActiveForUser(_userId: string, now: number): Promise<SessionRecord[]> {
    return [...this.byHash.values()].filter(
      (s) => s.revokedAt === null && s.expiresAt > now,
    );
  }

  async revokeByPublicIds(publicIds: string[], at: number): Promise<void> {
    for (const session of this.byHash.values()) {
      if (publicIds.includes(session.publicId)) {
        this.byHash.set(session.tokenHashHex, { ...session, revokedAt: at });
      }
    }
  }
}

export class InMemoryLockoutRepository implements LockoutRepository {
  private readonly locks = new Map<string, number>();
  private readonly failures = new Map<string, number[]>();
  private readonly keyLocks = new Map<string, ReturnType<typeof createMutex>>();

  private lockFor(clientKey: string): ReturnType<typeof createMutex> {
    const existing = this.keyLocks.get(clientKey);
    if (existing) {
      return existing;
    }
    const created = createMutex();
    this.keyLocks.set(clientKey, created);
    return created;
  }

  async getLockedUntil(clientKey: string): Promise<number | null> {
    return this.locks.get(clientKey) ?? null;
  }

  async setLockedUntil(clientKey: string, lockedUntil: number): Promise<void> {
    this.locks.set(clientKey, lockedUntil);
  }

  async clearLock(clientKey: string): Promise<void> {
    this.locks.delete(clientKey);
  }

  async addFailure(clientKey: string, at: number): Promise<void> {
    const list = this.failures.get(clientKey) ?? [];
    list.push(at);
    this.failures.set(clientKey, list);
  }

  async listFailuresSince(clientKey: string, since: number): Promise<number[]> {
    return (this.failures.get(clientKey) ?? []).filter((t) => t > since);
  }

  async clearFailures(clientKey: string): Promise<void> {
    this.failures.delete(clientKey);
  }

  async recordFailureUnderLock(
    clientKey: string,
    now: number,
    window: LockoutWindow,
  ): Promise<FailureRecordResult> {
    return this.lockFor(clientKey)(async () => {
      const lockedUntil = this.locks.get(clientKey) ?? null;
      if (lockedUntil !== null && lockedUntil > now) {
        return { kind: "already_locked", lockedUntil };
      }
      const list = this.failures.get(clientKey) ?? [];
      list.push(now);
      this.failures.set(clientKey, list);
      const since = now - window.windowMs;
      const visible = list.filter((t) => t > since && t <= now);
      const decision = lockoutFromFailures(visible, now, window.maxFailures, window.lockoutMs);
      if (decision.shouldLock && decision.lockedUntil !== null) {
        this.locks.set(clientKey, decision.lockedUntil);
        this.failures.delete(clientKey);
        return {
          kind: "newly_locked",
          lockedUntil: decision.lockedUntil,
          failuresInWindow: decision.failuresInWindow,
        };
      }
      return { kind: "open", failuresInWindow: decision.failuresInWindow };
    });
  }

  async clearUnderLock(clientKey: string): Promise<void> {
    return this.lockFor(clientKey)(async () => {
      this.failures.delete(clientKey);
      this.locks.delete(clientKey);
    });
  }
}

export class InMemoryUserRepository implements UserRepository {
  private userId = "00000000-0000-4000-8000-000000000001";
  private passwordHash: string | null = null;

  ensureBootstrapSync(passwordHash: string): string {
    this.passwordHash = passwordHash;
    return this.userId;
  }

  async ensureBootstrap(passwordHash: string): Promise<string> {
    return this.ensureBootstrapSync(passwordHash);
  }

  async getPasswordHash(): Promise<string | null> {
    return this.passwordHash;
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  readonly events: Array<{
    kind: AuditKind;
    clientKey: string | null;
    sessionPublicId: string | null;
    meta: Record<string, unknown>;
    at: number;
  }> = [];

  async append(event: {
    kind: AuditKind;
    clientKey: string | null;
    sessionPublicId: string | null;
    meta: Record<string, unknown>;
    at: number;
  }): Promise<void> {
    this.events.push({ ...event });
  }
}
