import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { TASKS_COPY } from "./tasks-copy";

describe("tasks copy", () => {
  test("has key parity", () => {
    expect(copyParityIssues(TASKS_COPY)).toEqual([]);
  });

  test("interpolated counts keep their values in every locale", () => {
    for (const locale of LOCALES) {
      expect(TASKS_COPY[locale].summary(12, 3)).toContain("12");
      expect(TASKS_COPY[locale].summary(12, 3)).toContain("3");
      expect(TASKS_COPY[locale].groupCount(4, 9)).toContain("4");
      expect(TASKS_COPY[locale].groupCount(4, 9)).toContain("9");
    }
  });
});
