import { CitationsRequiredError } from "@/domain/chat/errors";
import { chatContextLimitError } from "@/lib/chat/dto";
import { parseListLimit } from "../notes/validation";
import { jsonResponse } from "../http/json-response";
import { SearchIndexUnavailableError } from "../search/runtime";
import { JudgmentFailedError, TypesafeMisconfiguredError } from "../typesafe/runtime";
import {
  ChatNotFoundError,
  ChatValidationError,
  CodexFailedError,
  ContextLimitFailure,
  ProposalNotPendingError,
  StreamingUnsupportedError,
} from "./errors";
import {
  approveChatProposal,
  archiveChatThread,
  createChatThread,
  createExplicitProposal,
  getChatThread,
  listChatMessages,
  listChatThreads,
  listPendingProposals,
  postChatMessage,
  rejectChatProposal,
  suggestManage,
} from "./service";

/**
 * Fail-closed codes follow Ada and the chat contract:
 * 503 typesafe_misconfigured, 502 judgment_failed.
 * Kai's DTO names the same cases key_missing and jev_error; those strings
 * stay on the DTO seat and are not rewritten here.
 * Over-budget context uses Kai's context_limit body (contract: context_exhausted).
 */
function failureResponse(error: unknown): Response | null {
  if (error instanceof TypesafeMisconfiguredError) {
    return jsonResponse({ ok: false, code: "typesafe_misconfigured" }, 503);
  }
  if (error instanceof JudgmentFailedError) {
    return jsonResponse({ ok: false, code: "judgment_failed" }, 502);
  }
  if (error instanceof CodexFailedError) {
    return jsonResponse({ ok: false, code: "codex_failed" }, 502);
  }
  if (error instanceof CitationsRequiredError) {
    return jsonResponse({ ok: false, code: "citations_required" }, 422);
  }
  if (error instanceof ContextLimitFailure) {
    return jsonResponse(chatContextLimitError(error.contextLimit), 422);
  }
  if (error instanceof StreamingUnsupportedError) {
    return jsonResponse({ ok: false, code: "streaming_unsupported" }, 400);
  }
  if (error instanceof ChatValidationError) {
    return jsonResponse({ ok: false, code: "validation" }, 400);
  }
  if (error instanceof ChatNotFoundError) {
    return jsonResponse({ ok: false, code: "not_found" }, 404);
  }
  if (error instanceof ProposalNotPendingError) {
    return jsonResponse({ ok: false, code: "proposal_not_pending" }, 409);
  }
  if (error instanceof SearchIndexUnavailableError) {
    return jsonResponse({ ok: false, code: "search_index_unavailable" }, 503);
  }
  return null;
}

async function run(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    const failure = failureResponse(error);
    if (failure) {
      return failure;
    }
    throw error;
  }
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

function readTitle(body: Record<string, unknown>): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(body, "title") || body.title === null) {
    return null;
  }
  if (typeof body.title !== "string") {
    return undefined;
  }
  const trimmed = body.title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readContent(body: Record<string, unknown>): string | null {
  const raw = typeof body.body === "string" ? body.body : typeof body.content === "string" ? body.content : null;
  if (raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 8_000) {
    return null;
  }
  return trimmed;
}

function readCandidateIds(body: Record<string, unknown>): string[] | undefined | null {
  if (body.candidateNoteIds === undefined) {
    return undefined;
  }
  if (!Array.isArray(body.candidateNoteIds)) {
    return null;
  }
  if (!body.candidateNoteIds.every((id) => typeof id === "string" && id.trim().length > 0)) {
    return null;
  }
  return [...new Set(body.candidateNoteIds.map((id) => id.trim()))];
}

export async function handleListThreads(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = await listChatThreads({
    limit: parseListLimit(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  return jsonResponse({ ok: true, threads: page.threads, nextCursor: page.nextCursor }, 200);
}

export async function handleCreateThread(request: Request): Promise<Response> {
  const body = await readRecord(request);
  if (!body) {
    return jsonResponse({ ok: false, code: "validation" }, 400);
  }
  const title = readTitle(body);
  if (title === undefined) {
    return jsonResponse({ ok: false, code: "validation" }, 400);
  }
  const thread = await createChatThread(title);
  return jsonResponse({ ok: true, thread }, 201);
}

export async function handleGetThread(id: string, request: Request): Promise<Response> {
  if (!id) {
    return jsonResponse({ ok: false, code: "not_found" }, 404);
  }
  const view = await getChatThread(id);
  if (!view) {
    return jsonResponse({ ok: false, code: "not_found" }, 404);
  }
  const url = new URL(request.url);
  const limit = parseListLimit(url.searchParams.get("limit"));
  return jsonResponse(
    { ok: true, thread: view.thread, messages: view.messages.slice(-limit) },
    200,
  );
}

export async function handleArchiveThread(id: string): Promise<Response> {
  const thread = await archiveChatThread(id);
  if (!thread) {
    return jsonResponse({ ok: false, code: "not_found" }, 404);
  }
  return jsonResponse({ ok: true, thread }, 200);
}

export async function handleListMessages(threadId: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = await listChatMessages(threadId, {
    limit: parseListLimit(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!page) {
    return jsonResponse({ ok: false, code: "not_found" }, 404);
  }
  return jsonResponse({ ok: true, ...page }, 200);
}

export async function handlePostMessage(threadId: string, request: Request): Promise<Response> {
  return run(async () => {
    const body = await readRecord(request);
    if (!body) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    if (body.stream === true) {
      throw new StreamingUnsupportedError();
    }
    if (body.stream !== undefined && body.stream !== false) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const content = readContent(body);
    const candidateNoteIds = readCandidateIds(body);
    if (!content || candidateNoteIds === null) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const turn = await postChatMessage(threadId, { content, candidateNoteIds });
    return jsonResponse(turn, 200);
  });
}

export async function handleProposeEdit(threadId: string, request: Request): Promise<Response> {
  return run(async () => {
    const body = await readRecord(request);
    if (!body) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const noteId = typeof body.noteId === "string" ? body.noteId.trim() : "";
    const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
    const proposedTitle = typeof body.proposedTitle === "string" ? body.proposedTitle.trim() : "";
    const proposedBody = typeof body.proposedBody === "string" ? body.proposedBody.trim() : "";
    if (!noteId || !messageId || !proposedTitle || !proposedBody) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const proposal = await createExplicitProposal({
      threadId,
      noteId,
      messageId,
      proposedTitle,
      proposedBody,
    });
    return jsonResponse({ ok: true, proposal }, 201);
  });
}

export async function handleListProposals(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  if (status !== "pending" && status !== "approved" && status !== "rejected" && status !== "all") {
    return jsonResponse({ ok: false, code: "validation" }, 400);
  }
  const proposals = await listPendingProposals(status);
  return jsonResponse({ ok: true, proposals }, 200);
}

export async function handleApproveProposal(id: string): Promise<Response> {
  return run(async () => {
    const result = await approveChatProposal(id);
    return jsonResponse({ ok: true, ...result }, 200);
  });
}

export async function handleRejectProposal(id: string): Promise<Response> {
  return run(async () => {
    const result = await rejectChatProposal(id);
    return jsonResponse({ ok: true, ...result }, 200);
  });
}

export async function handleManageSuggest(request: Request): Promise<Response> {
  return run(async () => {
    const body = await readRecord(request);
    if (!body) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const noteId = typeof body.noteId === "string" ? body.noteId.trim() : undefined;
    const inboxItemId = typeof body.inboxItemId === "string" ? body.inboxItemId.trim() : undefined;
    if (!noteId && !inboxItemId) {
      return jsonResponse({ ok: false, code: "validation" }, 400);
    }
    const result = await suggestManage({ noteId, inboxItemId });
    return jsonResponse(result, 200);
  });
}
