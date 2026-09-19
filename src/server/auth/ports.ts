import type { AuthRuntimeConfig } from "@/domain/auth/env-config";
import type { AuditKind, SessionRecord } from "@/domain/auth/types";

export interface SessionRepository {
  insert(session: SessionRecord): Promise<void>;
  findByTokenHashHex(tokenHashHex: string): Promise<SessionRecord | null>;
  revokeByTokenHashHex(tokenHashHex: string, at: number): Promise<void>;
  listActiveForUser(userId: string, now: number): Promise<SessionRecord[]>;
  revokeByPublicIds(publicIds: string[], at: number): Promise<void>;
}

export interface LockoutRepository {
  getLockedUntil(clientKey: string): Promise<number | null>;
  setLockedUntil(clientKey: string, lockedUntil: number): Promise<void>;
  clearLock(clientKey: string): Promise<void>;
  addFailure(clientKey: string, at: number): Promise<void>;
  listFailuresSince(clientKey: string, since: number): Promise<number[]>;
  clearFailures(clientKey: string): Promise<void>;
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
