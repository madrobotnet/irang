import { describe, expect, test } from "bun:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ApiClientError } from "@/lib/api-client";
import { parseTasks } from "@/lib/tasks";
import type { ApiErrorBody } from "@/lib/types";
import { expandWikiLinks } from "./markdown";
import { taskConflictReason, taskItemLabel, taskItemLine } from "./preview-task";

/** Task items as the preview sees them: rendered through the same Markdown pipeline. */
function renderedTasks(body: string): { line: number; label: string; checked: boolean }[] {
  const items: { line: number; label: string; checked: boolean }[] = [];
  const li = ({ node, children }: ComponentProps<"li"> & ExtraProps) => {
    const line = taskItemLine(node);
    if (line !== null && node) {
      const input = node.children.find((child) => child.type === "element" && child.tagName === "input");
      const checked = input?.type === "element" && input.properties.checked === true;
      items.push({ line, label: taskItemLabel(node), checked });
    }
    return createElement("li", null, children);
  };
  renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components: { li } }, expandWikiLinks(body)));
  return items;
}

describe("rendered task items map to lib/tasks lines", () => {
  test("every parsed task has the rendered item's line and state", () => {
    const body = [
      "# Today", "", "- [ ] Call [[Bob|Robert]]", "- [x] Ship *release*", "  1. [ ] nested ordered", "",
      "Paragraph", "", "* [X] star", "+ [ ] plus with `code`", "", "```", "- [ ] fenced, not a task", "```",
    ].join("\r\n");
    const parsed = parseTasks(body);
    expect(parsed.map((task) => task.line)).toEqual([3, 4, 5, 9, 10]);
    const rendered = new Map(renderedTasks(body).map((item) => [item.line, item]));
    for (const task of parsed) expect(rendered.get(task.line)?.checked).toBe(task.done);
    expect([...rendered.keys()].sort((a, b) => a - b)).toEqual([3, 4, 5, 9, 10]);
  });

  test("shapes the parser skips render with a line it does not report", () => {
    const body = "> - [ ] quoted\n\n- [ ]\n  text below\n";
    expect(parseTasks(body)).toEqual([]);
    expect(renderedTasks(body).map((item) => item.line)).toEqual([1, 3]);
  });

  test("the label is the item's own text without markup or nested lists", () => {
    const [outer, inner] = renderedTasks("- [ ] Call [[Bob|Robert]] about **plans**\n  - [x] nested child\n");
    expect(outer?.label).toBe("Call Robert about plans");
    expect(inner?.label).toBe("nested child");
  });
});

describe("taskConflictReason", () => {
  const conflict = (reason: string, status = 409) =>
    new ApiClientError(status, "conflict", "conflict", { error: { code: "conflict", message: "conflict", reason } } as ApiErrorBody);

  test("reads the three toggle conflict reasons", () => {
    expect(["mismatch", "trashed", "archived"].map((reason) => taskConflictReason(conflict(reason)))).toEqual(["mismatch", "trashed", "archived"]);
  });

  test("ignores other statuses, unknown reasons and non-API failures", () => {
    expect(taskConflictReason(conflict("mismatch", 404))).toBeNull();
    expect(taskConflictReason(conflict("locked"))).toBeNull();
    expect(taskConflictReason(new ApiClientError(409, "conflict", "conflict"))).toBeNull();
    expect(taskConflictReason(new TypeError("Failed to fetch"))).toBeNull();
  });
});
