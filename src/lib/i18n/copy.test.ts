import { describe, expect, test } from "bun:test";
import { copyParityIssues, defineCopy, type AnyCopyCatalog } from "./copy";

const SAMPLE = defineCopy({
  ko: {
    save: "저장",
    remaining: (count: number) => `${count}개 남음`,
    form: { title: "제목", error: (field: string, max: number) => `${field}: 최대 ${max}자` },
  },
  en: {
    save: "Save",
    remaining: (count) => `${count} left`,
    form: { title: "Title", error: (field, max) => `${field}: up to ${max} characters` },
  },
});

/** Simulates a catalog that escaped the type checker (JSON import, `as` cast). */
const unchecked = (catalog: { ko: unknown; en: unknown }) => catalog as unknown as AnyCopyCatalog;

describe("defineCopy", () => {
  test("returns the catalog unchanged, indexed by locale", () => {
    expect(defineCopy(SAMPLE)).toBe(SAMPLE);
    expect(SAMPLE.ko.remaining(2)).toContain("2");
    expect(SAMPLE.en.form.error("Name", 40)).toContain("40");
    expect(copyParityIssues(SAMPLE)).toEqual([]);
  });

  // Negative type contracts are asserted by tsc (unused expected diagnostics fail compilation).
  {
    // The calls below never run; no runtime pass is claimed for a compiler check.
    const typeChecks = () => [
      // @ts-expect-error missing key in en
      defineCopy({ ko: { a: "가", b: "나" }, en: { a: "A" } }),
      // @ts-expect-error extra key in en
      defineCopy({ ko: { a: "가" }, en: { a: "A", b: "B" } }),
      // @ts-expect-error string where the source has a function
      defineCopy({ ko: { n: (count: number) => `${count}` }, en: { n: "n" } }),
      // @ts-expect-error changed parameter type
      defineCopy({ ko: { n: (count: number) => `${count}` }, en: { n: (count: string) => count } }),
      // @ts-expect-error missing nested key
      defineCopy({ ko: { group: { a: "가", b: "나" } }, en: { group: { a: "A" } } }),
    ];
    void typeChecks;
  }
});

describe("copyParityIssues", () => {
  test("reports missing, unexpected and empty entries with their paths", () => {
    const catalog = unchecked({
      ko: { a: "가", b: "나", group: { c: "다" } },
      en: { a: "A", extra: "X", group: { c: " ", d: "D" } },
    });
    expect(copyParityIssues(catalog).sort()).toEqual(
      ["en.b: missing", "en.extra: unexpected", "en.group.c: empty", "en.group.d: unexpected"].sort(),
    );
  });

  test("reports kind and arity mismatches", () => {
    const catalog = unchecked({
      ko: { label: "라벨", count: (n: number) => `${n}`, pair: (a: string, b: string) => a + b, group: { x: "엑스" } },
      en: { label: () => "Label", count: "count", pair: (a: string) => a, group: "flat" },
    });
    expect(copyParityIssues(catalog).sort()).toEqual(
      ["en.count: expected function", "en.group: expected object", "en.label: expected string", "en.pair: expected 2 parameter(s)"].sort(),
    );
  });

  test("checks the Korean source for empty strings and unsupported values", () => {
    const catalog = unchecked({ ko: { a: "", list: ["하나"] }, en: { a: "A", list: ["one"] } });
    expect(copyParityIssues(catalog).sort()).toEqual(["en.list: expected object", "ko.a: empty", "ko.list: expected object"].sort());
  });

  test("a missing locale is one issue, not a crash", () => {
    expect(copyParityIssues(unchecked({ ko: { a: "가" }, en: undefined }))).toEqual(["en: expected object"]);
  });
});
