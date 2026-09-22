import { NOTE_STATUSES, type NoteStatus } from "@/domain/notes/constants";
import { OPEN_SEARCH_FILTERS, type SearchFilters } from "@/domain/search/types";
import { searchErrorBody, type SearchErrorCode } from "@/lib/search/dto";
import { jsonResponse } from "../http/json-response";
import {
  JudgmentFailedError,
  TypesafeMisconfiguredError,
  getSystemOneInvoker,
} from "../typesafe/runtime";
import { EvidenceCandidatesInvalidError, executeEvidence, executeSearch } from "./service";
import { SearchIndexUnavailableError } from "./runtime";

const MAX_QUERY_LENGTH = 500;
const MAX_EVIDENCE_IDS = 10;

function failureResponse(error: unknown): Response | null {
  if (error instanceof TypesafeMisconfiguredError) {
    return jsonResponse(searchErrorBody("typesafe_misconfigured"), 503);
  }
  if (error instanceof JudgmentFailedError) {
    return jsonResponse(searchErrorBody("judgment_failed"), 502);
  }
  if (error instanceof SearchIndexUnavailableError) {
    return jsonResponse({ ok: false, code: "search_index_unavailable" }, 503);
  }
  if (error instanceof EvidenceCandidatesInvalidError) {
    return jsonResponse(searchErrorBody("validation"), 400);
  }
  return null;
}

function parseFilters(input: {
  from: string | null;
  to: string | null;
  status: string | null;
}): SearchFilters | null {
  const filters: SearchFilters = { ...OPEN_SEARCH_FILTERS };
  if (input.status) {
    if (!NOTE_STATUSES.includes(input.status as NoteStatus)) {
      return null;
    }
    filters.status = input.status as NoteStatus;
  }
  if (input.from) {
    if (Number.isNaN(new Date(input.from).getTime())) {
      return null;
    }
    filters.from = new Date(input.from).toISOString();
  }
  if (input.to) {
    if (Number.isNaN(new Date(input.to).getTime())) {
      return null;
    }
    filters.to = new Date(input.to).toISOString();
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return null;
  }
  return filters;
}

async function readRecord(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function readSearchRequest(
  request: Request,
): Promise<{ query: string; filters: SearchFilters } | null> {
  let query = "";
  let from: string | null = null;
  let to: string | null = null;
  let status: string | null = null;
  if (request.method === "GET") {
    const url = new URL(request.url);
    query = url.searchParams.get("query") ?? "";
    from = url.searchParams.get("from");
    to = url.searchParams.get("to");
    status = url.searchParams.get("status");
  } else {
    const body = await readRecord(request);
    if (!body || typeof body.query !== "string") {
      return null;
    }
    query = body.query;
    from = typeof body.from === "string" ? body.from : null;
    to = typeof body.to === "string" ? body.to : null;
    status = typeof body.status === "string" ? body.status : null;
  }
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH) {
    return null;
  }
  const filters = parseFilters({ from, to, status });
  if (!filters) {
    return null;
  }
  return { query: trimmed, filters };
}

export async function readEvidenceRequest(
  request: Request,
): Promise<{ query: string; candidateNoteIds: string[]; filters: SearchFilters } | null> {
  let query = "";
  let rawIds: unknown;
  let from: string | null = null;
  let to: string | null = null;
  let status: string | null = null;
  if (request.method === "GET") {
    const url = new URL(request.url);
    query = url.searchParams.get("query") ?? "";
    rawIds = (url.searchParams.get("candidateNoteIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    from = url.searchParams.get("from");
    to = url.searchParams.get("to");
    status = url.searchParams.get("status");
  } else {
    const body = await readRecord(request);
    if (!body || typeof body.query !== "string" || !Array.isArray(body.candidateNoteIds)) {
      return null;
    }
    query = body.query;
    rawIds = body.candidateNoteIds;
    from = typeof body.from === "string" ? body.from : null;
    to = typeof body.to === "string" ? body.to : null;
    status = typeof body.status === "string" ? body.status : null;
  }
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_QUERY_LENGTH || !Array.isArray(rawIds)) {
    return null;
  }
  if (!rawIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
    return null;
  }
  const candidateNoteIds = [...new Set(rawIds.map((id) => id.trim()))];
  if (candidateNoteIds.length > MAX_EVIDENCE_IDS) {
    return null;
  }
  const filters = parseFilters({ from, to, status });
  if (!filters) {
    return null;
  }
  return { query: trimmed, candidateNoteIds, filters };
}

function requireTypesafe(): Response | null {
  try {
    getSystemOneInvoker();
    return null;
  } catch (error) {
    return failureResponse(error);
  }
}

export async function handleSearch(request: Request): Promise<Response> {
  const parsed = await readSearchRequest(request);
  if (!parsed) {
    return jsonResponse(searchErrorBody("validation"), 400);
  }
  const blocked = requireTypesafe();
  if (blocked) {
    return blocked;
  }
  try {
    const body = await executeSearch(parsed.query, parsed.filters);
    return jsonResponse(body, 200);
  } catch (error) {
    const failure = failureResponse(error);
    if (failure) {
      return failure;
    }
    throw error;
  }
}

export async function handleEvidence(request: Request): Promise<Response> {
  const parsed = await readEvidenceRequest(request);
  if (!parsed) {
    return jsonResponse(searchErrorBody("validation"), 400);
  }
  const blocked = requireTypesafe();
  if (blocked) {
    return blocked;
  }
  try {
    const body = await executeEvidence(parsed.query, parsed.candidateNoteIds, parsed.filters);
    return jsonResponse({ ok: true, ...body }, 200);
  } catch (error) {
    const failure = failureResponse(error);
    if (failure) {
      return failure;
    }
    throw error;
  }
}

export function searchFailureCode(error: unknown): SearchErrorCode | "search_index_unavailable" | null {
  if (error instanceof TypesafeMisconfiguredError) {
    return "typesafe_misconfigured";
  }
  if (error instanceof JudgmentFailedError) {
    return "judgment_failed";
  }
  if (error instanceof SearchIndexUnavailableError) {
    return "search_index_unavailable";
  }
  return null;
}
