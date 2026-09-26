import type { NoteRecord } from "@/domain/notes/types";
import {
  GRAPH_NODE_LIMIT,
  NOTE_GRAPH_KIND,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
  type GraphQuery,
  type LinkRecord,
} from "./types";

function byRecent(left: NoteRecord, right: NoteRecord): number {
  const byTime = right.updatedAt.localeCompare(left.updatedAt);
  if (byTime !== 0) {
    return byTime;
  }
  return right.id.localeCompare(left.id);
}

function toNode(note: NoteRecord): GraphNode {
  return {
    id: note.id,
    kind: NOTE_GRAPH_KIND,
    label: note.title,
    status: note.status,
    updatedAt: note.updatedAt,
  };
}

function toEdge(link: LinkRecord): GraphEdge {
  return {
    id: link.id,
    from: link.fromNoteId,
    to: link.toNoteId,
    relation: link.relation,
    directed: true,
  };
}

function liveNotes(notes: readonly NoteRecord[], query: GraphQuery): NoteRecord[] {
  if (!query.kinds.includes(NOTE_GRAPH_KIND)) {
    return [];
  }
  return notes.filter((note) => note.deletedAt === null);
}

function eligibleLinks(
  links: readonly LinkRecord[],
  query: GraphQuery,
  byId: ReadonlyMap<string, NoteRecord>,
): LinkRecord[] {
  const relations = new Set(query.relations);
  return links.filter(
    (link) =>
      link.fromNoteId !== link.toNoteId &&
      relations.has(link.relation) &&
      byId.has(link.fromNoteId) &&
      byId.has(link.toNoteId),
  );
}

function latestId(notes: readonly NoteRecord[]): string | null {
  const latest = [...notes].sort(byRecent)[0];
  return latest?.id ?? null;
}

function adjacency(links: readonly LinkRecord[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const push = (from: string, to: string) => {
    const list = map.get(from);
    if (list) {
      list.push(to);
      return;
    }
    map.set(from, [to]);
  };
  for (const link of links) {
    push(link.fromNoteId, link.toNoteId);
    push(link.toNoteId, link.fromNoteId);
  }
  return map;
}

function localSelection(
  query: GraphQuery,
  live: readonly NoteRecord[],
  links: readonly LinkRecord[],
): { ids: Set<string>; seedId: string | null } {
  const byId = new Map(live.map((note) => [note.id, note]));
  const seedId =
    query.seedId === null ? latestId(live) : byId.has(query.seedId) ? query.seedId : null;
  if (seedId === null) {
    return { ids: new Set(), seedId: null };
  }
  const neighbors = adjacency(links);
  const ids = new Set<string>([seedId]);
  const queue: { id: string; depth: number }[] = [{ id: seedId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= query.depth) {
      continue;
    }
    for (const next of neighbors.get(current.id) ?? []) {
      if (ids.has(next)) {
        continue;
      }
      ids.add(next);
      queue.push({ id: next, depth: current.depth + 1 });
    }
  }
  return { ids, seedId };
}

function orderNotes(
  ids: ReadonlySet<string>,
  byId: ReadonlyMap<string, NoteRecord>,
  seedId: string | null,
): NoteRecord[] {
  const notes: NoteRecord[] = [];
  for (const id of ids) {
    const note = byId.get(id);
    if (note) {
      notes.push(note);
    }
  }
  notes.sort(byRecent);
  if (seedId === null || !ids.has(seedId)) {
    return notes;
  }
  const seed = byId.get(seedId);
  if (!seed) {
    return notes;
  }
  return [seed, ...notes.filter((note) => note.id !== seedId)];
}

export function projectGraph(input: {
  notes: readonly NoteRecord[];
  links: readonly LinkRecord[];
  query: GraphQuery;
}): GraphPayload {
  const live = liveNotes(input.notes, input.query);
  const byId = new Map(live.map((note) => [note.id, note]));
  const links = eligibleLinks(input.links, input.query, byId);

  const selected =
    input.query.mode === "full"
      ? {
          ids: new Set(live.map((note) => note.id)),
          seedId:
            input.query.seedId !== null && byId.has(input.query.seedId) ? input.query.seedId : null,
        }
      : localSelection(input.query, live, links);

  const ordered = orderNotes(selected.ids, byId, selected.seedId);
  const truncated = ordered.length > GRAPH_NODE_LIMIT;
  const kept = truncated ? ordered.slice(0, GRAPH_NODE_LIMIT) : ordered;
  const keptIds = new Set(kept.map((note) => note.id));
  const edges = links
    .filter((link) => keptIds.has(link.fromNoteId) && keptIds.has(link.toNoteId))
    .map(toEdge)
    .sort((left, right) => left.id.localeCompare(right.id));

  const seedId =
    selected.seedId !== null && keptIds.has(selected.seedId) ? selected.seedId : null;

  return {
    ok: true,
    seedId,
    mode: input.query.mode,
    nodes: kept.map(toNode),
    edges,
    truncated,
    limit: GRAPH_NODE_LIMIT,
  };
}
