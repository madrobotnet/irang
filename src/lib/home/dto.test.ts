import { describe, expect, it } from "vitest";
import { E6_GATED_PATHS, E6_HOME_SUMMARY_PATH } from "@/lib/auth/e6-gate-paths";
import {
  HOME_FAIL_CLOSED_ERROR_CODES,
  HOME_PAGE_STATES,
  HOME_TOP3_TARGETS,
  homeEmptyVaultOk,
  homeErrorBody,
  homePageModelFromSummary,
  homeReadyOk,
  type HomeEmptyVaultOk,
  type HomeErrorBody,
  type HomeLoadingModel,
  type HomePageModel,
  type HomeReadyOk,
  type RecentNoteListItemDto,
} from "./dto";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type FailClosedCode = (typeof HOME_FAIL_CLOSED_ERROR_CODES)[number];

type ForbiddenHomeKeys = "fallback" | "keywordFallback" | "notes" | "inboxItems" | "placeholder";

type AssertNoForbidden<T> = Extract<keyof T, ForbiddenHomeKeys> extends never ? true : never;

type EmptyKeys = keyof HomeEmptyVaultOk;
type EmptyHasNoRecentNotes = "recentNotes" extends EmptyKeys ? never : true;

type ErrorKeys = keyof HomeErrorBody;
type ErrorIsCodeOnly = Equal<ErrorKeys, "ok" | "code">;

type LoadingKeys = keyof HomeLoadingModel;
type LoadingIsStateOnly = Equal<LoadingKeys, "state">;

type PageStates = HomePageModel["state"];
type PageStatesMatch = Equal<PageStates, "loading" | "ready" | "empty_vault" | "error">;

type RecentNonEmpty = HomeReadyOk["recentNotes"] extends readonly [
  RecentNoteListItemDto,
  ...RecentNoteListItemDto[],
]
  ? readonly [] extends HomeReadyOk["recentNotes"]
    ? never
    : true
  : never;

const failClosedCodesMatch: Equal<FailClosedCode, "summary_failed" | "unauthorized"> = true;
const pageStateNamesMatch: Equal<
  (typeof HOME_PAGE_STATES)[number],
  "loading" | "ready" | "empty_vault" | "error"
> = true;
const noForbiddenOnReady: AssertNoForbidden<HomeReadyOk> = true;
const noForbiddenOnEmpty: AssertNoForbidden<HomeEmptyVaultOk> = true;
const noForbiddenOnError: AssertNoForbidden<HomeErrorBody> = true;
const emptyHasNoRecentNotes: EmptyHasNoRecentNotes = true;
const errorIsCodeOnly: ErrorIsCodeOnly = true;
const loadingIsStateOnly: LoadingIsStateOnly = true;
const pageStatesMatch: PageStatesMatch = true;
const recentNotesNonEmpty: RecentNonEmpty = true;

const note: RecentNoteListItemDto = {
  id: "note-1",
  title: "오늘 메모",
  updatedAt: "2026-09-23T00:00:00.000Z",
};

describe("E6 home DTO seat", () => {
  it("names the Top3 targets and the closed page states", () => {
    expect(pageStateNamesMatch).toBe(true);
    expect(pageStatesMatch).toBe(true);
    expect(failClosedCodesMatch).toBe(true);
    expect(loadingIsStateOnly).toBe(true);
    expect([...HOME_PAGE_STATES]).toEqual(["loading", "ready", "empty_vault", "error"]);
    expect(HOME_TOP3_TARGETS).toEqual([
      { id: "search", href: "/search", label: "검색" },
      { id: "inbox", href: "/inbox", label: "Inbox" },
      { id: "chat", href: "/chat", label: "AI 채팅" },
    ]);
    expect(E6_HOME_SUMMARY_PATH).toBe("/api/home");
    expect([...E6_GATED_PATHS]).toEqual(["/", "/api/home"]);
  });

  it("carries a real inbox count and a non-empty recent list when the vault is ready", () => {
    expect(noForbiddenOnReady).toBe(true);
    expect(recentNotesNonEmpty).toBe(true);
    const ready = homeReadyOk(3, [note]);
    expect(ready).toEqual({
      ok: true,
      state: "ready",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 3 },
      recentNotes: [note],
    });
    expect(ready.recentNotes[0]).toEqual({
      id: "note-1",
      title: "오늘 메모",
      updatedAt: "2026-09-23T00:00:00.000Z",
    });
    expect(homePageModelFromSummary(ready)).toBe(ready);
  });

  it("represents an empty vault without a recent-notes array", () => {
    expect(noForbiddenOnEmpty).toBe(true);
    expect(emptyHasNoRecentNotes).toBe(true);
    const empty = homeEmptyVaultOk(0);
    expect(empty).toEqual({
      ok: true,
      state: "empty_vault",
      top3: HOME_TOP3_TARGETS,
      inboxBadge: { count: 0 },
    });
    expect(empty).not.toHaveProperty("recentNotes");
    expect(empty).not.toHaveProperty("notes");
    expect(homePageModelFromSummary(empty).state).toBe("empty_vault");
  });

  it("keeps summary failure and unauthorized bodies free of fake lists", () => {
    expect(noForbiddenOnError).toBe(true);
    expect(errorIsCodeOnly).toBe(true);
    expect([...HOME_FAIL_CLOSED_ERROR_CODES]).toEqual(["summary_failed", "unauthorized"]);
    const failed = homeErrorBody("summary_failed");
    const unauthorized = homeErrorBody("unauthorized");
    expect(failed).toEqual({ ok: false, code: "summary_failed" });
    expect(unauthorized).toEqual({ ok: false, code: "unauthorized" });
    expect(failed).not.toHaveProperty("recentNotes");
    expect(failed).not.toHaveProperty("inboxBadge");
    expect(failed).not.toHaveProperty("notes");
    expect(JSON.parse(JSON.stringify(failed))).toEqual({ ok: false, code: "summary_failed" });
    expect(homePageModelFromSummary(failed)).toEqual({ state: "error", error: failed });
    expect(homePageModelFromSummary(unauthorized).state).toBe("error");
  });
});
