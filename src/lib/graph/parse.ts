import {
  GRAPH_NODE_LIMIT,
  isGraphMode,
  isGraphNodeKind,
  isGraphRelation,
  type GraphEdge,
  type GraphNode,
  type GraphPayload,
} from "@/domain/graph/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNode(value: unknown): GraphNode | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }
  if (typeof value.kind !== "string" || !isGraphNodeKind(value.kind)) {
    return null;
  }
  if (typeof value.label !== "string") {
    return null;
  }
  if (typeof value.updatedAt !== "string") {
    return null;
  }
  const status =
    value.status === null
      ? null
      : value.status === "draft" || value.status === "confirmed" || value.status === "archived"
        ? value.status
        : null;
  if (value.status !== null && status === null) {
    return null;
  }
  return {
    id: value.id,
    kind: value.kind,
    label: value.label,
    status,
    updatedAt: value.updatedAt,
  };
}

function parseEdge(value: unknown): GraphEdge | null {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }
  if (typeof value.from !== "string" || typeof value.to !== "string") {
    return null;
  }
  if (typeof value.relation !== "string" || !isGraphRelation(value.relation)) {
    return null;
  }
  if (value.directed !== true) {
    return null;
  }
  return {
    id: value.id,
    from: value.from,
    to: value.to,
    relation: value.relation,
    directed: true,
  };
}

export function parseGraphPayload(value: unknown): GraphPayload | null {
  if (!isRecord(value) || value.ok !== true) {
    return null;
  }
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return null;
  }
  if (typeof value.truncated !== "boolean") {
    return null;
  }
  const mode = typeof value.mode === "string" && isGraphMode(value.mode) ? value.mode : null;
  if (!mode) {
    return null;
  }
  const seedId = value.seedId === null ? null : typeof value.seedId === "string" ? value.seedId : null;
  if (value.seedId !== null && seedId === null) {
    return null;
  }
  const nodes: GraphNode[] = [];
  for (const item of value.nodes) {
    const node = parseNode(item);
    if (!node) {
      return null;
    }
    nodes.push(node);
  }
  const edges: GraphEdge[] = [];
  for (const item of value.edges) {
    const edge = parseEdge(item);
    if (!edge) {
      return null;
    }
    edges.push(edge);
  }
  const limit = typeof value.limit === "number" && Number.isFinite(value.limit) ? value.limit : GRAPH_NODE_LIMIT;
  return { ok: true, seedId, mode, nodes, edges, truncated: value.truncated, limit };
}
