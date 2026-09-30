import { describe, expect, test } from "bun:test";
import { ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/i18n/format-date";
import type { TaskEntry, TaskList } from "@/lib/tasks";
import {
  dailyLabel, groupTasksByNote, isStaleTaskError, parseTaskState, TASK_STATES, taskDisplayText, taskKey, tasksApiUrl,
  tasksPageHref, withTaskDone,
} from "./task-model";

const entry = (noteId: string, line: number, extra: Partial<TaskEntry> = {}): TaskEntry => ({
  noteId,
  title: `note ${noteId}`,
  dailyDate: null,
  line,
  text: `task ${noteId}-${line}`,
  done: false,
  noteUpdatedAt: "2026-09-30T00:00:00.000Z",
  ...extra,
});

describe("filter state", () => {
  test("defaults to open and accepts only the API's states", () => {
    expect(TASK_STATES).toEqual(["open", "done", "all"]);
    expect(parseTaskState(null)).toBe("open");
    expect(parseTaskState("done")).toBe("done");
    expect(parseTaskState("all")).toBe("all");
    expect(parseTaskState("DONE")).toBe("open");
    expect(parseTaskState("")).toBe("open");
  });

  test("page and API URLs round-trip the state", () => {
    expect(tasksPageHref("open")).toBe("/tasks");
    for (const state of TASK_STATES) {
      const url = new URL(tasksPageHref(state), "https://irang.invalid");
      expect(parseTaskState(url.searchParams.get("state"))).toBe(state);
      expect(tasksApiUrl(state)).toBe(`/api/tasks?state=${state}`);
    }
  });
});

describe("groupTasksByNote", () => {
  test("keeps the server's note order and line order, one group per note", () => {
    const tasks = [entry("b", 2), entry("b", 5), entry("a", 1, { dailyDate: "2026-09-30", title: "2026-09-30" }), entry("b", 9)];
    const groups = groupTasksByNote(tasks);
    expect(groups.map((group) => [group.noteId, group.dailyDate, group.tasks.map((task) => task.line)])).toEqual([
      ["b", null, [2, 5, 9]],
      ["a", "2026-09-30", [1]],
    ]);
    expect(groupTasksByNote([])).toEqual([]);
  });
});

describe("withTaskDone", () => {
  test("changes only the addressed task", () => {
    const list: TaskList = { tasks: [entry("a", 1), entry("a", 2), entry("b", 1)], truncated: true };
    const next = withTaskDone(list, { noteId: "a", line: 2 }, true);
    expect(next.tasks.map((task) => [taskKey(task), task.done])).toEqual([["a:1", false], ["a:2", true], ["b:1", false]]);
    expect(next.truncated).toBe(true);
    expect(list.tasks[1]?.done).toBe(false);
  });
});

describe("dailyLabel", () => {
  test("formats the calendar date itself, whatever the viewer's zone", () => {
    expect(dailyLabel("2026-09-30", "ko")).toBe("2026-09-30");
    expect(dailyLabel("2026-09-30", "en")).toBe(formatDate("2026-09-30T12:00:00Z", "en", { timeZone: "UTC" }));
    expect(dailyLabel("2026-01-01", "ko")).toBe("2026-01-01");
  });
});

describe("taskDisplayText", () => {
  test("drops Markdown syntax but keeps the words", () => {
    expect(taskDisplayText("Call [[Bob|Bobby]] about **the** [draft](https://example.com)")).toBe("Call Bobby about the draft");
    expect(taskDisplayText("plain")).toBe("plain");
  });

  test("falls back to the raw text when nothing readable is left", () => {
    expect(taskDisplayText("![](a.png)")).toBe("![](a.png)");
  });
});

describe("isStaleTaskError", () => {
  test("refetches after 404 and every 409 reason, not after other failures", () => {
    const conflict = (reason: string) => new ApiClientError(409, "conflict", "x", { error: { code: "conflict", message: "x", reason } as never });
    expect(isStaleTaskError(conflict("mismatch"))).toBe(true);
    expect(isStaleTaskError(conflict("archived"))).toBe(true);
    expect(isStaleTaskError(new ApiClientError(404, "not_found", "x"))).toBe(true);
    expect(isStaleTaskError(new ApiClientError(500, "internal", "x"))).toBe(false);
    expect(isStaleTaskError(new TypeError("offline"))).toBe(false);
  });
});
