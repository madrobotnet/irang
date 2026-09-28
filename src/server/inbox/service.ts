import { choice, noul } from "@typesafe-ai/sdk";
import type { PoolClient, QueryResultRow } from "pg";
import type { InboxItem, InboxSource, InboxSuggestions, Note } from "@/lib/types";
import { db, tx } from "@/server/db";
import { ApiError } from "@/server/http";
import { getJev, jevModel } from "@/server/jev/client";
import { createNote, getNote } from "@/server/notes/service";
import { fetchUrlText, type UrlIntakeDependencies } from "./url";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_PENDING = "> URL 내용을 가져오는 중입니다.";
const URL_FAILED = "> URL 내용을 가져오지 못했습니다. 원문 링크는 보존되었습니다.";

type InboxRow = QueryResultRow & {
  id: string; title: string; body: string; source: string; url: string | null;
  promoted_note_id: string | null; discarded_at: string | Date | null;
  suggestions: unknown; created_at: string | Date;
};

export type CaptureInboxInput = { text?: string; url?: string; title?: string; source?: InboxSource };
export type PromoteInboxInput = { title?: string; body?: string; tags?: string[] };

function assertId(id: string): void {
  if (!UUID_RE.test(id)) throw new ApiError("validation", "올바른 UUID가 아닙니다.");
}

function probability(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

function readSuggestions(value: unknown): InboxSuggestions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const status = raw.status === "ready" || raw.status === "unavailable" || raw.status === "failed" ? raw.status : "ready";
  const tags = Array.isArray(raw.tags) ? raw.tags.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    const score = probability(item.probability ?? item.noul);
    return typeof item.tag === "string" && item.tag.trim() && score !== null ? [{ tag: item.tag.trim(), probability: score }] : [];
  }) : [];
  const oldKind = raw.classification && typeof raw.classification === "object" ? raw.classification as Record<string, unknown> : null;
  const kindRaw = raw.kind && typeof raw.kind === "object" ? raw.kind as Record<string, unknown> : oldKind;
  const kindScore = kindRaw ? probability(kindRaw.confidence ?? kindRaw.probability) : null;
  const kind = kindRaw && typeof kindRaw.choice === "string" && kindScore !== null
    ? { choice: kindRaw.choice, confidence: kindScore } : null;
  const duplicateRaw = raw.duplicateOf && typeof raw.duplicateOf === "object" ? raw.duplicateOf as Record<string, unknown> : null;
  const duplicateScore = duplicateRaw ? probability(duplicateRaw.probability) : null;
  const duplicateOf = duplicateRaw && typeof duplicateRaw.noteId === "string" && typeof duplicateRaw.title === "string" && duplicateScore !== null
    ? { noteId: duplicateRaw.noteId, title: duplicateRaw.title, probability: duplicateScore } : null;
  return { status, tags, kind, duplicateOf };
}

function mapItem(row: InboxRow): InboxItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    source: (["web", "url", "share", "api"].includes(row.source) ? row.source : "api") as InboxSource,
    url: row.url,
    createdAt: new Date(row.created_at).toISOString(),
    suggestions: readSuggestions(row.suggestions),
  };
}

function initialTitle(input: CaptureInboxInput): string {
  const given = input.title?.trim();
  if (given) return given;
  const firstLine = input.text?.trim().split(/\r?\n/)[0]?.trim();
  if (firstLine) return firstLine.slice(0, 120);
  if (input.url) {
    try { return new URL(input.url).hostname || "링크 캡처"; } catch { return "링크 캡처"; }
  }
  return "빠른 캡처";
}

export async function captureInbox(input: CaptureInboxInput): Promise<InboxItem> {
  const text = input.text?.trim() ?? "";
  const url = input.url?.trim() || null;
  if (!text && !url) throw new ApiError("validation", "텍스트나 URL을 입력해 주세요.");
  const body = url ? [text, URL_PENDING].filter(Boolean).join("\n\n") : text;
  const pool = await db();
  const result = await pool.query<InboxRow>(
    "INSERT INTO inbox_items (title,body,source,url) VALUES ($1,$2,$3,$4) RETURNING *",
    [initialTitle(input), body, input.source ?? (url ? "url" : "web"), url],
  );
  return mapItem(result.rows[0]!);
}

export async function listInbox(): Promise<{ items: InboxItem[]; count: number }> {
  const pool = await db();
  const result = await pool.query<InboxRow>(
    "SELECT * FROM inbox_items WHERE discarded_at IS NULL AND promoted_note_id IS NULL ORDER BY created_at DESC,id DESC",
  );
  return { items: result.rows.map(mapItem), count: result.rows.length };
}

async function rowById(id: string, client?: PoolClient): Promise<InboxRow | null> {
  assertId(id);
  const executor = client ?? await db();
  const result = await executor.query<InboxRow>("SELECT * FROM inbox_items WHERE id=$1", [id]);
  return result.rows[0] ?? null;
}

export async function getInboxItem(id: string): Promise<InboxItem | null> {
  const row = await rowById(id);
  return row ? mapItem(row) : null;
}

export async function promoteInbox(id: string, input: PromoteInboxInput = {}): Promise<Note> {
  assertId(id);
  const noteId = await tx(async (client) => {
    const locked = await client.query<InboxRow>("SELECT * FROM inbox_items WHERE id=$1 FOR UPDATE", [id]);
    const item = locked.rows[0];
    if (!item) throw new ApiError("not_found", "인박스 항목을 찾을 수 없습니다.");
    if (item.discarded_at) throw new ApiError("conflict", "버린 항목은 노트로 만들 수 없습니다.");
    if (item.promoted_note_id) return item.promoted_note_id;
    const note = await createNote({
      title: input.title?.trim() || item.title,
      body: input.body ?? item.body.replace(`\n\n${URL_PENDING}`, "").replace(URL_PENDING, ""),
      tags: input.tags,
      sourceUrl: item.url,
    }, client);
    await client.query("UPDATE inbox_items SET promoted_note_id=$2 WHERE id=$1", [id, note.id]);
    await client.query("UPDATE attachments SET note_id=$2,inbox_item_id=NULL WHERE inbox_item_id=$1", [id, note.id]);
    return note.id;
  });
  const note = await getNote(noteId);
  if (!note) throw new ApiError("not_found", "승격된 노트를 찾을 수 없습니다.");
  return note;
}

export async function discardInbox(id: string): Promise<void> {
  assertId(id);
  await tx(async (client) => {
    const result = await client.query<InboxRow>("SELECT * FROM inbox_items WHERE id=$1 FOR UPDATE", [id]);
    const item = result.rows[0];
    if (!item) throw new ApiError("not_found", "인박스 항목을 찾을 수 없습니다.");
    if (item.promoted_note_id) throw new ApiError("conflict", "이미 노트로 만든 항목입니다.");
    await client.query("UPDATE inbox_items SET discarded_at=coalesce(discarded_at,now()) WHERE id=$1", [id]);
  });
}

type Answer = { type?: unknown; noul?: unknown; choice?: unknown; confidence?: unknown; probabilities?: unknown };

async function buildSuggestions(item: InboxRow): Promise<InboxSuggestions> {
  const jev = getJev();
  if (!jev) return { status: "unavailable", tags: [], kind: null, duplicateOf: null };
  try {
    const pool = await db();
    const notes = await pool.query<{ id: string; title: string }>(
      "SELECT id,title FROM notes WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20",
    );
    const duplicateChoices: Record<string, string | null> = { none: "기존 노트와 중복되지 않음" };
    for (const note of notes.rows) duplicateChoices[note.id] = note.title;
    const response = await jev.systemOne({
      model: jevModel(),
      state: { title: item.title, body: item.body.slice(0, 4000), existingNotes: notes.rows },
      questions: {
        kind: choice("이 캡처의 주된 종류를 하나 고르세요.", { idea: "아이디어", reference: "참고 자료", task: "할 일", other: "기타" }),
        tag_idea: noul("idea 태그를 제안할까요?"),
        tag_reference: noul("reference 태그를 제안할까요?"),
        tag_task: noul("task 태그를 제안할까요?"),
        ...(notes.rows.length ? { duplicate: choice("실질적으로 같은 기존 노트를 고르거나 none을 고르세요.", duplicateChoices) } : {}),
      },
    });
    const answers = response.answers as Record<string, Answer>;
    const tags = ["idea", "reference", "task"].flatMap((tag) => {
      const score = probability(answers[`tag_${tag}`]?.noul);
      return score !== null && score >= 0.5 ? [{ tag, probability: score }] : [];
    }).sort((a, b) => b.probability - a.probability);
    const kindAnswer = answers.kind;
    const kindConfidence = probability(kindAnswer?.confidence);
    const kind = typeof kindAnswer?.choice === "string" && kindConfidence !== null
      ? { choice: kindAnswer.choice, confidence: kindConfidence } : null;
    const duplicate = answers.duplicate;
    const probabilities = duplicate?.probabilities && typeof duplicate.probabilities === "object"
      ? duplicate.probabilities as Record<string, unknown> : null;
    const selected = typeof duplicate?.choice === "string" ? duplicate.choice : null;
    const matched = selected && selected !== "none" ? notes.rows.find((note) => note.id === selected) : null;
    const duplicateProbability = selected && probabilities ? probability(probabilities[selected]) : null;
    const duplicateOf = matched && duplicateProbability !== null
      ? { noteId: matched.id, title: matched.title, probability: duplicateProbability } : null;
    return { status: "ready", tags, kind, duplicateOf };
  } catch {
    return { status: "failed", tags: [], kind: null, duplicateOf: null };
  }
}

export async function suggestInbox(id: string): Promise<InboxItem> {
  const item = await rowById(id);
  if (!item) throw new ApiError("not_found", "인박스 항목을 찾을 수 없습니다.");
  const suggestions = await buildSuggestions(item);
  const pool = await db();
  const result = await pool.query<InboxRow>("UPDATE inbox_items SET suggestions=$2::jsonb WHERE id=$1 RETURNING *", [id, JSON.stringify(suggestions)]);
  return mapItem(result.rows[0]!);
}

/** Best-effort post-response URL intake and Jev suggestion persistence. */
export async function enrichInboxItem(id: string, dependencies: UrlIntakeDependencies = {}): Promise<void> {
  const item = await rowById(id);
  if (!item || item.discarded_at || item.promoted_note_id) return;
  if (item.url) {
    const fetched = await fetchUrlText(item.url, dependencies);
    const replacement = fetched.ok && fetched.text ? fetched.text : URL_FAILED;
    const body = item.body.includes(URL_PENDING) ? item.body.replace(URL_PENDING, replacement) : item.body;
    const pool = await db();
    await pool.query(
      "UPDATE inbox_items SET body=$2,url=CASE WHEN $3::text IS NULL THEN url ELSE $3 END WHERE id=$1 AND promoted_note_id IS NULL AND discarded_at IS NULL",
      [id, body, fetched.ok ? fetched.url : null],
    );
  }
  await suggestInbox(id).catch(() => undefined);
}
