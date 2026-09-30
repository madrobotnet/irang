import { describe, expect, test } from "bun:test";
import { copyParityIssues, type AnyCopyCatalog } from "@/lib/i18n/copy";
import { SETTINGS_COPY } from "@/features/settings/settings-copy";
import { AI_COPY } from "./ai-copy";
import { CONNECT_COPY } from "./connect-copy";
import { SETUP_COPY } from "./setup-copy";
import { hangulLeaks } from "./test-locale";

const CATALOGS: readonly (readonly [string, AnyCopyCatalog])[] = [
  ["SETUP_COPY", SETUP_COPY],
  ["CONNECT_COPY", CONNECT_COPY],
  ["AI_COPY", AI_COPY],
  ["SETTINGS_COPY", SETTINGS_COPY],
];

describe.each(CATALOGS)("%s", (_name, catalog) => {
  test("Korean and English have the same keys and argument counts", () => {
    expect(copyParityIssues(catalog)).toEqual([]);
  });

  test("the English side contains no Hangul", () => {
    expect(hangulLeaks(catalog.en)).toEqual([]);
    // Guards the checker itself: the Korean side must register as Hangul.
    expect(hangulLeaks(catalog.ko).length).toBeGreaterThan(0);
  });
});
