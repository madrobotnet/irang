import { describe, expect, test } from "bun:test";
import { copyParityIssues } from "@/lib/i18n/copy";
import { LOCALES } from "@/lib/i18n/locale";
import { hangulLeaks } from "@/features/setup/test-locale";
import { formatRemaining, LOGIN_COPY, splitRemaining } from "./login-copy";

describe("splitRemaining", () => {
  test("rounds up to whole seconds, splits minutes and never goes negative", () => {
    expect(splitRemaining(0)).toEqual({ minutes: 0, seconds: 0 });
    expect(splitRemaining(0.2)).toEqual({ minutes: 0, seconds: 1 });
    expect(splitRemaining(45)).toEqual({ minutes: 0, seconds: 45 });
    expect(splitRemaining(60)).toEqual({ minutes: 1, seconds: 0 });
    expect(splitRemaining(65)).toEqual({ minutes: 1, seconds: 5 });
    expect(splitRemaining(-3)).toEqual({ minutes: 0, seconds: 0 });
  });
});

describe("login copy", () => {
  test("has key parity and an English side without Hangul", () => {
    expect(copyParityIssues(LOGIN_COPY)).toEqual([]);
    expect(hangulLeaks(LOGIN_COPY.en)).toEqual([]);
  });

  test("the remaining time is each locale's own duration of the split value", () => {
    for (const locale of LOCALES) {
      expect(formatRemaining(65, locale)).toBe(LOGIN_COPY[locale].duration(1, 5));
    }
    expect(formatRemaining(65, "en")).not.toBe(formatRemaining(65, "ko"));
  });
});
