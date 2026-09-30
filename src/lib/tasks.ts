/**
 * GFM task items (`- [ ] a`, `* [x] b`, `1. [ ] c`) found by a line scanner that follows the
 * CommonMark container rules closely enough to skip fenced and indented code. Tasks inside
 * block quotes are not recognized.
 */
export type TaskItem = {
  /** 1-based source line, the same numbering as mdast / react-markdown positions. */
  line: number;
  /** Raw Markdown after the checkbox on that line, trailing whitespace removed. */
  text: string;
  done: boolean;
};
export type TaskToggle = { readonly line: number; readonly expectedText: string; readonly done: boolean };
export type ToggleResult =
  | { readonly ok: true; readonly body: string; readonly changed: boolean }
  | { readonly ok: false };

/** Wire types of GET /api/tasks. */
export type TaskState = "open" | "done" | "all";
export type TaskEntry = TaskItem & {
  noteId: string;
  title: string;
  dailyDate: string | null; // YYYY-MM-DD
  noteUpdatedAt: string; // ISO
};
export type TaskList = { tasks: TaskEntry[]; truncated: boolean };

type ScannedTask = TaskItem & { readonly markOffset: number };
type Fence = { readonly char: string; readonly length: number; readonly base: number };
type Previous = "blank" | "paragraph" | "code" | "other";

const LINE_END = /\r\n|\n|\r/g;
const LIST_MARKER = /^(?:[-*+]|(\d{1,9})[.)])(?=[ \t]|$)/;
const TASK_MARK = /^\[([ \txX])\][ \t]+(\S.*)$/;
const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const THEMATIC_BREAK = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const ATX_HEADING = /^#{1,6}(?:[ \t]|$)/;

function splitLines(body: string): { text: string; start: number }[] {
  const lines: { text: string; start: number }[] = [];
  let start = 0;
  for (const match of body.matchAll(LINE_END)) {
    lines.push({ text: body.slice(start, match.index), start });
    start = match.index + match[0].length;
  }
  lines.push({ text: body.slice(start), start });
  return lines;
}

/** Columns of leading whitespace (tab stops of 4) starting at `column`, and the characters consumed. */
function whitespace(text: string, from: number, column: number): { columns: number; width: number } {
  let columns = column;
  let index = from;
  for (; index < text.length; index += 1) {
    if (text[index] === " ") columns += 1;
    else if (text[index] === "\t") columns += 4 - (columns % 4);
    else break;
  }
  return { columns: columns - column, width: index - from };
}

function scanTasks(body: string): ScannedTask[] {
  const tasks: ScannedTask[] = [];
  const items: number[] = []; // content column of each open list item, outermost first
  let fence: Fence | null = null;
  let codeColumn: number | null = null;
  let previous: Previous = "blank";
  splitLines(body).forEach(({ text, start }, index) => {
    const indent = whitespace(text, 0, 0);
    const rest = text.slice(indent.width);
    const blank = rest.length === 0;
    if (fence && (blank || indent.columns >= fence.base)) {
      const close = new RegExp(`^${fence.char === "`" ? "`" : "~"}{${fence.length},}[ \\t]*$`);
      if (indent.columns - fence.base < 4 && close.test(rest)) fence = null;
      previous = "other";
      return;
    }
    fence = null; // a dedent below the fence's container closes it
    if (blank) {
      if (previous !== "code") previous = "blank"; // blank lines may still belong to indented code
      return;
    }
    if (codeColumn !== null && indent.columns >= codeColumn) { previous = "code"; return; }
    codeColumn = null;
    let depth = items.length;
    while (depth > 0 && indent.columns < items[depth - 1]!) depth -= 1;
    const parent = depth > 0 ? items[depth - 1]! : 0;
    if (indent.columns - parent >= 4) {
      if (previous === "paragraph") return; // paragraph continuation text
      items.length = depth;
      codeColumn = parent + 4;
      previous = "code";
      return;
    }
    const marker = THEMATIC_BREAK.test(rest) ? null : LIST_MARKER.exec(rest);
    if (marker) {
      const after = whitespace(text, indent.width + marker[0].length, indent.columns + marker[0].length);
      const content = text.slice(indent.width + marker[0].length + after.width);
      const startsList = depth === items.length;
      // micromark applies the paragraph-interruption limits after indented code as well
      const interrupts = (previous === "paragraph" || previous === "code") && startsList;
      if (!interrupts || (content.length > 0 && (marker[1] === undefined || Number(marker[1]) === 1))) {
        items.length = depth;
        const markerEnd = indent.columns + marker[0].length;
        const codeContent = content.length === 0 || after.columns > 4;
        items.push(codeContent ? markerEnd + 1 : markerEnd + after.columns);
        const task = codeContent ? null : TASK_MARK.exec(content);
        if (task) {
          const markOffset = start + text.length - content.length + 1;
          tasks.push({ line: index + 1, text: task[2]!.trimEnd(), done: task[1] !== " " && task[1] !== "\t", markOffset });
        }
        previous = content.length > 0 && !codeContent ? "paragraph" : "other";
        return;
      }
    }
    const open = FENCE_OPEN.exec(rest);
    if (open && !(open[1]!.startsWith("`") && open[2]!.includes("`"))) {
      items.length = depth;
      fence = { char: open[1]![0]!, length: open[1]!.length, base: parent };
      previous = "other";
      return;
    }
    if (previous === "paragraph" && !THEMATIC_BREAK.test(rest) && !ATX_HEADING.test(rest)) return;
    items.length = depth;
    previous = THEMATIC_BREAK.test(rest) || ATX_HEADING.test(rest) ? "other" : "paragraph";
  });
  return tasks;
}

export function parseTasks(body: string): TaskItem[] {
  return scanTasks(body).map(({ line, text, done }) => ({ line, text, done }));
}

/** Set one task's state after checking it still says `expectedText`; every other byte is kept. */
export function toggleTask(body: string, change: TaskToggle): ToggleResult {
  const task = scanTasks(body).find((item) => item.line === change.line);
  if (!task || task.text !== change.expectedText) return { ok: false };
  if (task.done === change.done) return { ok: true, body, changed: false };
  const mark = change.done ? "x" : " ";
  return { ok: true, body: body.slice(0, task.markOffset) + mark + body.slice(task.markOffset + 1), changed: true };
}
