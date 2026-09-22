import {
  E5_CHAT_COLLECTION_PATH,
  e5ChatMessagesPath,
  e5ChatProposeEditPath,
} from "@/lib/auth/e5-gate-paths";
import type {
  CreateChatMessageBody,
  CreateChatThreadBody,
  CreateNoteEditProposalBody,
  NoteEditDecisionDto,
} from "@/lib/chat/dto";
import {
  interpretMessageList,
  interpretProposal,
  interpretThread,
  interpretThreadList,
  interpretTurnBody,
  mapChatFailure,
  type ChatMessageView,
  type Interpreted,
  type ParsedThreads,
  type ParsedTurn,
  type ProposalView,
} from "./parse";
import type { ChatThreadDto } from "@/lib/chat/dto";

/**
 * Thin client for Kai's chat seats.
 * Note writes stay off this module: approve/reject records a decision,
 * and propose-edit only creates a pending proposal.
 */

export function chatProposalDecisionPath(
  proposalId: string,
  decision: NoteEditDecisionDto["decision"],
): string {
  return `/api/chat/proposals/${encodeURIComponent(proposalId)}/${decision}`;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function network<T>(): Interpreted<T> {
  return { ok: false, reason: "error", contextLimit: null };
}

export async function listChatThreads(
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<ParsedThreads>> {
  try {
    const res = await fetchImpl(E5_CHAT_COLLECTION_PATH, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { ok: true, value: { threads: [], nextCursor: null } };
    return interpretThreadList(res.status, await readJson(res));
  } catch {
    return network();
  }
}

export async function createChatThread(
  title: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<ChatThreadDto>> {
  const body: CreateChatThreadBody = { title };
  try {
    const res = await fetchImpl(E5_CHAT_COLLECTION_PATH, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return interpretThread(res.status, await readJson(res));
  } catch {
    return network();
  }
}

export async function listChatMessages(
  threadId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<{ threadId: string; messages: ChatMessageView[]; nextCursor: string | null }>> {
  try {
    const res = await fetchImpl(e5ChatMessagesPath(threadId), {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return interpretMessageList(res.status, await readJson(res));
  } catch {
    return network();
  }
}

type Delta = { delta?: unknown };

function isDelta(value: unknown): value is { delta: string } {
  return typeof value === "object" && value !== null && typeof (value as Delta).delta === "string";
}

function applyPayload(payload: unknown, onDelta: (delta: string) => void): Interpreted<ParsedTurn> | null {
  if (isDelta(payload)) {
    if (payload.delta) onDelta(payload.delta);
    return null;
  }
  return interpretTurnBody(200, payload);
}

async function readSse(res: Response, onDelta: (delta: string) => void): Promise<Interpreted<ParsedTurn>> {
  if (!res.body) return network();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalTurn: Interpreted<ParsedTurn> | null = null;
  const take = (block: string) => {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) return;
    let payload: unknown;
    try {
      payload = JSON.parse(data) as unknown;
    } catch {
      return;
    }
    const next = applyPayload(payload, onDelta);
    if (next) finalTurn = next;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) take(block);
  }
  buffer += decoder.decode();
  if (buffer.trim()) take(buffer);
  return finalTurn ?? network();
}

async function readNdjson(res: Response, onDelta: (delta: string) => void): Promise<Interpreted<ParsedTurn>> {
  if (!res.body) return network();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalTurn: Interpreted<ParsedTurn> | null = null;
  const takeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let payload: unknown;
    try {
      payload = JSON.parse(trimmed) as unknown;
    } catch {
      return;
    }
    const next = applyPayload(payload, onDelta);
    if (next) finalTurn = next;
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) takeLine(line);
  }
  if (buffer.trim()) takeLine(buffer);
  return finalTurn ?? network();
}

function finishStream(status: number, streamed: Interpreted<ParsedTurn>): Interpreted<ParsedTurn> {
  if (streamed.ok || streamed.reason !== "error") return streamed;
  const reason = mapChatFailure(status, null);
  if (!reason || reason === "error") return streamed;
  return { ok: false, reason, contextLimit: streamed.contextLimit };
}

export async function sendChatMessage(
  threadId: string,
  input: CreateChatMessageBody,
  onDelta: (delta: string) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<ParsedTurn>> {
  const body: CreateChatMessageBody = input.candidateNoteIds
    ? { body: input.body, candidateNoteIds: input.candidateNoteIds }
    : { body: input.body };
  try {
    const res = await fetchImpl(e5ChatMessagesPath(threadId), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/x-ndjson, application/json",
      },
      body: JSON.stringify(body),
    });
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/event-stream")) return finishStream(res.status, await readSse(res, onDelta));
    if (type.includes("ndjson")) return finishStream(res.status, await readNdjson(res, onDelta));
    return interpretTurnBody(res.status, await readJson(res));
  } catch {
    return network();
  }
}

export async function proposeNoteEdit(
  threadId: string,
  input: CreateNoteEditProposalBody,
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<ProposalView>> {
  const body: CreateNoteEditProposalBody = {
    noteId: input.noteId,
    messageId: input.messageId,
    proposedTitle: input.proposedTitle,
    proposedBody: input.proposedBody,
  };
  try {
    const res = await fetchImpl(e5ChatProposeEditPath(threadId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return interpretProposal(res.status, await readJson(res));
  } catch {
    return network();
  }
}

export async function decideNoteEdit(
  proposalId: string,
  decision: NoteEditDecisionDto["decision"],
  fetchImpl: typeof fetch = fetch,
): Promise<Interpreted<NoteEditDecisionDto>> {
  const payload: NoteEditDecisionDto = { proposalId, decision };
  try {
    const res = await fetchImpl(chatProposalDecisionPath(proposalId, decision), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await readJson(res);
    if (res.status >= 400 || (typeof body === "object" && body !== null && "ok" in body && body.ok === false)) {
      const code =
        typeof body === "object" && body !== null && "code" in body && typeof body.code === "string"
          ? body.code
          : null;
      if (code === "judgment_failed" || code === "jev_error" || res.status === 502) {
        return { ok: false, reason: "jev_error", contextLimit: null };
      }
      if (code === "typesafe_misconfigured" || code === "key_missing" || res.status === 503) {
        return { ok: false, reason: "key_missing", contextLimit: null };
      }
      return network();
    }
    return { ok: true, value: payload };
  } catch {
    return network();
  }
}
