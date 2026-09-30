import { describe, expect, test } from "bun:test";
import { linkFirstMention } from "./link-mention";

const basil = { title: "바질", aliases: [] };

describe("linkFirstMention", () => {
  test("links only the noun when a Korean particle follows it", () => {
    expect(linkFirstMention("오늘 바질은 잘 자랐다.", basil)).toBe("오늘 [[바질]]은 잘 자랐다.");
  });

  test("links only the first plain occurrence", () => {
    expect(linkFirstMention("바질 향, 바질 잎", basil)).toBe("[[바질]] 향, 바질 잎");
  });

  test("matches case-insensitively and keeps the original spelling as the label", () => {
    expect(linkFirstMention("I love basil pesto.", { title: "Basil", aliases: [] }))
      .toBe("I love [[Basil|basil]] pesto.");
  });

  test("links an alias mention to the canonical title", () => {
    expect(linkFirstMention("Fresh BASIL today", { title: "바질", aliases: ["Basil"] }))
      .toBe("Fresh [[바질|BASIL]] today");
  });

  test("prefers the earliest mention across the title and aliases", () => {
    expect(linkFirstMention("Basil first, 바질 later", { title: "바질", aliases: ["Basil"] }))
      .toBe("[[바질|Basil]] first, 바질 later");
  });

  test("prefers the longest name when several start at the same position", () => {
    expect(linkFirstMention("바질 페스토 만들기", { title: "바질", aliases: ["바질 페스토"] }))
      .toBe("[[바질|바질 페스토]] 만들기");
  });

  test("does not split Latin words but allows Latin names before Hangul particles", () => {
    expect(linkFirstMention("A basilica and basil's smell", { title: "basil", aliases: [] }))
      .toBe("A basilica and [[basil]]'s smell");
    expect(linkFirstMention("AI는 도구다", { title: "AI", aliases: [] })).toBe("[[AI]]는 도구다");
  });

  test("a shorter run inside a longer fence does not close it", () => {
    expect(linkFirstMention("````md\n```\n바질\n````\n바질", basil)).toBe("````md\n```\n바질\n````\n[[바질]]");
    expect(linkFirstMention("~~~~\n~~~\n바질\n~~~~\n바질", basil)).toBe("~~~~\n~~~\n바질\n~~~~\n[[바질]]");
    expect(linkFirstMention("````\n```\n바질", basil)).toBeNull();
  });

  test("only a line holding just the fence closes it", () => {
    expect(linkFirstMention('````\nconst x = "````";\n바질\n````\n바질', basil)).toBe('````\nconst x = "````";\n바질\n````\n[[바질]]');
    expect(linkFirstMention("```\n    ```\n바질\n```\n바질", basil)).toBe("```\n    ```\n바질\n```\n[[바질]]");
    expect(linkFirstMention("- 목록\n  ```\n  바질\n  ```\n> ~~~\n> 바질\n> ~~~\n바질", basil)).toBe("- 목록\n  ```\n  바질\n  ```\n> ~~~\n> 바질\n> ~~~\n[[바질]]");
  });

  test("a code span may continue onto the next line but not past a blank line", () => {
    expect(linkFirstMention("보기 ```\n바질\n이어서 ``` 끝 바질", basil)).toBe("보기 ```\n바질\n이어서 ``` 끝 [[바질]]");
    expect(linkFirstMention("`열림\n\n바질", basil)).toBe("`열림\n\n[[바질]]");
    expect(linkFirstMention("`a``b` 바질", basil)).toBe("`a``b` [[바질]]");
  });

  test("skips fenced code, inline code, and existing wikilinks", () => {
    const body = "```\n바질\n```\n`바질` [[바질]] [[허브|바질]] 바질";
    expect(linkFirstMention(body, basil)).toBe("```\n바질\n```\n`바질` [[바질]] [[허브|바질]] [[바질]]");
  });

  test("skips markdown link text, link URLs, bare URLs, tags, and HTML comments", () => {
    const body = "[바질 레시피](https://x.test/바질) https://x.test/basil #바질 <!-- 바질 --> 바질";
    expect(linkFirstMention(body, basil)).toBe(
      "[바질 레시피](https://x.test/바질) https://x.test/basil #바질 <!-- 바질 --> [[바질]]",
    );
  });

  test("returns null when every mention is protected or absent", () => {
    expect(linkFirstMention("`바질` and [[바질]]", basil)).toBeNull();
    expect(linkFirstMention("토마토만 있다", basil)).toBeNull();
  });

  test("uses a link-safe alias as the target when the title cannot be a wikilink target", () => {
    expect(linkFirstMention("I write C# notes daily", { title: "C# notes", aliases: ["csharp"] }))
      .toBe("I write [[csharp|C# notes]] daily");
  });
});
