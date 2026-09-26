import {
  DEFAULT_GRAPH_DEPTH,
  DEFAULT_GRAPH_MODE,
  GRAPH_NODE_KINDS,
  GRAPH_RELATIONS,
  isGraphDepth,
  isGraphMode,
  isGraphNodeKind,
  isGraphRelation,
  type GraphDepth,
  type GraphMode,
  type GraphNodeKind,
  type GraphQuery,
  type GraphRelation,
} from "@/domain/graph/types";

export const GRAPH_API_PATH = "/api/graph" as const;

function csv(values: readonly string[]): string {
  return values.join(",");
}

function parseCsv<T extends string>(
  raw: string | null,
  parseOne: (token: string) => T | null,
  fallback: readonly T[],
): T[] {
  if (raw === null || raw.trim() === "") {
    return [...fallback];
  }
  const out: T[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const parsed = parseOne(part.trim());
    if (!parsed || seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    out.push(parsed);
  }
  return out.length > 0 ? out : [...fallback];
}

export function graphQueryFromSearch(params: URLSearchParams): GraphQuery {
  const seedRaw = params.get("seedId");
  const seedId = seedRaw && seedRaw.trim() ? seedRaw.trim() : null;
  const depthRaw = params.get("depth");
  const depthNum = depthRaw ? Number(depthRaw) : DEFAULT_GRAPH_DEPTH;
  const depth: GraphDepth = isGraphDepth(depthNum) ? depthNum : DEFAULT_GRAPH_DEPTH;
  const modeRaw = params.get("mode");
  const mode: GraphMode = modeRaw && isGraphMode(modeRaw) ? modeRaw : DEFAULT_GRAPH_MODE;
  return {
    seedId: mode === "full" ? null : seedId,
    depth,
    kinds: parseCsv(params.get("kinds"), (token) => (isGraphNodeKind(token) ? token : null), GRAPH_NODE_KINDS),
    relations: parseCsv(
      params.get("relations"),
      (token) => (isGraphRelation(token) ? token : null),
      GRAPH_RELATIONS,
    ),
    mode,
  };
}

export function graphApiHref(query: GraphQuery): string {
  const params = new URLSearchParams();
  if (query.mode === "local" && query.seedId) {
    params.set("seedId", query.seedId);
  }
  if (query.depth !== DEFAULT_GRAPH_DEPTH) {
    params.set("depth", String(query.depth));
  }
  if (query.kinds.length !== GRAPH_NODE_KINDS.length) {
    params.set("kinds", csv(query.kinds));
  }
  if (query.relations.length !== GRAPH_RELATIONS.length) {
    params.set("relations", csv(query.relations));
  }
  if (query.mode !== DEFAULT_GRAPH_MODE) {
    params.set("mode", query.mode);
  }
  const qs = params.toString();
  return qs ? `${GRAPH_API_PATH}?${qs}` : GRAPH_API_PATH;
}

export function graphPageHref(query: GraphQuery): string {
  const href = graphApiHref(query);
  return href.replace(GRAPH_API_PATH, "/graph");
}

export function graphNotePath(noteId: string): string {
  return `/notes/${encodeURIComponent(noteId)}`;
}

export function graphChatHref(noteId: string): string {
  const params = new URLSearchParams();
  params.set("scope", "selected");
  params.set("selected", noteId);
  return `/chat?${params.toString()}`;
}

export function graphOpenFromNoteHref(noteId: string): string {
  return `/graph?seedId=${encodeURIComponent(noteId)}`;
}

export function toggleKind(kinds: readonly GraphNodeKind[], kind: GraphNodeKind): GraphNodeKind[] {
  const has = kinds.includes(kind);
  if (has) {
    const next = kinds.filter((item) => item !== kind);
    return next.length > 0 ? next : [kind];
  }
  return [...GRAPH_NODE_KINDS].filter((item) => item === kind || kinds.includes(item));
}

export function toggleRelation(
  relations: readonly GraphRelation[],
  relation: GraphRelation,
): GraphRelation[] {
  const has = relations.includes(relation);
  if (has) {
    const next = relations.filter((item) => item !== relation);
    return next.length > 0 ? next : [relation];
  }
  return [...GRAPH_RELATIONS].filter((item) => item === relation || relations.includes(item));
}
