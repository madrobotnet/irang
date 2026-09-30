import { ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/i18n/format-date";
import type { Locale } from "@/lib/i18n/locale";
import type { TaskEntry, TaskList, TaskState } from "@/lib/tasks";
import { markdownToText } from "@/lib/wikilinks";

export const TASK_STATES: readonly TaskState[] = ["open", "done", "all"];

export function parseTaskState(raw: string | null): TaskState {
  return raw === "done" || raw === "all" ? raw : "open";
}

export function tasksPageHref(state: TaskState): string {
  return state === "open" ? "/tasks" : `/tasks?state=${state}`;
}

export function tasksApiUrl(state: TaskState): string {
  return `/api/tasks?state=${state}`;
}

export type TaskGroup = { noteId: string; title: string; dailyDate: string | null; tasks: TaskEntry[] };

/** Groups keep the server's note order (newest first) and each note's line order. */
export function groupTasksByNote(tasks: readonly TaskEntry[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();
  for (const task of tasks) {
    const group = groups.get(task.noteId);
    if (group) group.tasks.push(task);
    else groups.set(task.noteId, { noteId: task.noteId, title: task.title, dailyDate: task.dailyDate, tasks: [task] });
  }
  return [...groups.values()];
}

export const taskKey = (task: Pick<TaskEntry, "noteId" | "line">): string => `${task.noteId}:${task.line}`;

/** A daily date is a calendar day, not an instant, so it is formatted in UTC to avoid a zone shift. */
export function dailyLabel(dailyDate: string, locale: Locale): string {
  return formatDate(dailyDate, locale, { timeZone: "UTC" });
}

export function taskDisplayText(text: string): string {
  return markdownToText(text) || text;
}

export function withTaskDone(list: TaskList, target: Pick<TaskEntry, "noteId" | "line">, done: boolean): TaskList {
  const key = taskKey(target);
  return { ...list, tasks: list.tasks.map((task) => (taskKey(task) === key ? { ...task, done } : task)) };
}

/** 404 and 409 (`mismatch`, `trashed`, `archived`) mean the list no longer matches the note, so it is refetched. */
export function isStaleTaskError(error: unknown): boolean {
  return error instanceof ApiClientError && (error.status === 404 || error.status === 409);
}
