import type { NoteStatus } from "@/domain/notes/constants";

export const GRAPH_NODE_KINDS = ["note", "inbox", "concept", "source"] as const;
export type GraphNodeKind = (typeof GRAPH_NODE_KINDS)[number];

export const NOTE_GRAPH_KIND = "note" satisfies GraphNodeKind;

export type GraphNodeStatus = NoteStatus;

export const GRAPH_RELATIONS = ["link", "backlink", "tag", "suggested"] as const;
export type GraphRelation = (typeof GRAPH_RELATIONS)[number];

export const GRAPH_MODES = ["local", "full"] as const;
export type GraphMode = (typeof GRAPH_MODES)[number];

export const GRAPH_DEPTHS = [1, 2, 3] as const;
export type GraphDepth = (typeof GRAPH_DEPTHS)[number];

export const DEFAULT_GRAPH_DEPTH: GraphDepth = 1;
export const DEFAULT_GRAPH_MODE: GraphMode = "local";
export const DEFAULT_GRAPH_RELATION: GraphRelation = "link";

export const GRAPH_NODE_LIMIT = 120;

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  status: GraphNodeStatus | null;
  updatedAt: string;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  relation: GraphRelation;
  directed: true;
};

export type GraphQuery = {
  seedId: string | null;
  depth: GraphDepth;
  kinds: readonly GraphNodeKind[];
  relations: readonly GraphRelation[];
  mode: GraphMode;
};

export type GraphPayload = {
  ok: true;
  seedId: string | null;
  mode: GraphMode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  limit: number;
};

export type LinkRecord = {
  id: string;
  fromNoteId: string;
  toNoteId: string;
  relation: GraphRelation;
  createdAt: string;
};

const KIND_SET: ReadonlySet<string> = new Set(GRAPH_NODE_KINDS);
const RELATION_SET: ReadonlySet<string> = new Set(GRAPH_RELATIONS);
const MODE_SET: ReadonlySet<string> = new Set(GRAPH_MODES);
const DEPTH_SET: ReadonlySet<number> = new Set(GRAPH_DEPTHS);

export function isGraphNodeKind(value: string): value is GraphNodeKind {
  return KIND_SET.has(value);
}

export function isGraphRelation(value: string): value is GraphRelation {
  return RELATION_SET.has(value);
}

export function isGraphMode(value: string): value is GraphMode {
  return MODE_SET.has(value);
}

export function isGraphDepth(value: number): value is GraphDepth {
  return DEPTH_SET.has(value);
}
