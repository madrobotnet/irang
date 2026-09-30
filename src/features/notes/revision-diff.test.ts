import { describe, expect, test } from "bun:test";
import { diffLines, DIFF_LIMITS } from "./revision-diff";

const lines = (count: number, prefix = "line") => Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

describe("diffLines", () => {
  test("identical bodies have no rows", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual({ status: "ok", added: 0, removed: 0, rows: [] });
    expect(diffLines("", "")).toEqual({ status: "ok", added: 0, removed: 0, rows: [] });
  });

  test("CRLF and LF line endings compare equal", () => {
    expect(diffLines("a\r\nb", "a\nb")).toEqual({ status: "ok", added: 0, removed: 0, rows: [] });
  });

  test("an empty side is all additions or all deletions", () => {
    expect(diffLines("", "x\ny")).toEqual({ status: "ok", added: 2, removed: 0, rows: [{ kind: "add", text: "x" }, { kind: "add", text: "y" }] });
    expect(diffLines("x", "")).toEqual({ status: "ok", added: 0, removed: 1, rows: [{ kind: "del", text: "x" }] });
  });

  test("a replaced line lists the deletion before the addition, with context", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual({
      status: "ok", added: 1, removed: 1,
      rows: [{ kind: "same", text: "a" }, { kind: "del", text: "b" }, { kind: "add", text: "B" }, { kind: "same", text: "c" }],
    });
  });

  test("unchanged runs outside the context collapse into skip rows", () => {
    const before = lines(10).join("\n");
    const after = lines(10).map((line, index) => (index === 5 ? "changed" : line)).join("\n");
    expect(diffLines(before, after, { ...DIFF_LIMITS, context: 1 })).toEqual({
      status: "ok", added: 1, removed: 1,
      rows: [
        { kind: "skip", count: 4 },
        { kind: "same", text: "line 5" },
        { kind: "del", text: "line 6" },
        { kind: "add", text: "changed" },
        { kind: "same", text: "line 7" },
        { kind: "skip", count: 3 },
      ],
    });
  });

  test("a single unchanged line between changes stays visible instead of a skip row", () => {
    expect(diffLines("a\nb\nc\nd\ne", "A\nb\nc\nd\nE", { ...DIFF_LIMITS, context: 1 })).toEqual({
      status: "ok", added: 2, removed: 2,
      rows: [
        { kind: "del", text: "a" }, { kind: "add", text: "A" }, { kind: "same", text: "b" },
        { kind: "same", text: "c" },
        { kind: "same", text: "d" }, { kind: "del", text: "e" }, { kind: "add", text: "E" },
      ],
    });
  });

  test("interleaved changes keep the lines both sides share", () => {
    const result = diffLines("a\nb\nc\nd", "a\nc\nd\ne");
    expect(result).toEqual({
      status: "ok", added: 1, removed: 1,
      rows: [{ kind: "same", text: "a" }, { kind: "del", text: "b" }, { kind: "same", text: "c" }, { kind: "same", text: "d" }, { kind: "add", text: "e" }],
    });
  });

  test("a shared head and tail are trimmed before the bounded table", () => {
    const before = lines(5000).join("\n");
    const after = lines(5000).map((line, index) => (index === 2500 ? "edited" : line)).join("\n");
    const result = diffLines(before, after, { ...DIFF_LIMITS, maxCells: 16 });
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect([result.added, result.removed]).toEqual([1, 1]);
  });

  test("falls back to too-large past the line or cell budget", () => {
    expect(diffLines(lines(11).join("\n"), "x", { ...DIFF_LIMITS, maxLines: 10 })).toEqual({ status: "too-large" });
    expect(diffLines(lines(40, "a").join("\n"), lines(40, "b").join("\n"), { ...DIFF_LIMITS, maxCells: 1000 })).toEqual({ status: "too-large" });
  });
});
