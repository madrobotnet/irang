import { SEARCH_INDEX_STATUSES, type SearchIndexStatus } from "@/domain/search/index-status";
import { E4_SEARCH_COLLECTION_PATH } from "@/lib/auth/e4-gate-paths";
import type {
  EvidenceNoteDto,
  EvidenceNotesOk,
  EvidenceNotesResponse,
  EvidenceQueryDto,
  JudgmentConfidenceDto,
  NoulJudgmentDto,
  SearchErrorBody,
  SearchErrorCode,
  SearchHitDto,
  SearchQueryDto,
  SearchResponse,
  SearchResultsOk,
} from "./dto";

export type SearchUiFailure = "jev_error" | "key_missing" | "error";

export type SearchCallFailure = SearchUiFailure | "indexing";

export type ParsedSearch =
  | { ok: true; envelope: SearchResultsOk }
  | { ok: false; reason: SearchCallFailure };

export const SEARCH_STATUS_FILTERS = ["draft", "confirmed", "archived"] as const;
export type SearchStatusFilter = (typeof SEARCH_STATUS_FILTERS)[number];
export type SearchRequestFilters = {
  status: SearchStatusFilter | "";
  from: string;
  to: string;
};

export type ParsedEvidence =
  | { ok: true; envelope: EvidenceNotesOk }
  | { ok: false; reason: SearchUiFailure };

const FORBIDDEN_KEYS = new Set(["fallback", "keywordFallback", "keywordScore", "mode"]);

const ERROR_CODES = new Set<SearchErrorCode>([
  "typesafe_misconfigured",
  "judgment_failed",
  "validation",
  "unauthorized",
]);

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

function hasForbiddenKey(record: Record<string, unknown>): boolean {
  return Object.keys(record).some((key) => FORBIDDEN_KEYS.has(key));
}

function mapFailure(status: number, code: string | null): SearchCallFailure | null {
  if (code === "typesafe_misconfigured" || code === "key_missing") return "key_missing";
  if (code === "judgment_failed" || code === "jev_error") return "jev_error";
  if (code === "search_index_unavailable") return "indexing";
  if (code === "validation" || code === "unauthorized") return "error";
  if (status === 502) return "jev_error";
  if (status === 503) return "key_missing";
  return null;
}

function readCode(record: Record<string, unknown>): string | null {
  return readString(record.code);
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

function readNoul(value: unknown): NoulJudgmentDto | null {
  if (!isRecord(value) || value.type !== "noul") return null;
  if ("confidence" in value) return null;
  const noul = readUnit(value.noul);
  if (noul === null) return null;
  return { type: "noul", noul };
}

function readChoice(
  value: unknown,
): Extract<JudgmentConfidenceDto, { type: "choice" }> | null {
  if (!isRecord(value) || value.type !== "choice") return null;
  const choice = readString(value.choice);
  const confidence = readUnit(value.confidence);
  const probabilities = readProbabilityMap(value.probabilities);
  if (!choice || confidence === null || !probabilities) return null;
  return { type: "choice", choice, confidence, probabilities };
}

function readScore(
  value: unknown,
): Extract<JudgmentConfidenceDto, { type: "score" }> | null {
  if (!isRecord(value) || value.type !== "score") return null;
  if (typeof value.score !== "number" || !Number.isFinite(value.score)) return null;
  const confidence = readUnit(value.confidence);
  const probabilities = readProbabilityMap(value.probabilities);
  const legend = readLegend(value.legend);
  if (confidence === null || !probabilities || !legend) return null;
  return {
    type: "score",
    score: value.score,
    legend,
    probabilities,
    confidence,
  };
}

function readHit(value: unknown): SearchHitDto | "forbidden" | null {
  if (!isRecord(value)) return null;
  if (hasForbiddenKey(value)) return "forbidden";
  const noteId = readString(value.noteId);
  const title = readString(value.title);
  if (!noteId || !title) return null;
  if (value.snippet != null && typeof value.snippet !== "string") return null;
  return {
    noteId,
    title,
    snippet: typeof value.snippet === "string" ? value.snippet : null,
  };
}

function readIndexStatus(value: unknown): SearchIndexStatus | null {
  if (typeof value !== "string") return null;
  for (const status of SEARCH_INDEX_STATUSES) {
    if (value === status) return status;
  }
  return null;
}

function indexStatusOrReady(record: Record<string, unknown>): SearchIndexStatus | null {
  if (!("indexStatus" in record) || record.indexStatus == null) {
    return "ready";
  }
  return readIndexStatus(record.indexStatus);
}

function readErrorBody(record: Record<string, unknown>): SearchErrorBody | null {
  if (record.ok !== false) return null;
  const code = readCode(record);
  if (!code || !ERROR_CODES.has(code as SearchErrorCode)) return null;
  return { ok: false, code: code as SearchErrorCode };
}

function readResults(record: Record<string, unknown>): SearchResultsOk | "forbidden" | null {
  if (hasForbiddenKey(record)) return "forbidden";
  if (record.ok !== true) return null;
  const indexStatus = indexStatusOrReady(record);
  const query = readString(record.query);
  const answersQuery = readNoul(record.answersQuery);
  const ranking = readChoice(record.ranking);
  if (!indexStatus || !query || !answersQuery || !ranking || !Array.isArray(record.results)) return null;
  const results: SearchHitDto[] = [];
  for (const entry of record.results) {
    const hit = readHit(entry);
    if (hit === "forbidden") return "forbidden";
    if (!hit) return null;
    results.push(hit);
  }
  return { ok: true, indexStatus, query, answersQuery, ranking, results };
}

function readEvidenceNote(value: unknown): EvidenceNoteDto | "forbidden" | null {
  if (!isRecord(value)) return null;
  if (hasForbiddenKey(value)) return "forbidden";
  const noteId = readString(value.noteId);
  const title = readString(value.title);
  const answers = readNoul(value.answers);
  const similarity = readScore(value.similarity);
  if (!noteId || !title || !answers || !similarity) return null;
  if (value.relevance == null) {
    return { noteId, title, answers, relevance: null, similarity };
  }
  const relevance = readScore(value.relevance);
  if (!relevance) return null;
  return { noteId, title, answers, relevance, similarity };
}

function readEvidence(record: Record<string, unknown>): EvidenceNotesOk | "forbidden" | null {
  if (hasForbiddenKey(record)) return "forbidden";
  if (record.ok !== true) return null;
  const indexStatus = indexStatusOrReady(record);
  const query = readString(record.query);
  if (!indexStatus || !query || !Array.isArray(record.notes)) return null;
  const notes: EvidenceNoteDto[] = [];
  for (const entry of record.notes) {
    const note = readEvidenceNote(entry);
    if (note === "forbidden") return "forbidden";
    if (!note) return null;
    notes.push(note);
  }
  return { ok: true, indexStatus, query, notes };
}

function interpret(
  status: number,
  body: unknown,
  readOk: (record: Record<string, unknown>) => SearchResultsOk | EvidenceNotesOk | "forbidden" | null,
): { ok: true; envelope: SearchResultsOk | EvidenceNotesOk } | { ok: false; reason: SearchCallFailure } {
  const record = isRecord(body) ? body : null;
  const code = record ? readCode(record) : null;
  const mapped = mapFailure(status, code);
  if (mapped) return { ok: false, reason: mapped };
  if (!record || status < 200 || status >= 300) return { ok: false, reason: "error" };
  if (hasForbiddenKey(record)) return { ok: false, reason: "jev_error" };
  if (readErrorBody(record)) return { ok: false, reason: "error" };
  const envelope = readOk(record);
  if (envelope === "forbidden") return { ok: false, reason: "jev_error" };
  if (!envelope) return { ok: false, reason: "error" };
  return { ok: true, envelope };
}

export function interpretSearchBody(status: number, body: unknown): ParsedSearch {
  const parsed = interpret(status, body, readResults);
  if (!parsed.ok) return parsed;
  return { ok: true, envelope: parsed.envelope as SearchResultsOk };
}

export function interpretEvidenceBody(status: number, body: unknown): ParsedEvidence {
  const parsed = interpret(status, body, readEvidence);
  if (!parsed.ok) {
    const reason: SearchUiFailure = parsed.reason === "indexing" ? "error" : parsed.reason;
    return { ok: false, reason };
  }
  return { ok: true, envelope: parsed.envelope as EvidenceNotesOk };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function searchCollectionUrl(
  query: SearchQueryDto["query"],
  filters?: SearchRequestFilters,
): string {
  const params = new URLSearchParams();
  params.set("query", query);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.from && DAY.test(filters.from)) params.set("from", filters.from);
  if (filters?.to && DAY.test(filters.to)) params.set("to", filters.to);
  return `${E4_SEARCH_COLLECTION_PATH}?${params.toString()}`;
}

export function evidenceRequestBody(
  input: EvidenceQueryDto,
  filters?: SearchRequestFilters,
): string {
  const body: EvidenceQueryDto & Partial<Pick<SearchRequestFilters, "status" | "from" | "to">> = {
    query: input.query,
    candidateNoteIds: [...input.candidateNoteIds],
  };
  if (filters?.status) body.status = filters.status;
  if (filters?.from && DAY.test(filters.from)) body.from = filters.from;
  if (filters?.to && DAY.test(filters.to)) body.to = filters.to;
  return JSON.stringify(body);
}

export type { SearchResponse, EvidenceNotesResponse };
