import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "@/domain/auth/constants";
import { GRAPH_NODE_LIMIT, type LinkRecord } from "@/domain/graph/types";
import type { NoteRecord } from "@/domain/notes/types";
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
import { MemoryNotesStore } from "@/server/notes/memory-store";
import { handleGetNote } from "@/server/notes/http";
import { resetNotesRuntimeForTests, setNotesStoreForTests } from "@/server/notes/runtime";
import { handleCreateLink, handleDeleteLink, handleGetGraph } from "./http";
import { MemoryLinkStore } from "./memory-store";
import { resetLinkRuntimeForTests, setLinkStoreForTests } from "./runtime";

let notes: MemoryNotesStore;
let token = "";

function installRuntime() {
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
        return `opaque-token-${"a".repeat(40)}`;
      },
    },
    tokenHasher: sha256TokenHasher,
  });
  const service = createAuthService(deps);
  setAuthRuntimeForTests({ service, deps });
  return service;
}

function authed(url: string, init?: RequestInit): Request {
  const headers = new Headers(init?.headers);
  headers.set("cookie", `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`);
  return new Request(url, { ...init, headers });
}

async function makeNote(title: string, updatedAt: string): Promise<NoteRecord> {
  const created = await notes.createNote({ title, body: "secret body", status: "draft" });
  const stored = notes.notes.get(created.id);
  if (!stored) {
    throw new Error(`missing note ${created.id}`);
  }
  const stamped = { ...stored, updatedAt };
  notes.notes.set(created.id, stamped);
  return stamped;
}

async function postLink(
  fromNoteId: string,
  toNoteId: string,
  relation?: string,
): Promise<LinkRecord> {
  const response = await handleCreateLink(
    authed("http://localhost/api/links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromNoteId, toNoteId, relation }),
    }),
  );
  expect(response.status).toBe(201);
  const body = (await response.json()) as { ok: true; link: LinkRecord };
  return body.link;
}

function graphNode(note: NoteRecord) {
  return {
    id: note.id,
    kind: "note" as const,
    label: note.title,
    status: "draft" as const,
    updatedAt: note.updatedAt,
  };
}

function graphEdge(link: LinkRecord) {
  return {
    id: link.id,
    from: link.fromNoteId,
    to: link.toNoteId,
    relation: link.relation,
    directed: true as const,
  };
}

beforeEach(async () => {
  notes = new MemoryNotesStore();
  setNotesStoreForTests(notes);
  setLinkStoreForTests(new MemoryLinkStore());
  const service = installRuntime();
  const login = await service.login({ password: "ok-password", clientKey: "graph-test" });
  if (login.kind !== "ok") {
    throw new Error("login failed");
  }
  token = login.sessionToken;
});

afterEach(() => {
  resetNotesRuntimeForTests();
  resetLinkRuntimeForTests();
  setAuthRuntimeForTests(null);
});

describe("GET /api/graph", () => {
  it("returns 401 when the request has no session", async () => {
    const response = await handleGetGraph(new Request("http://localhost/api/graph"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
  });

  it("returns 401 when the session cookie is forged", async () => {
    const response = await handleGetGraph(
      new Request("http://localhost/api/graph", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${"b".repeat(43)}` },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
  });

  it("returns an empty graph for a vault with no notes", async () => {
    const response = await handleGetGraph(authed("http://localhost/api/graph"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      seedId: null,
      mode: "local",
      nodes: [],
      edges: [],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
  });

  it("returns the depth-1 neighborhood of the seed and leaves the farther note out", async () => {
    const alpha = await makeNote("A", "2026-01-01T00:00:00.000Z");
    const beta = await makeNote("B", "2026-01-02T00:00:00.000Z");
    const gamma = await makeNote("C", "2026-01-03T00:00:00.000Z");
    const delta = await makeNote("D", "2026-01-04T00:00:00.000Z");
    const ab = await postLink(alpha.id, beta.id);
    const ca = await postLink(gamma.id, alpha.id);
    const bc = await postLink(beta.id, gamma.id);
    const bd = await postLink(beta.id, delta.id);

    const response = await handleGetGraph(
      authed(`http://localhost/api/graph?seedId=${alpha.id}`),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      seedId: alpha.id,
      mode: "local",
      nodes: [graphNode(alpha), graphNode(gamma), graphNode(beta)],
      edges: [graphEdge(ab), graphEdge(bc), graphEdge(ca)].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
    expect(JSON.stringify(body)).not.toContain(delta.id);
    expect(JSON.stringify(body)).not.toContain("secret body");

    const detail = await handleGetNote(alpha.id);
    expect(detail.status).toBe(200);
    expect(await detail.json()).toEqual({
      ok: true,
      note: {
        id: alpha.id,
        title: "A",
        body: "secret body",
        status: "draft",
        createdAt: alpha.createdAt,
        updatedAt: alpha.updatedAt,
        deletedAt: null,
        purgeAt: null,
      },
    });
  });

  it("excludes a soft-deleted note and the edges that touch it", async () => {
    const alpha = await makeNote("A", "2026-01-01T00:00:00.000Z");
    const beta = await makeNote("B", "2026-01-02T00:00:00.000Z");
    const gamma = await makeNote("C", "2026-01-03T00:00:00.000Z");
    const ab = await postLink(alpha.id, beta.id);
    await postLink(alpha.id, gamma.id);
    await notes.softDeleteNote(
      gamma.id,
      new Date("2026-09-01T00:00:00.000Z"),
      new Date("2099-01-01T00:00:00.000Z"),
    );

    const response = await handleGetGraph(
      authed(`http://localhost/api/graph?seedId=${alpha.id}&depth=1`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      seedId: alpha.id,
      mode: "local",
      nodes: [graphNode(alpha), graphNode(beta)],
      edges: [graphEdge(ab)],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });

    const rejected = await handleCreateLink(
      authed("http://localhost/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromNoteId: alpha.id, toNoteId: gamma.id }),
      }),
    );
    expect(rejected.status).toBe(409);
    expect(await rejected.json()).toEqual({ ok: false, code: "deleted" });
  });

  it("sets truncated when mode=full exceeds the node cap", async () => {
    const created: NoteRecord[] = [];
    for (let index = 0; index < GRAPH_NODE_LIMIT + 1; index += 1) {
      created.push(
        await makeNote(
          `n${index}`,
          new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        ),
      );
    }
    const oldest = created[0];
    const newest = created[GRAPH_NODE_LIMIT];
    const previous = created[GRAPH_NODE_LIMIT - 1];
    if (!oldest || !newest || !previous) {
      throw new Error("fixture short");
    }
    const keep = await postLink(newest.id, previous.id);
    const drop = await postLink(newest.id, oldest.id);

    const response = await handleGetGraph(authed("http://localhost/api/graph?mode=full"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: true;
      mode: string;
      seedId: string | null;
      truncated: boolean;
      limit: number;
      nodes: { id: string; kind: string; x?: number; y?: number; z?: number }[];
      edges: { id: string }[];
    };
    expect(body.ok).toBe(true);
    expect(body.mode).toBe("full");
    expect(body.seedId).toBeNull();
    expect(body.truncated).toBe(true);
    expect(body.limit).toBe(GRAPH_NODE_LIMIT);
    expect(body.nodes).toHaveLength(body.limit);
    expect(body.nodes.map((node) => node.id)).not.toContain(oldest.id);
    expect(body.nodes.map((node) => node.id)).toContain(newest.id);
    expect(body.edges.map((edge) => edge.id)).toEqual([keep.id]);
    expect(body.edges.map((edge) => edge.id)).not.toContain(drop.id);
    expect(body.nodes.every((node) => node.x === undefined && node.y === undefined && node.z === undefined)).toBe(
      true,
    );
    expect(body.nodes.every((node) => node.kind === "note")).toBe(true);
  });

  it("rejects a depth outside 1..3", async () => {
    const response = await handleGetGraph(authed("http://localhost/api/graph?depth=9"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: "validation", fields: ["depth"] });
  });
});

describe("POST/DELETE /api/links", () => {
  it("returns 401 when the request has no session", async () => {
    const created = await handleCreateLink(
      new Request("http://localhost/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromNoteId: crypto.randomUUID(), toNoteId: crypto.randomUUID() }),
      }),
    );
    expect(created.status).toBe(401);
    expect(await created.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });

    const removed = await handleDeleteLink(
      crypto.randomUUID(),
      new Request(`http://localhost/api/links/${crypto.randomUUID()}`, { method: "DELETE" }),
    );
    expect(removed.status).toBe(401);
    expect(await removed.json()).toEqual({
      ok: false,
      authenticated: false,
      code: "unauthorized",
    });
  });

  it("rejects a self link and returns the same link when the triple already exists", async () => {
    const alpha = await makeNote("A", "2026-01-01T00:00:00.000Z");
    const beta = await makeNote("B", "2026-01-02T00:00:00.000Z");
    const self = await handleCreateLink(
      authed("http://localhost/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromNoteId: alpha.id, toNoteId: alpha.id }),
      }),
    );
    expect(self.status).toBe(400);
    expect(await self.json()).toEqual({ ok: false, code: "validation", fields: ["toNoteId"] });

    const first = await postLink(alpha.id, beta.id, "link");
    const again = await handleCreateLink(
      authed("http://localhost/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fromNoteId: alpha.id, toNoteId: beta.id }),
      }),
    );
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, link: first });
  });

  it("removes the edge after delete", async () => {
    const alpha = await makeNote("A", "2026-01-01T00:00:00.000Z");
    const beta = await makeNote("B", "2026-01-02T00:00:00.000Z");
    const created = await postLink(alpha.id, beta.id);
    const removed = await handleDeleteLink(
      created.id,
      authed(`http://localhost/api/links/${created.id}`, { method: "DELETE" }),
    );
    expect(removed.status).toBe(200);
    expect(await removed.json()).toEqual({ ok: true });

    const response = await handleGetGraph(authed(`http://localhost/api/graph?seedId=${alpha.id}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      seedId: alpha.id,
      mode: "local",
      nodes: [graphNode(alpha)],
      edges: [],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
  });
});
