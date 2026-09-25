/**
 * E6 home summary envelopes (DTO seat only).
 *
 * Lio renders Top3, recent notes, and capture from these shapes.
 * Rex fills them from the existing notes and inbox lists. This module
 * does not query the database and does not add a handler.
 *
 * Page states are `loading`, `ready`, `empty_vault`, and `error`.
 * `loading` is the client wait before a response. It carries no notes
 * and no inbox count.
 *
 * `ready` means the vault has notes, so `recentNotes` is non-empty.
 * `empty_vault` means the notes list was read and the vault has no notes.
 * That state has no `recentNotes` field. An empty array is not a stand-in
 * for either state.
 *
 * A failed notes or inbox read is `summary_failed`. The error body is
 * `{ ok: false, code }` only. It has no note list and no inbox badge.
 * Do not map that failure onto `count: 0` or an empty recent-notes list.
 * Session failure stays on the auth gate (`unauthorized`).
 */

export const HOME_PAGE_STATES = ["loading", "ready", "empty_vault", "error"] as const;

export type HomePageStateName = (typeof HOME_PAGE_STATES)[number];

export const HOME_TOP3_TARGETS = [
  { id: "search", href: "/search", label: "검색" },
  { id: "inbox", href: "/inbox", label: "Inbox" },
  { id: "chat", href: "/chat", label: "AI 채팅" },
] as const;

export type HomeTop3Id = (typeof HOME_TOP3_TARGETS)[number]["id"];

export type HomeTop3TargetDto = (typeof HOME_TOP3_TARGETS)[number];

/**
 * Pending inbox rows for the home badge.
 * `count` is the integer from a successful inbox list read.
 * Zero is a real empty inbox. A failed read does not use this type.
 */
export type InboxCountBadgeDto = {
  count: number;
};

/** One recent note. Projection of the note id, title, and updatedAt. */
export type RecentNoteListItemDto = {
  id: string;
  title: string;
  updatedAt: string;
};

export type HomeReadyOk = {
  ok: true;
  state: "ready";
  top3: typeof HOME_TOP3_TARGETS;
  inboxBadge: InboxCountBadgeDto;
  recentNotes: readonly [RecentNoteListItemDto, ...RecentNoteListItemDto[]];
};

/** Notes list succeeded and the vault has no notes. No recent-notes array. */
export type HomeEmptyVaultOk = {
  ok: true;
  state: "empty_vault";
  top3: typeof HOME_TOP3_TARGETS;
  inboxBadge: InboxCountBadgeDto;
};

/** Notes or inbox list could not be read. No substitute payload. */
export type HomeSummaryFailedCode = "summary_failed";

/**
 * Handler failure, or the auth-gate unauthorized body.
 * `unauthorized` matches the middleware envelope (`authenticated: false`
 * may also be present). Neither code carries notes or a badge.
 */
export type HomeErrorCode = HomeSummaryFailedCode | "unauthorized";

export const HOME_FAIL_CLOSED_ERROR_CODES = [
  "summary_failed",
  "unauthorized",
] as const satisfies readonly HomeErrorCode[];

export type HomeErrorBody = {
  ok: false;
  code: HomeErrorCode;
};

export type HomeSummaryResponse = HomeReadyOk | HomeEmptyVaultOk | HomeErrorBody;

export type HomeLoadingModel = {
  state: "loading";
};

export type HomeErrorModel = {
  state: "error";
  error: HomeErrorBody;
};

export type HomePageModel = HomeLoadingModel | HomeReadyOk | HomeEmptyVaultOk | HomeErrorModel;

export function homeReadyOk(
  inboxCount: number,
  recentNotes: readonly [RecentNoteListItemDto, ...RecentNoteListItemDto[]],
): HomeReadyOk {
  return {
    ok: true,
    state: "ready",
    top3: HOME_TOP3_TARGETS,
    inboxBadge: { count: inboxCount },
    recentNotes,
  };
}

export function homeEmptyVaultOk(inboxCount: number): HomeEmptyVaultOk {
  return {
    ok: true,
    state: "empty_vault",
    top3: HOME_TOP3_TARGETS,
    inboxBadge: { count: inboxCount },
  };
}

export function homeErrorBody(code: HomeErrorCode): HomeErrorBody {
  return { ok: false, code };
}

/** Map a summary response onto the page union. Errors stay errors. */
export function homePageModelFromSummary(
  summary: HomeSummaryResponse,
): Exclude<HomePageModel, HomeLoadingModel> {
  if (summary.ok === false) {
    return { state: "error", error: summary };
  }
  return summary;
}
