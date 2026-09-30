import { describe, expect, test } from "bun:test";
import { attachmentMarkdownAt, expandWikiLinks, wikiTitleFromHref } from "./markdown";

describe("attachment insertion", () => {
  const link = "[file](/api/attachments/fixture-id)";

  test.each(["# Heading", "- Item", "> Quote", "```text\ncode\n```"])("keeps an existing line-start block after the attachment: %s", (document) => {
    const insert = attachmentMarkdownAt(document, 0, link);
    expect(insert + document).toBe(`${link}\n\n${document}`);
  });

  test("separates an attachment before a later heading", () => {
    const document = "Intro\n\n## Heading";
    const position = document.indexOf("##");
    expect(attachmentMarkdownAt(document, position, link)).toBe(`${link}\n\n`);
  });

  test("keeps inline, empty-document and end-of-document insertion unchanged", () => {
    expect(attachmentMarkdownAt("Read here.", 5, link)).toBe(link);
    expect(attachmentMarkdownAt("", 0, link)).toBe(link);
    expect(attachmentMarkdownAt("Read\n", 5, link)).toBe(link);
  });
});

describe("expandWikiLinks", () => {
  test("preserves display labels and encodes targets", () => {
    expect(expandWikiLinks("[[대상 노트|표시 이름]]")).toBe("[표시 이름](/notes/by-title?title=%EB%8C%80%EC%83%81%20%EB%85%B8%ED%8A%B8)");
  });

  test("does not turn wikilinks in code into active links", () => {
    expect(expandWikiLinks("`[[비밀]]`\n\n[[공개]]")).toBe("`[[비밀]]`\n\n[공개](/notes/by-title?title=%EA%B3%B5%EA%B0%9C)");
  });
});

test("parses wiki query values without crashing on incomplete UTF-8", () => {
  expect(wikiTitleFromHref("/notes/by-title?title=%E0")).toBe("\uFFFD");
  expect(wikiTitleFromHref("/notes/by-title?title=QA%20Target&other=value#heading")).toBe("QA Target");
  expect(wikiTitleFromHref("/notes/abc")).toBeNull();
});
