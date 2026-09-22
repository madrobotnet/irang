import {
  CHAT_CONTEXT_MAX_NOTES,
  CHAT_CONTEXT_MAX_TOKENS,
  CHAT_ROUTE_IDS,
  chatContextExceeded,
  type ChatContextLimitDto,
  type ChatJudgmentsDto,
  type ChatNoulJudgmentDto,
  type ChatRouteId,
  type ChatRouteJudgmentDto,
  type ChatScoreJudgmentDto,
  type ChatThreadDto,
} from "@/lib/chat/dto";
import type { TagSuggestionDto } from "@/lib/jev/capture-types";
import { JEV_LOW_CONFIDENCE_THRESHOLD } from "@/lib/jev/jev-state";
import { notePath } from "./scope";

export type ChatFailReason = "jev_error" | "key_missing" | "context_limit" | "error" | "unauthorized";

export type CitationView = {
  index: number;
  noteId: string;
  title: string;
  path: string;
  snippet: string | null;
  confidence: number | null;
};

export type ChatMessageView = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  body: string;
  createdAt: string;
  citations: CitationView[];
};

export type ProposalView = {
  proposalId: string | null;
  threadId: string;
  messageId: string;
  noteId: string;
  proposedTitle: string;
  proposedBody: string;
  tags: TagSuggestionDto[];
};

export type ParsedTurn = {
  threadId: string;
  userMessage: ChatMessageView;
  assistantMessage: ChatMessageView | null;
  judgments: ChatJudgmentsDto;
  contextLimit: ChatContextLimitDto | null;
  proposal: ProposalView | null;
  lowConfidence: boolean;
};

export type ParsedThreads = {
  threads: ChatThreadDto[];
  nextCursor: string | null;
};

export type Interpreted<T> =
  | { ok: true; value: T }
  | { ok: false; reason: ChatFailReason; contextLimit: ChatContextLimitDto | null };

const FORBIDDEN_KEYS = new Set(["fallback", "keywordFallback", "keywordScore", "mode"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readUnit(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function readCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function hasForbiddenKey(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => FORBIDDEN_KEYS.has(key));
}

function readProbabilityMap(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const unit = readUnit(raw);
    if (!key || unit === null) return null;
    out[key] = unit;
  }
  return out;
}

function readLegend(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") return null;
    out[key] = raw;
  }
  return out;
}

function readNoul(value: unknown): ChatNoulJudgmentDto | null {
  if (!isRecord(value) || value.type !== "noul") return null;
  if ("confidence" in value) return null;
  const noul = readUnit(value.noul);
  if (noul === null) return null;
  return { type: "noul", noul };
}

function readRoute(value: unknown): ChatRouteJudgmentDto | null {
  if (!isRecord(value) || value.type !== "choice") return null;
  const choice = readString(value.choice);
  const confidence = readUnit(value.confidence);
  const probabilities = readProbabilityMap(value.probabilities);
  if (!choice || confidence === null || !probabilities) return null;
  if (!CHAT_ROUTE_IDS.includes(choice as ChatRouteId)) return null;
  return {
    type: "choice",
    choice: choice as ChatRouteId,
    confidence,
    probabilities: probabilities as ChatRouteJudgmentDto["probabilities"],
  };
}

function readScore(value: unknown): ChatScoreJudgmentDto | null {
  if (!isRecord(value) || value.type !== "score") return null;
  if (typeof value.score !== "number" || !Number.isFinite(value.score)) return null;
  const confidence = readUnit(value.confidence);
  const probabilities = readProbabilityMap(value.probabilities);
  const legend = readLegend(value.legend);
  if (confidence === null || !probabilities || !legend) return null;
  return { type: "score", score: value.score, legend, probabilities, confidence };
}

export function readContextLimit(value: unknown): ChatContextLimitDto | null {
  if (!isRecord(value)) return null;
  const noteCount = readCount(value.noteCount);
  const tokenCount = readCount(value.tokenCount);
  if (noteCount === null || tokenCount === null) return null;
  return {
    maxNotes: CHAT_CONTEXT_MAX_NOTES,
    maxTokens: CHAT_CONTEXT_MAX_TOKENS,
    noteCount,
    tokenCount,
  };
}

function relevanceFor(judgments: ChatJudgmentsDto | null, noteId: string): number | null {
  if (!judgments) return null;
  const candidate = judgments.context.candidates.find((item) => item.noteId === noteId);
  return candidate ? candidate.relevance.confidence : null;
}

function readNoteId(record: Record<string, unknown>): string | null {
  const noteId = readString(record.noteId);
  if (noteId) return noteId;
  const path = readString(record.path);
  if (!path) return null;
  const marker = "notes/";
  const at = path.lastIndexOf(marker);
  if (at >= 0) {
    const id = path.slice(at + marker.length).replace(/\/+$/, "");
    return id || null;
  }
  return path.replace(/^\/+/, "") || null;
}

function readRoutingConfidence(message: Record<string, unknown>): number | null {
  if (!isRecord(message.routing) || message.routing.type !== "choice") return null;
  return readUnit(message.routing.confidence);
}

function readLink(
  value: unknown,
  position: number,
  judgments: ChatJudgmentsDto | null,
  routeConfidence: number | null,
): CitationView | null {
  if (!isRecord(value) || hasForbiddenKey(value)) return null;
  const noteId = readNoteId(value);
  if (!noteId) return null;
  const title = readString(value.title) ?? noteId;
  const explicitPath = readString(value.path);
  const snippet = typeof value.snippet === "string" ? value.snippet : null;
  const score = readUnit(value.score);
  const index =
    typeof value.index === "number" && Number.isInteger(value.index) && value.index > 0
      ? value.index
      : position + 1;
  return {
    index,
    noteId,
    title,
    path: explicitPath ?? notePath(noteId),
    snippet,
    confidence: relevanceFor(judgments, noteId) ?? score ?? routeConfidence,
  };
}

function readCitationList(
  message: Record<string, unknown>,
  judgments: ChatJudgmentsDto | null,
): CitationView[] {
  const citations = Array.isArray(message.citations) ? message.citations : null;
  const sources = Array.isArray(message.sources) ? message.sources : null;
  const raw = citations && citations.length > 0 ? citations : sources ?? citations ?? [];
  const routeConfidence = readRoutingConfidence(message);
  const views: CitationView[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const link = readLink(raw[i], i, judgments, routeConfidence);
    if (link) views.push({ ...link, index: views.length + 1 });
  }
  return views;
}

function readMessage(
  value: unknown,
  judgments: ChatJudgmentsDto | null,
): ChatMessageView | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id);
  const threadId = readString(value.threadId);
  const role = value.role;
  const body =
    typeof value.body === "string" ? value.body : typeof value.content === "string" ? value.content : null;
  const createdAt = readString(value.createdAt);
  if (!id || !threadId || !createdAt || body === null) return null;
  if (role !== "user" && role !== "assistant" && role !== "system") return null;
  return {
    id,
    threadId,
    role,
    body,
    createdAt,
    citations: role === "assistant" ? readCitationList(value, judgments) : [],
  };
}

function readTags(value: unknown): TagSuggestionDto[] {
  if (!Array.isArray(value)) return [];
  const tags: TagSuggestionDto[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const tag = readString(entry.tag);
    const probability = readUnit(entry.probability);
    if (!tag || probability === null) continue;
    tags.push({ tag, probability });
  }
  return tags;
}

export function readProposal(value: unknown, threadFallback: string): ProposalView | null {
  if (!isRecord(value)) return null;
  const noteId = readString(value.noteId);
  const messageId = readString(value.messageId);
  const proposedTitle = typeof value.proposedTitle === "string" ? value.proposedTitle : null;
  const proposedBody = typeof value.proposedBody === "string" ? value.proposedBody : null;
  if (!noteId || !messageId || proposedTitle === null || proposedBody === null) return null;
  const status = value.status;
  if (status != null && status !== "pending_approval" && status !== "pending") return null;
  return {
    proposalId: readString(value.proposalId),
    threadId: readString(value.threadId) ?? threadFallback,
    messageId,
    noteId,
    proposedTitle,
    proposedBody,
    tags: readTags(value.tags),
  };
}

function readJudgments(value: unknown): ChatJudgmentsDto | null {
  if (!isRecord(value) || hasForbiddenKey(value)) return null;
  const route = readRoute(value.route);
  if (!route || !isRecord(value.context) || !Array.isArray(value.context.candidates)) return null;
  if (hasForbiddenKey(value.context)) return null;
  const candidates = [];
  for (const entry of value.context.candidates) {
    if (!isRecord(entry) || hasForbiddenKey(entry)) return null;
    const noteId = readString(entry.noteId);
    const include = readNoul(entry.include);
    const relevance = readScore(entry.relevance);
    if (!noteId || !include || !relevance) return null;
    candidates.push({ noteId, include, relevance });
  }
  const selectedNoteIds = Array.isArray(value.context.selectedNoteIds)
    ? value.context.selectedNoteIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
  return { route, context: { candidates, selectedNoteIds } };
}

function fail(
  reason: ChatFailReason,
  contextLimit: ChatContextLimitDto | null = null,
): Interpreted<never> {
  return { ok: false, reason, contextLimit };
}

export function mapChatFailure(status: number, code: string | null): ChatFailReason | null {
  if (code === "judgment_failed" || code === "jev_error") return "jev_error";
  if (code === "typesafe_misconfigured" || code === "key_missing") return "key_missing";
  if (code === "context_limit" || code === "context_exhausted") return "context_limit";
  if (
    code === "codex_failed" ||
    code === "citations_required" ||
    code === "validation" ||
    code === "not_found" ||
    code === "streaming_unsupported" ||
    code === "proposal_not_pending" ||
    code === "search_index_unavailable"
  ) {
    return "error";
  }
  if (code === "unauthorized") return "unauthorized";
  if (status === 401) return "unauthorized";
  if (status === 502) return "jev_error";
  if (status === 503) return "key_missing";
  if (status >= 400) return "error";
  return null;
}

function readCode(record: Record<string, unknown>): string | null {
  return readString(record.code);
}

export function interpretTurnBody(status: number, body: unknown): Interpreted<ParsedTurn> {
  if (!isRecord(body)) {
    const reason = mapChatFailure(status, null);
    return fail(reason ?? "error");
  }
  if (hasForbiddenKey(body)) return fail("jev_error");
  if (body.ok === false || status >= 400) {
    const code = readCode(body);
    const reason = mapChatFailure(status, code) ?? "error";
    const contextLimit = reason === "context_limit" ? readContextLimit(body.contextLimit) : null;
    return fail(reason, contextLimit);
  }
  if (body.ok !== true) return fail("error");
  const threadId = readString(body.threadId);
  const userMessage = readMessage(body.userMessage, null);
  const judgments = readJudgments(body.judgments);
  if (!threadId || !userMessage || userMessage.role !== "user" || !judgments) return fail("jev_error");
  if (userMessage.threadId !== threadId) userMessage.threadId = threadId;
  const contextLimit = readContextLimit(body.contextLimit);
  if (contextLimit && chatContextExceeded(contextLimit)) {
    return fail("context_limit", contextLimit);
  }
  const assistantRecord = body.assistantMessage;
  let assistantMessage: ChatMessageView | null = null;
  if (assistantRecord != null) {
    assistantMessage = readMessage(assistantRecord, judgments);
    if (!assistantMessage || assistantMessage.role !== "assistant") return fail("error");
    assistantMessage.threadId = threadId;
  }
  const proposal = body.proposal == null ? null : readProposal(body.proposal, threadId);
  return {
    ok: true,
    value: {
      threadId,
      userMessage,
      assistantMessage,
      judgments,
      contextLimit,
      proposal,
      lowConfidence: judgments.route.confidence < JEV_LOW_CONFIDENCE_THRESHOLD,
    },
  };
}

export function interpretThreadList(status: number, body: unknown): Interpreted<ParsedThreads> {
  if (!isRecord(body)) return fail(mapChatFailure(status, null) ?? "error");
  if (body.ok === false || status >= 400) {
    return fail(mapChatFailure(status, readCode(body)) ?? "error");
  }
  if (body.ok !== true || !Array.isArray(body.threads)) return fail("error");
  const threads: ChatThreadDto[] = [];
  for (const entry of body.threads) {
    if (!isRecord(entry)) return fail("error");
    const id = readString(entry.id);
    const title = typeof entry.title === "string" ? entry.title : entry.title == null ? "" : null;
    const createdAt = readString(entry.createdAt);
    const updatedAt = readString(entry.updatedAt);
    if (!id || title === null || !createdAt || !updatedAt) return fail("error");
    threads.push({ id, title, createdAt, updatedAt });
  }
  const nextCursor = body.nextCursor == null ? null : readString(body.nextCursor);
  return { ok: true, value: { threads, nextCursor } };
}

export function interpretThread(status: number, body: unknown): Interpreted<ChatThreadDto> {
  if (!isRecord(body)) return fail(mapChatFailure(status, null) ?? "error");
  if (body.ok === false || status >= 400) {
    return fail(mapChatFailure(status, readCode(body)) ?? "error");
  }
  const thread = isRecord(body.thread) ? body.thread : body;
  if (!isRecord(thread)) return fail("error");
  const id = readString(thread.id);
  const title = typeof thread.title === "string" ? thread.title : thread.title == null ? "" : null;
  const createdAt = readString(thread.createdAt);
  const updatedAt = readString(thread.updatedAt);
  if (!id || title === null || !createdAt || !updatedAt) return fail("error");
  return { ok: true, value: { id, title, createdAt, updatedAt } };
}

export function interpretMessageList(
  status: number,
  body: unknown,
): Interpreted<{ threadId: string; messages: ChatMessageView[]; nextCursor: string | null }> {
  if (!isRecord(body)) return fail(mapChatFailure(status, null) ?? "error");
  if (body.ok === false || status >= 400) {
    return fail(mapChatFailure(status, readCode(body)) ?? "error");
  }
  const threadId = readString(body.threadId);
  if (!threadId || !Array.isArray(body.messages)) return fail("error");
  const messages: ChatMessageView[] = [];
  for (const entry of body.messages) {
    const message = readMessage(entry, null);
    if (!message) return fail("error");
    messages.push(message);
  }
  const nextCursor = body.nextCursor == null ? null : readString(body.nextCursor);
  return { ok: true, value: { threadId, messages, nextCursor } };
}

export function interpretProposal(status: number, body: unknown): Interpreted<ProposalView> {
  if (!isRecord(body)) return fail(mapChatFailure(status, null) ?? "error");
  if (body.ok === false || status >= 400) {
    return fail(mapChatFailure(status, readCode(body)) ?? "error");
  }
  const proposal = readProposal(body.proposal, "");
  if (!proposal?.proposalId) return fail("error");
  return { ok: true, value: proposal };
}

export type BodyPart = { kind: "text"; text: string } | { kind: "cite"; n: number };

export function splitCitationMarks(body: string): BodyPart[] {
  const parts = body.split(/(\[\d+\])/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      const mark = /^\[(\d+)\]$/.exec(part);
      if (!mark) return { kind: "text", text: part };
      return { kind: "cite", n: Number(mark[1]) };
    });
}

/** True when the turn is on the 10-note or 32k cap, including a hard context_limit error. */
export function contextLimitVisible(
  surface: string,
  signal: ChatContextLimitDto | null,
): boolean {
  if (surface === "context_limit") return true;
  if (!signal) return false;
  return signal.noteCount >= CHAT_CONTEXT_MAX_NOTES || signal.tokenCount >= CHAT_CONTEXT_MAX_TOKENS;
}
