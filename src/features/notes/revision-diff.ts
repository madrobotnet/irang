export type DiffLine = { kind: "same" | "add" | "del"; text: string };
export type DiffRow = DiffLine | { kind: "skip"; count: number };
export type LineDiff =
  | { status: "ok"; added: number; removed: number; rows: DiffRow[] }
  | { status: "too-large" };

export type DiffLimits = {
  /** Upper bound on either side's line count. */
  maxLines: number;
  /** Upper bound on the LCS table after the shared head and tail are trimmed. */
  maxCells: number;
  /** Unchanged lines kept around each change; longer unchanged runs collapse into a skip row. */
  context: number;
};

export const DIFF_LIMITS: DiffLimits = { maxLines: 20_000, maxCells: 1_000_000, context: 2 };

const splitLines = (text: string): string[] => (text === "" ? [] : text.split(/\r?\n/));

/** Compact line diff from `before` to `after`; the work is bounded by `limits`, beyond which it reports "too-large". */
export function diffLines(before: string, after: string, limits: DiffLimits = DIFF_LIMITS): LineDiff {
  const a = splitLines(before);
  const b = splitLines(after);
  if (a.length > limits.maxLines || b.length > limits.maxLines) return { status: "too-large" };

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;

  const middle = middleDiff(a.slice(head, a.length - tail), b.slice(head, b.length - tail), limits.maxCells);
  if (!middle) return { status: "too-large" };

  const lines: DiffLine[] = [
    ...a.slice(0, head).map((text): DiffLine => ({ kind: "same", text })),
    ...middle,
    ...a.slice(a.length - tail).map((text): DiffLine => ({ kind: "same", text })),
  ];
  const added = middle.filter((line) => line.kind === "add").length;
  const removed = middle.filter((line) => line.kind === "del").length;
  return { status: "ok", added, removed, rows: added + removed === 0 ? [] : compact(lines, limits.context) };
}

/** LCS over the differing middle; null when its table would exceed `maxCells`. */
function middleDiff(a: string[], b: string[], maxCells: number): DiffLine[] | null {
  if (a.length === 0) return b.map((text) => ({ kind: "add", text }));
  if (b.length === 0) return a.map((text) => ({ kind: "del", text }));
  const width = b.length + 1;
  if ((a.length + 1) * width > maxCells) return null;

  // Intern lines so the O(n*m) loop compares numbers, not strings.
  const ids = new Map<string, number>();
  const intern = (line: string) => {
    let id = ids.get(line);
    if (id === undefined) {
      id = ids.size;
      ids.set(line, id);
    }
    return id;
  };
  const x = a.map(intern);
  const y = b.map(intern);

  // lcs[i * width + j] = LCS length of x[i..] and y[j..]; lengths stay below maxLines, so 16 bits suffice.
  const lcs = new Uint16Array((a.length + 1) * width);
  const cell = (i: number, j: number) => lcs[i * width + j] ?? 0;
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] = x[i] === y[j] ? cell(i + 1, j + 1) + 1 : Math.max(cell(i + 1, j), cell(i, j + 1));
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && x[i] === y[j]) {
      out.push({ kind: "same", text: a[i] ?? "" });
      i += 1;
      j += 1;
    } else if (j === b.length || (i < a.length && cell(i + 1, j) >= cell(i, j + 1))) {
      out.push({ kind: "del", text: a[i] ?? "" });
      i += 1;
    } else {
      out.push({ kind: "add", text: b[j] ?? "" });
      j += 1;
    }
  }
  return out;
}

function compact(lines: DiffLine[], context: number): DiffRow[] {
  const keep = new Uint8Array(lines.length);
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, index - context); k <= Math.min(lines.length - 1, index + context); k += 1) keep[k] = 1;
  });
  const rows: DiffRow[] = [];
  let skipped: DiffLine[] = [];
  // A lone unchanged line is shown as is: collapsing it would not save a row.
  const flush = () => {
    if (skipped.length === 1) rows.push(...skipped);
    else if (skipped.length > 1) rows.push({ kind: "skip", count: skipped.length });
    skipped = [];
  };
  lines.forEach((line, index) => {
    if (keep[index]) {
      flush();
      rows.push(line);
    } else {
      skipped.push(line);
    }
  });
  flush();
  return rows;
}
