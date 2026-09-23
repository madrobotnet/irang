import type { AuthRuntimeConfig } from "@/domain/auth/env-config";
import type { AuditKind, SessionRecord } from "@/domain/auth/types";

export interface SessionRepository {
  insert(session: SessionRecord): Promise<void>;
  /**
   * Insert one session and revoke the oldest active sessions above maxSessions.
   * Postgres holds pg_advisory_xact_lock on `brain:sessions` for the unit.
   * Returned ids are the sessions revoked to make room. The inserted session is kept.
   */
  insertEnforcingCap(
    session: SessionRecord,
    userId: string,
    now: number,
    maxSessions: number,
  ): Promise<string[]>;
  findByTokenHashHex(tokenHashHex: string): Promise<SessionRecord | null>;
  revokeByTokenHashHex(tokenHashHex: string, at: number): Promise<void>;
  listActiveForUser(userId: string, now: number): Promise<SessionRecord[]>;
  revokeByPublicIds(publicIds: string[], at: number): Promise<void>;
}

export type LockoutWindow = {
  readonly windowMs: number;
  readonly maxFailures: number;
  readonly lockoutMs: number;
};

export type FailureRecordResult =
  | { readonly kind: "already_locked"; readonly lockedUntil: number }
  | { readonly kind: "newly_locked"; readonly lockedUntil: number; readonly failuresInWindow: number }
  | { readonly kind: "open"; readonly failuresInWindow: number };

export interface LockoutRepository {
  getLockedUntil(clientKey: string): Promise<number | null>;
  setLockedUntil(clientKey: string, lockedUntil: number): Promise<void>;
  clearLock(clientKey: string): Promise<void>;
  addFailure(clientKey: string, at: number): Promise<void>;
  listFailuresSince(clientKey: string, since: number): Promise<number[]>;
  clearFailures(clientKey: string): Promise<void>;
  /**
   * Count one failure and maybe start a lock.
   * An active lock is returned unchanged (it is not extended).
   * Postgres holds pg_advisory_xact_lock on `brain:login:` + clientKey.
   */
  recordFailureUnderLock(
    clientKey: string,
    now: number,
    window: LockoutWindow,
  ): Promise<FailureRecordResult>;
  /** Clear failures and any lock for this client under the same advisory key. */
  clearUnderLock(clientKey: string): Promise<void>;
}

export interface UserRepository {
  ensureBootstrap(passwordHash: string): Promise<string>;
  getPasswordHash(): Promise<string | null>;
}

export interface AuditRepository {
  append(event: {
    kind: AuditKind;
    clientKey: string | null;
    sessionPublicId: string | null;
    meta: Record<string, unknown>;
    at: number;
  }): Promise<void>;
}

export interface PasswordVerifier {
  verify(hash: string, password: string): Promise<boolean>;
}

export interface Clock {
  now(): number;
}

export interface SessionTokenFactory {
  nextToken(): string;
}

export interface TokenHasher {
  hash(token: string): Promise<string>;
}

export type AuthDeps = {
  userId: string;
  config: AuthRuntimeConfig;
  sessions: SessionRepository;
  lockouts: LockoutRepository;
  users: UserRepository;
  audit: AuditRepository;
  passwords: PasswordVerifier;
  clock: Clock;
  tokens: SessionTokenFactory;
  tokenHasher: TokenHasher;
  passwordHashEnv: string;
};
