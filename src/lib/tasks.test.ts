import { describe, expect, test } from "bun:test";
import { parseTasks, toggleTask } from "./tasks";

describe("parseTasks", () => {
  test("reads bullet and ordered task items with their 1-based lines", () => {
    const body = "# 할 일\n- [ ] 우유 사기\n* [x] Call [[Bob]]  \n+ [X] plus\n1. [ ] first\n2) [x] second";
    expect(parseTasks(body)).toEqual([
      { line: 2, text: "우유 사기", done: false },
      { line: 3, text: "Call [[Bob]]", done: true },
      { line: 4, text: "plus", done: true },
      { line: 5, text: "first", done: false },
      { line: 6, text: "second", done: true },
    ]);
  });

  test("reads nested items indented with spaces or tabs", () => {
    const body = "- [ ] parent\n  - [x] two spaces\n    - [ ] four spaces\n\t- [ ] tab\n1. [ ] ordered\n   - [ ] under ordered";
    expect(parseTasks(body).map((task) => task.line)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("counts CRLF and lone CR line endings", () => {
    expect(parseTasks("a\r\n- [ ] one\r\rb\r- [x] two").map((task) => [task.line, task.text])).toEqual([[2, "one"], [5, "two"]]);
  });

  test("skips fenced code, including longer closing fences and fences inside list items", () => {
    const body = [
      "```md", "- [ ] in backticks", "```", "~~~~", "- [ ] in tildes", "~~~", "- [ ] still fenced", "~~~~",
      "- [ ] item", "  ```", "  - [ ] fenced in item", "  ```", "- [ ] after",
    ].join("\n");
    expect(parseTasks(body).map((task) => task.text)).toEqual(["item", "after"]);
  });

  test("treats everything after an unclosed fence as code", () => {
    expect(parseTasks("- [ ] before\n```\n- [ ] never")).toEqual([{ line: 1, text: "before", done: false }]);
  });

  test("skips top-level indented code but keeps deeply nested list items", () => {
    const code = "text\n\n    - [ ] indented code\n\tstill code\n- [ ] real";
    expect(parseTasks(code).map((task) => task.line)).toEqual([5]);
    const nested = "- a\n\n    - [ ] nested after blank";
    expect(parseTasks(nested).map((task) => task.line)).toEqual([3]);
  });

  test("ignores lines that are not GFM task items", () => {
    const lines = [
      "- [ ]", "-[ ] no space", "- [y] other", "[ ] no marker", "foo [ ] bar", "- a [ ] b", "- - -",
      "      - [ ] six spaces",
    ];
    expect(lines.flatMap((line) => parseTasks(line))).toEqual([]);
    expect(parseTasks("-  [x]\ttab after")).toEqual([{ line: 1, text: "tab after", done: true }]);
  });

  test("lets bullets, but not ordered items above 1, interrupt a paragraph", () => {
    expect(parseTasks("para\n2. [ ] continuation\npara\n- [ ] bullet\n\n3. [ ] new list").map((task) => task.line)).toEqual([4, 6]);
    expect(parseTasks("    code\n\n2. [ ] after code\n- [ ] bullet").map((task) => task.line)).toEqual([4]);
  });

  test("treats a dedented line right after an item as paragraph continuation", () => {
    expect(parseTasks("- [ ] a\n    - [ ] lazy? no, nested\nplain lazy\n- [ ] b").map((task) => task.line)).toEqual([1, 2, 4]);
  });
});

describe("toggleTask", () => {
  const body = "Intro\r\n- [ ] one\r\n  * [X] two\r\n```\r\n- [ ] code\r\n```";

  test("checks and unchecks only the targeted box, keeping every other byte", () => {
    const checked = toggleTask(body, { line: 2, expectedText: "one", done: true });
    expect(checked).toEqual({ ok: true, changed: true, body: body.replace("- [ ] one", "- [x] one") });
    const unchecked = toggleTask(body, { line: 3, expectedText: "two", done: false });
    expect(unchecked).toEqual({ ok: true, changed: true, body: body.replace("[X] two", "[ ] two") });
  });

  test("returns the body unchanged when the task already has the requested state", () => {
    expect(toggleTask(body, { line: 3, expectedText: "two", done: true })).toEqual({ ok: true, changed: false, body });
  });

  test("reports a mismatch for a changed text, a non-task line, or a task inside code", () => {
    expect(toggleTask(body, { line: 2, expectedText: "uno", done: true })).toEqual({ ok: false });
    expect(toggleTask(body, { line: 1, expectedText: "Intro", done: true })).toEqual({ ok: false });
    expect(toggleTask(body, { line: 5, expectedText: "code", done: true })).toEqual({ ok: false });
  });
});
