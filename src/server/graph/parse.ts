import {
  DEFAULT_GRAPH_DEPTH,
  DEFAULT_GRAPH_MODE,
  DEFAULT_GRAPH_RELATION,
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type ParseFailure = { ok: false; fields: string[] };
export type ParseSuccess<T> = { ok: true; value: T };

function parseCsv<T extends string>(
  raw: string,
  parseOne: (token: string) => T | null,
): T[] | null {
  const values: T[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const token = part.trim();
    const parsed = token ? parseOne(token) : null;
    if (!parsed) {
      return null;
    }
    if (seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    values.push(parsed);
  }
  return values.length > 0 ? values : null;
}

export function parseGraphQuery(params: URLSearchParams): ParseSuccess<GraphQuery> | ParseFailure {
  const fields: string[] = [];

  let seedId: string | null = null;
  const rawSeed = params.get("seedId");
  if (rawSeed !== null) {
    if (!isUuid(rawSeed)) {
      fields.push("seedId");
    } else {
      seedId = rawSeed;
    }
  }

  let depth: GraphDepth = DEFAULT_GRAPH_DEPTH;
  const rawDepth = params.get("depth");
  if (rawDepth !== null) {
    if (!/^[0-9]+$/.test(rawDepth)) {
      fields.push("depth");
    } else {
      const parsed = Number(rawDepth);
      if (!isGraphDepth(parsed)) {
        fields.push("depth");
      } else {
        depth = parsed;
      }
    }
  }

  let kinds: readonly GraphNodeKind[] = GRAPH_NODE_KINDS;
  const rawKinds = params.get("kinds");
  if (rawKinds !== null) {
    const parsed = parseCsv(rawKinds, (token) => (isGraphNodeKind(token) ? token : null));
    if (!parsed) {
      fields.push("kinds");
    } else {
      kinds = parsed;
    }
  }

  let relations: readonly GraphRelation[] = GRAPH_RELATIONS;
  const rawRelations = params.get("relations");
  if (rawRelations !== null) {
    const parsed = parseCsv(rawRelations, (token) => (isGraphRelation(token) ? token : null));
    if (!parsed) {
      fields.push("relations");
    } else {
      relations = parsed;
    }
  }

  let mode: GraphMode = DEFAULT_GRAPH_MODE;
  const rawMode = params.get("mode");
  if (rawMode !== null) {
    if (!isGraphMode(rawMode)) {
      fields.push("mode");
    } else {
      mode = rawMode;
    }
  }

  if (fields.length > 0) {
    return { ok: false, fields };
  }
  return { ok: true, value: { seedId, depth, kinds, relations, mode } };
}

export type CreateLinkBody = {
  fromNoteId: string;
  toNoteId: string;
  relation: GraphRelation;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCreateLinkBody(body: unknown): ParseSuccess<CreateLinkBody> | ParseFailure {
  if (!isRecord(body)) {
    return { ok: false, fields: ["fromNoteId", "toNoteId"] };
  }
  const fields: string[] = [];
  const fromNoteId = body.fromNoteId;
  const toNoteId = body.toNoteId;
  let parsedFrom = "";
  let parsedTo = "";
  if (typeof fromNoteId !== "string" || !isUuid(fromNoteId)) {
    fields.push("fromNoteId");
  } else {
    parsedFrom = fromNoteId;
  }
  if (typeof toNoteId !== "string" || !isUuid(toNoteId)) {
    fields.push("toNoteId");
  } else {
    parsedTo = toNoteId;
  }
  if (parsedFrom && parsedTo && parsedFrom === parsedTo) {
    fields.push("toNoteId");
  }

  let relation: GraphRelation = DEFAULT_GRAPH_RELATION;
  if (body.relation !== undefined) {
    if (typeof body.relation !== "string" || !isGraphRelation(body.relation)) {
      fields.push("relation");
    } else {
      relation = body.relation;
    }
  }

  if (fields.length > 0) {
    return { ok: false, fields };
  }
  return { ok: true, value: { fromNoteId: parsedFrom, toNoteId: parsedTo, relation } };
}
