import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LINKS_COPY } from "./links-copy";

const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

function leaves(tree: object, path = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return [[at, value]];
    if (typeof value === "function") {
      const render = value as (...args: string[]) => string;
      return [[at, render(...Array.from({ length: render.length }, () => "Sample"))]];
    }
    return leaves(value as object, at);
  });
}

describe("LINKS_COPY", () => {
  test("Korean and English have the same keys and message signatures", () => {
    expect(copyParityIssues(LINKS_COPY)).toEqual([]);
  });

  test("English copy contains no Hangul", () => {
    expect(leaves(LINKS_COPY.en).filter(([, text]) => HANGUL.test(text)).map(([at]) => at)).toEqual([]);
  });

  test("messages carry the note title they are about", () => {
    for (const locale of ["ko", "en"] as const) {
      const { mentions, completion } = LINKS_COPY[locale];
      for (const render of [mentions.linkLabel, mentions.linked, mentions.gone, mentions.stale, completion.create, completion.createFailed]) {
        expect(render("바질 노트")).toContain("바질 노트");
      }
    }
  });

  test("a link button's accessible name contains its visible label", () => {
    for (const locale of ["ko", "en"] as const) {
      const { mentions } = LINKS_COPY[locale];
      expect(mentions.linkLabel("Basil")).toContain(mentions.link);
    }
  });
});
