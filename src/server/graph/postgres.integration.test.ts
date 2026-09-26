import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureAuthSchema, getPool, resetPoolForTests } from "@/server/db/postgres";
import { ensureNotesSchema, resetNotesSchemaForTests } from "@/server/notes/schema";
import { PostgresNotesStore } from "@/server/notes/postgres-store";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { handleCreateLink, handleDeleteLink, handleGetGraph } from "./http";
import { PostgresLinkStore } from "./postgres-store";
import { resetLinkRuntimeForTests, setLinkStoreForTests } from "./runtime";
import { ensureGraphSchema, resetGraphSchemaForTests } from "./schema";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import {
  InMemoryAuditRepository,
  InMemoryLockoutRepository,
  InMemorySessionRepository,
} from "@/server/auth/memory";
import { sha256TokenHasher } from "@/server/auth/crypto";
import {
  createAuthService,
  createMemoryAuthDeps,
  setAuthRuntimeForTests,
} from "@/server/auth/runtime";

const databaseUrl = process.env.DATABASE_URL ?? "";
const runIntegration = process.env.RUN_PG_INTEGRATION === "1" && databaseUrl.length > 0;

describe.runIf(runIntegration)("Postgres links schema", () => {
  let token = "";

  beforeAll(async () => {
    resetPoolForTests();
    resetNotesSchemaForTests();
    resetGraphSchemaForTests();
    await ensureAuthSchema(databaseUrl);
    await ensureNotesSchema(databaseUrl);
    await ensureGraphSchema(databaseUrl);
    const pool = getPool(databaseUrl);
    setNotesStoreForTests(new PostgresNotesStore(pool));
    setLinkStoreForTests(new PostgresLinkStore(pool));
    const deps = createMemoryAuthDeps({
      sessions: new InMemorySessionRepository(),
      lockouts: new InMemoryLockoutRepository(),
      audit: new InMemoryAuditRepository(),
      passwordHashEnv: "stored-hash",
      passwords: {
        async verify(hash, password) {
          return hash === "stored-hash" && password === "ok-password";
        },
      },
      tokens: {
        nextToken() {
          return `opaque-token-${"c".repeat(40)}`;
        },
      },
      tokenHasher: sha256TokenHasher,
    });
    const service = createAuthService(deps);
    setAuthRuntimeForTests({ service, deps });
    const login = await service.login({ password: "ok-password", clientKey: "graph-pg" });
    if (login.kind !== "ok") {
      throw new Error("login failed");
    }
    token = login.sessionToken;
  });

  afterAll(() => {
    resetNotesRuntimeForTests();
    resetLinkRuntimeForTests();
    setAuthRuntimeForTests(null);
    resetPoolForTests();
  });

  it("persists a directed link and hides it after delete", async () => {
    const notes = new PostgresNotesStore(getPool(databaseUrl));
    const from = await notes.createNote({ title: "pg-from", body: "a", status: "draft" });
    const to = await notes.createNote({ title: "pg-to", body: "b", status: "draft" });
    const headers = {
      cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "content-type": "application/json",
    };
    const created = await handleCreateLink(
      new Request("http://localhost/api/links", {
        method: "POST",
        headers,
        body: JSON.stringify({ fromNoteId: from.id, toNoteId: to.id, relation: "link" }),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { link: { id: string } };

    const graph = await handleGetGraph(
      new Request(`http://localhost/api/graph?seedId=${from.id}&depth=1`, { headers }),
    );
    expect(graph.status).toBe(200);
    const payload = (await graph.json()) as {
      nodes: { id: string; label: string }[];
      edges: { id: string; from: string; to: string; directed: boolean }[];
    };
    expect(payload.nodes.map((node) => node.label).sort()).toEqual(["pg-from", "pg-to"]);
    expect(payload.edges).toEqual([
      {
        id: createdBody.link.id,
        from: from.id,
        to: to.id,
        relation: "link",
        directed: true,
      },
    ]);

    const again = await handleCreateLink(
      new Request("http://localhost/api/links", {
        method: "POST",
        headers,
        body: JSON.stringify({ fromNoteId: from.id, toNoteId: to.id }),
      }),
    );
    expect(again.status).toBe(200);
    const againBody = (await again.json()) as { link: { id: string } };
    expect(againBody.link.id).toBe(createdBody.link.id);

    const columns = await getPool(databaseUrl).query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'links'
       ORDER BY column_name`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      "created_at",
      "from_note_id",
      "id",
      "relation",
      "to_note_id",
    ]);

    await expect(
      getPool(databaseUrl).query(
        `INSERT INTO links (from_note_id, to_note_id, relation)
         VALUES ($1::uuid, $1::uuid, 'link')`,
        [from.id],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const removed = await handleDeleteLink(
      createdBody.link.id,
      new Request(`http://localhost/api/links/${createdBody.link.id}`, {
        method: "DELETE",
        headers,
      }),
    );
    expect(removed.status).toBe(200);
    const after = await handleGetGraph(
      new Request(`http://localhost/api/graph?seedId=${from.id}`, { headers }),
    );
    const afterBody = (await after.json()) as { edges: unknown[]; nodes: { id: string }[] };
    expect(afterBody.edges).toEqual([]);
    expect(afterBody.nodes.map((node) => node.id)).toEqual([from.id]);
  });
});
