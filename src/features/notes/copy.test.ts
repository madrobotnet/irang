import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { NOTES_COPY } from "./copy";

const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

/** Every rendered leaf by path; message functions are called with sample arguments 0, 1 and 2. */
function leaves(tree: object, path = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return [[at, value]];
    if (typeof value === "function") {
      const render = value as (...args: number[]) => string;
      return [0, 1, 2].map((sample): [string, string] => [`${at}(${sample})`, render(...Array.from({ length: render.length }, () => sample))]);
    }
    return leaves(value as object, at);
  });
}

describe("NOTES_COPY", () => {
  test("Korean and English have the same keys and message signatures", () => {
    expect(copyParityIssues(NOTES_COPY)).toEqual([]);
  });

  test("English copy contains no Hangul", () => {
    expect(leaves(NOTES_COPY.en).filter(([, text]) => HANGUL.test(text)).map(([at]) => at)).toEqual([]);
  });

  test("CodeMirror phrase keys are CodeMirror's English source phrases", () => {
    // CodeMirror looks phrases up by their English text, so English maps every key to itself.
    for (const [phrase, text] of Object.entries(NOTES_COPY.en.editor.phrases)) expect(text).toBe(phrase);
  });
});
