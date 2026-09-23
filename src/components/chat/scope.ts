export const CHAT_SCOPES = ["current", "selected", "all", "evidence"] as const;

export type ChatScope = (typeof CHAT_SCOPES)[number];

export type ChatQuery = {
  scope: ChatScope;
  evidenceIds: string[];
  selectedIds: string[];
  currentNoteId: string | null;
};

function uniqueIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function readIds(params: URLSearchParams, key: string): string[] {
  const values: string[] = [];
  for (const raw of params.getAll(key)) {
    for (const part of raw.split(",")) values.push(part);
  }
  return uniqueIds(values);
}

export function isChatScope(value: string | null): value is ChatScope {
  return CHAT_SCOPES.some((scope) => scope === value);
}

/** `/chat?evidence=…` and `?scope=current|selected|all|evidence`. */
export function readChatQuery(params: URLSearchParams): ChatQuery {
  const evidenceIds = readIds(params, "evidence");
  const selectedIds = readIds(params, "selected");
  const currentNoteId = params.get("note")?.trim() || null;
  const requested = params.get("scope");
  const scope: ChatScope = isChatScope(requested)
    ? requested
    : evidenceIds.length > 0
      ? "evidence"
      : "all";
  return { scope, evidenceIds, selectedIds, currentNoteId };
}

export function candidateNoteIds(query: ChatQuery): string[] | undefined {
  if (query.scope === "all") return undefined;
  if (query.scope === "current") {
    return query.currentNoteId ? [query.currentNoteId] : undefined;
  }
  if (query.scope === "selected") {
    const ids = query.selectedIds.length > 0 ? query.selectedIds : query.evidenceIds;
    return ids.length > 0 ? ids : undefined;
  }
  return query.evidenceIds.length > 0 ? query.evidenceIds : undefined;
}

export function scopeHref(current: URLSearchParams, scope: ChatScope): string {
  const next = new URLSearchParams(current.toString());
  next.set("scope", scope);
  const qs = next.toString();
  return qs ? `/chat?${qs}` : "/chat";
}

export function noteHref(noteId: string): string {
  return `/notes?note=${encodeURIComponent(noteId)}`;
}

export function notePath(noteId: string): string {
  return `notes/${noteId}`;
}
