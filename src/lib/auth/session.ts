import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/client";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_MAX = 5;
export const SESSION_COOKIE = "brain_session";

const sessionSchema = z.object({
  id: z.uuid().brand("SessionId"),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastSeenAt: z.date(),
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
}).readonly();
export type Session = z.infer<typeof sessionSchema>;
export type SessionMetadata = {
  readonly ip?: string | null;
  readonly userAgent?: string | null;
};

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(metadata: SessionMetadata = {}, now = new Date()): Promise<Session & { readonly token: string }> {
  const token = randomBytes(32).toString("hex");
  return getDb().begin(async (sql) => {
    await sql`SELECT pg_advisory_xact_lock(hashtext(current_schema()), hashtext('brain:sessions'))`;
    // Make room before insertion so the new session survives timestamp ties.
    await sql`
      DELETE FROM sessions WHERE id IN (
        SELECT id FROM sessions WHERE expires_at > ${now}
        ORDER BY created_at DESC, id DESC OFFSET ${SESSION_MAX - 1}
      )
    `;
    const [row] = await sql`
      INSERT INTO sessions (id, token_hash, created_at, expires_at, last_seen_at, user_agent, ip)
      VALUES (${randomUUID()}, ${tokenHash(token)}, ${now}, ${new Date(now.getTime() + SESSION_TTL_MS)},
              ${now}, ${metadata.userAgent ?? null}, ${metadata.ip ?? null})
      RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt", last_seen_at AS "lastSeenAt",
                user_agent AS "userAgent", ip
    `;
    return { ...sessionSchema.parse(row), token };
  });
}

export async function resolveSession(token: string, now = new Date()): Promise<Session | null> {
  const [row] = await getDb()`
    UPDATE sessions SET last_seen_at = ${now}
    WHERE token_hash = ${tokenHash(token)} AND expires_at > ${now}
    RETURNING id, created_at AS "createdAt", expires_at AS "expiresAt", last_seen_at AS "lastSeenAt",
              user_agent AS "userAgent", ip
  `;
  return row ? sessionSchema.parse(row) : null;
}

export async function revokeByToken(token: string): Promise<void> {
  await getDb()`DELETE FROM sessions WHERE token_hash = ${tokenHash(token)}`;
}

export async function revokeById(id: string): Promise<void> {
  await getDb()`DELETE FROM sessions WHERE id = ${id}`;
}

export async function listSessions(now = new Date()): Promise<readonly Session[]> {
  const rows = await getDb()`
    SELECT id, created_at AS "createdAt", expires_at AS "expiresAt", last_seen_at AS "lastSeenAt",
           user_agent AS "userAgent", ip
    FROM sessions WHERE expires_at > ${now} ORDER BY created_at DESC, id DESC
  `;
  return z.array(sessionSchema).parse(rows);
}
