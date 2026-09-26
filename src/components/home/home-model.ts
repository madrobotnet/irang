import {
  homeEmptyVaultOk,
  homeErrorBody,
  homePageModelFromSummary,
  homeReadyOk,
  type HomeErrorCode,
  type HomePageModel,
  type HomeSummaryResponse,
  type RecentNoteListItemDto,
} from "@/lib/home/dto";
import { ONLINE_ONLY_BANNER_COPY } from "@/lib/pwa/copy";
import { resolvePwaInstallState, type PwaInstallSignals } from "@/lib/pwa/install";
export const RECENT_NOTE_LIMIT = 5;
export const INBOX_PREVIEW_LIMIT = 3;

export const HOME_SWIPE_THRESHOLD_PX = 72;

export type HomeSwipeTarget = "/search" | "/chat";

export type InboxPreviewRow = {
  id: string;
  title: string;
  summary: string;
};

export type InstallOffer =
  | { kind: "hidden" }
  | { kind: "prompt" }
  | { kind: "ios" };

const ERROR_CODES: readonly HomeErrorCode[] = ["summary_failed", "unauthorized"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCount(value: unknown): number | null {
  if (!isRecord(value)) return null;
  const count = value.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return null;
  return count;
}

function readNote(value: unknown): RecentNoteListItemDto | null {
  if (!isRecord(value)) return null;
  const { id, title, updatedAt } = value;
  if (typeof id !== "string" || id.trim() === "") return null;
  if (typeof title !== "string") return null;
  if (typeof updatedAt !== "string" || updatedAt.trim() === "") return null;
  return { id: id.trim(), title, updatedAt };
}

function readNotes(value: unknown): RecentNoteListItemDto[] | null {
  if (!Array.isArray(value)) return null;
  const notes: RecentNoteListItemDto[] = [];
  for (const entry of value) {
    const note = readNote(entry);
    if (!note) return null;
    notes.push(note);
  }
  return notes;
}

function isErrorCode(value: unknown): value is HomeErrorCode {
  return typeof value === "string" && ERROR_CODES.some((code) => code === value);
}

export function parseHomeSummary(value: unknown): HomeSummaryResponse | null {
  if (!isRecord(value) || (value.ok !== true && value.ok !== false)) return null;

  if (value.ok === false) {
    if (!isErrorCode(value.code)) return null;
    return homeErrorBody(value.code);
  }

  const count = readCount(value.inboxBadge);
  if (count === null) return null;

  if (value.state === "empty_vault") {
    if ("recentNotes" in value) return null;
    return homeEmptyVaultOk(count);
  }

  if (value.state !== "ready") return null;
  const notes = readNotes(value.recentNotes);
  if (!notes) return null;
  const [first, ...rest] = notes;
  if (!first) return null;
  return homeReadyOk(count, [first, ...rest]);
}

export function pageModelFromBody(value: unknown): HomePageModel {
  const summary = parseHomeSummary(value);
  if (!summary || summary.ok === false) {
    return {
      state: "error",
      error: summary && summary.ok === false ? summary : homeErrorBody("summary_failed"),
    };
  }
  return homePageModelFromSummary(summary);
}

export function visibleRecentNotes(
  notes: readonly RecentNoteListItemDto[],
): RecentNoteListItemDto[] {
  return notes.slice(0, RECENT_NOTE_LIMIT);
}

export function previewRows(
  items: readonly { id: string; title: string; body: string }[],
): InboxPreviewRow[] {
  return items.slice(0, INBOX_PREVIEW_LIMIT).map((item) => ({
    id: item.id,
    title: item.title.trim() || "캡처",
    summary: item.body.trim(),
  }));
}

export function inboxBadgeCount(model: HomePageModel): number | null {
  if (model.state !== "ready" && model.state !== "empty_vault") return null;
  return model.inboxBadge.count;
}

export function showInboxPreview(model: HomePageModel, preview: readonly InboxPreviewRow[]): boolean {
  const count = inboxBadgeCount(model);
  return count !== null && count > 0 && preview.length > 0;
}

/** Home portrait swipe: right → search, left → chat. */
export function homeSwipeHref(deltaX: number, deltaY = 0): HomeSwipeTarget | null {
  if (Math.abs(deltaX) < HOME_SWIPE_THRESHOLD_PX) return null;
  if (Math.abs(deltaY) > Math.abs(deltaX)) return null;
  if (deltaX < 0) return "/chat";
  return "/search";
}

export function installOffer(input: PwaInstallSignals): InstallOffer {
  const state = resolvePwaInstallState(input);
  if (state === "eligible") return { kind: "prompt" };
  if (state === "ios-share-hint") return { kind: "ios" };
  return { kind: "hidden" };
}

export function offlineBannerMessage(online: boolean): string | null {
  return online ? null : ONLINE_ONLY_BANNER_COPY;
}
