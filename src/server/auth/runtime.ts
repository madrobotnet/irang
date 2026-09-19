import { authRuntimeConfigFromEnv } from "@/domain/auth/env-config";
import { AuthService } from "./service";
import type { AuthDeps } from "./ports";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
  InMemoryUserRepository,
} from "./memory";
import {
  argon2PasswordVerifier,
  opaqueSessionTokens,
  sha256TokenHasher,
} from "./crypto";
import { ensureAuthSchema, getPool } from "../db/postgres";
import {
  PostgresAuditRepository,
  PostgresLockoutRepository,
  PostgresSessionRepository,
  PostgresUserRepository,
} from "./postgres-repos";

export function loadAuthEnv(): { passwordHash: string; databaseUrl: string } {
  return {
    passwordHash: process.env.AUTH_PASSWORD_HASH ?? "",
    databaseUrl: process.env.DATABASE_URL ?? "",
  };
}

function systemClock() {
  return { now: () => Date.now() };
}

export async function createAuthDepsFromEnv(): Promise<AuthDeps> {
  const env = loadAuthEnv();
  const config = authRuntimeConfigFromEnv();
  if (!env.passwordHash) {
    throw new Error("AUTH_PASSWORD_HASH is required");
  }

  if (env.databaseUrl) {
    await ensureAuthSchema(env.databaseUrl);
    const pool = getPool(env.databaseUrl);
    const users = new PostgresUserRepository(pool);
    const userId = await users.ensureBootstrap(env.passwordHash);
    return {
      userId,
      config,
      users,
      sessions: new PostgresSessionRepository(pool, userId),
      lockouts: new PostgresLockoutRepository(pool),
      audit: new PostgresAuditRepository(pool),
      passwords: argon2PasswordVerifier,
      clock: systemClock(),
      tokens: opaqueSessionTokens,
      tokenHasher: sha256TokenHasher,
      passwordHashEnv: env.passwordHash,
    };
  }

  const users = new InMemoryUserRepository();
  const userId = await users.ensureBootstrap(env.passwordHash);
  return {
    userId,
    config,
    users,
    sessions: new InMemorySessionRepository(),
    lockouts: new InMemoryLockoutRepository(),
    audit: new InMemoryAuditRepository(),
    passwords: argon2PasswordVerifier,
    clock: systemClock(),
    tokens: opaqueSessionTokens,
    tokenHasher: sha256TokenHasher,
    passwordHashEnv: env.passwordHash,
  };
}

export function createMemoryAuthDeps(
  overrides: Partial<AuthDeps> & { passwordHashEnv: string },
): AuthDeps {
  const users =
    overrides.users instanceof InMemoryUserRepository
      ? overrides.users
      : (overrides.users ?? new InMemoryUserRepository());
  const userId =
    overrides.userId ??
    (users instanceof InMemoryUserRepository
      ? users.ensureBootstrapSync(overrides.passwordHashEnv)
      : "00000000-0000-4000-8000-000000000001");
  if (users instanceof InMemoryUserRepository && !overrides.userId) {
    users.ensureBootstrapSync(overrides.passwordHashEnv);
  }
  return {
    userId,
    config: overrides.config ?? authRuntimeConfigFromEnv(),
    sessions: overrides.sessions ?? new InMemorySessionRepository(),
    lockouts: overrides.lockouts ?? new InMemoryLockoutRepository(),
    users,
    audit: overrides.audit ?? new InMemoryAuditRepository(),
    passwords: overrides.passwords ?? argon2PasswordVerifier,
    clock: overrides.clock ?? systemClock(),
    tokens: overrides.tokens ?? opaqueSessionTokens,
    tokenHasher: overrides.tokenHasher ?? sha256TokenHasher,
    passwordHashEnv: overrides.passwordHashEnv,
  };
}

let runtime: { service: AuthService; deps: AuthDeps } | null = null;

export async function getAuthRuntime(): Promise<{ service: AuthService; deps: AuthDeps }> {
  if (runtime) {
    return runtime;
  }
  const env = loadAuthEnv();
  if (!env.passwordHash) {
    const deps = createMemoryAuthDeps({ passwordHashEnv: "" });
    runtime = { service: new AuthService(deps), deps };
    return runtime;
  }
  const deps = await createAuthDepsFromEnv();
  runtime = { service: new AuthService(deps), deps };
  return runtime;
}

export function setAuthRuntimeForTests(next: { service: AuthService; deps: AuthDeps } | null): void {
  runtime = next;
}

export function createAuthService(deps: AuthDeps): AuthService {
  return new AuthService(deps);
}
