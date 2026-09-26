import { describe, expect, it } from "vitest";
import type { NoteRecord } from "@/domain/notes/types";
import { projectGraph } from "./project";
import {
  GRAPH_NODE_KINDS,
  GRAPH_NODE_LIMIT,
  GRAPH_RELATIONS,
  type GraphQuery,
  type LinkRecord,
} from "./types";

function note(input: {
  id: string;
  title: string;
  updatedAt: string;
  deletedAt?: string | null;
}): NoteRecord {
  return {
    id: input.id,
    title: input.title,
    body: "secret body",
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: input.updatedAt,
    deletedAt: input.deletedAt ?? null,
    purgeAt: null,
  };
}

function link(input: {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  relation?: LinkRecord["relation"];
}): LinkRecord {
  return {
    id: input.id,
    fromNoteId: input.fromNoteId,
    toNoteId: input.toNoteId,
    relation: input.relation ?? "link",
    createdAt: "2026-01-02T00:00:00.000Z",
  };
}

function query(patch: Partial<GraphQuery> = {}): GraphQuery {
  return {
    seedId: null,
    depth: 1,
    kinds: GRAPH_NODE_KINDS,
    relations: GRAPH_RELATIONS,
    mode: "local",
    ...patch,
  };
}

const A = note({ id: "a", title: "A", updatedAt: "2026-01-01T00:00:00.000Z" });
const B = note({ id: "b", title: "B", updatedAt: "2026-01-02T00:00:00.000Z" });
const C = note({ id: "c", title: "C", updatedAt: "2026-01-03T00:00:00.000Z" });
const D = note({ id: "d", title: "D", updatedAt: "2026-01-04T00:00:00.000Z" });

describe("projectGraph", () => {
  it("returns an empty payload when the vault has no live notes", () => {
    expect(
      projectGraph({
        notes: [],
        links: [],
        query: query(),
      }),
    ).toEqual({
      ok: true,
      seedId: null,
      mode: "local",
      nodes: [],
      edges: [],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
  });

  it("keeps the depth-1 induced neighborhood and drops the farther note", () => {
    const payload = projectGraph({
      notes: [A, B, C, D],
      links: [
        link({ id: "e-ab", fromNoteId: "a", toNoteId: "b" }),
        link({ id: "e-ca", fromNoteId: "c", toNoteId: "a" }),
        link({ id: "e-bc", fromNoteId: "b", toNoteId: "c" }),
        link({ id: "e-bd", fromNoteId: "b", toNoteId: "d" }),
      ],
      query: query({ seedId: "a", depth: 1, mode: "local" }),
    });

    expect(payload).toEqual({
      ok: true,
      seedId: "a",
      mode: "local",
      nodes: [
        { id: "a", kind: "note", label: "A", status: "draft", updatedAt: A.updatedAt },
        { id: "c", kind: "note", label: "C", status: "draft", updatedAt: C.updatedAt },
        { id: "b", kind: "note", label: "B", status: "draft", updatedAt: B.updatedAt },
      ],
      edges: [
        { id: "e-ab", from: "a", to: "b", relation: "link", directed: true },
        { id: "e-bc", from: "b", to: "c", relation: "link", directed: true },
        { id: "e-ca", from: "c", to: "a", relation: "link", directed: true },
      ],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
    expect(JSON.stringify(payload)).not.toContain("secret body");
  });

  it("omits a soft-deleted note and every edge that touches it", () => {
    const deletedC = note({
      id: "c",
      title: "C",
      updatedAt: C.updatedAt,
      deletedAt: "2026-02-01T00:00:00.000Z",
    });
    const payload = projectGraph({
      notes: [A, B, deletedC],
      links: [
        link({ id: "e-ab", fromNoteId: "a", toNoteId: "b" }),
        link({ id: "e-ac", fromNoteId: "a", toNoteId: "c" }),
      ],
      query: query({ seedId: "a" }),
    });

    expect(payload.nodes.map((node) => node.id)).toEqual(["a", "b"]);
    expect(payload.edges).toEqual([
      { id: "e-ab", from: "a", to: "b", relation: "link", directed: true },
    ]);
    expect(payload.seedId).toBe("a");
  });

  it("returns no nodes when the requested seed is soft-deleted", () => {
    const deleted = note({
      id: "a",
      title: "A",
      updatedAt: A.updatedAt,
      deletedAt: "2026-02-01T00:00:00.000Z",
    });
    expect(
      projectGraph({
        notes: [deleted, B],
        links: [link({ id: "e-ab", fromNoteId: "a", toNoteId: "b" })],
        query: query({ seedId: "a" }),
      }),
    ).toEqual({
      ok: true,
      seedId: null,
      mode: "local",
      nodes: [],
      edges: [],
      truncated: false,
      limit: GRAPH_NODE_LIMIT,
    });
  });

  it("uses the newest live note when local mode has no seed", () => {
    const payload = projectGraph({
      notes: [A, B],
      links: [],
      query: query({ seedId: null, depth: 1 }),
    });
    expect(payload.seedId).toBe("b");
    expect(payload.nodes).toEqual([
      { id: "b", kind: "note", label: "B", status: "draft", updatedAt: B.updatedAt },
    ]);
  });

  it("does not walk edges outside the relation filter", () => {
    const payload = projectGraph({
      notes: [A, B, C],
      links: [
        link({ id: "e-ab", fromNoteId: "a", toNoteId: "b", relation: "link" }),
        link({ id: "e-ac", fromNoteId: "a", toNoteId: "c", relation: "tag" }),
      ],
      query: query({ seedId: "a", relations: ["tag"] }),
    });
    expect(payload.nodes.map((node) => node.id)).toEqual(["a", "c"]);
    expect(payload.edges).toEqual([
      { id: "e-ac", from: "a", to: "c", relation: "tag", directed: true },
    ]);
  });

  it("returns no note nodes when the kind filter excludes note", () => {
    const payload = projectGraph({
      notes: [A, B],
      links: [link({ id: "e-ab", fromNoteId: "a", toNoteId: "b" })],
      query: query({ kinds: ["inbox", "concept"] }),
    });
    expect(payload.nodes).toEqual([]);
    expect(payload.edges).toEqual([]);
    expect(payload.seedId).toBeNull();
  });

  it("marks mode=full truncated and keeps the newest nodes under the cap", () => {
    const notes: NoteRecord[] = [];
    for (let index = 0; index < GRAPH_NODE_LIMIT + 1; index += 1) {
      notes.push(
        note({
          id: `n${String(index).padStart(4, "0")}`,
          title: `n${index}`,
          updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        }),
      );
    }
    const oldest = notes[0];
    const newest = notes[GRAPH_NODE_LIMIT];
    const previous = notes[GRAPH_NODE_LIMIT - 1];
    if (!oldest || !newest || !previous) {
      throw new Error("fixture short");
    }
    const payload = projectGraph({
      notes,
      links: [
        link({ id: "keep", fromNoteId: newest.id, toNoteId: previous.id }),
        link({ id: "drop", fromNoteId: newest.id, toNoteId: oldest.id }),
      ],
      query: query({ mode: "full", seedId: null, depth: 1 }),
    });

    expect(payload.truncated).toBe(true);
    expect(payload.limit).toBe(GRAPH_NODE_LIMIT);
    expect(payload.nodes).toHaveLength(GRAPH_NODE_LIMIT);
    expect(payload.nodes.map((node) => node.id)).not.toContain(oldest.id);
    expect(payload.nodes.map((node) => node.id)).toContain(newest.id);
    expect(payload.edges).toEqual([
      { id: "keep", from: newest.id, to: previous.id, relation: "link", directed: true },
    ]);
    expect(payload.seedId).toBeNull();
    expect(payload.mode).toBe("full");
  });
});
