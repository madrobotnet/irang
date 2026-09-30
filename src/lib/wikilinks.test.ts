import { describe, expect, test } from "bun:test";
import { excerpt, linkTargets, mergeTags, parseInlineTags, parseWikiLinks, renameWikiLinks } from "./wikilinks";

describe("wikilinks", () => {
  test("parses target, heading, label and ignores code", () => {
    const body = "see [[Alpha]] and [[Beta#Intro|the beta]]\n`[[NotALink]]`\n```\n[[Nope]]\n```";
    const links = parseWikiLinks(body);
    expect(links.map((l) => [l.target, l.heading, l.label])).toEqual([
      ["Alpha", null, null],
      ["Beta", "Intro", "the beta"],
    ]);
  });

  test("dedupes targets case-insensitively", () => {
    expect(linkTargets("[[Alpha]] [[alpha]] [[ Gamma ]]")).toEqual(["Alpha", "Gamma"]);
  });

  test("extracts hangul tags, skips headings, numbers and code", () => {
    expect(parseInlineTags("# 제목\n#독서 #PKM/도구 issue #12 `#code`")).toEqual(["독서", "pkm/도구"]);
    expect(mergeTags(["B", "a"], ["b"])).toEqual(["a", "b"]);
  });

  test("renames references preserving heading and label", () => {
    expect(renameWikiLinks("[[old]] x [[Old#h|lbl]] [[other]]", "OLD", "New")).toBe("[[New]] x [[New#h|lbl]] [[other]]");
  });

  test("excerpt strips markdown", () => {
    expect(excerpt("# Head\n**bold** [[T|label]] [x](http://a)")).toBe("Head bold label x");
  });

  test("excerpt removes task-list syntax without stripping literal brackets", () => {
    expect(excerpt("- [x] Done\n* [ ] Open\n+ [X] More\n\nA literal [x] stays."))
      .toBe("Done Open More A literal [x] stays.");
  });
});
