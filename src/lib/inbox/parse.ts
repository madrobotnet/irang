import { clamp01 } from "./judgment";
import {
  INBOX_SOURCES,
  type InboxClassificationView,
  type InboxItem,
  type InboxSource,
  type InboxSuggestions,
  type IngestJobView,
  type JevFailure,
  type TagSuggestion,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value;
}

function readSource(value: unknown): InboxSource | null {
  if (typeof value !== "string") return null;
  return INBOX_SOURCES.includes(value as InboxSource) ? (value as InboxSource) : null;
}

export function mapJudgmentCode(code: string | null | undefined): JevFailure | null {
  if (code === "judgment_failed" || code === "jev_error") return "jev_error";
  if (code === "typesafe_misconfigured" || code === "key_missing") return "key_missing";
  return null;
}

function readProbability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function readTags(value: unknown): TagSuggestion[] | null {
  if (!Array.isArray(value)) return null;
  const tags: TagSuggestion[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const tag = readString(entry.tag)?.trim();
    const probability = readProbability(entry.probability);
    if (!tag || probability === null || seen.has(tag)) continue;
    seen.add(tag);
    tags.push({ tag, probability: clamp01(probability) });
  }
  return tags;
}

function readClassification(value: unknown): InboxClassificationView | null {
  if (value == null) return null;
  if (!isRecord(value)) return null;
  const choice = readString(value.choice)?.trim();
  const probability = readProbability(value.probability);
  const confidence = readProbability(value.confidence);
  if (!choice || probability === null || confidence === null) return null;
  return {
    choice,
    probability: clamp01(probability),
    confidence: clamp01(confidence),
  };
}

function readSuggestions(value: unknown): InboxSuggestions | null {
  if (!isRecord(value)) return null;
  const tags = readTags(value.tags);
  if (!tags) return null;
  const classification = readClassification(value.classification);
  const judgedAt = readString(value.judgedAt)?.trim() ?? "";
  if (tags.length === 0 && !classification && !judgedAt) return null;
  return { tags, classification, judgedAt };
}

export function parseInboxItem(value: unknown): InboxItem | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id)?.trim();
  const source = readSource(value.source);
  if (!id || !source) return null;
  return {
    id,
    title: readString(value.title) ?? "",
    body: readString(value.body) ?? "",
    source,
    url: readString(value.url),
    createdAt: readString(value.createdAt) ?? "",
    promotedNoteId: readString(value.promotedNoteId),
    discardedAt: readString(value.discardedAt),
    suggestions: readSuggestions(value.suggestions),
  };
}

export function parseInboxListBody(body: unknown): InboxItem[] | null {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.inboxItems)) {
    return null;
  }
  const items: InboxItem[] = [];
  for (const entry of body.inboxItems) {
    const item = parseInboxItem(entry);
    if (!item) continue;
    if (item.discardedAt || item.promotedNoteId) continue;
    items.push(item);
  }
  return items;
}

export function parseIngestJob(value: unknown): IngestJobView | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id)?.trim();
  const status = readString(value.status);
  if (!id || status !== "failed") return null;
  const payload = isRecord(value.payload) ? value.payload : {};
  const title = readString(payload.title)?.trim() || "";
  const url = readString(payload.url)?.trim() || "";
  const error = readString(value.error)?.trim() || "";
  return {
    id,
    title,
    detail: error || url,
    createdAt: readString(value.createdAt) ?? "",
  };
}

export function parseIngestJobsBody(body: unknown): IngestJobView[] | null {
  if (!isRecord(body) || body.ok !== true || !Array.isArray(body.jobs)) {
    return null;
  }
  const jobs: IngestJobView[] = [];
  for (const entry of body.jobs) {
    const job = parseIngestJob(entry);
    if (job) jobs.push(job);
  }
  return jobs;
}
