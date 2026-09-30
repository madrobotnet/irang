import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { BOUNDARY_COPY, everyLocale, keywordsInEveryLocale, SHELL_COPY } from "./copy";
import { NAV_ITEMS } from "./nav";

describe("shell copy", () => {
  test("shell and boundary catalogs have key parity", () => {
    expect(copyParityIssues(SHELL_COPY)).toEqual([]);
    expect(copyParityIssues(BOUNDARY_COPY)).toEqual([]);
  });

  test("every rail item has a label in every locale", () => {
    for (const locale of LOCALES) {
      for (const item of NAV_ITEMS) expect(SHELL_COPY[locale].nav[item.id].trim()).not.toBe("");
    }
  });

  test("interpolated entries keep their values in every locale", () => {
    for (const locale of LOCALES) {
      expect(SHELL_COPY[locale].rail.pending(7)).toContain("7");
      expect(SHELL_COPY[locale].rail.pending(1)).toContain("1");
      expect(SHELL_COPY[locale].theme.value("value-marker")).toContain("value-marker");
      expect(BOUNDARY_COPY[locale].error.reference("digest-marker")).toContain("digest-marker");
    }
  });

  test("locale-neutral helpers carry every locale's entry", () => {
    expect(everyLocale((copy) => copy.nav.inbox)).toEqual({ ko: SHELL_COPY.ko.nav.inbox, en: SHELL_COPY.en.nav.inbox });
    expect(keywordsInEveryLocale((copy) => copy.nav.home, (copy) => copy.actions.capture)).toEqual(
      LOCALES.flatMap((locale) => [SHELL_COPY[locale].nav.home, SHELL_COPY[locale].actions.capture]),
    );
  });
});
