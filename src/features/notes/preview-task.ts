import type { ExtraProps } from "react-markdown";
import { ApiClientError } from "@/lib/api-client";

export type TaskConflictReason = "mismatch" | "trashed" | "archived";
type HastElement = NonNullable<ExtraProps["node"]>;
type HastChild = HastElement["children"][number];

/** A GFM task `li` and its 1-based source line (the `lib/tasks` numbering), or null. */
export function taskItemLine(node: HastElement | undefined): number | null {
  const className = node?.properties.className;
  const isTask = Array.isArray(className) && className.includes("task-list-item");
  return isTask ? node?.position?.start.line ?? null : null;
}

/** The item's own rendered text, nested lists excluded: the checkbox's accessible name. */
export function taskItemLabel(node: HastElement): string {
  const text = (children: HastChild[]): string => children.map((child) => {
    if (child.type === "text") return child.value;
    if (child.type !== "element" || child.tagName === "ul" || child.tagName === "ol") return "";
    return text(child.children);
  }).join("");
  return text(node.children).replace(/\s+/g, " ").trim();
}

/** `error.reason` of a `409` from `POST /api/tasks/toggle`; null for any other failure. */
export function taskConflictReason(error: unknown): TaskConflictReason | null {
  if (!(error instanceof ApiClientError) || error.status !== 409) return null;
  const reason: unknown = (error.body?.error as { reason?: unknown } | undefined)?.reason;
  return reason === "mismatch" || reason === "trashed" || reason === "archived" ? reason : null;
}
