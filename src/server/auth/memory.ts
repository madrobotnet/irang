import type { AuditKind, SessionRecord } from "@/domain/auth/types";
import type {
  AuditRepository,
  LockoutRepository,
  SessionRepository,
  UserRepository,
} from "./ports";

export class InMemorySessionRepository implements SessionRepository {
  private readonly byHash = new Map<string, SessionRecord>();

  async insert(session: SessionRecord): Promise<void> {
    this.byHash.set(session.tokenHashHex, { ...session });
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
