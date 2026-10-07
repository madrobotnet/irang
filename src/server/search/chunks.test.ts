import { describe, expect, test } from "bun:test";
import { chunkMarkdown, PASSAGE_BYTE_LIMIT } from "./chunks";

describe("passage chunking", () => {
  test("preserves duplicate heading locations and ignores headings inside fences", () => {
    const chunks = chunkMarkdown("# 반복\n첫 내용\n\n# 반복\n```md\n# 코드\n```\n다른 내용");
    expect(chunks.map((chunk) => chunk.heading)).toEqual(["반복", "반복"]);
    expect(chunks.map((chunk) => chunk.startLine)).toEqual([1, 4]);
    expect(chunks[1]?.content).toContain("# 코드");
  });
  test("bounds long Korean paragraphs and code without losing text", () => {
    const body = "가나다".repeat(4000);
    const chunks = chunkMarkdown(body);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk.content) <= PASSAGE_BYTE_LIMIT)).toBe(true);
    expect(chunks.map((chunk) => chunk.content).join("")).toBe(body);
  });
  test("empty notes have no body passages", () => {
    expect(chunkMarkdown(" \n\n")).toEqual([]);
  });
  test("keeps heading and section body together across a blank separator", () => {
    const chunks = chunkMarkdown("# Structural title\n\n## Evidence\n\nA supporting paragraph.\n");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ heading: "Evidence", startLine: 3 });
    expect(chunks[0]?.content).toContain("A supporting paragraph.");
    expect(chunkMarkdown("# Heading only\n")[0]?.content).toBe("# Heading only");
  });
  test("keeps heading context when a huge fenced code block spans passages", () => {
    const chunks = chunkMarkdown("## Real heading\n```\n# Not a heading\n" + "x".repeat(9000) + "\n```");
    expect(chunks.length).toBeGreaterThan(4);
    expect(chunks.every((chunk) => chunk.heading === "Real heading")).toBe(true);
    expect(chunks.every((chunk) => Buffer.byteLength(chunk.content) <= PASSAGE_BYTE_LIMIT)).toBe(true);
    expect(chunks.slice(1, -1).every((chunk) => chunk.startLine === 4 && chunk.endLine === 4)).toBe(true);
  });
});
