import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { TEMPLATE_VARIABLES } from "@/lib/templates";
import { SETTINGS_COPY } from "./settings-copy";

describe("settings copy", () => {
  test("has key parity", () => {
    expect(copyParityIssues(SETTINGS_COPY)).toEqual([]);
  });

  test("template help names every placeholder verbatim, and interpolations keep their values", () => {
    for (const locale of LOCALES) {
      const copy = SETTINGS_COPY[locale].templates;
      for (const name of TEMPLATE_VARIABLES) expect(copy.help).toContain(`{{${name}}}`);
      expect(copy.nameTooLong(100)).toContain("100");
      expect(copy.deleteTitle("name-marker")).toContain("name-marker");
    }
  });
});
