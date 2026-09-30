import { describe, expect, test } from "bun:test";
import { copyParityIssues, type AnyCopyCatalog } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { DAILY_COPY, PREVIEW_TASK_COPY } from "./daily-copy";

const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;
type Leaf = string | ((...args: never[]) => string);

/** Every rendered leaf by path; message functions get sample arguments of each parameter kind. */
function leaves(tree: object, path = ""): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]: [string, Leaf | object]): [string, string][] => {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === "string") return [[at, value]];
    if (typeof value === "function") {
      const render = value as (...args: unknown[]) => string;
      return [[`${at}(a)`, render(...Array.from({ length: render.length }, () => 1))], [`${at}(b)`, render(...Array.from({ length: render.length }, () => true))]];
    }
    return leaves(value, at);
  });
}

describe.each([["DAILY_COPY", DAILY_COPY], ["PREVIEW_TASK_COPY", PREVIEW_TASK_COPY]] as [string, AnyCopyCatalog][])("%s", (_, catalog) => {
  test("Korean and English have the same keys and message signatures", () => {
    expect(copyParityIssues(catalog)).toEqual([]);
  });

  test("English copy contains no Hangul", () => {
    expect(leaves(catalog.en).filter(([, text]) => HANGUL.test(text)).map(([at]) => at)).toEqual([]);
  });
});

test("every locale names all seven weekdays and twelve months", () => {
  for (const locale of LOCALES) {
    const calendar = DAILY_COPY[locale].calendar;
    const weekdays = [0, 1, 2, 3, 4, 5, 6].map((index) => [calendar.weekday(index), calendar.weekdayLong(index)]);
    expect(new Set(weekdays.map(([short]) => short)).size).toBe(7);
    expect(new Set(weekdays.map(([, long]) => long)).size).toBe(7);
    expect(weekdays.flat().every((label) => label.length > 0)).toBe(true);
    const months = Array.from({ length: 12 }, (_, index) => calendar.month(2026, index + 1));
    expect(new Set(months).size).toBe(12);
    expect(months.every((label) => label.includes("2026"))).toBe(true);
  }
});
